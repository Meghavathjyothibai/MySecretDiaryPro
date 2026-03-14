require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://my-secret-diary-pro.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for local fallback)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('✅ Cloudinary configured with cloud_name:', process.env.CLOUDINARY_CLOUD_NAME);

// ================= MULTER CONFIG (Temporary storage) =================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/temp";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// MongoDB Connection
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in .env file');
      process.exit(1);
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

connectDB();

// Import models
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/auth');

// Use auth routes
app.use('/api/auth', authRoutes);

// ================= CLOUDINARY IMAGE UPLOAD =================
app.post('/api/upload/image', async (req, res) => {
  try {
    // Verify token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Use multer to handle the upload
    upload.single('image')(req, res, async function(err) {
      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      try {
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'diary-images',
          resource_type: 'image'
        });

        // Delete temporary file
        fs.unlinkSync(req.file.path);

        res.json({
          success: true,
          url: result.secure_url
        });
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        
        // Fallback to local storage if Cloudinary fails
        const localDir = "uploads/images";
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        
        const localPath = path.join(localDir, req.file.filename);
        fs.renameSync(req.file.path, localPath);
        
        const imageUrl = `/uploads/images/${req.file.filename}`;
        
        res.json({
          success: true,
          url: imageUrl,
          warning: 'Uploaded to local storage (Cloudinary failed)'
        });
      }
    });

  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

// ================= CLOUDINARY VOICE UPLOAD =================
app.post('/api/upload/voice', async (req, res) => {
  try {
    // Verify token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Use multer to handle the upload
    upload.single('voice')(req, res, async function(err) {
      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      try {
        // Upload to Cloudinary (voice notes are treated as video type)
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'voice-notes',
          resource_type: 'video', // Cloudinary uses 'video' for audio files
          format: 'webm'
        });

        // Delete temporary file
        fs.unlinkSync(req.file.path);

        res.json({
          success: true,
          url: result.secure_url
        });
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        
        // Fallback to local storage if Cloudinary fails
        const localDir = "uploads/voices";
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        
        const localPath = path.join(localDir, req.file.filename);
        fs.renameSync(req.file.path, localPath);
        
        const voiceUrl = `/uploads/voices/${req.file.filename}`;
        
        res.json({
          success: true,
          url: voiceUrl,
          warning: 'Uploaded to local storage (Cloudinary failed)'
        });
      }
    });

  } catch (error) {
    console.error('Voice upload error:', error);
    res.status(500).json({ error: 'Voice upload failed' });
  }
});

// Diary Entry Schema
const diaryEntrySchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  mood: { type: String, default: 'neutral' },
  tags: { type: [String], default: [] },
  images: { type: [String], default: [] },
  voiceNotes: { type: [String], default: [] },
  isLocked: { type: Boolean, default: false },
  password: { type: String, default: null },
  date: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

