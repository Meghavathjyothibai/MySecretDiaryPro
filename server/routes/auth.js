const express = require('express');
const router = express.Router();

// ========== SUPER SIMPLE TEST ROUTE ==========
router.get('/ping', (req, res) => {
    console.log('✅ PING route hit!');
    res.json({ 
        success: true, 
        message: 'Server is working!',
        time: new Date().toISOString()
    });
});

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
// ==================== EMAILJS FUNCTION - FIXED ====================
async function sendOtpEmail(toEmail, otp, username = 'User') {
  try {
    console.log('\n📧 Sending OTP email to:', toEmail);
    console.log('🔑 OTP:', otp);
    console.log('👤 Username:', username);
    
    // Check if EmailJS is configured
    if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID || !process.env.EMAILJS_PUBLIC_KEY) {
      console.error('❌ EmailJS configuration missing!');
      return { 
        success: false, 
        error: 'EmailJS configuration missing. Check your .env.local file.' 
      };
    }

    // IMPORTANT: Based on test results, your template uses:
    // - {{email}} for email address
    // - {{otp}} for OTP code
    // - {{name}} for username
    const payload = {
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      accessToken: process.env.EMAILJS_PRIVATE_KEY,
      template_params: {
        email: toEmail,     // ← FIXED: Using 'email' (not 'to_email')
        otp: otp,           // ← FIXED: Using 'otp'
        name: username,     // ← FIXED: Using 'name' (not 'to_name')
        reply_to: 'noreply@mysecretdiary.com'
      }
    };

    console.log('📤 Sending payload to EmailJS...');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(
      'https://api.emailjs.com/api/v1.0/email/send',
      payload,
      { 
        timeout: 30000,
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000'
        } 
      }
    );

    console.log('✅ OTP email sent successfully!', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ EmailJS Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received from EmailJS');
    } else {
      console.error('Error:', error.message);
    }
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
}

// ==================== TEST ROUTES ====================

