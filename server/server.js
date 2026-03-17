// LOAD ENVIRONMENT VARIABLES - Smart loading (MUST BE FIRST!)
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Clear console for better visibility
console.clear();
console.log('🔍 Loading environment variables...\n');

// Check which env file exists and load it
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
  console.log('📁 Loading environment from .env.local');
  dotenv.config({ path: '.env.local' });
} else if (fs.existsSync(path.join(__dirname, '.env'))) {
  console.log('📁 Loading environment from .env');
  dotenv.config();
} else {
  console.log('⚠️ No .env or .env.local file found! Using process environment variables only.');
}

// Set consistent JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'my-secret-diary-pro-super-secret-key-2026';

// Verify EmailJS keys are loaded (DEBUGGING)
console.log('\n📧 EmailJS Configuration Status:');
console.log(`   - Service ID: ${process.env.EMAILJS_SERVICE_ID ? '✅ ' + process.env.EMAILJS_SERVICE_ID : '❌ Missing'}`);
console.log(`   - Template ID: ${process.env.EMAILJS_TEMPLATE_ID ? '✅ ' + process.env.EMAILJS_TEMPLATE_ID : '❌ Missing'}`);
console.log(`   - Public Key: ${process.env.EMAILJS_PUBLIC_KEY ? '✅ ' + process.env.EMAILJS_PUBLIC_KEY.substring(0, 10) + '...' : '❌ Missing'}`);
console.log(`   - Private Key: ${process.env.EMAILJS_PRIVATE_KEY ? '✅ Present' : '❌ Missing'}`);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');

const app = express();

// ===== CORS CONFIGURATION with your actual URLs =====
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://my-secret-diary-pro.vercel.app',           // Your Vercel frontend
  'https://mysecretdiarypro.onrender.com'             // Your Render backend
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log('❌ CORS blocked origin:', origin);
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
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

console.log('\n✅ Cloudinary configured with cloud_name:', process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET');

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

// MongoDB Connection with retry logic
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in environment variables');
      console.error('📌 Please check your .env.local or Render environment variables');
      process.exit(1);
    }

    console.log('📡 Connecting to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// Import models
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/auth');

// Use auth routes
app.use('/api/auth', authRoutes);

// ===== TEST ENV ROUTE =====
app.get('/api/test-env', (req, res) => {
  res.json({
    message: 'Environment variables status',
    using_file: fs.existsSync(path.join(__dirname, '.env.local')) 
      ? '.env.local' 
      : fs.existsSync(path.join(__dirname, '.env')) 
        ? '.env' 
        : 'No env file (using system env)',
    emailjs_service_id: process.env.EMAILJS_SERVICE_ID || '❌ Missing',
    emailjs_template_id: process.env.EMAILJS_TEMPLATE_ID || '❌ Missing',
    emailjs_public_key: process.env.EMAILJS_PUBLIC_KEY ? '✅ Set' : '❌ Missing',
    emailjs_private_key: process.env.EMAILJS_PRIVATE_KEY ? '✅ Set' : '❌ Missing',
    mongodb_uri: process.env.MONGODB_URI ? '✅ Set' : '❌ Missing',
    jwt_secret: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing (using default)',
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing',
    node_env: process.env.NODE_ENV || 'development'
  });
});

// ===== TEST EMAILJS ROUTE =====
app.get('/api/test-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required. Use ?email=your@email.com' 
      });
    }

    console.log('\n🧪 Testing EmailJS with email:', email);
    
    // Get environment variables
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    // Validate keys
    if (!serviceId || !templateId || !publicKey) {
      return res.status(500).json({
        success: false,
        message: 'EmailJS configuration missing',
        details: {
          serviceId: !!serviceId,
          templateId: !!templateId,
          publicKey: !!publicKey,
          privateKey: !!privateKey
        }
      });
    }

    // Using 'email' as the variable name (as per your template)
    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        email: email,
        name: 'Test User',
        otp: '123456',
        reply_to: 'noreply@mysecretdiary.com'
      }
    };

    console.log('📤 Sending payload to EmailJS...');

    const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Origin': process.env.CLIENT_URL || 'https://my-secret-diary-pro.vercel.app'
      }
    });

    console.log('✅ EmailJS Response:', response.data);
    res.json({ 
      success: true, 
      message: '✅ Test email sent successfully! Check your inbox.',
      data: response.data 
    });
  } catch (error) {
    console.error('❌ EmailJS Test Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      res.status(500).json({ 
        success: false, 
        error: error.response.data,
        status: error.response.status
      });
    } else if (error.request) {
      console.error('No response received');
      res.status(500).json({ 
        success: false, 
        error: 'No response from EmailJS server'
      });
    } else {
      console.error('Error:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message
      });
    }
  }
});

