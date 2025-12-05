// backend/server.js
require('dotenv').config();

const express = require('express');
const http = require('http'); // ADD THIS
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const session = require('express-session');
const newsRoutes = require('./routes/news');
const serverRoutes = require('./routes/server');
const jumpserverRoutes = require('./routes/jumpserver');
const wazuhRoutes = require('./routes/wazuh');
const falsePositiveRoutes = require('./routes/falsePositives');
const shuffleRoutes = require('./routes/shuffle');

// ADD THIS: Import TAXII routes and service
const taxiiRoutes = require('./routes/taxii');
const taxiiStreamService = require('./services/taxiiStreamService');

// Import AI Chat routes
const aiRoutes = require('./routes/ai');

// Import audits
const { router: auditsRoutes, startBackgroundPing } = require('./routes/audits');

// Import services
const { startHighPerformanceLogIngestion } = require('./services/optimizedLogIngestor');
const { initializeVault } = require('./config/vault');
const { createIndexTemplates, checkOpenSearchStatus } = require('./config/opensearch');
const { startFalsePositiveProcessor } = require('./services/falsePositiveProcessor');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const logRoutes = require('./routes/logs');
const ticketRoutes = require('./routes/tickets');

// Create Express application
const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';

// WEBSOCKET PORT (different from API port)
const WS_PORT = process.env.WS_PORT || 5002;

// Initialize middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Initialize system
(async () => {
  try {
    // Initialize Vault
    await initializeVault();
    console.log('Vault initialized successfully');

    // Initialize OpenSearch with new indexes
    await createIndexTemplates();
    console.log('OpenSearch indexes initialized successfully');

    const { fixUnassignedShards } = require('./config/opensearch');
    await fixUnassignedShards();

    // Check OpenSearch status
    await checkOpenSearchStatus();

    // Start log ingestion from Kafka to OpenSearch
    await startHighPerformanceLogIngestion();
    console.log('Log ingestion service started');

    // Start background device ping service
    startBackgroundPing();
    console.log('Device audit service started');
  } catch (error) {
    console.error('Initialization error:', error);
    console.log('Continuing with limited functionality');
  }
})();

let fpProcessorCleanup = null;
setTimeout(() => {
  try {
    fpProcessorCleanup = startFalsePositiveProcessor();
    console.log('False positive processor started successfully');
  } catch (error) {
    console.error('Failed to start false positive processor:', error);
  }
}, 5000); // 5 second delay

// Add graceful shutdown for the processor
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');

  if (fpProcessorCleanup) {
    fpProcessorCleanup();
  }

  // ADD THIS: Cleanup TAXII WebSocket
  if (taxiiStreamService && taxiiStreamService.wss) {
    console.log('Closing TAXII WebSocket server...');
    taxiiStreamService.wss.close();
  }

  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');

  if (fpProcessorCleanup) {
    fpProcessorCleanup();
  }

  // ADD THIS: Cleanup TAXII WebSocket
  if (taxiiStreamService && taxiiStreamService.wss) {
    console.log('Closing TAXII WebSocket server...');
    taxiiStreamService.wss.close();
  }

  process.exit(0);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/server', serverRoutes);
app.use('/api/jumpserver', jumpserverRoutes);
app.use('/api/wazuh', wazuhRoutes);
app.use('/api/audits', auditsRoutes);
app.use('/api/false-positives', falsePositiveRoutes);
app.use('/api/shuffle', shuffleRoutes);

// ADD THIS: TAXII routes
app.use('/api/taxii', taxiiRoutes);

// AI Chat routes
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(), 
    service: 'Security Log Manager API',
    websocket: taxiiStreamService.wss ? 'running' : 'not initialized' // ADD THIS
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ADD THIS: Create separate HTTP server for WebSocket
const wsServer = http.createServer();

// Initialize TAXII WebSocket Service on separate port
taxiiStreamService.initialize(wsServer);

// Start the WebSocket server on different port
wsServer.listen(WS_PORT, HOST, () => {
  console.log(`✅ TAXII WebSocket server running on ws://${HOST}:${WS_PORT}/ws/taxii`);
});

// Start the main API server
app.listen(PORT, HOST, () => {
  console.log(`✅ API Server running on http://${HOST}:${PORT}`);
  console.log(`✅ TAXII REST API available at http://${HOST}:${PORT}/api/taxii`);
});

// Keep this as is
const logsRouter = require('./routes/logs');
app.use('/api/logs', logsRouter);