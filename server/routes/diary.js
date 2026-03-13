const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const DiaryEntry = require('../models/DiaryEntry');

// Get all entries for user
router.get('/', auth, async (req, res) => {
  try {
    const entries = await DiaryEntry.find({ user: req.user.id })
      .sort({ date: -1 });
    res.json(entries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get entry by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const entry = await DiaryEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    // Check ownership
    if (entry.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    res.json(entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new entry
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, mood, tags, images, voiceNotes } = req.body;
    
    const newEntry = new DiaryEntry({
      user: req.user.id,
      title,
      content,
      mood,
      tags: tags || [],
      images: images || [],
      voiceNotes: voiceNotes || []
    });
    
    const entry = await newEntry.save();
    res.json(entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update entry
router.put('/:id', auth, async (req, res) => {
  try {
    let entry = await DiaryEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    // Check ownership
    if (entry.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    const { title, content, mood, tags, images, voiceNotes } = req.body;
    
    entry.title = title || entry.title;
    entry.content = content || entry.content;
    entry.mood = mood || entry.mood;
    entry.tags = tags || entry.tags;
    entry.images = images || entry.images;
    entry.voiceNotes = voiceNotes || entry.voiceNotes;
    entry.updatedAt = Date.now();
    
    entry = await entry.save();
    res.json(entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete entry
router.delete('/:id', auth, async (req, res) => {
  try {
    const entry = await DiaryEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    // Check ownership
    if (entry.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    await entry.remove();
    res.json({ message: 'Entry removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search entries
router.get('/search/:query', auth, async (req, res) => {
  try {
    const entries = await DiaryEntry.find({
      user: req.user.id,
      $or: [
        { title: { $regex: req.params.query, $options: 'i' } },
        { content: { $regex: req.params.query, $options: 'i' } },
        { tags: { $in: [new RegExp(req.params.query, 'i')] } }
      ]
    }).sort({ date: -1 });
    
    res.json(entries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get entries by date
router.get('/date/:date', auth, async (req, res) => {
  try {
    const startDate = new Date(req.params.date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(req.params.date);
    endDate.setHours(23, 59, 59, 999);
    
    const entries = await DiaryEntry.find({
      user: req.user.id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 });
    
    res.json(entries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;