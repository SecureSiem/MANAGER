// backend/routes/wazuh.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { getWazuhAgents, getStatusSummary } = require('../services/wazuhka');

router.get('/agents', authenticate, async (req, res) => {
  try {
    const data = await getWazuhAgents();
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching agents:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch agents' });
  }
});

router.get('/agents/summary', authenticate, async (req, res) => {
  try {
    const data = await getStatusSummary();
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching summary:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
});

module.exports = router;
