// backend/routes/jumpserver.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate } = require('../middleware/authMiddleware');

// Cache for storing assets
let assetsCache = {
  timestamp: 0,
  assets: [],
  CACHE_DURATION: 300000 // 5 minutes cache
};

const getJumpServerConfig = () => {
  const host = process.env.JUMP_SERVER_HOST;
  const port = process.env.JUMP_SERVER_PORT;
  const username = process.env.JUMP_SERVER_USER;
  const password = process.env.JUMP_SERVER_PASSWORD;
  
  return {
    url: `http://${host}:${port}`,
    username,
    password
  };
};

const getJumpServerToken = async () => {
  try {
    const config = getJumpServerConfig();
    const authResponse = await axios.post(`${config.url}/api/v1/authentication/auth/`, {
      username: config.username,
      password: config.password
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    return authResponse.data.token;
  } catch (error) {
    console.error('JumpServer authentication error:', error.message);
    throw new Error('Failed to authenticate with JumpServer');
  }
};

const fetchJumpServerAssets = async (token) => {
  try {
    const config = getJumpServerConfig();
    const assetsResponse = await axios.get(`${config.url}/api/v1/assets/assets/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    return assetsResponse.data;
  } catch (error) {
    console.error('JumpServer assets fetch error:', error.message);
    throw new Error('Failed to fetch assets from JumpServer');
  }
};

// Get JumpServer configuration (without sensitive data)
router.get('/config', authenticate, async (req, res) => {
  try {
    const config = getJumpServerConfig();
    
    // Return only non-sensitive configuration data
    res.json({
      url: config.url,
      username: config.username // Only return username, not password
    });
  } catch (error) {
    console.error('JumpServer config error:', error);
    res.status(500).json({ 
      message: 'Failed to get JumpServer configuration',
      error: error.message 
    });
  }
});

// Get assets from JumpServer
router.get('/assets', authenticate, async (req, res) => {
  try {
    // Return cached data if still fresh
    if (Date.now() - assetsCache.timestamp < assetsCache.CACHE_DURATION) {
      return res.json(assetsCache.assets);
    }

    // Get authentication token
    const token = await getJumpServerToken();
    
    // Fetch assets
    const assets = await fetchJumpServerAssets(token);
    
    // Update cache
    assetsCache = {
      timestamp: Date.now(),
      assets: assets.results || assets || [],
      CACHE_DURATION: 300000
    };

    res.json(assetsCache.assets);
  } catch (error) {
    console.error('JumpServer route error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch JumpServer assets',
      error: error.message 
    });
  }
});

module.exports = router;