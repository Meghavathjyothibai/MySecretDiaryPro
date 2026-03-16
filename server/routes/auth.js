const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const axios = require('axios');

// Store OTPs temporarily
const otpStore = new Map();

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// Generate random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ==================== EMAILJS FUNCTION ====================
const sendOTPEmail = async (email, username, otp) => {
  try {
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    console.log('\n🔍 EmailJS Debug Info:');
    console.log('   - Service ID:', serviceId);
    console.log('   - Template ID:', templateId);
    console.log('   - Public Key:', publicKey);
    console.log('   - To Email:', email);
    console.log('   - OTP:', otp);

    // Try different variable combinations (your template might use any of these)
    const templateVariations = [
      { to_email: email, to_name: username || 'User', otp: otp },
      { user_email: email, user_name: username || 'User', otp: otp },
      { recipient: email, name: username || 'User', otp: otp },
      { email: email, username: username || 'User', otp: otp }
    ];

    // Use the first variation (to_email) - most common
    const template_params = templateVariations[0];

    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: template_params
    };

    const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ EmailJS Success!');
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ EmailJS Error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
};

// ==================== TEST ROUTES - ADD THESE ====================

// @route   GET /api/test-variables - Test different variable names
router.get('/test-variables', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    console.log('\n🧪 Testing different variable names for:', email);
    
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    // Test different variable combinations
    const variations = [
      { to_email: email, otp: '123456', to_name: 'Test User' },
      { user_email: email, otp: '123456', user_name: 'Test User' },
      { recipient: email, otp: '123456', name: 'Test User' },
      { email: email, otp: '123456', username: 'Test User' }
    ];

    const results = [];

    for (let i = 0; i < variations.length; i++) {
      try {
        console.log(`\nTrying variation ${i + 1}:`, variations[i]);
        
        const payload = {
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: variations[i]
        };

        await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        });

        results.push({ variation: i + 1, params: variations[i], success: true });
      } catch (error) {
        results.push({ 
          variation: i + 1, 
          params: variations[i], 
          success: false, 
          error: error.response?.data || error.message 
        });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   GET /api/test-email - Simple test with GET
router.get('/test-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    console.log('\n🧪 Testing EmailJS GET with email:', email);
    
    const result = await sendOTPEmail(email, 'Test User', '123456');
    
    if (result.success) {
      res.json({ success: true, message: '✅ Test email sent! Check your inbox.' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send test email', error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/test-email - Simple test with POST
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    console.log('\n🧪 Testing EmailJS POST with email:', email);
    
    const result = await sendOTPEmail(email, 'Test User', '123456');
    
    if (result.success) {
      res.json({ success: true, message: '✅ Test email sent! Check your inbox.' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send test email', error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/test-emailjs - Original test route
router.post('/test-emailjs', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    console.log('\n🧪 Testing EmailJS connection...');
    const result = await sendOTPEmail(email, 'Test User', '123456');
    
    if (result.success) {
      res.json({ success: true, message: '✅ Test email sent! Check your inbox.' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send test email', error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Middleware to verify token
const authMiddleware = async (req, res, next) => {
  try {
    let token = req.header('x-auth-token');
    
    if (!token) {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
      }
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.userId = user._id;
    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      });
    }

    const user = new User({ username, email, password });
    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
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
    console.error('❌ Register error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ success: false, message: `${field} already exists` });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
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
    console.error('❌ Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('📧 Forgot password request for:', email);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: true, message: 'If your email is registered, you will receive an OTP' });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpStore.set(email, { 
      otp, 
      expiresAt, 
      userId: user._id,
      attempts: 0,
      verified: false
    });

    console.log(`🔑 OTP generated for ${email}: ${otp}`);

    const emailResult = await sendOTPEmail(email, user.username, otp);
    
    if (emailResult.success) {
      console.log(`✅ OTP email sent successfully to ${email}`);
      res.json({ success: true, message: 'OTP sent successfully to your email' });
    } else {
      console.error('❌ Failed to send OTP email:', emailResult.error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send OTP. Please try again.'
      });
    }
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP required' });
    }

    const storedData = otpStore.get(email);
    
    if (!storedData) {
      return res.status(400).json({ success: false, message: 'OTP expired or not found' });
    }

    if (storedData.expiresAt < Date.now()) {
      otpStore.delete(email);
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      otpStore.set(email, storedData);
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    storedData.verified = true;
    otpStore.set(email, storedData);

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('❌ Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const storedData = otpStore.get(email);
    
    if (!storedData || !storedData.verified) {
      return res.status(400).json({ success: false, message: 'Please verify OTP first' });
    }

    if (storedData.otp !== otp || storedData.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    otpStore.delete(email);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/auth/verify
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    console.error('❌ Verify error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { username, name, email, bio, location, website } = req.body;
    
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username already taken' });
      }
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
    }

    if (username) user.username = username;
    if (name) user.name = name;
    if (email) user.email = email;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
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
    console.error('❌ Profile update error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/upload-avatar
router.post('/upload-avatar', authMiddleware, async (req, res) => {
  try {
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({ success: false, message: 'Please provide avatar URL' });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.avatar = avatarUrl;
    await user.save();
    
    res.json({
      success: true,
      message: 'Avatar updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name || user.username,
        bio: user.bio || '',
        location: user.location || '',
        website: user.website || '',
        avatar: user.avatar,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Avatar upload error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;