// @route   GET /api/test-email
router.get('/test-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    console.log('\n🧪 Testing EmailJS with email:', email);
    
    const testOTP = '123456';
    const result = await sendOtpEmail(email, testOTP, 'Test User');
    
    if (result.success) {
      res.json({ success: true, message: '✅ Test email sent! Check your inbox.' });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send test email',
        error: result.error 
      });
    }
  } catch (error) {
    console.error('❌ Test route error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/test-email
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    console.log('\n🧪 Testing EmailJS POST with email:', email);
    
    const testOTP = '123456';
    const result = await sendOtpEmail(email, testOTP, 'Test User');
    
    if (result.success) {
      res.json({ success: true, message: '✅ Test email sent! Check your inbox.' });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send test email',
        error: result.error 
      });
    }
  } catch (error) {
    console.error('❌ Test route error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/test-variables
router.get('/test-variables', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    console.log('\n🧪 Testing different variable names for:', email);
    
    const variations = [
      { to_email: email, otp: '123456', to_name: 'Test User' },
      { user_email: email, otp: '123456', user_name: 'Test User' },
      { recipient: email, otp: '123456', name: 'Test User' },
      { email: email, otp: '123456', username: 'Test User' },
      { email: email, otp: '123456', to_name: 'Test User' },
      { to: email, otp: '123456', name: 'Test User' }
    ];

    const results = [];

    for (let i = 0; i < variations.length; i++) {
      try {
        console.log(`\n🔄 Trying variation ${i + 1}:`, variations[i]);
        
        const payload = {
          service_id: process.env.EMAILJS_SERVICE_ID,
          template_id: process.env.EMAILJS_TEMPLATE_ID,
          user_id: process.env.EMAILJS_PUBLIC_KEY,
          accessToken: process.env.EMAILJS_PRIVATE_KEY,
          template_params: variations[i]
        };

        const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
          timeout: 10000,
          headers: { 
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000'
          }
        });

        results.push({ 
          variation: i + 1, 
          params: variations[i], 
          success: true,
          response: response.data
        });
        
        // Stop on first success
        break;
      } catch (error) {
        results.push({ 
          variation: i + 1, 
          params: variations[i], 
          success: false, 
          error: error.response?.data || error.message 
        });
      }
    }

    const working = results.find(r => r.success);
    
    if (working) {
      console.log('\n🎯 FOUND WORKING VARIABLE!');
      console.log('Working params:', working.params);
      res.json({ 
        success: true, 
        message: '✅ Found working variable combination!',
        working_variables: working.params,
        results: results
      });
    } else {
      res.json({ 
        success: false, 
        message: '❌ No working variable combination found',
        results: results 
      });
    }
  } catch (error) {
    console.error('❌ Test variables error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   GET /api/test-all-variables
router.get('/test-all-variables', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    console.log('\n🧪 Testing ALL possible variable names for:', email);
    
    const allVariations = [
      { email: email, otp: '123456', name: 'Test User' },
      { to: email, otp: '123456', name: 'Test User' },
      { to_email: email, otp: '123456', name: 'Test User' },
      { user_email: email, otp: '123456', name: 'Test User' },
      { recipient: email, otp: '123456', name: 'Test User' },
      { mail: email, otp: '123456', name: 'Test User' },
      { address: email, otp: '123456', name: 'Test User' },
      { email_address: email, otp: '123456', name: 'Test User' },
      { email: email, otp: '123456', username: 'Test User' },
      { email: email, otp: '123456', user_name: 'Test User' },
      { email: email, otp: '123456', to_name: 'Test User' },
      { email: email, otp: '123456', full_name: 'Test User' },
      { email: email, otp: '123456', recipient_name: 'Test User' },
      { to_email: email, otp: '123456', to_name: 'Test User' },
      { user_email: email, otp: '123456', user_name: 'Test User' },
      { recipient: email, otp: '123456', recipient_name: 'Test User' }
    ];

    const results = [];

    for (let i = 0; i < allVariations.length; i++) {
      try {
        console.log(`\n🔄 Trying variation ${i + 1}:`, allVariations[i]);
        
        const payload = {
          service_id: process.env.EMAILJS_SERVICE_ID,
          template_id: process.env.EMAILJS_TEMPLATE_ID,
          user_id: process.env.EMAILJS_PUBLIC_KEY,
          accessToken: process.env.EMAILJS_PRIVATE_KEY,
          template_params: allVariations[i]
        };

        const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
          timeout: 10000,
          headers: { 
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000'
          }
        });

        results.push({ 
          variation: i + 1, 
          params: allVariations[i], 
          success: true,
          message: '✅ WORKING!',
          response: response.data
        });
        
        break;
      } catch (error) {
        results.push({ 
          variation: i + 1, 
          params: allVariations[i], 
          success: false, 
          error: error.response?.data || error.message 
        });
      }
    }

    const working = results.find(r => r.success);
    
    if (working) {
      console.log('\n🎯 FOUND WORKING VARIABLE!');
      console.log('Working params:', working.params);
      res.json({ 
        success: true, 
        message: '✅ Found working variable combination!',
        working_variables: working.params,
        all_results: results
      });
    } else {
      res.json({ 
        success: false, 
        message: '❌ No working variable combination found',
        all_results: results 
      });
    }
  } catch (error) {
    console.error('❌ Test all variables error:', error);
    res.status(500).json({ success: false, error: error.message });
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

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal that user doesn't exist (security)
      return res.json({ success: true, message: 'If your email is registered, you will receive an OTP' });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(email, { 
      otp, 
      expiresAt, 
      userId: user._id,
      verified: false
    });

    console.log(`🔑 OTP generated for ${email}: ${otp}`);

    // Send OTP email
    const emailResult = await sendOtpEmail(email, otp, user.username);
    
    if (emailResult.success) {
      console.log(`✅ OTP email sent successfully to ${email}`);
      res.json({ success: true, message: 'OTP sent successfully to your email' });
    } else {
      console.error('❌ Failed to send OTP email');
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send OTP. Please try again.',
        error: emailResult.error
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