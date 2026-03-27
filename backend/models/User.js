const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define what a User looks like in the database
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true, // Name is mandatory
    trim: true // Remove extra spaces
  },
  email: {
    type: String,
    required: true,
    unique: true, // No two users can have same email
    lowercase: true // Convert email to lowercase
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now // Auto-set current date
  }
});

// Before saving a user, encrypt the password
userSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password')) return next();
  
  // Generate salt and hash password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to check if password is correct (for login)
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Create and export the User model
module.exports = mongoose.model('User', userSchema);