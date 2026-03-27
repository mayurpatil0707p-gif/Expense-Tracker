const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const JWT_SECRET = 'smartfinance_secret_key_2024';
const PORT = 5000;

// ============ EMAIL CONFIGURATION ============
const EMAIL_USER = 'mayurpatil0707p@gmail.com';
const EMAIL_PASS = 'bvovxhoxgetgdqaz';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

transporter.verify((error, success) => {
    if (error) console.log('❌ Email error:', error);
    else console.log('✅ Email service ready!');
});

// ============ FILE STORAGE ============
const USERS_FILE = path.join(__dirname, 'users.json');
const TRANSACTIONS_FILE = path.join(__dirname, 'transactions.json');
const RECURRING_FILE = path.join(__dirname, 'recurring.json');

// Initialize files if they don't exist
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
if (!fs.existsSync(TRANSACTIONS_FILE)) fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify([]));
if (!fs.existsSync(RECURRING_FILE)) fs.writeFileSync(RECURRING_FILE, JSON.stringify([]));

// Helper functions
function readUsers() { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
function writeUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }
function readTransactions() { return JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8')); }
function writeTransactions(transactions) { fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2)); }
function readRecurring() { return JSON.parse(fs.readFileSync(RECURRING_FILE, 'utf8')); }
function writeRecurring(recurring) { fs.writeFileSync(RECURRING_FILE, JSON.stringify(recurring, null, 2)); }

// ============ FILE UPLOAD ============
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ============ HELPER FUNCTIONS ============
function getPeriodMs(period) {
    switch(period) {
        case 'daily': return 24 * 60 * 60 * 1000;
        case 'weekly': return 7 * 24 * 60 * 60 * 1000;
        case 'monthly': return 30 * 24 * 60 * 60 * 1000;
        case 'yearly': return 365 * 24 * 60 * 60 * 1000;
        default: return 30 * 24 * 60 * 60 * 1000;
    }
}

// ============ AUTH MIDDLEWARE ============
function auth(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Access denied' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
}

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        const users = readUsers();
        
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = {
            id: Date.now().toString(),
            name,
            email,
            phone: phone || '',
            password: hashedPassword,
            createdAt: new Date().toISOString(),
            profilePic: '',
            resetToken: null,
            resetTokenExpiry: null
        };
        
        users.push(user);
        writeUsers(users);
        
        const token = jwt.sign({ userId: user.id }, JWT_SECRET);
        
        res.json({
            message: 'User created successfully',
            token,
            user: { id: user.id, name: user.name, email: user.email, phone: user.phone, profilePic: user.profilePic }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = readUsers();
        const user = users.find(u => u.email === email);
        
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });
        
        const token = jwt.sign({ userId: user.id }, JWT_SECRET);
        
        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, name: user.name, email: user.email, phone: user.phone || '', profilePic: user.profilePic || '' }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ FORGOT PASSWORD ============

