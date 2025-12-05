// backend/routes/audits.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/authMiddleware');

// Simple function to load device names from .env.audits file
const loadDeviceNames = () => {
  try {
    const envPath = path.join(__dirname, '../.env.audits');
    
    if (!fs.existsSync(envPath)) {
      return [];
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const devices = [];
    const lines = envContent.split('\n');
    
    lines.forEach((line) => {
      // Skip comments and empty lines
      if (line.trim() && !line.trim().startsWith('#')) {
        const [name, ip] = line.split('=');
        if (name && ip) {
          devices.push({
            name: name.trim()
          });
        }
      }
    });
    
    return devices;
  } catch (error) {
    console.error('Error loading device names:', error);
    return [];
  }
};

// API endpoint to get device names only
router.get('/devices', authenticate, async (req, res) => {
  try {
    const devices = loadDeviceNames();
    
    res.json({
      devices: devices,
      totalDevices: devices.length
    });
  } catch (error) {
    console.error('Error fetching device names:', error);
    res.status(500).json({ 
      message: 'Failed to fetch device names',
      error: error.message 
    });
  }
});

// Dummy function to replace the old startBackgroundPing (no longer needed)
const startBackgroundPing = () => {
  // No background ping needed for just displaying names
  return null;
};

module.exports = { router, startBackgroundPing };