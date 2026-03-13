const express = require('express');
const router = express.Router();
const { uploadImage, uploadVoice } = require('../config/cloudinary');

// Upload image
router.post('/image', uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    res.json({
      url: req.file.path,
      public_id: req.file.filename,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Upload voice note
router.post('/voice', uploadVoice.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    res.json({
      url: req.file.path,
      public_id: req.file.filename,
      message: 'Voice note uploaded successfully'
    });
  } catch (error) {
    console.error('Voice upload error:', error);
    res.status(500).json({ error: 'Failed to upload voice note' });
  }
});

// Delete file
router.delete('/:public_id', async (req, res) => {
  try {
    const { public_id } = req.params;
    const { resource_type = 'image' } = req.query;
    
    const result = await cloudinary.uploader.destroy(public_id, {
      resource_type: resource_type
    });
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;