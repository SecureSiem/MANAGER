// backend/services/optimizedLogIngestor.js
const { getOpenSearchClient, getIndexNameForDate, createIndexTemplates } = require('../config/opensearch');
const { getConsumer } = require('../config/kafka');
const { transformLogFast } = require('../utils/optimizedLogTransformer');

// Configuration for high-performance ingestion
const BULK_SIZE = 1000;           // Process 1000 logs per bulk request
const FLUSH_INTERVAL = 5000;      // Flush every 5 seconds even if bulk not full
const MAX_PARALLEL_CONSUMERS = 4; // Reduced from 6 to 4 for better stability
const CONSUMER_TIMEOUT = 30000;   // 30 second timeout

// Shared bulk buffer for all consumers
let bulkBuffer = [];
let bulkBufferLock = false;
let lastFlushTime = Date.now();

// Performance tracking
let stats = {
  processed: 0,
  errors: 0,
  bulkRequests: 0,
  startTime: Date.now()
};

// Optimized bulk indexing function
const flushBulkBuffer = async (force = false) => {
  if (bulkBufferLock) return; // Prevent concurrent flushes
  
  const currentTime = Date.now();
  const timeSinceLastFlush = currentTime - lastFlushTime;
  
  // Flush conditions: buffer full OR force flush OR timeout
  if (bulkBuffer.length === 0) return;
  if (!force && bulkBuffer.length < BULK_SIZE && timeSinceLastFlush < FLUSH_INTERVAL) return;
  
  bulkBufferLock = true;
  const logsToProcess = [...bulkBuffer]; // Copy current buffer
  bulkBuffer = []; // Clear buffer immediately
  lastFlushTime = currentTime;
  
  try {
    const client = await getOpenSearchClient();
    
    // Prepare bulk operations
    const bulkOps = [];
    const indexGroups = new Map(); // Group by index for better performance
    
    for (const log of logsToProcess) {
      const timestamp = log['@timestamp'] || new Date();
      const index = getIndexNameForDate(new Date(timestamp));
      
      if (!indexGroups.has(index)) {
        indexGroups.set(index, []);
      }
      indexGroups.get(index).push(log);
    }
    
    // Create bulk operations grouped by index
    for (const [index, logs] of indexGroups) {
      for (const log of logs) {
        bulkOps.push({
          index: {
            _index: index,
            _id: log.id
          }
        });
        bulkOps.push(log);
      }
    }
    
    if (bulkOps.length > 0) {
      const bulkResponse = await client.bulk({
        body: bulkOps,
        refresh: false, // Don't refresh immediately for performance
        timeout: '60s'
      });
      
      // Handle errors in bulk response
      if (bulkResponse.body.errors) {
        const errorCount = bulkResponse.body.items.filter(item => 
          item.index && item.index.error
        ).length;
        stats.errors += errorCount;
        
        if (errorCount > 0) {
          console.error(`Bulk indexing errors: ${errorCount}/${logsToProcess.length}`);
          // Log first few errors for debugging
          bulkResponse.body.items.slice(0, 3).forEach(item => {
            if (item.index && item.index.error) {
              console.error('Index error:', item.index.error);
            }
          });
        }
      }
      
      stats.processed += logsToProcess.length;
      stats.bulkRequests++;
      
      console.log(`Bulk indexed ${logsToProcess.length} logs across ${indexGroups.size} indices. Total: ${stats.processed}`);
    }
    
  } catch (error) {
    console.error('Error in bulk indexing:', error.message);
    stats.errors += logsToProcess.length;
    
    // Add failed logs back to buffer for retry (with limit)
    if (bulkBuffer.length < BULK_SIZE * 2) { // Prevent infinite growth
      bulkBuffer.unshift(...logsToProcess);
    }
  } finally {
    bulkBufferLock = false;
  }
};

