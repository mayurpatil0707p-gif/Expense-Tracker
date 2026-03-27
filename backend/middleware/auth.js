const jwt = require('jsonwebtoken');

// This function checks if user is logged in
module.exports = (req, res, next) => {
  try {
    // Get token from request headers
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId; // Add userId to request
    next(); // Continue to next function
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};