// Hash password before saving
diaryEntrySchema.pre('save', async function(next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

const DiaryEntry = mongoose.model('DiaryEntry', diaryEntrySchema);

// ============ DIARY ROUTES ============

// Middleware to verify token
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// GET all entries for a user
app.get('/api/diary', authMiddleware, async (req, res) => {
  try {
    const entries = await DiaryEntry.find({ user: req.userId }).sort({ date: -1 });
    const processedEntries = entries.map(entry => {
      const entryObj = entry.toObject();
      delete entryObj.password;
      
      if (entry.isLocked) {
        return {
          _id: entryObj._id,
          title: entryObj.title,
          isLocked: true,
          date: entryObj.date,
          mood: entryObj.mood,
          tags: []
        };
      }
      return entryObj;
    });
    res.json(processedEntries);
  } catch (error) {
    console.error('Error fetching diary entries:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single entry
app.get('/api/diary/:id', authMiddleware, async (req, res) => {
  try {
    const entry = await DiaryEntry.findOne({ 
      _id: req.params.id,
      user: req.userId 
    });
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    const entryObj = entry.toObject();
    delete entryObj.password;
    
    if (entry.isLocked) {
      return res.json({
        _id: entryObj._id,
        title: entryObj.title,
        isLocked: true,
        date: entryObj.date,
        mood: entryObj.mood
      });
    }
    
    res.json(entryObj);
  } catch (error) {
    console.error('Error fetching diary entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// CREATE new entry
app.post('/api/diary', authMiddleware, async (req, res) => {
  try {
    const { title, content, mood, tags, images, voiceNotes, isLocked, password } = req.body;
    
    const newEntry = new DiaryEntry({
      title,
      content,
      mood: mood || 'neutral',
      tags: tags || [],
      images: images || [],
      voiceNotes: voiceNotes || [],
      isLocked: isLocked || false,
      password: password || null,
      user: req.userId
    });
    
    const savedEntry = await newEntry.save();
    const entryObj = savedEntry.toObject();
    delete entryObj.password;
    
    res.status(201).json(entryObj);
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({ error: error.message });
  }
});

// UPDATE entry - FIXED: Allows editing locked entries with password
app.put('/api/diary/:id', authMiddleware, async (req, res) => {
  try {
    const { title, content, mood, tags, images, voiceNotes, password } = req.body;
    
    const entry = await DiaryEntry.findOne({ 
      _id: req.params.id,
      user: req.userId 
    });
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    // Check if entry is locked and handle password
    if (entry.isLocked) {
      // If no password provided, check if this is an unlock attempt
      if (!password) {
        return res.status(403).json({ error: 'Password required to edit locked entry' });
      }

      // Verify the password
      const isMatch = await bcrypt.compare(password, entry.password);
      
      if (!isMatch) {
        return res.status(401).json({ error: 'Wrong password' });
      }
      
      // If password is correct, we can edit but keep it locked
    }
    
    // Update entry
    entry.title = title;
    entry.content = content;
    entry.mood = mood;
    entry.tags = tags;
    entry.images = images;
    entry.voiceNotes = voiceNotes;
    
    const updatedEntry = await entry.save();
    const entryObj = updatedEntry.toObject();
    delete entryObj.password;
    
    res.json(entryObj);
  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE entry
app.delete('/api/diary/:id', authMiddleware, async (req, res) => {
  try {
    const deletedEntry = await DiaryEntry.findOneAndDelete({ 
      _id: req.params.id,
      user: req.userId 
    });
    
    if (!deletedEntry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ error: error.message });
  }
});

// LOCK entry
app.put('/api/diary/:id/lock', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    const entry = await DiaryEntry.findOne({ 
      _id: req.params.id,
      user: req.userId 
    });
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    entry.isLocked = true;
    entry.password = hashedPassword;
    await entry.save();
    
    res.json({ 
      success: true, 
      message: 'Entry locked successfully'
    });
  } catch (error) {
    console.error('Lock error:', error);
    res.status(500).json({ error: error.message });
  }
});

// UNLOCK entry
app.post('/api/diary/:id/unlock', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    const entry = await DiaryEntry.findOne({ 
      _id: req.params.id,
      user: req.userId 
    });
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    if (!entry.password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Entry is not locked' 
      });
    }
    
    const isMatch = await bcrypt.compare(password, entry.password);
    
    if (isMatch) {
      const entryObj = entry.toObject();
      delete entryObj.password;
      
      res.json({ 
        success: true, 
        message: 'Entry unlocked',
        entry: entryObj 
      });
    } else {
      res.status(401).json({ 
        success: false, 
        error: 'Wrong password' 
      });
    }
  } catch (error) {
    console.error('Unlock error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Server is running', 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    server: 'running',
    serverTime: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n✅ Server started on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📝 API Endpoints:`);
  console.log(`   - Auth: http://localhost:${PORT}/api/auth`);
  console.log(`   - Diary: http://localhost:${PORT}/api/diary`);
  console.log(`   - Upload: http://localhost:${PORT}/api/upload/image`);
  console.log(`   - Upload: http://localhost:${PORT}/api/upload/voice`);
  console.log(`☁️  Cloudinary configured for image/voice uploads`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    process.exit(1);
  }
});