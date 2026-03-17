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

// Send OTP via EmailJS - Works for ALL users (free)
async function sendOtpEmail(toEmail, otp, username = 'User') {
  try {
    console.log('\n📧 Sending OTP email to:', toEmail);
    console.log('🔑 OTP:', otp);
    console.log('👤 Username:', username);

    // Check EmailJS configuration
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

    // Beautiful HTML email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset OTP</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            color: white;
            font-size: 28px;
            font-weight: 600;
          }
          .header p {
            color: rgba(255, 255, 255, 0.9);
            margin: 10px 0 0;
            font-size: 16px;
          }
          .content {
            padding: 40px 30px;
            background: white;
          }
          .greeting {
            font-size: 18px;
            margin-bottom: 20px;
          }
          .otp-container {
            background: #f3f4f6;
            padding: 30px;
            text-align: center;
            border-radius: 12px;
            margin: 30px 0;
            border: 2px dashed #667eea;
          }
          .otp-code {
            font-family: 'Courier New', monospace;
            font-size: 48px;
            font-weight: bold;
            color: #667eea;
            letter-spacing: 8px;
            margin: 20px 0;
            word-break: break-all;
          }
          .warning-box {
            background: #fff3cd;
            border: 1px solid #ffeeba;
            color: #856404;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
            font-size: 14px;
          }
          .warning-box strong {
            color: #856404;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
          }
          .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            border-top: 1px solid #e5e7eb;
          }
          .footer a {
            color: #667eea;
            text-decoration: none;
          }
          .divider {
            height: 1px;
            background: #e5e7eb;
            margin: 20px 0;
          }
          @media only screen and (max-width: 600px) {
            .container {
              margin: 10px;
              border-radius: 12px;
            }
            .header {
              padding: 30px 20px;
            }
            .content {
              padding: 30px 20px;
            }
            .otp-code {
              font-size: 36px;
              letter-spacing: 4px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
            <p>My Secret Diary</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              <p>Hello <strong>${username}</strong>,</p>
              <p>We received a request to reset your password for your My Secret Diary account. Use the verification code below to complete the process.</p>
            </div>
            
            <div class="otp-container">
              <p style="margin: 0 0 10px; color: #6b7280;">Your verification code is:</p>
              <div class="otp-code">${otp}</div>
              <p style="margin: 10px 0 0; color: #6b7280; font-size: 14px;">Enter this code on the password reset page</p>
            </div>
            
            <div class="warning-box">
              <strong>⚠️ Important:</strong>
              <ul style="margin: 10px 0 0; padding-left: 20px;">
                <li>This code will expire in <strong>10 minutes</strong></li>
                <li>Never share this code with anyone</li>
                <li>Our team will never ask for this code</li>
              </ul>
            </div>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <p style="margin: 0 0 10px; font-weight: 600;">Didn't request this?</p>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                If you didn't request a password reset, please ignore this email or 
                <a href="mailto:support@mysecretdiary.com" style="color: #667eea;">contact support</a> 
                if you have concerns about your account security.
              </p>
            </div>
            
            <div class="divider"></div>
            
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              This is an automated message from My Secret Diary. Please do not reply to this email.
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 0 0 10px;">© ${new Date().getFullYear()} My Secret Diary. All rights reserved.</p>
            <p style="margin: 0; font-size: 12px;">
              <a href="#">Privacy Policy</a> • 
              <a href="#">Terms of Service</a> • 
              <a href="#">Contact Support</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // EmailJS template parameters
    const templateParams = {
      email: toEmail,
      name: username,
      otp: otp,
      html: htmlContent,
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

// Forgot Password - Send OTP (NO RATE LIMITING)
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
    
    // For security, always return success even if user doesn't exist
    if (!user) {
      console.log('User not found, but returning success for security');
      return res.json({ 
        success: true, 
        message: 'If your email is registered, you will receive an OTP' 
      });
    }

    // RATE LIMITING IS DISABLED FOR TESTING
    // You can uncomment this in production
    /*
    const existingOTP = otpStore.get(trimmedEmail);
    if (existingOTP && existingOTP.createdAt > Date.now() - 60000) {
      return res.status(429).json({ 
        success: false, 
        message: 'Please wait 1 minute before requesting another OTP' 
      });
    }
    */

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

// Clear OTP for testing
router.get('/clear-otp/:email', (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  otpStore.delete(email);
  res.json({ 
    success: true, 
    message: `OTP cleared for ${email}` 
  });
});

// Get OTP status for debugging
router.get('/otp-status/:email', (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  const data = otpStore.get(email);
  
  if (data) {
    res.json({
      exists: true,
      expiresIn: Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000)) + ' seconds',
      verified: data.verified,
      otp: process.env.NODE_ENV === 'development' ? data.otp : 'hidden' // Only show OTP in development
    });
  } else {
    res.json({ exists: false });
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