// Send Reset Link
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        console.log('📧 Forgot password request for:', email);
        
        const users = readUsers();
        const user = users.find(u => u.email === email);
        
        if (!user) {
            return res.status(404).json({ error: 'Email not found' });
        }
        
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // 1 hour
        
        user.resetToken = resetToken;
        user.resetTokenExpiry = resetTokenExpiry;
        writeUsers(users);
        
        // Create reset link
        const resetLink = `http://localhost:5500/reset-password.html?token=${resetToken}`;
        
        console.log('🔗 Reset link generated:', resetLink);
        
        // Email HTML
        const emailHTML = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: auto; background: white; border-radius: 20px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center;">
                    <h1>💰 SmartFinance</h1>
                    <p>Password Reset Request</p>
                </div>
                <div style="padding: 30px;">
                    <p>Hello <strong>${user.name}</strong>,</p>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px;">Reset Password</a>
                    </div>
                    <p>If you didn't request this, please ignore this email.</p>
                    <p>This link will expire in <strong>1 hour</strong>.</p>
                </div>
                <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>SmartFinance Tracker - Track. Save. Grow.</p>
                </div>
            </div>
        `;
        
        await transporter.sendMail({
            from: `"SmartFinance Tracker" <${EMAIL_USER}>`,
            to: email,
            subject: '🔐 Reset Your SmartFinance Password',
            html: emailHTML
        });
        
        console.log('✅ Email sent successfully to:', email);
        res.json({ message: 'Password reset link sent to your email! Check your inbox/spam folder.' });
        
    } catch (error) {
        console.error('❌ Forgot password error:', error);
        res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
    }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        console.log('🔐 Reset password request with token:', token);
        
        const users = readUsers();
        const user = users.find(u => u.resetToken === token && u.resetTokenExpiry > Date.now());
        
        if (!user) {
            console.log('❌ Invalid or expired token');
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetToken = null;
        user.resetTokenExpiry = null;
        writeUsers(users);
        
        console.log('✅ Password reset successful for:', user.email);
        
        res.json({ message: 'Password reset successful! You can now login with your new password.' });
    } catch (error) {
        console.error('❌ Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// ============ PROFILE ROUTES ============

// Upload Profile Picture
app.post('/api/profile/upload-pic', auth, upload.single('profilePic'), (req, res) => {
    try {
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === req.userId);
        if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
        
        const profilePicUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
        users[userIndex].profilePic = profilePicUrl;
        writeUsers(users);
        res.json({ profilePic: profilePicUrl });
    } catch (error) {
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Update Name
app.put('/api/profile/update-name', auth, (req, res) => {
    try {
        const { name } = req.body;
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === req.userId);
        if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
        
        users[userIndex].name = name;
        writeUsers(users);
        res.json({ name });
    } catch (error) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// ============ TRANSACTION ROUTES ============

// Get all transactions
app.get('/api/transactions', auth, (req, res) => {
    const transactions = readTransactions();
    const userTransactions = transactions.filter(t => t.userId === req.userId);
    res.json(userTransactions.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// Add transaction
app.post('/api/transactions', auth, (req, res) => {
    try {
        const { amount, type, category, description, date, notes, isRecurring, recurringPeriod } = req.body;
        const transactions = readTransactions();
        
        const transaction = {
            id: Date.now().toString(),
            userId: req.userId,
            amount: parseFloat(amount),
            type,
            category,
            description,
            notes: notes || '',
            date: date || new Date().toISOString(),
            isRecurring: isRecurring || false,
            recurringPeriod: recurringPeriod || null,
            createdAt: new Date().toISOString()
        };
        
        transactions.push(transaction);
        writeTransactions(transactions);
        
        // Handle recurring transactions
        if (isRecurring && recurringPeriod) {
            const recurring = readRecurring();
            recurring.push({
                id: transaction.id,
                userId: req.userId,
                amount: parseFloat(amount),
                type,
                category,
                description,
                notes: notes || '',
                period: recurringPeriod,
                lastAdded: new Date().toISOString(),
                nextDue: new Date(Date.now() + getPeriodMs(recurringPeriod)).toISOString(),
                isActive: true
            });
            writeRecurring(recurring);
        }
        
        res.status(201).json(transaction);
    } catch (error) {
        console.error('Add transaction error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Edit transaction
app.put('/api/transactions/:id', auth, (req, res) => {
    try {
        const { amount, type, category, description, date, notes } = req.body;
        const transactions = readTransactions();
        const index = transactions.findIndex(t => t.id === req.params.id && t.userId === req.userId);
        
        if (index === -1) return res.status(404).json({ error: 'Transaction not found' });
        
        transactions[index] = {
            ...transactions[index],
            amount: parseFloat(amount),
            type,
            category,
            description,
            notes: notes || '',
            date: date || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        writeTransactions(transactions);
        res.json(transactions[index]);
    } catch (error) {
        res.status(500).json({ error: 'Edit error' });
    }
});

// Delete transaction
app.delete('/api/transactions/:id', auth, (req, res) => {
    const transactions = readTransactions();
    const index = transactions.findIndex(t => t.id === req.params.id && t.userId === req.userId);
    
    if (index === -1) return res.status(404).json({ error: 'Transaction not found' });
    
    transactions.splice(index, 1);
    writeTransactions(transactions);
    
    // Also remove from recurring if exists
    let recurring = readRecurring();
    recurring = recurring.filter(r => r.id !== req.params.id);
    writeRecurring(recurring);
    
    res.json({ message: 'Transaction deleted' });
});

// ============ RECURRING TRANSACTIONS ROUTES ============

// Get all recurring transactions
app.get('/api/recurring', auth, (req, res) => {
    const recurring = readRecurring();
    res.json(recurring.filter(r => r.userId === req.userId && r.isActive === true));
});

// Cancel recurring transaction
app.delete('/api/recurring/:id', auth, (req, res) => {
    let recurring = readRecurring();
    const index = recurring.findIndex(r => r.id === req.params.id && r.userId === req.userId);
    
    if (index === -1) return res.status(404).json({ error: 'Recurring not found' });
    
    recurring[index].isActive = false;
    writeRecurring(recurring);
    res.json({ message: 'Recurring transaction cancelled' });
});

// Manually add due recurring transactions
app.post('/api/recurring/add-due', auth, async (req, res) => {
    try {
        const recurring = readRecurring();
        const userRecurring = recurring.filter(r => r.userId === req.userId && r.isActive === true);
        const now = new Date();
        
        const dueRecurring = userRecurring.filter(r => new Date(r.nextDue) <= now);
        
        const added = [];
        const transactions = readTransactions();
        
        for (const rec of dueRecurring) {
            const newTransaction = {
                id: Date.now().toString(),
                userId: req.userId,
                amount: rec.amount,
                type: rec.type,
                category: rec.category,
                description: rec.description,
                notes: `${rec.notes || ''} (Auto-generated from recurring on ${new Date().toLocaleDateString()})`,
                date: now.toISOString(),
                isRecurring: true,
                recurringPeriod: rec.period,
                createdAt: new Date().toISOString()
            };
            
            transactions.push(newTransaction);
            
            // Update recurring record
            rec.lastAdded = now.toISOString();
            rec.nextDue = new Date(now.getTime() + getPeriodMs(rec.period)).toISOString();
            
            added.push(newTransaction);
        }
        
        writeTransactions(transactions);
        writeRecurring(recurring);
        
        res.json({ 
            message: `Added ${added.length} recurring transactions`, 
            added 
        });
    } catch (error) {
        console.error('Error adding recurring:', error);
        res.status(500).json({ error: 'Failed to add recurring transactions' });
    }
});

// ============ EMAIL REPORT ROUTE ============
app.post('/api/send-report', auth, async (req, res) => {
    try {
        const { userEmail, userName, totalBalance, totalIncome, totalExpense, incomeCount, expenseCount, transactions, startDate, endDate, currencySymbol } = req.body;
        
        let filteredTransactions = transactions;
        if (startDate) filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= new Date(startDate));
        if (endDate) filteredTransactions = filteredTransactions.filter(t => new Date(t.date) <= new Date(endDate));
        
        let transactionsHTML = '<table style="width:100%; border-collapse:collapse;">';
        transactionsHTML += '<thead><tr style="background:#f8f9fa;"><th style="padding:12px;">Date</th><th>Description</th><th>Category</th><th>Notes</th><th>Amount</th>    </tr></thead><tbody>';
        
        filteredTransactions.forEach(t => {
            const color = t.type === 'income' ? '#4caf50' : '#ff6b6b';
            const sign = t.type === 'income' ? '+' : '-';
            transactionsHTML += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px;">${new Date(t.date).toLocaleDateString()}</td>
                    <td style="padding:10px;">${t.description}</td>
                    <td style="padding:10px;">${t.category}</td>
                    <td style="padding:10px;">${t.notes || '-'}</td>
                    <td style="padding:10px; color:${color};">${sign}${currencySymbol}${t.amount}</td>
                </tr>
            `;
        });
        transactionsHTML += '</tbody></table>';
        
        const emailHTML = `
            <div style="font-family: 'Segoe UI'; max-width: 600px; margin: auto; background: white; border-radius: 20px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center;">
                    <h1>💰 SmartFinance Report</h1>
                    <p>${startDate ? `From ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}` : 'All Time'}</p>
                </div>
                <div style="padding: 30px;">
                    <p>Hello <strong>${userName}</strong>,</p>
                    <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 15px; text-align: center;">
                        <div>💰 TOTAL BALANCE</div>
                        <div style="font-size: 36px;">${currencySymbol}${totalBalance}</div>
                    </div>
                    <div style="display: flex; gap: 20px; margin: 20px 0;">
                        <div style="flex:1; background:#e8f5e9; padding:20px; border-radius:15px; text-align:center;">
                            <div>📈 INCOME</div>
                            <div style="font-size:28px; color:#4caf50;">${currencySymbol}${totalIncome}</div>
                            <div>${incomeCount} transactions</div>
                        </div>
                        <div style="flex:1; background:#ffebee; padding:20px; border-radius:15px; text-align:center;">
                            <div>📉 EXPENSE</div>
                            <div style="font-size:28px; color:#ff6b6b;">${currencySymbol}${totalExpense}</div>
                            <div>${expenseCount} transactions</div>
                        </div>
                    </div>
                    ${transactionsHTML}
                </div>
                <div style="background:#f8f9fa; padding:20px; text-align:center; font-size:12px;">
                    🚀 SmartFinance Tracker - Track. Save. Grow.
                </div>
            </div>
        `;
        
        await transporter.sendMail({
            from: `"SmartFinance" <${EMAIL_USER}>`,
            to: userEmail,
            subject: `📊 Financial Report - ${new Date().toLocaleDateString()}`,
            html: emailHTML
        });
        
        res.json({ success: true, message: 'Email sent!' });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// ============ TEST EMAIL ROUTE ============
app.get('/api/test-email', async (req, res) => {
    try {
        await transporter.sendMail({
            from: `"SmartFinance" <${EMAIL_USER}>`,
            to: EMAIL_USER,
            subject: 'Test Email',
            html: '<h1>✅ Test Email Successful!</h1><p>Your email is working!</p>'
        });
        res.json({ message: 'Test email sent!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Data saved in JSON files`);
    console.log(`📧 Email service ready!`);
    console.log(`🔄 Recurring transactions ready!`);
});