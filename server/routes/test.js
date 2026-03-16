const express = require('express');
const router = express.Router();

// Simple test route
router.get('/ping', (req, res) => {
    console.log('✅ TEST PING ROUTE HIT!');
    res.json({ 
        success: true, 
        message: 'Test route is working!',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;