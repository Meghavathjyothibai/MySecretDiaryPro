const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Verifies JWT token from request headers and attaches user info to request object
 */
module.exports = (req, res, next) => {
  // Get token from multiple possible sources
  // 1. x-auth-token header (legacy)
  // 2. Authorization header (Bearer token)
  // 3. Cookie (if you use cookies in the future)
  
  let token = req.header('x-auth-token');
  
  // If no x-auth-token, check Authorization header
  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    }
  }

  // Debug log (remove in production)
  console.log('🔑 Auth Middleware - Token present:', !!token);

  // Check if token exists
  if (!token) {
    console.log('❌ Auth Middleware - No token provided');
    return res.status(401).json({ 
      success: false,
      message: 'No token, authorization denied' 
    });
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'your-secret-key'
    );
    
    console.log('✅ Auth Middleware - Token verified successfully');
    console.log('📦 Decoded token:', { 
      userId: decoded.userId,
      exp: decoded.exp 
    });

    // ATTACH USER INFO TO REQUEST
    // Your auth.js routes expect req.userId
    req.userId = decoded.userId;
    
    // Also attach full user object for flexibility
    req.user = decoded;
    
    // For legacy compatibility with some routes
    if (decoded.user) {
      req.user = decoded.user;
    }

    // Log successful authentication
    console.log(`👤 Authenticated user ID: ${req.userId}`);
    
    // Proceed to next middleware/route handler
    next();
    
  } catch (error) {
    // Handle specific JWT errors
    console.error('❌ Auth Middleware - Token verification failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token has expired' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token' 
      });
    }
    
    // Generic error
    res.status(401).json({ 
      success: false,
      message: 'Token is not valid' 
    });
  }
};