// backend/services/falsePositiveProcessor.js
const { getOpenSearchClient } = require('../config/opensearch');

// Helper function to get nested object value using dot notation
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
};

// Helper function to check if a log matches a false positive rule
const matchesRule = (log, rule) => {
  try {
    for (const condition of rule.conditions) {
      const { field_path, operator, value } = condition;
      const actualValue = getNestedValue(log, field_path);
      
      if (actualValue === undefined || actualValue === null) {
        return false;
      }
      
      const actualStr = String(actualValue).toLowerCase();
      const expectedStr = String(value).toLowerCase();
      
      switch (operator) {
        case 'equals':
          if (actualStr !== expectedStr) return false;
          break;
        case 'regex':
          try {
            const regex = new RegExp(value, 'i');
            if (!regex.test(String(actualValue))) return false;
          } catch (e) {
            console.error('Invalid regex pattern:', value);
            return false;
          }
          break;
        default:
          if (actualStr !== expectedStr) return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error matching rule:', error);
    return false;
  }
};

// Get all active false positive rules
const getActiveFalsePositiveRules = async () => {
  try {
    const client = await getOpenSearchClient();
    
    const response = await client.search({
      index: 'false_positives',
      body: {
        query: {
          term: { 'is_active': true }
        },
        size: 1000
      }
    });

    return response.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id
    }));
  } catch (error) {
    console.error('Error fetching false positive rules:', error);
    return [];
  }
};

// Check if a log matches any false positive rule
const checkFalsePositiveRules = async (log) => {
  try {
    const rules = await getActiveFalsePositiveRules();
    
    for (const rule of rules) {
      if (matchesRule(log, rule)) {
        return {
          isFalsePositive: true,
          matchedRule: {
            rule_id: rule.id,
            rule_name: rule.rule_name,
            matched_at: new Date().toISOString()
          }
        };
      }
    }
    
    return { isFalsePositive: false };
  } catch (error) {
    console.error('Error checking false positive rules:', error);
    return { isFalsePositive: false };
  }
};

// Process logs in batches to update false positive status
const processBatchOfLogs = async (indices, batchSize = 1000) => {
  try {
    const client = await getOpenSearchClient();
    
    console.log('Processing batch of logs for false positive detection...');
    
    // Get logs that don't have is_false_positive field or have it as false
    const scrollResponse = await client.search({
      index: indices.join(','),
      scroll: '5m',
      size: batchSize,
      body: {
        query: {
          bool: {
            should: [
              {
                bool: {
                  must_not: {
                    exists: { field: 'is_false_positive' }
                  }
                }
              },
              {
                term: { 'is_false_positive': false }
              }
            ],
            minimum_should_match: 1
          }
        },
        sort: [{ '@timestamp': { order: 'desc' } }]
      }
    });

    let scrollId = scrollResponse.body._scroll_id;
    let hits = scrollResponse.body.hits.hits;
    let processedCount = 0;
    let updatedCount = 0;

    while (hits.length > 0) {
      const bulkOps = [];
      
      for (const hit of hits) {
        const log = hit._source;
        const fpCheck = await checkFalsePositiveRules(log);
        
        if (fpCheck.isFalsePositive) {
          // Add update operation
          bulkOps.push({
            update: {
              _index: hit._index,
              _id: hit._id
            }
          });
          
          bulkOps.push({
            doc: {
              is_false_positive: true,
              false_positive_rules: [fpCheck.matchedRule]
            }
          });
          
          updatedCount++;
        } else if (!log.hasOwnProperty('is_false_positive')) {
          // Set as false if not already set
          bulkOps.push({
            update: {
              _index: hit._index,
              _id: hit._id
            }
          });
          
          bulkOps.push({
            doc: {
              is_false_positive: false
            }
          });
        }
      }

      // Execute bulk update if there are operations
      if (bulkOps.length > 0) {
        await client.bulk({
          body: bulkOps,
          refresh: false
        });
      }

      processedCount += hits.length;
      console.log(`Processed ${processedCount} logs, updated ${updatedCount} as false positives`);

      // Get next batch
      const nextScrollResponse = await client.scroll({
        scroll_id: scrollId,
        scroll: '5m'
      });

      scrollId = nextScrollResponse.body._scroll_id;
      hits = nextScrollResponse.body.hits.hits;
    }

    // Clear scroll
    await client.clearScroll({
      scroll_id: scrollId
    });

    console.log(`Batch processing complete. Total processed: ${processedCount}, updated: ${updatedCount}`);
    return { processedCount, updatedCount };
    
  } catch (error) {
    console.error('Error processing batch of logs:', error);
    throw error;
  }
};

// Main processing function
const processRecentLogs = async () => {
  try {
    const client = await getOpenSearchClient();
    
    // Get all log indices
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    if (!indicesResponse.body || indicesResponse.body.length === 0) {
      console.log('No log indices found');
      return;
    }

    const indices = indicesResponse.body.map(index => index.index);
    console.log(`Found ${indices.length} log indices`);

    // Process logs in batches
    const result = await processBatchOfLogs(indices, 1000);
    
    console.log(`False positive processing completed: ${result.processedCount} processed, ${result.updatedCount} updated`);
    
  } catch (error) {
    console.error('Error in false positive processing:', error);
  }
};

// Start the continuous processor
const startFalsePositiveProcessor = () => {
  console.log('Starting false positive processor...');
  
  // Process immediately on start
  processRecentLogs();
  
  // Set up hourly processing
  const processingInterval = setInterval(() => {
    console.log('Running hourly false positive processing...');
    processRecentLogs();
  }, 30 * 60 * 1000); // 1 hour

  // Return cleanup function
  return () => {
    console.log('Stopping false positive processor...');
    clearInterval(processingInterval);
  };
};

module.exports = {
  checkFalsePositiveRules,
  processRecentLogs,
  startFalsePositiveProcessor,
  getActiveFalsePositiveRules
};