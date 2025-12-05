/**
 * AI Chat Proxy Route
 * Proxies requests to Python FastAPI SYSBOT service
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate } = require('../middleware/authMiddleware');

// Python AI Service URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

/**
 * POST /api/ai/chat
 * Proxy chat request to Python FastAPI service
 */
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user?.id || 'anonymous';

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        status: 'error',
        response_text: 'Message is required',
        model_name: 'N/A',
        latency_ms: 0
      });
    }

    // Forward request to Python AI service
    const response = await axios.post(
      `${AI_SERVICE_URL}/api/chat`,
      {
        user_id: userId,
        message: message.trim()
      },
      {
        timeout: 60000, // 60 second timeout for LLM
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error('AI Chat Error:', error.message);

    // Handle different error types
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        status: 'error',
        response_text: 'AI service is currently unavailable. Please ensure the SEntinel AI service is running.',
        model_name: 'N/A',
        latency_ms: 0
      });
    }

    if (error.response) {
      // Forward error from AI service
      return res.status(error.response.status).json({
        status: 'error',
        response_text: error.response.data?.detail || 'AI service error',
        model_name: 'N/A',
        latency_ms: 0
      });
    }

    res.status(500).json({
      status: 'error',
      response_text: 'Failed to process your request. Please try again.',
      model_name: 'N/A',
      latency_ms: 0
    });
  }
});

/**
 * GET /api/ai/health
 * Check AI service health
 */
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`, {
      timeout: 5000
    });
    res.json({
      status: 'healthy',
      ai_service: response.data
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      ai_service: 'unavailable'
    });
  }
});

module.exports = router;
