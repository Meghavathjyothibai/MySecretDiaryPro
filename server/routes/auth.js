const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const axios = require('axios');

// Store OTPs temporarily
const otpStore = new Map();

// Clean up expired OTPs every hour
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(email);
    }
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

// Generate random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via EmailJS
async function sendOtpEmail(toEmail, otp, username = 'User') {
  try {
    console.log('\n📧 Sending OTP email to:', toEmail);
    console.log('🔑 OTP:', otp);

    if (!process.env.EMAILJS_SERVICE_ID || 
        !process.env.EMAILJS_TEMPLATE_ID || 
        !process.env.EMAILJS_PUBLIC_KEY || 
        !process.env.EMAILJS_PRIVATE_KEY) {
      console.error('❌ EmailJS configuration missing!');
      return {
        success: false,
        error: 'Email service not configured properly'
      };
    }

    const templateParams = {
      email: toEmail,
      name: username,
      otp: otp,
      reply_to: 'noreply@mysecretdiary.com'
    };

    const payload = {
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      accessToken: process.env.EMAILJS_PRIVATE_KEY,
      template_params: templateParams
    };

    console.log('📤 Sending request to EmailJS...');
    
    const response = await axios.post(
      'https://api.emailjs.com/api/v1.0/email/send',
      payload,
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Origin': process.env.CLIENT_URL || 'https://my-secret-diary-pro.vercel.app'
        }
      }
    );

    console.log('✅ EmailJS Response:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ EmailJS Error Details:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// Test route
router.get('/ping', (req, res) => {
  res.json({
    success: true,
    message: 'Auth server is running',
    time: new Date().toISOString()
  });
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    if (username.length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username must be at least 3 characters' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase() 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    const user = new User({ 
      username, 
      email: email.toLowerCase(), 
      password 
    });
    
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
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration' 
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
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
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

// Forgot Password - Send OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('📧 Forgot password request for:', email);

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const trimmedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: trimmedEmail });
    
    if (!user) {
      console.log('User not found, but returning success for security');
      return res.json({ 
        success: true, 
        message: 'If your email is registered, you will receive an OTP' 
      });
    }

    const existingOTP = otpStore.get(trimmedEmail);
    if (existingOTP && existingOTP.createdAt > Date.now() - 60000) {
      return res.status(429).json({ 
        success: false, 
        message: 'Please wait 1 minute before requesting another OTP' 
      });
    }

    const otp = generateOTP();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;

    otpStore.set(trimmedEmail, {
      otp,
      expiresAt,
      createdAt: now,
      userId: user._id,
      verified: false
    });

    console.log(`🔑 OTP generated for ${trimmedEmail}: ${otp}`);

    const emailResult = await sendOtpEmail(trimmedEmail, otp, user.username);

    if (emailResult.success) {
      console.log(`✅ OTP email sent successfully to ${trimmedEmail}`);
      res.json({ 
        success: true, 
        message: 'OTP sent successfully to your email' 
      });
    } else {
      console.error('❌ Failed to send OTP email:', emailResult.error);
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again.'
      });
    }
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during password reset request' 
    });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log('🔐 Verify OTP request for:', email);

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP are required' 
      });
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

    storedData.verified = true;
    otpStore.set(trimmedEmail, storedData);

    res.json({ 
      success: true, 
      message: 'OTP verified successfully. You can now reset your password.' 
    });
  } catch (error) {
    console.error('❌ Verify OTP error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during OTP verification' 
    });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
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

    const user = await User.findById(storedData.userId);
    if (!user) {
      otpStore.delete(trimmedEmail);
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    user.password = newPassword;
    await user.save();

    otpStore.delete(trimmedEmail);

    res.json({ 
      success: true, 
      message: 'Password reset successfully. You can now login with your new password.' 
    });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during password reset' 
    });
  }
});

// Auth middleware
const authMiddleware = async (req, res, next) => {
  try {
    let token = req.header('x-auth-token') || req.header('Authorization');

    if (token && token.startsWith('Bearer ')) {
      token = token.replace('Bearer ', '');
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'my-secret-diary-pro-super-secret-key-2026'
    );
    
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    req.userId = user._id;
    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    
    res.status(401).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
};

// Verify token
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    res.json({ 
      success: true, 
      user: req.user 
    });
  } catch (error) {
    console.error('❌ Verify error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during verification' 
    });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { username, name, email, bio, location, website } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
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
    res.status(500).json({ 
      success: false, 
      message: 'Server error during profile update' 
    });
  }
});

// Change password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide current and new password' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'New password must be at least 6 characters' 
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during password change' 
    });
  }
});

// Upload avatar
router.post('/upload-avatar', authMiddleware, async (req, res) => {
  try {
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide avatar URL' 
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
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
    res.status(500).json({ 
      success: false, 
      message: 'Server error during avatar upload' 
    });
  }
});

module.exports = router;