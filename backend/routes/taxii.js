// backend/routes/taxii.js
// CREATE THIS FILE IN: backend/routes/taxii.js

const express = require('express');
const router = express.Router();
const taxiiStreamService = require('../services/taxiiStreamService');

/**
 * @route   POST /api/taxii/endpoints
 * @desc    Add a new TAXII endpoint
 * @access  Public (add auth if needed)
 */
router.post('/endpoints', async (req, res) => {
    try {
        const { name, url, apiRoot, collection } = req.body;

        if (!name || !url) {
            return res.status(400).json({
                success: false,
                error: 'Name and URL are required'
            });
        }

        // Generate unique ID
        const id = `endpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Add endpoint to service
        taxiiStreamService.handleAddEndpoint({
            id,
            name,
            url,
            apiRoot: apiRoot || 'default',
            collection: collection || 'default'
        });

        res.json({
            success: true,
            message: 'Endpoint added successfully',
            endpoint: {
                id,
                name,
                url,
                apiRoot: apiRoot || 'default',
                collection: collection || 'default'
            }
        });
    } catch (error) {
        console.error('[TAXII] Add endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/taxii/endpoints
 * @desc    Get all TAXII endpoints
 * @access  Public
 */
router.get('/endpoints', (req, res) => {
    try {
        const endpoints = Array.from(taxiiStreamService.endpoints.values());

        res.json({
            success: true,
            count: endpoints.length,
            endpoints: endpoints
        });
    } catch (error) {
        console.error('[TAXII] Get endpoints error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   DELETE /api/taxii/endpoints/:id
 * @desc    Remove a TAXII endpoint
 * @access  Public
 */
router.delete('/endpoints/:id', (req, res) => {
    try {
        const { id } = req.params;

        if (!taxiiStreamService.endpoints.has(id)) {
            return res.status(404).json({
                success: false,
                error: 'Endpoint not found'
            });
        }

        taxiiStreamService.handleRemoveEndpoint({ endpointId: id });

        res.json({
            success: true,
            message: 'Endpoint removed successfully'
        });
    } catch (error) {
        console.error('[TAXII] Remove endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/taxii/stats
 * @desc    Get TAXII service statistics
 * @access  Public
 */
router.get('/stats', (req, res) => {
    try {
        const stats = taxiiStreamService.getStats();

        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('[TAXII] Get stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/taxii/test-connection
 * @desc    Test connection to a TAXII endpoint
 * @access  Public
 */
router.post('/test-connection', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        const axios = require('axios');

        // Try to fetch from endpoint
        const response = await axios.get(url, {
            params: { limit: 1 },
            timeout: 5000
        });

        res.json({
            success: true,
            message: 'Connection successful',
            status: response.status,
            bufferSize: response.data.buffer_size || 0
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Connection failed'
        });
    }
});

module.exports = router;