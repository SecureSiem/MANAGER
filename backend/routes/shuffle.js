const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate } = require('../middleware/authMiddleware');

const getShuffleConfig = () => {
  const host = process.env.SHUFFLE_HOST;
  const port = process.env.SHUFFLE_PORT;
  const username = process.env.SHUFFLE_USER;
  const password = process.env.SHUFFLE_PASSWORD;
  
  return {
    url: `https://${host}:${port}`,
    username,
    password
  };
};

// Get SHUFFLE configuration (without sensitive data)
router.get('/config', authenticate, async (req, res) => {
  try {
    const config = getShuffleConfig();
    
    // Return only non-sensitive configuration data
    res.json({
      url: config.url,
      username: config.username
    });
  } catch (error) {
    console.error('SHUFFLE config error:', error);
    res.status(500).json({ 
      message: 'Failed to get SHUFFLE configuration',
      error: error.message 
    });
  }
});

module.exports = router;
