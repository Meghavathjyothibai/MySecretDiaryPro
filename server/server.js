// LOAD ENVIRONMENT VARIABLES
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Clear console
console.clear();
console.log('🔍 Loading environment variables...\n');

// Load env file
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
  console.log('📁 Loading from .env.local');
  dotenv.config({ path: '.env.local' });
} else if (fs.existsSync(path.join(__dirname, '.env'))) {
  console.log('📁 Loading from .env');
  dotenv.config();
}

// Log status
console.log('\n📧 EmailJS Status:');
console.log(`   - Service ID: ${process.env.EMAILJS_SERVICE_ID ? '✅ ' + process.env.EMAILJS_SERVICE_ID : '❌ Missing'}`);
console.log(`   - Template ID: ${process.env.EMAILJS_TEMPLATE_ID ? '✅ ' + process.env.EMAILJS_TEMPLATE_ID : '❌ Missing'}`);
console.log(`   - Public Key: ${process.env.EMAILJS_PUBLIC_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   - Private Key: ${process.env.EMAILJS_PRIVATE_KEY ? '✅ Set' : '❌ Missing'}`);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();

// ===== CORS =====
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://my-secret-diary-pro.vercel.app',
    'https://mysecretdiarypro.onrender.com'
  ],
  credentials: true
}));

app.use(express.json());

// ===== MongoDB Connection =====
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI missing');
      return;
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB error:', error.message);
    setTimeout(connectDB, 5000);
  }
};
connectDB();

// ===== User Model =====
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, default: '' },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  website: { type: String, default: '' },
  avatar: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', UserSchema);

// ===== Auth Routes =====
const router = express.Router();

// Store OTPs
const otpStore = new Map();

// Clean up expired OTPs every hour
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (data.expiresAt < now) otpStore.delete(email);
  }
}, 60 * 60 * 1000);

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'my-secret-diary-pro-super-secret-key-2026',
    { expiresIn: '7d' }
  );
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ===== EMAILJS OTP SENDER - WORKS FOR ALL USERS =====
async function sendOtpEmail(toEmail, otp, username = 'User') {
  try {
    console.log(`\n📧 Sending OTP to: ${toEmail}`);
    console.log(`🔑 OTP: ${otp}`);
    console.log(`👤 User: ${username}`);

    // Get EmailJS credentials
    const serviceId = process.env.EMAILJS_SERVICE_ID;     // service_lxeal6p
    const templateId = process.env.EMAILJS_TEMPLATE_ID;   // template_ze26cjr
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;     // -wvN2YaMWnP6JhvmW
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;   // pr_-suTx0cyWTHRFtnM57B88

    console.log('📤 Using EmailJS credentials:', {
      serviceId,
      templateId,
      publicKey: publicKey ? '✅' : '❌',
      privateKey: privateKey ? '✅' : '❌'
    });

    // Simple template params - exactly what your template needs
    const templateParams = {
      email: toEmail,     // Your template uses {{email}}
      name: username,     // Your template uses {{name}} 
      otp: otp           // Your template uses {{otp}}
    };

    // EmailJS API payload
    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: templateParams
    };

    console.log('📤 Sending to EmailJS...');

    // Send to EmailJS
    const response = await axios.post(
      'https://api.emailjs.com/api/v1.0/email/send',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://my-secret-diary-pro.vercel.app'
        },
        timeout: 15000
      }
    );

    console.log('✅ EmailJS success:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ EmailJS error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
}

// ===== TEST ROUTE =====
router.get('/ping', (req, res) => {
  res.json({ success: true, message: 'Auth server running' });
});

// ===== TEST EMAILJS ROUTE =====
router.get('/test-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const result = await sendOtpEmail(email, '123456', 'Test User');
    
    if (result.success) {
      res.json({ success: true, message: 'Test email sent!' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== REGISTER =====
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    if (username.length < 3) {
      return res.status(400).json({ success: false, message: 'Username too short' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password too short' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email' });
    }

    // Check existing
    const existing = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: existing.email === email.toLowerCase() ? 'Email exists' : 'Username exists'
      });
    }

    // Create user
    const user = new User({ 
      username, 
      email: email.toLowerCase(), 
      password 
    });
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name || user.username,
        bio: user.bio || '',
        location: user.location || '',
        website: user.website || '',
        avatar: user.avatar || '',
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== LOGIN =====
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name || user.username,
        bio: user.bio || '',
        location: user.location || '',
        website: user.website || '',
        avatar: user.avatar || '',
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== FORGOT PASSWORD - SEND OTP =====
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('📧 Forgot password for:', email);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: trimmedEmail });

    // Always return success for security
    if (!user) {
      console.log('User not found - returning success');
      return res.json({ 
        success: true, 
        message: 'If your email is registered, you will receive an OTP' 
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(trimmedEmail, {
      otp,
      expiresAt,
      createdAt: now,
      userId: user._id,
      verified: false
    });

    console.log(`🔑 OTP for ${trimmedEmail}: ${otp}`);

    // Send OTP via EmailJS
    const emailResult = await sendOtpEmail(trimmedEmail, otp, user.username);

    if (emailResult.success) {
      console.log(`✅ OTP sent to ${trimmedEmail}`);
      res.json({ 
        success: true, 
        message: 'OTP sent successfully to your email' 
      });
    } else {
      console.error('❌ Failed to send:', emailResult.error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send OTP. Please try again.' 
      });
    }
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ===== VERIFY OTP =====
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP required' });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const storedData = otpStore.get(trimmedEmail);

    if (!storedData) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired or not found. Please request a new one.' 
      });
    }

    if (storedData.expiresAt < Date.now()) {
      otpStore.delete(trimmedEmail);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired. Please request a new one.' 
      });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP. Please try again.' 
      });
    }

    // Mark as verified
    storedData.verified = true;
    otpStore.set(trimmedEmail, storedData);

    res.json({ 
      success: true, 
      message: 'OTP verified successfully. You can now reset your password.' 
    });
  } catch (error) {
    console.error('❌ Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== RESET PASSWORD =====
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters' 
      });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const storedData = otpStore.get(trimmedEmail);

    if (!storedData) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP session expired. Please request a new OTP.' 
      });
    }

    if (!storedData.verified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please verify OTP first' 
      });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }

    if (storedData.expiresAt < Date.now()) {
      otpStore.delete(trimmedEmail);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired. Please request a new one.' 
      });
    }

    // Update password
    const user = await User.findById(storedData.userId);
    if (!user) {
      otpStore.delete(trimmedEmail);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    // Clear OTP
    otpStore.delete(trimmedEmail);

    res.json({ 
      success: true, 
      message: 'Password reset successfully. You can now login.' 
    });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== VERIFY TOKEN =====
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-diary-pro-super-secret-key-2026');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// ===== UPDATE PROFILE =====
router.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-diary-pro-super-secret-key-2026');
    
    const { username, name, email, bio, location, website } = req.body;
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (username) user.username = username;
    if (name !== undefined) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name || user.username,
        bio: user.bio || '',
        location: user.location || '',
        website: user.website || '',
        avatar: user.avatar || '',
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== MOUNT ROUTES =====
app.use('/api/auth', router);

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    time: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/', (req, res) => {
  res.json({ message: '🚀 Server running' });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 URL: https://mysecretdiarypro.onrender.com`);
  console.log(`📧 EmailJS: ${process.env.EMAILJS_SERVICE_ID ? '✅ Ready' : '❌ Not configured'}`);
  console.log(`\n📝 Test EmailJS:`);
  console.log(`   GET https://mysecretdiarypro.onrender.com/api/auth/test-email?email=your@email.com`);
});