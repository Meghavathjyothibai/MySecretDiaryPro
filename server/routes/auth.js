const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const axios = require('axios'); // Add this for EmailJS

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

// Generate JWT Token - MUST match middleware expectations
const generateToken = (userId) => {
  return jwt.sign(
    { userId },  // This creates { userId: user._id }
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// Generate random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ==================== IMPROVED EMAILJS FUNCTION WITH TIMEOUT ====================
const sendOTPEmail = async (email, username, otp) => {
  try {
    // Get environment variables
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    // Validate keys
    if (!serviceId || !templateId || !publicKey) {
      console.error('❌ EmailJS configuration missing!');
      console.error('Service ID:', serviceId ? '✅' : '❌');
      console.error('Template ID:', templateId ? '✅' : '❌');
      console.error('Public Key:', publicKey ? '✅' : '❌');
      throw new Error('EmailJS configuration missing. Check your .env.local file');
    }

    console.log('📧 Sending OTP via EmailJS to:', email);
    console.log('Service ID:', serviceId);
    console.log('Template ID:', templateId);
    console.log('Public Key:', publicKey ? '✅ Present' : '❌ Missing');

    // Prepare the payload
    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        to_email: email,
        to_name: username || 'User',
        otp: otp,
        reply_to: 'noreply@mysecretdiary.com'
      }
    };

    console.log('📤 Sending request to EmailJS API...');

    // Send with increased timeout (20 seconds)
    const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
      timeout: 20000, // 20 seconds timeout
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'
      }
    });

    console.log('✅ EmailJS Response:', response.data);
    return { 
      success: true, 
      data: response.data,
      message: 'OTP sent successfully'
    };

  } catch (error) {
    console.error('❌ EmailJS Error Details:');
    
    if (error.code === 'ECONNABORTED') {
      console.error('   - Error: Request timeout (20s exceeded)');
      console.error('   - This might be due to EmailJS server slowness or network issues');
      return { 
        success: false, 
        error: 'Request timeout',
        message: 'Email service is taking too long. Please try again.'
      };
    }
    
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error('   - Status:', error.response.status);
      console.error('   - Data:', error.response.data);
      
      // Handle specific EmailJS errors
      if (error.response.status === 400) {
        if (error.response.data === 'Invalid service_id') {
          return { 
            success: false, 
            error: 'Invalid Service ID',
            message: 'Email service configuration error. Please contact support.'
          };
        }
        if (error.response.data === 'Invalid template_id') {
          return { 
            success: false, 
            error: 'Invalid Template ID',
            message: 'Email template configuration error. Please contact support.'
          };
        }
        if (error.response.data === 'The Public Key is required') {
          return { 
            success: false, 
            error: 'Missing Public Key',
            message: 'Email service configuration error. Please contact support.'
          };
        }
      }
      
      return { 
        success: false, 
        error: error.response.data || 'EmailJS API error',
        message: 'Failed to send email. Please try again.'
      };
    } else if (error.request) {
      // The request was made but no response was received
      console.error('   - No response received from EmailJS');
      return { 
        success: false, 
        error: 'No response from EmailJS',
        message: 'Email service is not responding. Please try again later.'
      };
    } else {
      // Something happened in setting up the request
      console.error('   - Error:', error.message);
      return { 
        success: false, 
        error: error.message,
        message: 'Failed to send email. Please try again.'
      };
    }
  }
};

// ==================== TEST EMAILJS ROUTE ====================
router.post('/test-emailjs', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    console.log('🧪 Testing EmailJS connection...');
    const testOTP = '123456';
    const result = await sendOTPEmail(email, 'Test User', testOTP);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: '✅ Test email sent! Check your inbox.',
        details: result
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: result.message || 'Failed to send test email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Test route error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Middleware to verify token (reusable for protected routes)
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from multiple sources
    let token = req.header('x-auth-token');
    
    if (!token) {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
      }
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Find user
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Attach user info to request
    req.userId = user._id;
    req.user = user;
    
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    
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
    
    console.log('📝 Registration attempt:', { username, email });

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    // Check username length
    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters long'
      });
    }

    // Check password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: existingUser.email === email 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password
    });

    await user.save();
    console.log('✅ User saved successfully with ID:', user._id);

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without password)
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
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
    
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        success: false, 
        message: `${field} already exists` 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration' 
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
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and password' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Invalid password for user:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    console.log('✅ Login successful for user:', user.username);

    // Generate token
    const token = generateToken(user._id);

    // Return user data
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
// @desc    Send OTP to email using EmailJS
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('ℹ️ User not found for forgot password:', email);
      // For security, don't reveal that user doesn't exist
      return res.json({ 
        success: true, 
        message: 'If your email is registered, you will receive an OTP' 
      });
    }

    console.log('✅ User found:', user.username);

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(email, { 
      otp, 
      expiresAt, 
      userId: user._id,
      attempts: 0,
      verified: false
    });

    console.log(`🔑 OTP generated for ${email}`);

    // ===== SEND EMAIL VIA EMAILJS =====
    const emailResult = await sendOTPEmail(email, user.username, otp);
    
    if (emailResult.success) {
      console.log(`✅ OTP email sent successfully to ${email}`);
      
      res.json({
        success: true,
        message: 'OTP sent successfully to your email',
        // Only show OTP in development (optional)
        devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
      });
    } else {
      console.error('❌ Failed to send OTP email:', emailResult.error);
      
      // Return helpful error message
      res.status(500).json({
        success: false,
        message: emailResult.message || 'Failed to send OTP. Please try again.',
        error: emailResult.error
      });
    }

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again.' 
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

    // Check expiry
    if (storedData.expiresAt < Date.now()) {
      otpStore.delete(email);
      console.log('❌ OTP expired for:', email);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired' 
      });
    }

    // Check OTP
    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      otpStore.set(email, storedData);
      
      console.log('❌ Invalid OTP for:', email);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }

    // OTP verified - mark as verified
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
    
    if (!storedData || !storedData.verified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please verify OTP first' 
      });
    }

    if (storedData.otp !== otp || storedData.expiresAt < Date.now()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired OTP' 
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
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
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
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
    
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if username is already taken by another user
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Username already taken' 
        });
      }
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email already in use' 
        });
      }
    }

    // Update fields
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
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Update password
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

    // Update user's avatar
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
      message: 'Server error' 
    });
  }
});

module.exports = router;