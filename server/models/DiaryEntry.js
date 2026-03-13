const mongoose = require('mongoose');

const diaryEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  mood: {
    type: String,
    enum: ['happy', 'sad', 'excited', 'calm', 'angry', 'anxious', 'grateful', 'neutral'],
    default: 'neutral'
  },
  images: [{
    url: String,
    publicId: String
  }],
  voiceNotes: [{
    url: String,
    publicId: String,
    duration: Number
  }],
  tags: [String],
  date: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on modification
diaryEntrySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DiaryEntry', diaryEntrySchema);