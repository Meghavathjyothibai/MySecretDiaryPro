const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '7d'
  });
};

// Generate random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Configure email transporter
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your Gmail
    pass: process.env.EMAIL_PASS  // your 16-character App Password
  }
});
// Send OTP email
const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset OTP - My Secret Diary',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #6b46c1;">My Secret Diary</h1>
        </div>
        <div style="background: linear-gradient(135deg, #6b46c1, #db2777); padding: 30px; border-radius: 10px; color: white; text-align: center;">
          <h2 style="margin-bottom: 10px;">Password Reset OTP</h2>
          <p style="font-size: 36px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">${otp}</p>
          <p style="font-size: 14px;">This OTP is valid for 10 minutes</p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #666;">
          <p>If you didn't request this, please ignore this email.</p>
          <p>© ${new Date().getFullYear()} My Secret Diary. All rights reserved.</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Middleware to verify token
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    
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
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    console.log('📝 Registration attempt:', { username, email, passwordLength: password?.length });

    // Validation
    if (!username || !email || !password) {
      console.log('❌ Missing fields:', { 
        username: !!username, 
        email: !!email, 
        password: !!password 
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    // Check if username meets minimum length
    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters long'
      });
    }

    // Check if password meets minimum length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    console.log('🔍 Checking for existing user...');
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      console.log('❌ User already exists:', { 
        email: existingUser.email, 
        username: existingUser.username 
      });
      return res.status(400).json({ 
        success: false, 
        message: existingUser.email === email 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Create new user
    console.log('🆕 Creating new user...');
    const user = new User({
      username,
      email,
      password
    });

    console.log('💾 Saving user to database...');
    await user.save();
    console.log('✅ User saved successfully with ID:', user._id);

    // Generate token
    const token = generateToken(user._id);
    console.log('🔑 Token generated for user:', user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name || username,
        bio: user.bio || '',
        location: user.location || '',
        website: user.website || '',
        avatar: user.avatar || '',
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('❌❌❌ REGISTER ERROR DETAILS:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Check for specific MongoDB errors
    if (error.name === 'MongoServerError') {
      console.error('MongoDB Error Code:', error.code);
      console.error('MongoDB Error Details:', error.errInfo);
      
      if (error.code === 11000) {
        // Duplicate key error
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({ 
          success: false, 
          message: `${field} already exists. Please use a different ${field}.` 
        });
      }
    }
    
    // Check for validation errors
    if (error.name === 'ValidationError') {
      console.error('Validation Errors:', error.errors);
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ 
        success: false, 
        message: messages.join(', ') 
      });
    }

    // Check for bcrypt errors
    if (error.message.includes('bcrypt')) {
      console.error('Bcrypt error detected. Make sure bcryptjs is installed correctly.');
      return res.status(500).json({ 
        success: false, 
        message: 'Password encryption error. Please try again.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration: ' + error.message 
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for email:', email);

    // Validation
    if (!email || !password) {
      console.log('❌ Missing login fields');
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and password' 
      });
    }

    // Find user by email
    console.log('🔍 Searching for user...');
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found with email:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    console.log('✅ User found:', user.username);

    // Check password
    console.log('🔑 Verifying password...');
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Password mismatch for user:', user.username);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    console.log('✅ Password verified successfully');

    // Generate token
    const token = generateToken(user._id);
    console.log('🔑 Token generated for user:', user._id);

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

// @route   POST /api/auth/forgot-password
// @desc    Send OTP to email
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('📧 Forgot password request for:', email);

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email address' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found for forgot password:', email);
      // For security, don't reveal that user doesn't exist
      return res.json({ 
        success: true, 
        message: 'If your email is registered, you will receive an OTP' 
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(email, { otp, expiresAt, userId: user._id });

    // Send email
    try {
      await sendOTPEmail(email, otp);
      console.log(`📧 OTP sent to ${email}`);
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // If email fails, still return success but log error
    }

    // For development, return OTP in response
    res.json({
      success: true,
      message: 'OTP sent successfully',
      // Remove this in production!
      devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP
// @access  Public
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log('🔐 OTP verification attempt for:', email);

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and OTP' 
      });
    }

    const storedData = otpStore.get(email);
    
    if (!storedData) {
      console.log('❌ No OTP found for:', email);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired or not found' 
      });
    }

    if (storedData.expiresAt < Date.now()) {
      otpStore.delete(email);
      console.log('❌ OTP expired for:', email);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired' 
      });
    }

    if (storedData.otp !== otp) {
      console.log('❌ Invalid OTP for:', email);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }

    // OTP verified - mark as verified but keep in store for password reset
    storedData.verified = true;
    otpStore.set(email, storedData);

    console.log('✅ OTP verified successfully for:', email);

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });

  } catch (error) {
    console.error('❌ Verify OTP error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with OTP
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    console.log('🔄 Reset password attempt for:', email);

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Verify OTP again
    const storedData = otpStore.get(email);
    
    if (!storedData || storedData.otp !== otp || storedData.expiresAt < Date.now()) {
      console.log('❌ Invalid or expired OTP for:', email);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired OTP' 
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found for reset password:', email);
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Clear OTP
    otpStore.delete(email);

    console.log('✅ Password reset successfully for:', email);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   GET /api/auth/verify
// @desc    Verify token and get user info
// @access  Private
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    console.log('🔍 Verifying token for user:', req.userId);
    
    const user = await User.findById(req.userId).select('-password');
    
    console.log('✅ Token verified successfully for:', user.username);
    
    res.json({
      success: true,
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
    console.error('❌ Verify error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { username, name, email, bio, location, website } = req.body;
    
    console.log('📝 Profile update attempt for user:', req.userId);
    
    const user = await User.findById(req.userId);
    
    if (!user) {
      console.log('❌ User not found for profile update:', req.userId);
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if username is already taken by another user
    if (username && username !== user.username) {
      console.log('🔍 Checking username availability:', username);
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        console.log('❌ Username already taken:', username);
        return res.status(400).json({ 
          success: false, 
          message: 'Username already taken' 
        });
      }
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      console.log('🔍 Checking email availability:', email);
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.log('❌ Email already in use:', email);
        return res.status(400).json({ 
          success: false, 
          message: 'Email already in use' 
        });
      }
    }

    // Update fields (only if provided)
    if (username) user.username = username;
    if (name) user.name = name;
    if (email) user.email = email;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;

    await user.save();
    console.log('✅ Profile updated successfully for user:', user.username);

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

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    console.log('🔐 Password change attempt for user:', req.userId);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide current and new password' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      console.log('❌ User not found for password change:', req.userId);
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check current password
    console.log('🔑 Verifying current password...');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      console.log('❌ Current password is incorrect for user:', user.username);
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }
    console.log('✅ Current password verified');

    // Update password
    user.password = newPassword;
    await user.save();
    console.log('✅ Password changed successfully for user:', user.username);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   POST /api/auth/upload-avatar
// @desc    Upload user avatar
// @access  Private
router.post('/upload-avatar', authMiddleware, async (req, res) => {
  try {
    const { avatarUrl } = req.body;

    console.log('🖼️ Avatar upload attempt for user:', req.userId);

    if (!avatarUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide avatar URL' 
      });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      console.log('❌ User not found for avatar upload:', req.userId);
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Update user's avatar
    user.avatar = avatarUrl;
    await user.save();
    
    console.log('✅ Avatar updated successfully for user:', user.username);

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
      message: 'Server error' 
    });
  }
});

module.exports = router;