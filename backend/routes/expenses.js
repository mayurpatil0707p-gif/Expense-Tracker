const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');

// GET ALL EXPENSES - Get expenses for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.userId })
      .sort({ date: -1 }); // Sort by newest first
    res.json(expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADD EXPENSE - Create new expense
router.post('/', auth, async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;
    
    const expense = new Expense({
      userId: req.userId,
      amount,
      category,
      description,
      date: date || Date.now()
    });
    
    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE EXPENSE - Remove an expense
router.delete('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId // Ensure user owns this expense
    });
    
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;