// ===== TEST EMAILJS POST ROUTE =====
app.post('/api/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    console.log('\n🧪 Testing EmailJS POST with email:', email);
    
    const payload = {
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      accessToken: process.env.EMAILJS_PRIVATE_KEY,
      template_params: {
        email: email,
        otp: '123456',
        name: 'Test User',
        reply_to: 'noreply@mysecretdiary.com'
      }
    };

    const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Origin': process.env.CLIENT_URL || 'https://my-secret-diary-pro.vercel.app'
      }
    });

    res.json({ 
      success: true, 
      message: '✅ Test email sent successfully!',
      data: response.data 
    });
  } catch (error) {
    console.error('❌ POST Error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data || error.message 
    });
  }
});

// ================= CLOUDINARY IMAGE UPLOAD =================
app.post('/api/upload/image', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    upload.single('image')(req, res, async function(err) {
      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'diary-images',
          resource_type: 'image'
        });

        fs.unlinkSync(req.file.path);

        res.json({
          success: true,
          url: result.secure_url
        });
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        
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
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    upload.single('voice')(req, res, async function(err) {
      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'voice-notes',
          resource_type: 'video',
          format: 'webm'
        });

        fs.unlinkSync(req.file.path);

        res.json({
          success: true,
          url: result.secure_url
        });
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        
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

    const decoded = jwt.verify(token, JWT_SECRET);
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

// UPDATE entry
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
    
    if (entry.isLocked) {
      if (!password) {
        return res.status(403).json({ error: 'Password required to edit locked entry' });
      }

      const isMatch = await bcrypt.compare(password, entry.password);
      
      if (!isMatch) {
        return res.status(401).json({ error: 'Wrong password' });
      }
    }
    
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
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    server: 'running',
    serverTime: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found',
    path: req.originalUrl 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  const envFile = fs.existsSync(path.join(__dirname, '.env.local')) 
    ? '.env.local' 
    : fs.existsSync(path.join(__dirname, '.env')) 
      ? '.env' 
      : 'System Environment Variables';
  
  console.log(`\n✅ Server started on port ${PORT}`);
  console.log(`📁 Environment file: ${envFile}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`🚀 Render URL: https://mysecretdiarypro.onrender.com`);
  console.log(`📝 API Endpoints:`);
  console.log(`   - Auth: /api/auth`);
  console.log(`   - Diary: /api/diary`);
  console.log(`   - Upload Image: /api/upload/image`);
  console.log(`   - Upload Voice: /api/upload/voice`);
  console.log(`   - Test Env: /api/test-env`);
  console.log(`   - Test Email: /api/test-email?email=your@email.com`);
  console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Configured' : '❌ Missing'}`);
  console.log(`📧 EmailJS Status:`);
  console.log(`   - Service ID: ${process.env.EMAILJS_SERVICE_ID ? '✅ ' + process.env.EMAILJS_SERVICE_ID : '❌ Missing'}`);
  console.log(`   - Template ID: ${process.env.EMAILJS_TEMPLATE_ID ? '✅ ' + process.env.EMAILJS_TEMPLATE_ID : '❌ Missing'}`);
  console.log(`   - Public Key: ${process.env.EMAILJS_PUBLIC_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - Private Key: ${process.env.EMAILJS_PRIVATE_KEY ? '✅ Set' : '❌ Missing'}`);
  
  if (process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY) {
    console.log(`\n✅ EmailJS is ready! Test it now:`);
    console.log(`   GET:  https://mysecretdiarypro.onrender.com/api/test-email?email=your@email.com`);
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});