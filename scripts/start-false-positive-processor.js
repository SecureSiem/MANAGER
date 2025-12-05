// scripts/start-false-positive-processor.js
// This script can be run independently or as part of your main application

const path = require('path');

// IMPORTANT: Load environment variables from the correct path
require('dotenv').config({ 
  path: path.join(__dirname, '..', 'backend', '.env')
});

// Debug: Print loaded environment variables
console.log('Loaded Environment Variables:');
console.log('VAULT_ADDR:', process.env.VAULT_ADDR);
console.log('OPENSEARCH_HOST:', process.env.OPENSEARCH_HOST);
console.log('NODE_ENV:', process.env.NODE_ENV);

const { startFalsePositiveProcessor } = require('../backend/services/falsePositiveProcessor');
const { createIndexTemplates } = require('../backend/config/opensearch');

async function initializeAndStart() {
  try {
    console.log('Initializing False Positive Processor...');
    
    // Validate required environment variables
    if (!process.env.VAULT_ADDR) {
      console.error('VAULT_ADDR environment variable is not set');
      process.exit(1);
    }
    
    if (!process.env.OPENSEARCH_HOST) {
      console.error('OPENSEARCH_HOST environment variable is not set');
      process.exit(1);
    }
    
    // Ensure OpenSearch indices and templates are created
    console.log('Creating OpenSearch index templates...');
    await createIndexTemplates();
    
    // Start the false positive processor
    console.log('Starting False Positive Processor...');
    const cleanup = startFalsePositiveProcessor();
    
    console.log('False Positive Processor started successfully!');
    console.log('The processor will run every hour to check for new logs.');
    console.log('Press Ctrl+C to stop the processor.');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nReceived SIGINT, shutting down gracefully...');
      if (cleanup) {
        cleanup();
      }
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\nReceived SIGTERM, shutting down gracefully...');
      if (cleanup) {
        cleanup();
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start False Positive Processor:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  initializeAndStart();
}

module.exports = { initializeAndStart };