// Create and run a single consumer instance
const createConsumerInstance = async (consumerId) => {
  try {
    // Create consumer with unique instance ID to avoid conflicts
    const kafka = await require('../config/kafka').getKafkaClient();
    const consumer = kafka.consumer({ 
      groupId: process.env.KAFKA_CONSUMER_GROUP_ID,
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
      heartbeatInterval: 3000,
      allowAutoTopicCreation: false,
      maxWaitTimeInMs: 5000,
      retry: {
        initialRetryTime: 100,
        retries: 8,
        multiplier: 2,
        maxRetryTime: 30000
      }
    });
    
    await consumer.connect();
    console.log(`Consumer ${consumerId} connected successfully`);
    
    // Subscribe to topic
    await consumer.subscribe({ 
      topic: process.env.KAFKA_LOG_TOPIC,
      fromBeginning: false 
    });
    
    console.log(`Consumer ${consumerId} subscribed to ${process.env.KAFKA_LOG_TOPIC}`);
    
    // Process messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message, heartbeat }) => {
        try {
          // Parse message
          const rawLog = JSON.parse(message.value.toString());
          
          // Fast transformation (without expensive false positive checking)
          const transformedLog = await transformLogFast(rawLog);
          
          // Add to bulk buffer
          bulkBuffer.push(transformedLog);
          
          // Flush if buffer is full
          if (bulkBuffer.length >= BULK_SIZE) {
            await flushBulkBuffer();
          }
          
          // Send heartbeat to prevent rebalancing
          await heartbeat();
          
        } catch (error) {
          console.error(`Consumer ${consumerId} error processing message:`, error.message);
          stats.errors++;
        }
      },
    });
    
  } catch (error) {
    console.error(`Consumer ${consumerId} error:`, error);
    throw error;
  }
};

// Main function to start multiple consumers
const startHighPerformanceLogIngestion = async () => {
  try {
    // Create index templates first
    await createIndexTemplates();
    console.log('Index templates ready');
    
    // Start performance monitoring
    const statsInterval = setInterval(() => {
      const runtime = (Date.now() - stats.startTime) / 1000;
      const rate = Math.round(stats.processed / runtime);
      
      console.log(`📊 PERFORMANCE: ${stats.processed} logs processed, ${stats.errors} errors, ${rate} logs/sec avg, ${stats.bulkRequests} bulk requests`);
    }, 30000); // Every 30 seconds
    
    // Start periodic flush (backup for low-volume periods)
    const flushInterval = setInterval(() => {
      flushBulkBuffer(true);
    }, FLUSH_INTERVAL);
    
    // Start multiple consumers with staggered startup
    const consumers = [];
    for (let i = 0; i < MAX_PARALLEL_CONSUMERS; i++) {
      console.log(`Starting consumer ${i + 1}/${MAX_PARALLEL_CONSUMERS}...`);
      
      // Stagger consumer startup to avoid rebalancing conflicts
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
      
      consumers.push(createConsumerInstance(i + 1));
    }
    
    // Wait for all consumers to start
    await Promise.all(consumers);
    
    console.log(`🚀 High-performance log ingestion started with ${MAX_PARALLEL_CONSUMERS} parallel consumers`);
    console.log(`📈 Expected throughput: ~${BULK_SIZE * MAX_PARALLEL_CONSUMERS * 12} logs/hour`);
    
    // Graceful shutdown handling
    const cleanup = async () => {
      console.log('Shutting down high-performance log ingestion...');
      
      clearInterval(statsInterval);
      clearInterval(flushInterval);
      
      // Final flush
      await flushBulkBuffer(true);
      
      console.log(`Final stats: ${stats.processed} processed, ${stats.errors} errors`);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    return {
      consumers,
      stats,
      cleanup
    };
    
  } catch (error) {
    console.error('Error starting high-performance log ingestion:', error);
    throw error;
  }
};

module.exports = {
  startHighPerformanceLogIngestion,
  flushBulkBuffer
};