// backend/config/opensearch.js - FIXED VERSION
const { Client } = require('@opensearch-project/opensearch');
const { getSecret } = require('./vault');
const { hashPassword, createDefaultAdmin } = require('../utils/auth');

// OpenSearch indices for time-based sharding
const INDICES = {
  USERS: 'users',
  TICKETS: 'tickets',
  FALSE_POSITIVES: 'false_positives' // Added for false positive rules
};

// Dynamic indices based on date
const getIndexNameForDate = (date) => {
  const d = new Date(date);
  return `logs-${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};

// Get today's index name
const getTodayIndexName = () => {
  return getIndexNameForDate(new Date());
};

const checkOpenSearchStatus = async () => {
  try {
    const client = await getOpenSearchClient();

    // Check cluster health
    const health = await client.cluster.health();
    console.log('Cluster health:', health.body.status);

    // Check indices
    const indices = await client.cat.indices({ format: 'json' });
    console.log('Indices:', indices.body.map(idx =>
      `${idx.index}: docs=${idx.docs?.count || 0}, size=${idx.store?.size || '0'}`
    ).join(', '));

    // Check shards
    const shards = await client.cat.shards({ format: 'json' });
    const unassignedShards = shards.body.filter(s => s.state === 'UNASSIGNED');
    if (unassignedShards.length > 0) {
      console.error('Warning: Unassigned shards detected!', unassignedShards.length);
    }
  } catch (error) {
    console.error('Error checking OpenSearch status:', error);
  }
};

// Initialize OpenSearch client
let client;

const getOpenSearchClient = async () => {
  if (client) return client;

  try {
    // Try to get credentials from Vault first
    let node, username, password;

    try {
      console.log('Attempting to get OpenSearch credentials from Vault...');
      const opensearchConfig = await getSecret('opensearch');
      node = opensearchConfig.host || process.env.OPENSEARCH_HOST;
      username = opensearchConfig.username || process.env.OPENSEARCH_USERNAME;
      password = opensearchConfig.password || process.env.OPENSEARCH_PASSWORD;
      console.log('Successfully retrieved credentials from Vault');
    } catch (vaultError) {
      console.log('Vault not available, falling back to environment variables...');
      // Fallback to environment variables
      node = process.env.OPENSEARCH_HOST;
      username = process.env.OPENSEARCH_USERNAME;
      password = process.env.OPENSEARCH_PASSWORD;
    }

    // Validate that we have the required configuration
    if (!node) {
      throw new Error('OpenSearch host is not configured. Please set OPENSEARCH_HOST environment variable.');
    }
    if (!username || !password) {
      throw new Error('OpenSearch credentials are not configured. Please set OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD environment variables.');
    }

    console.log(`Connecting to OpenSearch at: ${node}`);

    // Create client
    client = new Client({
      node,
      auth: {
        username,
        password,
      },
      ssl: {
        rejectUnauthorized: false, // Only for development
      },
    });

    // Test the connection
    await client.cluster.health();
    console.log('OpenSearch connection established successfully');

    return client;
  } catch (error) {
    console.error('Error creating OpenSearch client:', error);
    throw error;
  }
};

// Get index pattern for a date range
const getIndexPatternForDateRange = (startDate, endDate) => {
  if (!startDate) {
    // Default to last 7 days if no start date provided
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  }

  if (!endDate) {
    endDate = new Date();
  }

  const indices = [];
  const currentDate = new Date(startDate);

  // Loop through each day in the range
  while (currentDate <= endDate) {
    indices.push(getIndexNameForDate(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return indices.join(',');
};

// Delete indices older than retention period (90 days)
const deleteOldIndices = async () => {
  try {
    const client = await getOpenSearchClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days retention

    // Get all indices starting with logs-
    const indices = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    for (const index of indices.body) {
      // Extract date from index name (logs-YYYY-MM-DD)
      const indexDate = index.index.replace('logs-', '');
      const [year, month, day] = indexDate.split('-').map(Number);

      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        continue; // Skip if not in expected format
      }

      const indexDateObj = new Date(year, month - 1, day);

      // Delete if older than retention period
      if (indexDateObj < cutoffDate) {
        console.log(`Deleting old index: ${index.index}`);
        await client.indices.delete({ index: index.index });
      }
    }
  } catch (error) {
    console.error('Error pruning old indices:', error);
  }
};

const updateExistingIndicesWithLocation = async () => {
  try {
    const client = await getOpenSearchClient();
    const indices = await client.cat.indices({ index: 'logs-*', format: 'json' });

    for (const index of indices.body) {
      console.log(`Updating mapping for index: ${index.index}`);
      await client.indices.putMapping({
        index: index.index,
        body: {
          properties: {
            location: {
              type: 'text',
              fields: {
                keyword: {
                  type: 'keyword',
                  ignore_above: 256
                }
              }
            }
          }
        }
      });
    }
    console.log('Finished updating existing indices with location field');
  } catch (error) {
    console.error('Error updating existing indices:', error);
  }
};

// Create false positive rules index
const createFalsePositiveIndex = async (client) => {
  try {
    const falsePositiveExists = await client.indices.exists({ index: INDICES.FALSE_POSITIVES });

    if (!falsePositiveExists.body) {
      await client.indices.create({
        index: INDICES.FALSE_POSITIVES,
        body: {
          mappings: {
            properties: {
              'rule_name': {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              'description': { type: 'text' },
              'conditions': {
                type: 'nested',
                properties: {
                  'field_path': { type: 'keyword' },
                  'operator': { type: 'keyword' },
                  'value': { type: 'keyword' }
                }
              },
              'created_by': {
                properties: {
                  'id': { type: 'keyword' },
                  'username': { type: 'keyword' }
                }
              },
              'created_at': { type: 'date' },
              'updated_at': { type: 'date' },
              'is_active': { type: 'boolean' },
              'match_count': { type: 'long' },
              'last_matched': { type: 'date' }
            }
          }
        }
      });

      console.log('False positive rules index created successfully');
    } else {
      console.log('False positive rules index already exists');
    }
  } catch (error) {
    console.error('Error creating false positive index:', error);
    throw error;
  }
};

// Create the index templates for time-based sharding
const createIndexTemplates = async () => {
  try {
    const client = await getOpenSearchClient();

    // Create template for logs with false positive fields
    await client.indices.putTemplate({
      name: 'logs-template',
      body: {
        index_patterns: ['logs-*'],
        mappings: {
          properties: {
            '@timestamp': { type: 'date' },
            'id': { type: 'keyword' },
            // FALSE POSITIVE FIELDS
            'is_false_positive': { type: 'boolean' },
            'false_positive_rules': {
              type: 'nested',
              properties: {
                'rule_id': { type: 'keyword' },
                'rule_name': { type: 'keyword' },
                'matched_at': { type: 'date' }
              }
            },
            // EXISTING FIELDS
            'agent': {
              properties: {
                'name': { type: 'keyword' },
                'id': { type: 'keyword' },
                'ip': { type: 'ip', ignore_malformed: true }
              }
            },
            'location': {
              type: 'text',
              fields: {
                keyword: {
                  type: 'keyword',
                  ignore_above: 256
                }
              }
            },
            'rule': {
              properties: {
                'id': { type: 'keyword' },
                'level': { type: 'integer' },
                'description': { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
                'groups': { type: 'keyword' },
                'mitre': {
                  properties: {
                    'id': { type: 'keyword' },
                    'tactic': { type: 'keyword' },
                    'technique': { type: 'keyword' }
                  }
                },
                'gdpr': { type: 'keyword' },
                'hipaa': { type: 'keyword' },
                'gpg13': { type: 'keyword' },
                'nist': { type: 'keyword' },
                'pci_dss': { type: 'keyword' },
                'tsc': { type: 'keyword' }
              }
            },
            'network': {
              properties: {
                'srcIp': { type: 'ip', ignore_malformed: true },
                'destIp': { type: 'ip', ignore_malformed: true },
                'protocol': { type: 'keyword' },
                'srcPort': { type: 'integer' },
                'destPort': { type: 'integer' },
                'flow': {
                  properties: {
                    'state': { type: 'keyword' },
                    'pktsToServer': { type: 'long' },
                    'bytesToServer': { type: 'long' },
                    'pktsToClient': { type: 'long' },
                    'bytesToClient': { type: 'long' }
                  }
                }
              }
            },
            'data': {
              type: 'object',
              enabled: true,
              properties: {
                'win': { type: 'object', enabled: true },
                'action': { type: 'keyword' },
                'app': { type: 'keyword' },
                'appcat': { type: 'keyword' }
              }
            },
            'syscheck': {
              type: 'object',
              enabled: true,
              properties: {
                'path': { type: 'keyword' },
                'mode': { type: 'keyword' },
                'size_after': { type: 'keyword' },
                'size_before': { type: 'keyword' },
                'uid_after': { type: 'keyword' },
                'uid_before': { type: 'keyword' },
                'gid_after': { type: 'keyword' },
                'gid_before': { type: 'keyword' },
                'md5_after': { type: 'keyword' },
                'md5_before': { type: 'keyword' },
                'sha1_after': { type: 'keyword' },
                'sha1_before': { type: 'keyword' },
                'sha256_after': { type: 'keyword' },
                'sha256_before': { type: 'keyword' },
                'uname_after': { type: 'keyword' },
                'uname_before': { type: 'keyword' },
                'mtime_after': { type: 'date' },
                'mtime_before': { type: 'date' },
                'changed_attributes': { type: 'keyword' },
                'event': { type: 'keyword' },
                'diff': { type: 'text' },
                'attrs_after': { type: 'keyword' },
                'attrs_before': { type: 'keyword' },
                'win_perm_after': {
                  type: 'nested',
                  properties: {
                    'name': { type: 'keyword' },
                    'allowed': { type: 'keyword' }
                  }
                },
                'win_perm_before': {
                  type: 'nested',
                  properties: {
                    'name': { type: 'keyword' },
                    'allowed': { type: 'keyword' }
                  }
                },
                'audit': {
                  properties: {
                    'user': {
                      properties: {
                        'id': { type: 'keyword' },
                        'name': { type: 'keyword' }
                      }
                    },
                    'process': {
                      properties: {
                        'id': { type: 'keyword' },
                        'name': { type: 'keyword' }
                      }
                    }
                  }
                }
              }
            },
            'ai_ml_logs': {
              type: 'object',
              enabled: true,
              properties: {
                'timestamp': { type: 'date' },
                'log_analysis': { type: 'keyword' },
                'anomaly_detected': { type: 'boolean' },
                'anomaly_score': { type: 'integer' },
                'original_log_id': { type: 'keyword' },
                'original_source': { type: 'keyword' },
                'analysis_timestamp': { type: 'date' },
                'correlation': {
                  properties: {
                    'source': { type: 'keyword' },
                    'destination': { type: 'keyword' },
                    'path': { type: 'keyword' },
                    'description': { type: 'text' }
                  }
                },
                'log_summary': { type: 'text' },
                'categories': {
                  properties: {
                    'score_category': { type: 'keyword' },
                    'severity_category': { type: 'keyword' },
                    'combined_risk': { type: 'keyword' }
                  }
                },
                'hybrid_score': { type: 'float' },
                'anomaly_reason': { type: 'text' },
                'cluster_info': {
                  properties: {
                    'cluster_id': { type: 'integer' },
                    'is_outlier': { type: 'boolean' },
                    'is_in_small_cluster': { type: 'boolean' }
                  }
                },
                'score_explanation': { type: 'object', enabled: false }
              }
            },
            'raw_log': {
              type: 'object',
              enabled: false,
              properties: {
                'message': {
                  type: 'text',
                  fields: {
                    'keyword': { type: 'keyword' }
                  }
                }
              }
            }
          }
        },
        settings: {
          'index.refresh_interval': '30s',  // Changed from 5s for better performance
          'index.number_of_shards': 1,
          'index.number_of_replicas': 0,   // Critical: 0 replicas for single node
          'index.mapping.total_fields.limit': 2000,
          'index.translog.flush_threshold_size': '512mb',
          'index.translog.sync_interval': '30s'
        }
      }
    });

    console.log('OpenSearch logs template created/updated successfully');

    // Create false positive index
    await createFalsePositiveIndex(client);

    // Create today's index if it doesn't exist
    const todayIndex = getTodayIndexName();
    const indexExists = await client.indices.exists({ index: todayIndex });
    await updateExistingIndicesWithLocation();

    if (!indexExists.body) {
      await client.indices.create({ index: todayIndex });
      console.log(`Created today's index: ${todayIndex}`);
    } else {
      console.log(`Today's index already exists: ${todayIndex}`);
    }

    // Create users index if needed
    const userIndex = INDICES.USERS;
    const userExists = await client.indices.exists({ index: userIndex });

    if (!userExists.body) {
      await client.indices.create({
        index: userIndex,
        body: {
          mappings: {
            properties: {
              username: { type: 'keyword' },
              password: { type: 'keyword' },
              fullName: { type: 'text' },
              email: { type: 'keyword' },
              phone: { type: 'keyword' },
              department: { type: 'keyword' },
              role: { type: 'keyword' },
              plan: { type: 'keyword' },
              authority: { type: 'keyword' },
              planExpiryDate: { type: 'date' },
              active: { type: 'boolean' },
              lastLogin: { type: 'date' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' }
            }
          }
        }
      });

      console.log('Users index created');
      await createDefaultAdmin(client);
    }

    // Create tickets index if needed
    const ticketsIndex = INDICES.TICKETS;
    const ticketsExists = await client.indices.exists({ index: ticketsIndex });

    if (!ticketsExists.body) {
      await client.indices.create({
        index: ticketsIndex,
        body: {
          mappings: {
            properties: {
              ticketId: { type: 'keyword' },
              creator: {
                properties: {
                  id: { type: 'keyword' },
                  username: { type: 'keyword' },
                  name: { type: 'text' }
                }
              },
              assignedTo: {
                properties: {
                  id: { type: 'keyword' },
                  username: { type: 'keyword' },
                  name: { type: 'text' }
                }
              },
              logSummary: {
                properties: {
                  originalLogId: { type: 'keyword' },
                  timestamp: { type: 'date' }
                }
              },
              originalLog: { type: 'object', enabled: false },
              status: { type: 'keyword' },
              description: { type: 'text' },
              statusHistory: {
                type: 'nested',
                properties: {
                  status: { type: 'keyword' },
                  changedBy: {
                    properties: {
                      id: { type: 'keyword' },
                      username: { type: 'keyword' }
                    }
                  },
                  description: { type: 'text' },
                  timestamp: { type: 'date' }
                }
              },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' }
            }
          }
        }
      });
      console.log('Tickets index created');
    }

    // Create tickets_counter index if needed
    const counterExists = await client.indices.exists({ index: 'tickets_counter' });

    if (!counterExists.body) {
      await client.indices.create({ index: 'tickets_counter' });
      await client.index({
        index: 'tickets_counter',
        id: 'counter',
        body: {
          seq: 0
        },
        refresh: true
      });
      console.log('Tickets counter created');
    }

    // Schedule daily index cleanup
    deleteOldIndices();

    return client;
  } catch (error) {
    console.error('Error creating OpenSearch index templates:', error);
    throw error;
  }
};

const fixUnassignedShards = async () => {
  try {
    const client = await getOpenSearchClient();
    
    console.log('Fixing unassigned shards by setting replicas to 0...');
    
    // Set all indices to 0 replicas
    await client.indices.putSettings({
      index: '_all',
      body: {
        'index.number_of_replicas': 0
      }
    });
    
    console.log('✅ Fixed unassigned shards - set all indices to 0 replicas');
    
    // Wait a moment for the changes to apply
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check cluster health
    const health = await client.cluster.health({ wait_for_status: 'yellow', timeout: '30s' });
    console.log(`Cluster status after fix: ${health.body.status}`);
    
  } catch (error) {
    console.error('Error fixing unassigned shards:', error.message);
  }
};

module.exports = {
  getOpenSearchClient,
  createIndexTemplates,
  getIndexNameForDate,
  getTodayIndexName,
  getIndexPatternForDateRange,
  deleteOldIndices,
  checkOpenSearchStatus,
  updateExistingIndicesWithLocation,
  fixUnassignedShards,
  INDICES
};