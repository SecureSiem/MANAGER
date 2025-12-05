const express = require('express');
const axios = require('axios');
const router = express.Router();
const { getOpenSearchClient, getIndexNameForDate, getIndexPatternForDateRange } = require('../config/opensearch');
const { ApiError } = require('../utils/errorHandler');
const { authenticate, hasRole } = require('../middleware/authMiddleware');
router.use(authenticate);

const addFalsePositiveFilter = (query) => {
  // Automatically exclude false positives from all queries
  if (!query.bool) {
    query.bool = { must: [] };
  }
  if (!query.bool.must) {
    query.bool.must = [];
  }

  // Add false positive filter
  query.bool.must.push({
    bool: {
      should: [
        { term: { 'is_false_positive': false } },
        { bool: { must_not: { exists: { field: 'is_false_positive' } } } }
      ],
      minimum_should_match: 1
    }
  });

  return query;
};

// Utility function to parse time range parameters
const parseTimeRange = (timeRange = '24h') => {
  const now = new Date();
  let startDate = new Date(now);
  let endDate = new Date(now);

  // Parse timeRange
  if (timeRange.startsWith('custom:')) {
    // Custom absolute timerange
    const parts = timeRange.split(':');
    if (parts.length === 3) {
      startDate = new Date(parts[1]);
      endDate = new Date(parts[2]);
    }
  } else {
    // Relative timerange
    switch (timeRange) {
      case '15m':
        startDate.setMinutes(startDate.getMinutes() - 15);
        break;
      case '1h':
        startDate.setHours(startDate.getHours() - 1);
        break;
      case '4h':
        startDate.setHours(startDate.getHours() - 4);
        break;
      case '12h':
        startDate.setHours(startDate.getHours() - 12);
        break;
      case '3d':
        startDate.setDate(startDate.getDate() - 3);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '15d':
        startDate.setDate(startDate.getDate() - 15);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '24h':
      default:
        startDate.setDate(startDate.getDate() - 1);
        break;
    }
  }

  return { startDate, endDate };
};



// this is added by raman to check the functionality right now

// DELETE /api/logs/:id?timestamp=2023-07-30T14:00:00Z
router.delete('/:id', async (req, res) => {
  const logId = req.params.id;
  const timestamp = req.query.timestamp;

  if (!timestamp) {
    return res.status(400).json({ message: 'Timestamp query parameter is required to determine index.' });
  }

  try {
    const client = await getOpenSearchClient();

    // Determine index name from timestamp
    const index = getIndexNameForDate(timestamp);

    // Attempt to delete document by ID from calculated index
    const result = await client.delete({
      index,
      id: logId,
    });

    if (result.body?.result === 'deleted') {
      return res.status(200).json({ message: 'Log deleted successfully' });
    } else {
      // Cover cases like "not_found" result
      return res.status(404).json({ message: 'Log not found' });
    }

  } catch (error) {
    console.error('Error deleting log:', error);

    if (error.body?.result === 'not_found') {
      return res.status(404).json({ message: 'Log not found' });
    }

    return res.status(500).json({ message: 'Error deleting log', error: error.meta || String(error) });
  }
});







router.get('/major', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h'
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byLevel: [],
          byAgent: [],
          byTimeInterval: [],
          mitreCategories: {
            tactics: [],
            techniques: [],
            ids: []
          },
          ruleGroups: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // Build main query for logs with rule level >= 12
    const majorLogsQuery = {
      bool: {
        must: [
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          {
            range: {
              'rule.level': {
                gte: 12
              }
            }
          }
        ]
      }
    };

    if (search) {
      majorLogsQuery.bool.must.push({
        match: {
          'raw_log.message': {
            query: search,
            operator: 'or'
          }
        }
      });
    }

    // Get paginated major logs
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query: majorLogsQuery,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    // Get statistics for major logs in parallel
    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        query: majorLogsQuery,
        aggs: {
          // Severity distribution (by rule level)
          level_distribution: {
            terms: {
              field: 'rule.level',
              size: 10
            }
          },
          // Agent distribution
          agent_distribution: {
            terms: {
              field: 'agent.name',
              size: 20
            }
          },
          // Time trend
          time_trend: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            }
          },
          // MITRE ATT&CK Tactics
          mitre_tactics: {
            nested: {
              path: 'rule.mitre.tactic'
            },
            aggs: {
              tactics: {
                terms: {
                  field: 'rule.mitre.tactic',
                  size: 20
                }
              }
            }
          },
          // MITRE ATT&CK Techniques
          mitre_techniques: {
            nested: {
              path: 'rule.mitre.technique'
            },
            aggs: {
              techniques: {
                terms: {
                  field: 'rule.mitre.technique',
                  size: 20
                }
              }
            }
          },
          // MITRE ATT&CK IDs
          mitre_ids: {
            nested: {
              path: 'rule.mitre.id'
            },
            aggs: {
              ids: {
                terms: {
                  field: 'rule.mitre.id',
                  size: 20
                }
              }
            }
          },
          // Rule groups
          rule_groups: {
            terms: {
              field: 'rule.groups',
              size: 20
            }
          }
        }
      }
    });

    // Process and format the logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Process statistics
    const aggregations = statsResponse.body.aggregations;
    const stats = {
      total: logsResponse.body.hits.total.value,
      byLevel: aggregations.level_distribution.buckets.map(bucket => ({
        level: bucket.key,
        count: bucket.doc_count
      })),
      byAgent: aggregations.agent_distribution.buckets.map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byTimeInterval: aggregations.time_trend.buckets.map(bucket => ({
        timestamp: bucket.key_as_string,
        count: bucket.doc_count
      })),
      mitreCategories: {
        tactics: aggregations.mitre_tactics?.tactics?.buckets || [],
        techniques: aggregations.mitre_techniques?.techniques?.buckets || [],
        ids: aggregations.mitre_ids?.ids?.buckets || []
      },
      ruleGroups: aggregations.rule_groups.buckets.map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      }))
    };

    // Return results
    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: logsResponse.body.hits.total.value,
        pages: Math.ceil(logsResponse.body.hits.total.value / pageSize)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get logs with Tor Browser activity
router.get('/tor-browser', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      sortBy = '@timestamp',
      sortOrder = 'desc'
    } = req.query;

    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);
    if (pageSize > 100000) pageSize = 100000;

    const from = (currentPage - 1) * pageSize;
    const client = await getOpenSearchClient();

    // Get all indices matching logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];
    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    if (indices.length === 0) {
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byDestinationIp: [],
          byAgent: [],
          byProtocol: [],
          byPort: [],
          timeDistribution: []
        },
        pagination: { page: currentPage, limit: pageSize, total: 0, pages: 0 }
      });
    }

    // ✅ Core query — exact logic you asked for
    const query = {
      bool: {
        must: [
          {
            term: {
              'rule.id': '130001'
            }
          },
          {
            wildcard: {
              'data.win.eventdata.image': {
                value: '*tor.exe',
                case_insensitive: true // ensures it matches Tor.exe / TOR.EXE / tor.exe etc.
              }
            }
          }
        ]
      }
    };

    // ✅ Aggregations (safe keyword usage for fields that support it)
    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        track_total_hits: true,
        query,
        aggs: {
          destination_ips: {
            terms: {
              field: 'data.win.eventdata.destinationIp.keyword',
              size: 50
            }
          },
          agents: {
            terms: {
              field: 'agent.name.keyword',
              size: 20,
              missing: 'N/A'
            }
          },
          protocols: {
            terms: {
              field: 'data.win.eventdata.protocol.keyword',
              size: 10
            }
          },
          ports: {
            terms: {
              field: 'data.win.eventdata.destinationPort.keyword',
              size: 20
            }
          },
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'hour'
            }
          }
        }
      }
    });

    const totalCount = statsResponse.body.hits.total.value;

    // ✅ Paginated logs
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy === 'agent.name' ? 'agent.name.keyword' : sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    const aggs = statsResponse.body.aggregations;
    const stats = {
      total: totalCount,
      byDestinationIp: aggs.destination_ips.buckets.map(b => ({ ip: b.key, count: b.doc_count })),
      byAgent: aggs.agents.buckets.map(b => ({ name: b.key, count: b.doc_count })),
      byProtocol: aggs.protocols.buckets.map(b => ({ protocol: b.key, count: b.doc_count })),
      byPort: aggs.ports.buckets.map(b => ({ port: b.key, count: b.doc_count })),
      timeDistribution: aggs.time_distribution.buckets.map(b => ({
        date: b.key_as_string,
        count: b.doc_count
      }))
    };

    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        pages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (error) {
    console.error('Error in Tor Browser (rule.id=130001 + image=*tor.exe) route:', error);
    next(error);
  }
});


router.get('/advanced-analytics', async (req, res, next) => {
  try {
    const { timeRange = '12h' } = req.query; // ✅ Changed default to 12h

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Calculate dynamic flow limit based on time range
    const timeDiffHours = (endDate - startDate) / (1000 * 60 * 60);
    let flowLimit = 60; // Default

    if (timeDiffHours <= 24) {
      flowLimit = 100;  // 24 hours or less: 100 flows
    } else if (timeDiffHours <= 72) {
      flowLimit = 150;  // 1-3 days: 150 flows
    } else if (timeDiffHours <= 168) {
      flowLimit = 200;  // 3-7 days: 200 flows
    } else {
      flowLimit = 250;  // 7+ days: 250 flows
    }

    console.log(`📊 Time range: ${timeRange} (${timeDiffHours.toFixed(1)}h) → Flow limit: ${flowLimit}`);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      return res.json({
        summary: {
          total: 0,
          warnings: 0,
          critical: 0,
          normal: 0
        },
        timeline: [],
        ruleLevels: [],
        ruleDescriptions: [],
        topAgents: [],
        topProtocols: [],
        topServices: [], // ✅ Added topServices
        networkFlows: []
      });
    }

    // Multiple queries in parallel for better performance
    const [summaryResponse, timelineResponse, detailsResponse, networkResponse] = await Promise.all([
      // Query 1: Get summary counts
      client.search({
        index: indices.join(','),
        body: {
          size: 0,
          track_total_hits: true,
          query: {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          aggs: {
            critical_events: {
              filter: {
                range: {
                  'rule.level': {
                    gte: 12
                  }
                }
              }
            },
            warning_events: {
              filter: {
                range: {
                  'rule.level': {
                    gte: 9,
                    lt: 12
                  }
                }
              }
            }
          }
        }
      }),

      // Query 2: Get timeline data
      client.search({
        index: indices.join(','),
        body: {
          size: 0,
          query: {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          aggs: {
            events_over_time: {
              date_histogram: {
                field: '@timestamp',
                calendar_interval: 'day'
              },
              aggs: {
                critical_events: {
                  filter: {
                    range: {
                      'rule.level': {
                        gte: 12
                      }
                    }
                  }
                },
                warning_events: {
                  filter: {
                    range: {
                      'rule.level': {
                        gte: 9,
                        lt: 12
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }),

      // Query 3: Get rule levels and descriptions
      client.search({
        index: indices.join(','),
        body: {
          size: 0,
          query: {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          aggs: {
            rule_levels: {
              terms: {
                field: 'rule.level',
                size: 20
              }
            },
            top_agents: {
              terms: {
                field: 'agent.name',
                size: 50
              }
            },
            rule_descriptions: {
              terms: {
                field: 'rule.description.keyword',
                size: 50
              }
            }
          }
        }
      }),

      // Query 4: Get network data using AGGREGATIONS (like old code)
      client.search({
        index: indices.join(','),
        body: {
          size: 0, // No raw documents needed
          query: {
            bool: {
              must: [
                {
                  range: {
                    '@timestamp': {
                      gte: startDate.toISOString(),
                      lte: endDate.toISOString()
                    }
                  }
                }
              ]
            }
          },
          aggs: {
            protocols: {
              terms: {
                field: 'network.protocol',
                size: 20,
                missing: 'unknown'
              }
            },
            services: {
              terms: {
                field: 'data.service.keyword',
                size: 20
              }
            },
            // Network flows - INCLUDE PROTOCOL in composite aggregation sources
            network_flows: {
              composite: {
                size: flowLimit, // Dynamic based on time range
                sources: [
                  { srcIp: { terms: { field: 'network.srcIp', missing_bucket: true } } },
                  { destIp: { terms: { field: 'network.destIp', missing_bucket: true } } },
                  { protocol: { terms: { field: 'network.protocol', missing_bucket: true } } }
                ]
              },
              aggs: {
                // Get document count as proxy for flow volume
                flow_count: {
                  value_count: {
                    field: 'network.srcIp'
                  }
                },
                // Get source port
                src_ports: {
                  terms: {
                    field: 'network.srcPort',
                    size: 5
                  }
                },
                // Get destination port
                dest_ports: {
                  terms: {
                    field: 'network.destPort',
                    size: 5
                  }
                },
                // Get latest timestamp
                latest_timestamp: {
                  max: {
                    field: '@timestamp'
                  }
                },
                // Get earliest timestamp
                earliest_timestamp: {
                  min: {
                    field: '@timestamp'
                  }
                }
              }
            },
            // Fallback aggregation: use data.dest_ip.keyword when network.destIp is "unknown"
            network_flows_fallback: {
              composite: {
                size: Math.floor(flowLimit * 0.8), // Dynamic fallback limit (80% of main)
                sources: [
                  { srcIp: { terms: { field: 'network.srcIp', missing_bucket: false } } },
                  { destIp: { terms: { field: 'data.dest_ip.keyword', missing_bucket: false } } },
                  { protocol: { terms: { field: 'network.protocol', missing_bucket: true } } }
                ]
              },
              aggs: {
                flow_count: {
                  value_count: {
                    field: 'network.srcIp'
                  }
                },
                src_ports: {
                  terms: {
                    field: 'network.srcPort',
                    size: 5
                  }
                },
                dest_ports: {
                  terms: {
                    field: 'network.destPort',
                    size: 5
                  }
                },
                latest_timestamp: {
                  max: {
                    field: '@timestamp'
                  }
                },
                earliest_timestamp: {
                  min: {
                    field: '@timestamp'
                  }
                }
              }
            }
          }
        }
      })
    ]);

    // Helper function: Normalize protocol (6→tcp, 17→udp, 1→icmp, "UDP"→udp)
    const normalizeProtocol = (proto) => {
      if (!proto || proto === 'unknown') return 'unknown';
      const p = proto.toString().toLowerCase().trim();

      // Common numeric protocols to names (IANA Protocol Numbers)
      if (p === '6') return 'tcp';
      if (p === '17') return 'udp';
      if (p === '1') return 'icmp';
      if (p === '58') return 'icmpv6';
      if (p === '47') return 'gre';      // Generic Routing Encapsulation
      if (p === '50') return 'esp';      // Encapsulating Security Payload
      if (p === '51') return 'ah';       // Authentication Header
      if (p === '89') return 'ospf';     // Open Shortest Path First
      if (p === '88') return 'eigrp';    // Enhanced Interior Gateway Routing Protocol
      if (p === '132') return 'sctp';    // Stream Control Transmission Protocol
      if (p === '4') return 'ipip';      // IP-in-IP tunneling
      if (p === '41') return 'ipv6';     // IPv6 encapsulation
      if (p === '2') return 'igmp';      // Internet Group Management Protocol
      if (p === '103') return 'pim';     // Protocol Independent Multicast
      if (p === '112') return 'vrrp';    // Virtual Router Redundancy Protocol

      // String normalization
      if (p.includes('tcp')) return 'tcp';
      if (p.includes('udp')) return 'udp';
      if (p.includes('icmp')) return 'icmp';
      if (p.includes('gre')) return 'gre';
      if (p.includes('esp')) return 'esp';
      if (p.includes('ospf')) return 'ospf';
      if (p.includes('sctp')) return 'sctp';

      return p;
    };

    // Helper function: Validate IP addresses (filter invalid IPv4/IPv6)
    const isValidIP = (ip) => {
      if (!ip || ip === 'unknown') return false;

      // IPv4 validation
      if (ip.includes('.')) {
        if (ip === '0.0.0.0' || ip === '255.255.255.255') return false;
        if (ip.startsWith('224.') || ip.startsWith('239.')) return false; // Multicast
        if (ip.startsWith('169.254.')) return false; // Link-local
        if (ip.startsWith('127.')) return false; // Loopback
        return true;
      }

      // IPv6 validation
      if (ip.includes(':')) {
        const lower = ip.toLowerCase();
        if (lower === '::' || lower === '0000:0000:0000:0000:0000:0000:0000:0000') return false; // Unspecified
        if (lower === '::1') return false; // Loopback
        if (lower.startsWith('ff')) return false; // Multicast (ff00::/8)
        if (lower.startsWith('fe80:')) return false; // Link-local
        return true;
      }

      return false;
    };

    // Process summary results
    const totalEvents = summaryResponse.body.hits.total.value;
    const criticalEvents = summaryResponse.body.aggregations.critical_events.doc_count;
    const warningEvents = summaryResponse.body.aggregations.warning_events.doc_count;
    const normalEvents = totalEvents - criticalEvents - warningEvents;

    // Process timeline results
    const timelineBuckets = timelineResponse.body.aggregations.events_over_time.buckets;
    const timeline = timelineBuckets.map(bucket => ({
      timestamp: bucket.key_as_string,
      total: bucket.doc_count,
      critical: bucket.critical_events.doc_count,
      warning: bucket.warning_events.doc_count
    }));

    // Process rule details
    const ruleLevels = detailsResponse.body.aggregations.rule_levels.buckets.map(bucket => ({
      level: bucket.key,
      count: bucket.doc_count
    }));

    const topAgents = detailsResponse.body.aggregations.top_agents.buckets.map(bucket => ({
      name: bucket.key,
      count: bucket.doc_count
    }));

    const ruleDescriptions = detailsResponse.body.aggregations.rule_descriptions.buckets.map(bucket => ({
      description: bucket.key,
      count: bucket.doc_count
    }));

    // Process network data
    const topProtocols = networkResponse.body.aggregations.protocols.buckets.map(bucket => ({
      name: bucket.key || 'unknown',
      count: bucket.doc_count
    }));

    // process service data 
    const topServices = networkResponse.body.aggregations.services.buckets.map(bucket => ({
      name: bucket.key || 'unknown',
      count: bucket.doc_count
    }));

    // Process network flows - MERGE PRIMARY AND FALLBACK AGGREGATIONS
    const primaryBuckets = networkResponse.body.aggregations?.network_flows?.buckets || [];
    const fallbackBuckets = networkResponse.body.aggregations?.network_flows_fallback?.buckets || [];

    console.log(`📊 Primary flow buckets (network.destIp): ${primaryBuckets.length}`);
    console.log(`📊 Fallback flow buckets (data.dest_ip): ${fallbackBuckets.length}`);

    // Combine both sources
    const networkFlowsBuckets = [...primaryBuckets, ...fallbackBuckets];
    console.log(`📊 Total combined flow buckets: ${networkFlowsBuckets.length}`);

    const networkFlows = [];
    const protocolStats = {};
    const filteredOut = { invalidIP: 0, selfLoop: 0, invalidSamples: [] };

    networkFlowsBuckets.forEach(bucket => {
      const src = bucket.key.srcIp;
      const dst = bucket.key.destIp;
      const rawProtocol = bucket.key.protocol || 'unknown'; // NOW protocol is in the key!

      // Track protocol stats BEFORE filtering
      protocolStats[rawProtocol] = (protocolStats[rawProtocol] || 0) + 1;

      // Use helper functions to validate IPs
      if (!isValidIP(src) || !isValidIP(dst)) {
        filteredOut.invalidIP++;
        // Save first 5 samples to see what's being filtered
        if (filteredOut.invalidSamples.length < 5) {
          filteredOut.invalidSamples.push({ src, dst, protocol: rawProtocol });
        }
        return;
      }
      if (src === dst) {
        filteredOut.selfLoop++;
        return;
      }

      const flowCount = bucket.flow_count?.value || bucket.doc_count || 1;

      // Use flow count as approximate bytes (for visualization purposes)
      const bytesToServer = flowCount * 100; // Approximate
      const bytesToClient = 0; // We don't have bidirectional data

      const protocol = normalizeProtocol(rawProtocol); // Normalize protocol

      // Extract ports (get top ports from aggregation)
      const srcPorts = bucket.src_ports?.buckets?.map(b => b.key) || [];
      const destPorts = bucket.dest_ports?.buckets?.map(b => b.key) || [];

      // Extract timestamps
      const latestTime = bucket.latest_timestamp?.value_as_string || bucket.latest_timestamp?.value;
      const earliestTime = bucket.earliest_timestamp?.value_as_string || bucket.earliest_timestamp?.value;

      networkFlows.push({
        source: src,
        target: dst,
        bytesToServer,
        bytesToClient,
        protocol, // Normalized protocol (tcp/udp/icmp)
        packetCount: flowCount, // Use flow count as packet count
        srcPort: srcPorts[0] || null, // Most common source port
        destPort: destPorts[0] || null, // Most common destination port
        srcPorts: srcPorts.slice(0, 3), // Top 3 source ports
        destPorts: destPorts.slice(0, 3), // Top 3 destination ports
        latestTimestamp: latestTime,
        earliestTimestamp: earliestTime,
        duration: latestTime && earliestTime ? new Date(latestTime) - new Date(earliestTime) : null
      });
    });

    console.log('📊 Protocol distribution (raw):', protocolStats);
    console.log('🚫 Filtered out:', filteredOut);

    console.log(`🔗 Valid network flows: ${networkFlows.length}`);
    if (networkFlows.length > 0) {
      console.log('📦 Sample flow:', networkFlows[0]);
    }

    // Return results - MINIMAL DATA ONLY
    res.json({
      summary: {
        total: totalEvents,
        warnings: warningEvents,
        critical: criticalEvents,
        normal: normalEvents
      },
      timeline,
      ruleLevels,
      ruleDescriptions,
      topAgents,
      topProtocols,
      topServices,
      networkFlows // ONLY minimal flow data
    });
  } catch (error) {
    console.error('Error in advanced analytics endpoint:', error);
    next(error);
  }
});
// Get endpoint-specific analytics
router.get('/endpoint-analytics/:endpoint', async (req, res, next) => {
  try {
    const { endpoint } = req.params;
    const { timeRange = '7d', page = 1, limit = 200, search = '' } = req.query;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint parameter is required' });
    }

    // Parse pagination parameters
    const pageNum = parseInt(page, 10);
    const pageSize = Math.min(parseInt(limit, 10), 10000);
    const from = (pageNum - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      return res.json({
        analytics: {
          ruleLevels: [],
          ruleGroups: [],
          ruleDescriptions: [],
          timeline: []
        },
        logs: [],
        pagination: {
          total: 0,
          page: pageNum,
          limit: pageSize,
          pages: 0
        }
      });
    }

    // Base query with time range and endpoint filter
    const baseQuery = {
      bool: {
        must: [
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          {
            term: {
              'agent.name': endpoint
            }
          }
        ]
      }
    };

    // Add search filter if provided
    if (search && search.trim() !== '') {
      baseQuery.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule.description^3',
            'rule.groups^2',
            'agent.name',
            'rule.id',
            'data.srcip',
            'data.dstip'
          ]
        }
      });
    }

    // Multiple queries in parallel for better performance
    const [ruleLevelsResponse, ruleDetailsResponse, timelineResponse, logsResponse] = await Promise.all([
      // Query 1: Get rule levels
      client.search({
        index: indices.join(','),
        body: {
          size: 0,
          query: baseQuery,
          aggs: {
            rule_levels: {
              terms: {
                field: 'rule.level',
                size: 20
              }
            }
          }
        }
      }),

      // Query 2: Get rule groups and descriptions
      client.search({
        index: indices.join(','),
        body: {
          size: 0,
          query: baseQuery,
          aggs: {
            rule_groups: {
              terms: {
                field: 'rule.groups',
                size: 20
              }
            },
            rule_descriptions: {
              terms: {
                field: 'rule.description.keyword',
                size: 30
              }
            }
          }
        }
      }),

      // Query 3: Get timeline
      client.search({
        index: indices.join(','),
        body: {
          size: 0,
          query: baseQuery,
          aggs: {
            events_over_time: {
              date_histogram: {
                field: '@timestamp',
                calendar_interval: 'day'
              }
            }
          }
        }
      }),

      // Query 4: Get paginated logs
      client.search({
        index: indices.join(','),
        body: {
          query: baseQuery,
          size: pageSize,
          from: from,
          sort: [{ '@timestamp': { order: 'desc' } }]
        }
      })
    ]);

    // Process results
    const ruleLevels = ruleLevelsResponse.body.aggregations.rule_levels.buckets.map(bucket => ({
      level: bucket.key,
      count: bucket.doc_count
    }));

    const ruleGroups = ruleDetailsResponse.body.aggregations.rule_groups.buckets.map(bucket => ({
      name: bucket.key,
      count: bucket.doc_count
    }));

    const ruleDescriptions = ruleDetailsResponse.body.aggregations.rule_descriptions.buckets.map(bucket => ({
      description: bucket.key,
      count: bucket.doc_count
    }));

    const timeline = timelineResponse.body.aggregations.events_over_time.buckets.map(bucket => ({
      timestamp: bucket.key_as_string,
      count: bucket.doc_count
    }));

    // Process logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      id: hit._id,
      ...hit._source,
      _index: hit._index,
      _score: hit._score
    }));

    const totalLogs = logsResponse.body.hits.total.value;
    const totalPages = Math.ceil(totalLogs / pageSize);

    // Return results with proper structure
    res.json({
      analytics: {
        ruleLevels,
        ruleGroups,
        ruleDescriptions,
        timeline
      },
      logs,
      pagination: {
        total: totalLogs,
        page: pageNum,
        limit: pageSize,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error in endpoint analytics endpoint:', error);
    next(error);
  }
});


// Get logs with FIM information (files added, modified, deleted)
router.get('/fim', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h',
      eventType = ''
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size
    if (pageSize > 10000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 10000, capping at 10000`);
      pageSize = 10000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs that have FIM events (syscheck.event exists)
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure syscheck.event exists
          {
            exists: {
              field: 'syscheck.event'
            }
          }
        ]
      }
    };

    // Add event type filter if specified
    if (eventType) {
      const eventTypes = eventType.split(',').filter(Boolean);
      if (eventTypes.length > 0) {
        query.bool.must.push({
          terms: {
            'syscheck.event': eventTypes
          }
        });
      }
    }

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'syscheck.path^3',
            'agent.name^2',
            'rule.description^2',
            'syscheck.event',
            'syscheck.diff',
            'syscheck.mode',
            'rule.id',
            'id',
            'raw_log.message'
          ]
        }
      });
    }

    addFalsePositiveFilter(query);
    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byEvent: [],
          byAgent: [],
          timeDistribution: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // First get total count and stats with a size 0 query for accuracy
    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        track_total_hits: true, // Ensure accurate counting for large result sets
        query: query,
        aggs: {
          // Event type distribution
          events: {
            terms: {
              field: 'syscheck.event',
              size: 20
            }
          },
          // Agent distribution
          agents: {
            terms: {
              field: 'agent.name',
              size: 50
            }
          },
          // Time distribution with event breakdown
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            },
            aggs: {
              events: {
                filters: {
                  filters: {
                    'added': { term: { 'syscheck.event': 'added' } },
                    'modified': { term: { 'syscheck.event': 'modified' } },
                    'deleted': { term: { 'syscheck.event': 'deleted' } }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Get the total count from the stats query
    const totalCount = statsResponse.body.hits.total.value;

    // Log the stats found
    console.log(`Found ${totalCount} total logs with FIM events`);
    console.log(`Event types found: ${statsResponse.body.aggregations.events.buckets.length}`);
    console.log(`Agents found: ${statsResponse.body.aggregations.agents.buckets.length}`);

    // Now get the specific page of logs
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    // Format the logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Extract aggregation results
    const aggs = statsResponse.body.aggregations;

    // Process time distribution to include events breakdown
    const timeDistribution = aggs.time_distribution.buckets.map(bucket => {
      const eventBuckets = bucket.events.buckets;
      return {
        date: bucket.key_as_string,
        count: bucket.doc_count,
        events: {
          added: eventBuckets.added.doc_count,
          modified: eventBuckets.modified.doc_count,
          deleted: eventBuckets.deleted.doc_count
        }
      };
    });

    // Format the statistics
    const stats = {
      total: totalCount, // Use the accurate total from the stats query
      byEvent: aggs.events.buckets.map(bucket => ({
        event: bucket.key,
        count: bucket.doc_count
      })),
      byAgent: aggs.agents.buckets.map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return results with pagination
    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error in FIM logs route:', error);
    next(error);
  }
});

// Get logs with SCA information
router.get('/sca', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h',
      result = '' // For filtering by result (passed, failed, not applicable)
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size
    if (pageSize > 100000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 100000, capping at 100000`);
      pageSize = 100000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs with SCA information
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Filter for logs with 'sca' in rule.groups
          {
            term: {
              'rule.groups': 'sca'
            }
          }
        ]
      }
    };

    // Add result filter if provided
    if (result) {
      const resultTypes = result.split(',').filter(Boolean);
      if (resultTypes.length > 0) {
        // Filter by specified results (passed, failed, not applicable)
        query.bool.must.push({
          terms: {
            'data.sca.check.result': resultTypes
          }
        });
      }
    }

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule.description^3',
            'data.sca.policy^2',
            'data.sca.check.title^2',
            'agent.name',
            'data.sca.check.id',
            'raw_log.message'
          ],
          type: "best_fields",
          fuzziness: "AUTO"
        }
      });
    }

    addFalsePositiveFilter(query);
    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byResult: [],
          byAgent: [],
          timeDistribution: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // First get total count and stats with a size 0 query for accuracy
    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        track_total_hits: true, // Ensure accurate counting for large result sets
        query: query,
        aggs: {
          // Result distribution
          results: {
            terms: {
              field: 'data.sca.check.result.keyword',
              size: 20,
              missing: "No Result" // Handle logs that don't have this field
            }
          },
          // Agent distribution
          agents: {
            terms: {
              field: 'agent.name',
              size: 50
            }
          },
          // Time distribution with result breakdown
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            },
            aggs: {
              results: {
                terms: {
                  field: 'data.sca.check.result.keyword',
                  size: 20,
                  missing: "No Result"
                }
              }
            }
          },
          // Policy distribution
          policies: {
            terms: {
              field: 'data.sca.policy.keyword',
              size: 50
            }
          }
        }
      }
    });

    // Get the total count from the stats query
    const totalCount = statsResponse.body.hits.total.value;

    console.log(`Found ${totalCount} total logs with SCA information`);

    // Now get the specific page of logs
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    // Format the logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Extract aggregation results
    const aggs = statsResponse.body.aggregations;

    // Process time distribution to include results breakdown
    const timeDistribution = aggs.time_distribution.buckets.map(bucket => {
      // Get result buckets or empty array if not available
      const resultBuckets = bucket.results?.buckets || [];

      // Create a result map for easier access
      const resultMap = {};
      resultBuckets.forEach(rb => {
        resultMap[rb.key] = rb.doc_count;
      });

      return {
        date: bucket.key_as_string,
        count: bucket.doc_count,
        results: {
          passed: resultMap.passed || 0,
          failed: resultMap.failed || 0,
          'not applicable': resultMap['not applicable'] || 0,
          'No Result': resultMap['No Result'] || 0
        }
      };
    });

    // Format the statistics
    const stats = {
      total: totalCount,
      byResult: aggs.results.buckets.map(bucket => ({
        result: bucket.key,
        count: bucket.doc_count
      })),
      byAgent: aggs.agents.buckets.map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byPolicy: aggs.policies.buckets.map(bucket => ({
        policy: bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return results with pagination
    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error in SCA logs route:', error);
    next(error);
  }
});

// Get logs with authentication sessions information
router.get('/sessions', async (req, res, next) => {
  console.error('🚀 SESSION ENDPOINT HIT - START');
  console.error('Request params:', req.query);

  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h',
      authResult = '', // For filtering by authentication_success or authentication_failed
      deviceType = '' // For filtering by device type (firewall, windows, linux, mac)
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size
    if (pageSize > 100000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 100000, capping at 100000`);
      pageSize = 100000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs with authentication_success or authentication_failed
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Filter for logs with authentication_success or authentication_failed in rule.groups
          {
            bool: {
              should: [
                {
                  term: {
                    'rule.groups': 'authentication_success'
                  }
                },
                {
                  term: {
                    'rule.groups': 'authentication_failed'
                  }
                }
              ],
              minimum_should_match: 1
            }
          }
        ]
      }
    };

    // In your backend - fix the device type filters to match frontend logic
    if (deviceType) {
      const deviceFilters = deviceType.split(',').filter(Boolean);
      if (deviceFilters.length > 0) {
        const deviceFilterQuery = {
          bool: {
            should: []
          }
        };

        deviceFilters.forEach(type => {
          switch (type.toLowerCase()) {
            case 'firewall':
              deviceFilterQuery.bool.should.push({
                bool: {
                  should: [
                    { term: { 'rule.groups': 'firewall' } },
                    { term: { 'rule.groups': 'fortigate' } },
                    { term: { 'rule.groups': 'mikrotik' } }
                  ],
                  minimum_should_match: 1
                }
              });
              break;
            case 'windows':
              deviceFilterQuery.bool.should.push({
                term: { 'rule.groups': 'windows' }
              });
              break;
            case 'linux':
              // Match frontend logic: syslog AND NOT firewall
              deviceFilterQuery.bool.should.push({
                bool: {
                  must: [
                    { term: { 'rule.groups': 'syslog' } }
                  ],
                  must_not: [
                    {
                      bool: {
                        should: [
                          { term: { 'rule.groups': 'firewall' } },
                          { term: { 'rule.groups': 'fortigate' } },
                          { term: { 'rule.groups': 'mikrotik' } }
                        ],
                        minimum_should_match: 1
                      }
                    }
                  ]
                }
              });
              break;
            case 'mac':
              deviceFilterQuery.bool.should.push({
                bool: {
                  should: [
                    { term: { 'rule.groups': 'macOS' } },
                    { term: { 'rule.groups': 'apple' } },
                    { term: { 'rule.groups': 'mac' } }
                  ],
                  minimum_should_match: 1
                }
              });
              break;
          }
        });

        deviceFilterQuery.bool.minimum_should_match = 1;
        query.bool.must.push(deviceFilterQuery);
      }
    }

    // Add authentication result filter if provided
    if (authResult) {
      const authFilters = authResult.split(',').filter(Boolean);
      if (authFilters.length > 0) {
        const authFilterQuery = {
          bool: {
            should: []
          }
        };

        // Add filters for each auth result
        authFilters.forEach(result => {
          switch (result.toLowerCase()) {
            case 'success':
              authFilterQuery.bool.should.push({
                term: {
                  'rule.groups': 'authentication_success'
                }
              });
              break;
            case 'failed':
              authFilterQuery.bool.should.push({
                term: {
                  'rule.groups': 'authentication_failed'
                }
              });
              break;
          }
        });

        authFilterQuery.bool.minimum_should_match = 1;
        query.bool.must.push(authFilterQuery);
      }
    }

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule.description^3',
            'agent.name^2',
            'data.dstuser',
            'data.srcuser',
            'data.user',
            'data.win.eventdata.targetUserName',
            'raw_log.message'
          ],
          type: "best_fields",
          fuzziness: "AUTO"
        }
      });
    }

    addFalsePositiveFilter(query);
    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byAuthResult: [],
          byDeviceType: [],
          byAgent: [],
          timeDistribution: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // First get total count and stats with a size 0 query for accuracy
    console.error('📊 EXECUTING STATS QUERY');
    console.error('Query:', JSON.stringify(query, null, 2));
    console.error('Index:', indices.join(','));

    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        track_total_hits: true, // Ensure accurate counting for large result sets
        query: query,
        aggs: {
          // Authentication result distribution (success/failed)
          auth_results: {
            filters: {
              filters: {
                success: {
                  term: {
                    'rule.groups': 'authentication_success'
                  }
                },
                failed: {
                  term: {
                    'rule.groups': 'authentication_failed'
                  }
                }
              }
            }
          },

          // Device type distribution based on rule groups
          device_types: {
            filters: {
              filters: {
                firewall: {
                  bool: {
                    should: [
                      { term: { 'rule.groups': 'firewall' } },
                      { term: { 'rule.groups': 'fortigate' } },
                      { term: { 'rule.groups': 'mikrotik' } }
                    ],
                    minimum_should_match: 1
                  }
                },
                windows: {
                  term: {
                    'rule.groups': 'windows'
                  }
                },
                linux: {
                  bool: {
                    must: [
                      { term: { 'rule.groups': 'syslog' } }
                    ],
                    must_not: [
                      {
                        bool: {
                          should: [
                            { term: { 'rule.groups': 'firewall' } },
                            { term: { 'rule.groups': 'fortigate' } },
                            { term: { 'rule.groups': 'mikrotik' } }
                          ],
                          minimum_should_match: 1
                        }
                      }
                    ]
                  }
                },
                mac: {
                  bool: {
                    should: [
                      {
                        term: {
                          'rule.groups': 'macOS'
                        }
                      },
                      {
                        term: {
                          'rule.groups': 'apple'
                        }
                      }
                    ],
                    minimum_should_match: 1
                  }
                }
              }
            }
          },

          // Authentication results by device type (for more detailed stats)
          auth_by_device: {
            filters: {
              filters: {
                firewall_success: {
                  bool: {
                    must: [
                      {
                        bool: {
                          should: [
                            { term: { 'rule.groups': 'firewall' } },
                            { term: { 'rule.groups': 'fortigate' } },
                            { term: { 'rule.groups': 'mikrotik' } }
                          ],
                          minimum_should_match: 1
                        }
                      },
                      { term: { 'rule.groups': 'authentication_success' } }
                    ]
                  }
                },
                firewall_failed: {
                  bool: {
                    must: [
                      {
                        bool: {
                          should: [
                            { term: { 'rule.groups': 'firewall' } },
                            { term: { 'rule.groups': 'fortigate' } },
                            { term: { 'rule.groups': 'mikrotik' } }
                          ],
                          minimum_should_match: 1
                        }
                      },
                      { term: { 'rule.groups': 'authentication_failed' } }
                    ]
                  }
                },
                windows_success: {
                  bool: {
                    must: [
                      { term: { 'rule.groups': 'windows' } },
                      { term: { 'rule.groups': 'authentication_success' } }
                    ]
                  }
                },
                windows_failed: {
                  bool: {
                    must: [
                      { term: { 'rule.groups': 'windows' } },
                      { term: { 'rule.groups': 'authentication_failed' } }
                    ]
                  }
                },
                linux_success: {
                  bool: {
                    must: [
                      { term: { 'rule.groups': 'syslog' } },
                      { term: { 'rule.groups': 'authentication_success' } }
                    ],
                    must_not: [
                      {
                        bool: {
                          should: [
                            { term: { 'rule.groups': 'firewall' } },
                            { term: { 'rule.groups': 'fortigate' } },
                            { term: { 'rule.groups': 'mikrotik' } }
                          ],
                          minimum_should_match: 1
                        }
                      }
                    ]
                  }
                },
                linux_failed: {
                  bool: {
                    must: [
                      { term: { 'rule.groups': 'syslog' } },
                      { term: { 'rule.groups': 'authentication_failed' } }
                    ],
                    must_not: [
                      {
                        bool: {
                          should: [
                            { term: { 'rule.groups': 'firewall' } },
                            { term: { 'rule.groups': 'fortigate' } },
                            { term: { 'rule.groups': 'mikrotik' } }
                          ],
                          minimum_should_match: 1
                        }
                      }
                    ]
                  }
                },
                mac_success: {
                  bool: {
                    must: [
                      {
                        bool: {
                          should: [
                            { term: { 'rule.groups': 'macOS' } },
                            { term: { 'rule.groups': 'apple' } }
                          ],
                          minimum_should_match: 1
                        }
                      },
                      { term: { 'rule.groups': 'authentication_success' } }
                    ]
                  }
                },
                mac_failed: {
                  bool: {
                    must: [
                      {
                        bool: {
                          should: [
                            { term: { 'rule.groups': 'macOS' } },
                            { term: { 'rule.groups': 'apple' } }
                          ],
                          minimum_should_match: 1
                        }
                      },
                      { term: { 'rule.groups': 'authentication_failed' } }
                    ]
                  }
                }
              }
            }
          },

          // Agent distribution
          agents: {
            terms: {
              field: 'agent.name',
              size: 50
            }
          },

          // Time distribution with auth result breakdown
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            },
            aggs: {
              success: {
                filter: {
                  term: { 'rule.groups': 'authentication_success' }
                }
              },
              failed: {
                filter: {
                  term: { 'rule.groups': 'authentication_failed' }
                }
              }
            }
          }
        }
      }
    });

    // Get the total count from the stats query
    const totalCount = statsResponse.body.hits.total.value;

    console.log(`Found ${totalCount} total logs with authentication sessions`);

    // Now get the specific page of logs
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    addFalsePositiveFilter(query);

    // Format the logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Extract aggregation results
    console.error('🔍 AGGREGATION EXTRACTION START');

    try {
      const aggs = statsResponse.body.aggregations;
      console.error('✅ Aggregations retrieved successfully');
      console.error('Firewall bucket doc_count:', aggs?.device_types?.buckets?.firewall?.doc_count);
      console.error('Full device_types:', JSON.stringify(aggs?.device_types, null, 2));
      console.error('Full auth_by_device firewall:', JSON.stringify({
        firewall_success: aggs?.auth_by_device?.buckets?.firewall_success,
        firewall_failed: aggs?.auth_by_device?.buckets?.firewall_failed
      }, null, 2));
    } catch (aggError) {
      console.error('❌ ERROR extracting aggregations:', aggError);
      console.error('Stats response structure:', JSON.stringify(statsResponse?.body, null, 2));
    }

    const aggs = statsResponse.body.aggregations;

    // Process time distribution to include auth results
    const timeDistribution = aggs.time_distribution.buckets.map(bucket => {
      return {
        date: bucket.key_as_string,
        count: bucket.doc_count,
        results: {
          success: bucket.success.doc_count || 0,
          failed: bucket.failed.doc_count || 0
        }
      };
    });

    // Format the statistics
    const stats = {
      total: totalCount,
      byAuthResult: {
        success: aggs.auth_results.buckets.success.doc_count || 0,
        failed: aggs.auth_results.buckets.failed.doc_count || 0
      },
      byDeviceType: {
        firewall: aggs.device_types.buckets.firewall.doc_count || 0,
        windows: aggs.device_types.buckets.windows.doc_count || 0,
        linux: aggs.device_types.buckets.linux.doc_count || 0,
        mac: aggs.device_types.buckets.mac.doc_count || 0
      },
      byAuthAndDevice: {
        firewall: {
          success: aggs.auth_by_device.buckets.firewall_success.doc_count || 0,
          failed: aggs.auth_by_device.buckets.firewall_failed.doc_count || 0
        },
        windows: {
          success: aggs.auth_by_device.buckets.windows_success.doc_count || 0,
          failed: aggs.auth_by_device.buckets.windows_failed.doc_count || 0
        },
        linux: {
          success: aggs.auth_by_device.buckets.linux_success.doc_count || 0,
          failed: aggs.auth_by_device.buckets.linux_failed.doc_count || 0
        },
        mac: {
          success: aggs.auth_by_device.buckets.mac_success.doc_count || 0,
          failed: aggs.auth_by_device.buckets.mac_failed.doc_count || 0
        }
      },
      byAgent: (aggs.agents?.buckets || []).map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return results with pagination
    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error in session logs route:', error);
    next(error);
  }
});

router.get('/malware', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h',
      sourceType = '' // For filtering by source type (VirusScanner, SentinelAI, rootcheck)
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size
    if (pageSize > 100000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 100000, capping at 100000`);
      pageSize = 100000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for malware-related logs
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Filter for logs with VirusScanner, SentinelAI, or rootcheck in rule.groups
          {
            bool: {
              should: [
                { term: { 'rule.groups': 'VirusScanner' } },
                { term: { 'rule.groups': 'SentinelAI' } },
                { term: { 'rule.groups': 'rootcheck' } }
              ],
              minimum_should_match: 1
            }
          }
        ]
      }
    };

    // Add source type filter if provided
    if (sourceType) {
      const sourceTypes = sourceType.split(',').filter(Boolean);
      if (sourceTypes.length > 0) {
        // Replace the existing should clause with filtered source types
        query.bool.must[1] = {
          bool: {
            should: sourceTypes.map(type => ({
              term: { 'rule.groups': type }
            })),
            minimum_should_match: 1
          }
        };
      }
    }

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule.description^3',
            'agent.name^2',
            'rule.level',
            'rule.groups',
            'raw_log.message'
          ],
          type: "best_fields",
          fuzziness: "AUTO"
        }
      });
    }

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        stats: {
          total: 0,
          bySourceType: [],
          byAgent: [],
          byDescription: [],
          timeDistribution: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // First get total count and stats with a size 0 query for accuracy
    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        track_total_hits: true, // Ensure accurate counting for large result sets
        query: query,
        aggs: {
          // Source type distribution (VirusScanner, SentinelAI, rootcheck)
          source_types: {
            terms: {
              field: 'rule.groups',
              size: 10,
              include: ['VirusScanner', 'SentinelAI', 'rootcheck']
            }
          },
          // Agent distribution
          agents: {
            terms: {
              field: 'agent.name',
              size: 50
            }
          },
          // Top descriptions
          descriptions: {
            terms: {
              field: 'rule.description.keyword',
              size: 7
            }
          },
          // Time distribution with source type breakdown
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            },
            aggs: {
              source_types: {
                terms: {
                  field: 'rule.groups',
                  size: 10,
                  include: ['VirusScanner', 'SentinelAI', 'rootcheck']
                }
              }
            }
          }
        }
      }
    });

    // Get the total count from the stats query
    const totalCount = statsResponse.body.hits.total.value;

    console.log(`Found ${totalCount} total logs with malware information`);

    // Now get the specific page of logs
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    addFalsePositiveFilter(query);

    // Format the logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Extract aggregation results
    const aggs = statsResponse.body.aggregations;

    // Process time distribution to include source type breakdown
    const timeDistribution = aggs.time_distribution.buckets.map(bucket => {
      // Get source type buckets or empty array if not available
      const sourceTypeBuckets = bucket.source_types?.buckets || [];

      // Create a source type map for easier access
      const sourceTypeMap = {};
      sourceTypeBuckets.forEach(stb => {
        sourceTypeMap[stb.key] = stb.doc_count;
      });

      return {
        date: bucket.key_as_string,
        count: bucket.doc_count,
        sourceTypes: {
          VirusScanner: sourceTypeMap.VirusScanner || 0,
          SentinelAI: sourceTypeMap.SentinelAI || 0,
          rootcheck: sourceTypeMap.rootcheck || 0
        }
      };
    });

    // Format the statistics
    const stats = {
      total: totalCount,
      bySourceType: aggs.source_types.buckets.map(bucket => ({
        type: bucket.key,
        count: bucket.doc_count
      })),
      byAgent: aggs.agents.buckets.map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byDescription: aggs.descriptions.buckets.map(bucket => ({
        description: bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return results with pagination
    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error in malware logs route:', error);
    next(error);
  }
});

// Get logs with Sentinel AI response data
router.get('/sentinel-ai', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h'
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size
    if (pageSize > 10000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 10000, capping at 10000`);
      pageSize = 10000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs that have AI_response data
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure data.AI_response exists
          {
            exists: {
              field: 'data.AI_response'
            }
          }
        ]
      }
    };

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'data.AI_response^3',
            'rule.description^2',
            'agent.name^2',
            'agent.ip',
            'rule.id',
            'rule.level',
            'id',
            'raw_log.message'
          ]
        }
      });
    }

    addFalsePositiveFilter(query);

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // Execute search query
    const response = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    // Format the logs
    const logs = response.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    res.json({
      logs,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: response.body.hits.total.value,
        pages: Math.ceil(response.body.hits.total.value / pageSize)
      }
    });
  } catch (error) {
    console.error('Error in Sentinel AI logs route:', error);
    next(error);
  }
});

// Get logs with ML Analysis data
router.get('/ml-analysis', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h'
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size
    if (pageSize > 10000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 10000, capping at 10000`);
      pageSize = 10000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs that have ML_logs.anomaly_score data
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure data.ML_logs.anomaly_score exists
          {
            exists: {
              field: 'data.ML_logs.anomaly_score'
            }
          }
        ]
      }
    };

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'data.ML_logs.ai_ml_logs^3',
            'data.ML_logs.severity^2',
            'rule.description^2',
            'agent.name^2',
            'agent.ip',
            'rule.id',
            'rule.level',
            'id',
            'raw_log.message'
          ]
        }
      });
    }

    addFalsePositiveFilter(query);

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // Execute search query
    const response = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    // Format the logs
    const logs = response.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    res.json({
      logs,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: response.body.hits.total.value,
        pages: Math.ceil(response.body.hits.total.value / pageSize)
      }
    });
  } catch (error) {
    console.error('Error in ML Analysis logs route:', error);
    next(error);
  }
});

// Get logs with MITRE ATT&CK information
router.get('/mitre', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h'
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs that have MITRE ATT&CK information
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure rule.mitre exists
          {
            exists: {
              field: 'rule.mitre'
            }
          }
        ]
      }
    };

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule.description^3',
            'rule.mitre.tactic^2',
            'rule.mitre.technique^2',
            'rule.mitre.id^2',
            'agent.name',
            "id"
          ]
        }
      });
    }

    addFalsePositiveFilter(query);

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byRuleLevel: [],
          byAgent: [],
          byTactic: [],
          byTechnique: [],
          byMitreId: [],
          timeDistribution: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // Execute search query
    const response = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ],
        // Add aggregations for statistics
        aggs: {
          // Rule level distribution
          rule_levels: {
            terms: {
              field: 'rule.level',
              size: 10
            }
          },
          // Agent distribution
          agents: {
            terms: {
              field: 'agent.name',
              size: 20
            }
          },
          // Time distribution
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            }
          },
          // MITRE ATT&CK Tactics
          mitre_tactics: {
            terms: {
              field: 'rule.mitre.tactic',
              size: 20
            }
          },
          // MITRE ATT&CK Techniques
          mitre_techniques: {
            terms: {
              field: 'rule.mitre.technique',
              size: 20
            }
          },
          // MITRE ATT&CK IDs
          mitre_ids: {
            terms: {
              field: 'rule.mitre.id',
              size: 30
            }
          }
        }
      }
    });

    // Format the logs
    const logs = response.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Extract aggregation results
    const aggs = response.body.aggregations;

    // Format the statistics
    const stats = {
      total: response.body.hits.total.value,
      byRuleLevel: (aggs.rule_levels?.buckets || []).map(bucket => ({
        level: bucket.key,
        count: bucket.doc_count
      })),
      byAgent: (aggs.agents?.buckets || []).map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byTactic: (aggs.mitre_tactics?.buckets || []).map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byTechnique: (aggs.mitre_techniques?.buckets || []).map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byMitreId: (aggs.mitre_ids?.buckets || []).map(bucket => ({
        id: bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution: (aggs.time_distribution?.buckets || []).map(bucket => ({
        date: bucket.key_as_string,
        count: bucket.doc_count
      }))
    };

    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: response.body.hits.total.value,
        pages: Math.ceil(response.body.hits.total.value / pageSize)
      }
    });
  } catch (error) {
    console.error('Error in MITRE logs route:', error);
    next(error);
  }
});
// Get logs with pagination, filtering and sorting

// Get logs with HIPAA information
router.get('/hipaa', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h',
      fullStats = false // New parameter for full stats
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size at 100,000
    if (pageSize > 100000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 100000, capping at 100000`);
      pageSize = 100000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs that have HIPAA information
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure rule.hipaa exists
          {
            exists: {
              field: 'rule.hipaa'
            }
          }
        ]
      }
    };

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule.description^3',
            'rule.hipaa^2',
            'agent.name',
            "id",
            "raw_log.message"
          ]
        }
      });
    }
    addFalsePositiveFilter(query);

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byRuleLevel: [],
          byAgent: [],
          byHipaa: [],
          timeDistribution: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // First get total count and stats with a size 0 query for accuracy
    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        track_total_hits: true, // Ensure accurate counting even with large result sets
        query: query,
        aggs: {
          // Rule level distribution
          rule_levels: {
            terms: {
              field: 'rule.level',
              size: 20 // Increased from 10 to get more complete data
            }
          },
          // Agent distribution
          agents: {
            terms: {
              field: 'agent.name',
              size: 50 // Increased from 20 to get more complete data
            }
          },
          // Time distribution
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            }
          },
          // HIPAA controls
          hipaa_controls: {
            terms: {
              field: 'rule.hipaa',
              size: 100 // Increased from 30 to get more complete data
            }
          }
        }
      }
    });

    // Get the total count from the stats query
    const totalCount = statsResponse.body.hits.total.value;

    // Log the stats found
    console.log(`Found ${totalCount} total logs with HIPAA information`);
    console.log(`Rule levels found: ${statsResponse.body.aggregations.rule_levels.buckets.length}`);
    console.log(`Agents found: ${statsResponse.body.aggregations.agents.buckets.length}`);
    console.log(`HIPAA controls found: ${statsResponse.body.aggregations.hipaa_controls.buckets.length}`);

    // Now get the specific page of logs for pagination
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    // Format the logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Extract aggregation results
    const aggs = statsResponse.body.aggregations;

    // Format the statistics
    const stats = {
      total: totalCount, // Use the accurate total from the stats query
      byRuleLevel: (aggs.rule_levels?.buckets || []).map(bucket => ({
        level: bucket.key,
        count: bucket.doc_count
      })),
      byAgent: (aggs.agents?.buckets || []).map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byHipaa: (aggs.hipaa_controls?.buckets || []).map(bucket => ({
        control: bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution: (aggs.time_distribution?.buckets || []).map(bucket => ({
        date: bucket.key_as_string,
        count: bucket.doc_count
      }))
    };

    // Calculate total pages based on the accurate total count
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return results with pagination
    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error in HIPAA logs route:', error);
    next(error);
  }
});

// Get logs with GDPR information
router.get('/gdpr', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h',
      fullStats = false // Parameter for full stats
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size at 100,000
    if (pageSize > 100000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 100000, capping at 100000`);
      pageSize = 100000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs that have GDPR information
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure rule.gdpr exists
          {
            exists: {
              field: 'rule.gdpr'
            }
          }
        ]
      }
    };

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule.description^3',
            'rule.gdpr^2',
            'rule.level',
            'agent.name',
            "id",
            "raw_log.message",
            "data.srccountry",
            "data.dstcountry"
          ]
        }
      });
    }

    addFalsePositiveFilter(query);

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byRuleLevel: [],
          byAgent: [],
          byGdpr: [],
          timeDistribution: [],
          bySrcCountry: [],
          byDstCountry: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // First get total count and stats with a size 0 query for accuracy
    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        track_total_hits: true, // Ensure accurate counting for large result sets
        query: query,
        aggs: {
          // Rule level distribution
          rule_levels: {
            terms: {
              field: 'rule.level',
              size: 20
            }
          },
          // Agent distribution
          agents: {
            terms: {
              field: 'agent.name',
              size: 50
            }
          },
          // Time distribution
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            }
          },
          // GDPR controls
          gdpr_controls: {
            terms: {
              field: 'rule.gdpr',
              size: 100
            }
          },
          // Source countries
          src_countries: {
            terms: {
              field: 'data.srccountry.keyword',
              size: 50,
              missing: 'Unknown'  // Handle missing values
            }
          },
          // Destination countries
          dst_countries: {
            terms: {
              field: 'data.dstcountry.keyword',
              size: 50,
              missing: 'Unknown'  // Handle missing values
            }
          }
        }
      }
    });

    // Get the total count from the stats query
    const totalCount = statsResponse.body.hits.total.value;

    // Log the stats found
    console.log(`Found ${totalCount} total logs with GDPR information`);
    console.log(`Rule levels found: ${statsResponse.body.aggregations.rule_levels.buckets.length}`);
    console.log(`Agents found: ${statsResponse.body.aggregations.agents.buckets.length}`);
    console.log(`GDPR controls found: ${statsResponse.body.aggregations.gdpr_controls.buckets.length}`);
    console.log(`Source countries found: ${statsResponse.body.aggregations.src_countries.buckets.length}`);
    console.log(`Destination countries found: ${statsResponse.body.aggregations.dst_countries.buckets.length}`);

    // Now get the specific page of logs
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    // Format the logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Extract aggregation results
    const aggs = statsResponse.body.aggregations;

    // Format the statistics
    const stats = {
      total: totalCount, // Use the accurate total from the stats query
      byRuleLevel: (aggs.rule_levels?.buckets || []).map(bucket => ({
        level: bucket.key,
        count: bucket.doc_count
      })),
      byAgent: (aggs.agents?.buckets || []).map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byGdpr: (aggs.gdpr_controls?.buckets || []).map(bucket => ({
        control: bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution: (aggs.time_distribution?.buckets || []).map(bucket => ({
        date: bucket.key_as_string,
        count: bucket.doc_count
      })),
      bySrcCountry: (aggs.src_countries?.buckets || []).map(bucket => ({
        country: bucket.key,
        count: bucket.doc_count
      })),
      byDstCountry: (aggs.dst_countries?.buckets || []).map(bucket => ({
        country: bucket.key,
        count: bucket.doc_count
      }))
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return results with pagination
    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error in GDPR logs route:', error);
    next(error);
  }
});

// Add this endpoint to your routes/logs.js file

// Get logs with NIST information
router.get('/nist', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h',
      fullStats = false // Parameter for full stats
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size at 100,000
    if (pageSize > 100000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 100000, capping at 100000`);
      pageSize = 100000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs that have NIST information
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure rule.nist exists
          {
            exists: {
              field: 'rule.nist'
            }
          }
        ]
      }
    };

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule.description^3',
            'rule.nist^2',
            'rule.level',
            'agent.name',
            "id",
            "raw_log.message",
            "data.hostname",
            "data.service"
          ]
        }
      });
    }
    addFalsePositiveFilter(query);

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byRuleLevel: [],
          byAgent: [],
          byNist: [],
          timeDistribution: [],
          byHostname: [],
          byService: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // First get total count and stats with a size 0 query for accuracy
    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        track_total_hits: true, // Ensure accurate counting for large result sets
        query: query,
        aggs: {
          // Rule level distribution
          rule_levels: {
            terms: {
              field: 'rule.level',
              size: 20
            }
          },
          // Agent distribution
          agents: {
            terms: {
              field: 'agent.name',
              size: 50
            }
          },
          // Time distribution
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            }
          },
          // NIST controls
          nist_controls: {
            terms: {
              field: 'rule.nist',
              size: 100
            }
          },
          // Hostname distribution
          hostnames: {
            terms: {
              field: 'data.hostname.keyword',
              size: 50,
              missing: 'Unknown'  // Handle missing values
            }
          },
          // Service distribution
          services: {
            terms: {
              field: 'data.service.keyword',
              size: 50,
              missing: 'Unknown'  // Handle missing values
            }
          }
        }
      }
    });

    // Get the total count from the stats query
    const totalCount = statsResponse.body.hits.total.value;

    // Log the stats found
    console.log(`Found ${totalCount} total logs with NIST information`);
    console.log(`Rule levels found: ${statsResponse.body.aggregations.rule_levels.buckets.length}`);
    console.log(`Agents found: ${statsResponse.body.aggregations.agents.buckets.length}`);
    console.log(`NIST controls found: ${statsResponse.body.aggregations.nist_controls.buckets.length}`);
    console.log(`Hostnames found: ${statsResponse.body.aggregations.hostnames.buckets.length}`);
    console.log(`Services found: ${statsResponse.body.aggregations.services.buckets.length}`);

    // Now get the specific page of logs
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    // Format the logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Extract aggregation results
    const aggs = statsResponse.body.aggregations;

    // Format the statistics
    const stats = {
      total: totalCount, // Use the accurate total from the stats query
      byRuleLevel: (aggs.rule_levels?.buckets || []).map(bucket => ({
        level: bucket.key,
        count: bucket.doc_count
      })),
      byAgent: (aggs.agents?.buckets || []).map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byNist: (aggs.nist_controls?.buckets || []).map(bucket => ({
        control: bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution: (aggs.time_distribution?.buckets || []).map(bucket => ({
        date: bucket.key_as_string,
        count: bucket.doc_count
      })),
      byHostname: (aggs.hostnames?.buckets || []).map(bucket => ({
        hostname: bucket.key,
        count: bucket.doc_count
      })),
      byService: (aggs.services?.buckets || []).map(bucket => ({
        service: bucket.key,
        count: bucket.doc_count
      }))
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return results with pagination
    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error in NIST logs route:', error);
    next(error);
  }
});

// Get logs with PCI DSS information
router.get('/pcidss', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h',
      fullStats = false // Parameter for full stats
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size at 100,000
    if (pageSize > 100000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 100000, capping at 100000`);
      pageSize = 100000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs that have PCI DSS information
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure rule.pci_dss exists
          {
            exists: {
              field: 'rule.pci_dss'
            }
          }
        ]
      }
    };

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule.description^3',
            'rule.pci_dss^2',
            'rule.level',
            'agent.name',
            "id",
            "raw_log.message",
            "data.msg",
            "data.applist"
          ]
        }
      });
    }

    addFalsePositiveFilter(query);

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byRuleLevel: [],
          byAgent: [],
          byPciDss: [],
          timeDistribution: [],
          byMessage: [],
          byApplist: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // First get total count and stats with a size 0 query for accuracy
    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        track_total_hits: true, // Ensure accurate counting for large result sets
        query: query,
        aggs: {
          // Rule level distribution
          rule_levels: {
            terms: {
              field: 'rule.level',
              size: 20
            }
          },
          // Agent distribution
          agents: {
            terms: {
              field: 'agent.name',
              size: 50
            }
          },
          // Time distribution
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            }
          },
          // PCI DSS controls
          pci_dss_controls: {
            terms: {
              field: 'rule.pci_dss',
              size: 100
            }
          },
          // Message distribution
          messages: {
            terms: {
              field: 'data.msg.keyword',
              size: 50,
              missing: 'Unknown'  // Handle missing values
            }
          },
          // Applist distribution
          applists: {
            terms: {
              field: 'data.applist.keyword',
              size: 50,
              missing: 'Unknown'  // Handle missing values
            }
          }
        }
      }
    });

    // Get the total count from the stats query
    const totalCount = statsResponse.body.hits.total.value;

    // Log the stats found
    console.log(`Found ${totalCount} total logs with PCI DSS information`);
    console.log(`Rule levels found: ${statsResponse.body.aggregations.rule_levels.buckets.length}`);
    console.log(`Agents found: ${statsResponse.body.aggregations.agents.buckets.length}`);
    console.log(`PCI DSS controls found: ${statsResponse.body.aggregations.pci_dss_controls.buckets.length}`);
    console.log(`Messages found: ${statsResponse.body.aggregations.messages.buckets.length}`);
    console.log(`Applists found: ${statsResponse.body.aggregations.applists.buckets.length}`);

    // Now get the specific page of logs
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    // Format the logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Extract aggregation results
    const aggs = statsResponse.body.aggregations;

    // Format the statistics
    const stats = {
      total: totalCount, // Use the accurate total from the stats query
      byRuleLevel: (aggs.rule_levels?.buckets || []).map(bucket => ({
        level: bucket.key,
        count: bucket.doc_count
      })),
      byAgent: (aggs.agents?.buckets || []).map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byPciDss: (aggs.pci_dss_controls?.buckets || []).map(bucket => ({
        control: bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution: (aggs.time_distribution?.buckets || []).map(bucket => ({
        date: bucket.key_as_string,
        count: bucket.doc_count
      })),
      byMessage: (aggs.messages?.buckets || []).map(bucket => ({
        message: bucket.key,
        count: bucket.doc_count
      })),
      byApplist: (aggs.applists?.buckets || []).map(bucket => ({
        applist: bucket.key,
        count: bucket.doc_count
      }))
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return results with pagination
    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error in PCI DSS logs route:', error);
    next(error);
  }
});
// Get logs with TSC information
router.get('/tsc', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h',
      fullStats = false // Parameter for full stats
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size at 100,000
    if (pageSize > 100000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 100000, capping at 100000`);
      pageSize = 100000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs that have TSC information
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure rule.tsc exists
          {
            exists: {
              field: 'rule.tsc'
            }
          }
        ]
      }
    };

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule.description^3',
            'rule.tsc^2',
            'rule.level',
            'agent.name',
            "id",
            "raw_log.message",
            "rule.groups",
            "rule.description"
          ]
        }
      });
    }

    addFalsePositiveFilter(query);
    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byRuleLevel: [],
          byAgent: [],
          byTsc: [],
          timeDistribution: [],
          byDescription: [],
          byGroups: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // First get total count and stats with a size 0 query for accuracy
    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        track_total_hits: true, // Ensure accurate counting for large result sets
        query: query,
        aggs: {
          // Rule level distribution
          rule_levels: {
            terms: {
              field: 'rule.level',
              size: 20
            }
          },
          // Agent distribution
          agents: {
            terms: {
              field: 'agent.name',
              size: 50
            }
          },
          // Time distribution
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            }
          },
          // TSC controls
          tsc_controls: {
            terms: {
              field: 'rule.tsc',
              size: 100
            }
          },
          // Description distribution - trimmed to prevent too large aggregations
          descriptions: {
            terms: {
              field: 'rule.description.keyword',
              size: 50
            }
          },
          // Groups distribution
          groups: {
            terms: {
              field: 'rule.groups',
              size: 50
            }
          }
        }
      }
    });

    // Get the total count from the stats query
    const totalCount = statsResponse.body.hits.total.value;

    // Log the stats found
    console.log(`Found ${totalCount} total logs with TSC information`);
    console.log(`Rule levels found: ${statsResponse.body.aggregations.rule_levels.buckets.length}`);
    console.log(`Agents found: ${statsResponse.body.aggregations.agents.buckets.length}`);
    console.log(`TSC controls found: ${statsResponse.body.aggregations.tsc_controls.buckets.length}`);
    console.log(`Descriptions found: ${statsResponse.body.aggregations.descriptions.buckets.length}`);
    console.log(`Groups found: ${statsResponse.body.aggregations.groups.buckets.length}`);

    // Now get the specific page of logs
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    // Format the logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Extract aggregation results
    const aggs = statsResponse.body.aggregations;

    // Format the statistics
    const stats = {
      total: totalCount, // Use the accurate total from the stats query
      byRuleLevel: (aggs.rule_levels?.buckets || []).map(bucket => ({
        level: bucket.key,
        count: bucket.doc_count
      })),
      byAgent: (aggs.agents?.buckets || []).map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byTsc: (aggs.tsc_controls?.buckets || []).map(bucket => ({
        control: bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution: (aggs.time_distribution?.buckets || []).map(bucket => ({
        date: bucket.key_as_string,
        count: bucket.doc_count
      })),
      byDescription: (aggs.descriptions?.buckets || []).map(bucket => ({
        description: bucket.key,
        count: bucket.doc_count
      })),
      byGroups: (aggs.groups?.buckets || []).map(bucket => ({
        group: bucket.key,
        count: bucket.doc_count
      }))
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return results with pagination
    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error in TSC logs route:', error);
    next(error);
  }
});

// Get logs with vulnerability information
router.get('/vulnerability', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h',
      fullStats = false // Parameter for full stats
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size at 100,000
    if (pageSize > 100000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 100000, capping at 100000`);
      pageSize = 100000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs that have vulnerability information
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure data.vulnerability.cve exists
          {
            exists: {
              field: 'data.vulnerability.cve'
            }
          }
        ]
      }
    };

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule.description^3',
            'data.vulnerability.cve^2',
            'data.vulnerability.title^2',
            'data.vulnerability.severity.keyword',
            'data.vulnerability.package.name.keyword',
            'agent.name',
            "id",
            "raw_log.message"
          ]
        }
      });
    }

    addFalsePositiveFilter(query);

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        stats: {
          total: 0,
          bySeverity: [],
          byAgent: [],
          byCve: [],
          byPackage: [],
          byScore: [],
          timeDistribution: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // First get total count and stats with a size 0 query for accuracy
    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        track_total_hits: true, // Ensure accurate counting for large result sets
        query: query,
        aggs: {
          // Severity distribution - Use .keyword for text fields
          severities: {
            terms: {
              field: 'data.vulnerability.severity.keyword',
              size: 20
            }
          },
          // Agent distribution
          agents: {
            terms: {
              field: 'agent.name',
              size: 50
            }
          },
          // CVE distribution - Use .keyword for text fields
          cves: {
            terms: {
              field: 'data.vulnerability.cve.keyword',
              size: 50
            }
          },
          // Package name distribution - Use .keyword for text fields
          packages: {
            terms: {
              field: 'data.vulnerability.package.name.keyword',
              size: 100
            }
          },
          // Score distribution
          scores: {
            terms: {
              field: 'data.vulnerability.score.base.keyword',
              size: 20
            }
          },
          // Time distribution
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            }
          }
        }
      }
    });

    // Log the aggregation results for debugging
    console.log("Aggregation buckets:", {
      severity: statsResponse.body.aggregations?.severities?.buckets?.length || 0,
      agents: statsResponse.body.aggregations?.agents?.buckets?.length || 0,
      cves: statsResponse.body.aggregations?.cves?.buckets?.length || 0,
      packages: statsResponse.body.aggregations?.packages?.buckets?.length || 0,
      scores: statsResponse.body.aggregations?.scores?.buckets?.length || 0,
      time: statsResponse.body.aggregations?.time_distribution?.buckets?.length || 0
    });

    // Get the total count from the stats query
    const totalCount = statsResponse.body.hits.total.value;

    // Log the stats found
    console.log(`Found ${totalCount} total logs with vulnerability information`);

    // Now get the specific page of logs
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    // Format the logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Extract aggregation results
    const aggs = statsResponse.body.aggregations;

    // Format the statistics
    const stats = {
      total: totalCount, // Use the accurate total from the stats query
      bySeverity: (aggs.severities?.buckets || []).map(bucket => ({
        severity: bucket.key,
        count: bucket.doc_count
      })),
      byAgent: (aggs.agents?.buckets || []).map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byCve: (aggs.cves?.buckets || []).map(bucket => ({
        cve: bucket.key,
        count: bucket.doc_count
      })),
      byPackage: (aggs.packages?.buckets || []).map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byScore: (aggs.scores?.buckets || []).map(bucket => ({
        score: bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution: (aggs.time_distribution?.buckets || []).map(bucket => ({
        date: bucket.key_as_string,
        count: bucket.doc_count
      }))
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return results with pagination
    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error in vulnerability logs route:', error);
    next(error);
  }
});

// Get logs with threat hunting information
router.get('/threathunting', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h',
      fullStats = false // Parameter for full stats
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    let pageSize = parseInt(limit, 10);

    // Cap the maximum page size at 100,000
    if (pageSize > 100000) {
      console.warn(`Requested size ${pageSize} exceeds max limit of 100000, capping at 100000`);
      pageSize = 100000;
    }

    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs that have data.action
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure data.action exists
          {
            exists: {
              field: 'data.action'
            }
          }
        ]
      }
    };

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule.description^3',
            'data.action^2',
            'data.msg^2',
            'data.direction',
            'data.app',
            'data.applist',
            'data.apprisk',
            'data.srccountry',
            'data.dstcountry',
            'agent.name',
            "id",
            "raw_log.message"
          ]
        }
      });
    }

    addFalsePositiveFilter(query);

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byAction: [],
          byDirection: [],
          byMessage: [],
          byAppList: [],
          byAppRisk: [],
          byLevel: [],
          bySrcCountry: [],
          byDstCountry: [],
          timeDistribution: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // First get total count and stats with a size 0 query for accuracy
    const statsResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        track_total_hits: true, // Ensure accurate counting for large result sets
        query: query,
        aggs: {
          // Action distribution
          actions: {
            terms: {
              field: 'data.action',
              size: 20
            }
          },
          // Direction distribution
          directions: {
            terms: {
              field: 'data.direction.keyword',
              size: 20
            }
          },
          // Message distribution
          messages: {
            terms: {
              field: 'data.msg.keyword',
              size: 50
            }
          },
          // App list distribution
          applists: {
            terms: {
              field: 'data.applist.keyword',
              size: 30
            }
          },
          // App risk distribution
          apprisks: {
            terms: {
              field: 'data.apprisk.keyword',
              size: 20
            }
          },
          // Level distribution
          levels: {
            terms: {
              field: 'data.level.keyword',
              size: 20
            }
          },
          // Source country distribution
          src_countries: {
            terms: {
              field: 'data.srccountry.keyword',
              size: 50,
              missing: 'Unknown'
            }
          },
          // Destination country distribution
          dst_countries: {
            terms: {
              field: 'data.dstcountry.keyword',
              size: 50,
              missing: 'Unknown'
            }
          },
          // Time distribution
          time_distribution: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            }
          }
        }
      }
    });

    // Get the total count from the stats query
    const totalCount = statsResponse.body.hits.total.value;

    // Log the stats found
    console.log(`Found ${totalCount} total logs with threat hunting information`);

    // Now get the specific page of logs
    const logsResponse = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    // Format the logs
    const logs = logsResponse.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
      _score: hit._score
    }));

    // Extract aggregation results
    const aggs = statsResponse.body.aggregations;

    // Format the statistics
    const stats = {
      total: totalCount, // Use the accurate total from the stats query
      byAction: (aggs.actions?.buckets || []).map(bucket => ({
        action: bucket.key,
        count: bucket.doc_count
      })),
      byDirection: (aggs.directions?.buckets || []).map(bucket => ({
        direction: bucket.key,
        count: bucket.doc_count
      })),
      byMessage: (aggs.messages?.buckets || []).map(bucket => ({
        message: bucket.key,
        count: bucket.doc_count
      })),
      byAppList: (aggs.applists?.buckets || []).map(bucket => ({
        applist: bucket.key,
        count: bucket.doc_count
      })),
      byAppRisk: (aggs.apprisks?.buckets || []).map(bucket => ({
        risk: bucket.key,
        count: bucket.doc_count
      })),
      byLevel: (aggs.levels?.buckets || []).map(bucket => ({
        level: bucket.key,
        count: bucket.doc_count
      })),
      bySrcCountry: (aggs.src_countries?.buckets || []).map(bucket => ({
        country: bucket.key === 'Reserved' ? 'Server' : bucket.key,
        count: bucket.doc_count
      })),
      byDstCountry: (aggs.dst_countries?.buckets || []).map(bucket => ({
        country: bucket.key === 'Reserved' ? 'Server' : bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution: (aggs.time_distribution?.buckets || []).map(bucket => ({
        date: bucket.key_as_string,
        count: bucket.doc_count
      }))
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    // Return results with pagination
    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error) {
    console.error('Error in threat hunting logs route:', error);
    next(error);
  }
});

// Get connection data for the world map
router.get('/connections', async (req, res, next) => {
  try {
    const { timeRange = '24h' } = req.query;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      return res.json({
        connections: []
      });
    }

    // Build query for logs with srccountry and dstcountry
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure data.srccountry exists
          {
            exists: {
              field: 'data.srccountry'
            }
          },
          // Ensure data.dstcountry exists
          {
            exists: {
              field: 'data.dstcountry'
            }
          }
        ]
      }
    };

    // Execute aggregation query
    const response = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        query: query,
        aggs: {
          connections: {
            composite: {
              sources: [
                { source: { terms: { field: 'data.srccountry.keyword' } } },
                { destination: { terms: { field: 'data.dstcountry.keyword' } } }
              ],
              size: 100  // Limit to top 100 connections
            }
          }
        }
      }
    });

    // Process the results
    const connections = [];

    if (response.body.aggregations && response.body.aggregations.connections) {
      const buckets = response.body.aggregations.connections.buckets || [];

      buckets.forEach(bucket => {
        // Skip if "Unknown" is either source or destination
        if (bucket.key.source === 'Unknown' || bucket.key.destination === 'Unknown') {
          return;
        }

        connections.push({
          source: bucket.key.source,
          destination: bucket.key.destination,
          count: bucket.doc_count
        });
      });
    }

    // Sort by count in descending order and limit to top 50 connections
    connections.sort((a, b) => b.count - a.count);
    const topConnections = connections.slice(0, 50);

    res.json({
      connections: topConnections
    });
  } catch (error) {
    console.error('Error getting connections data:', error);
    next(error);
  }
});

// Get connection logs for connection analysis page with server-side pagination
router.get('/connectionspage', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '7d',
      connectionType = 'all'
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const from = (currentPage - 1) * pageSize;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query for logs that have source and destination country information
    const query = {
      bool: {
        must: [
          // Time range filter
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          },
          // Ensure data.srccountry exists
          {
            exists: {
              field: 'data.srccountry'
            }
          },
          // Ensure data.dstcountry exists
          {
            exists: {
              field: 'data.dstcountry'
            }
          }
        ]
      }
    };

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        bool: {
          should: [
            {
              query_string: {
                query: `*${search}*`,
                fields: ["data.srccountry^3", "data.dstcountry^3"],
                analyze_wildcard: true
              }
            },
            {
              multi_match: {
                query: search,
                fields: [
                  'data.srcip',
                  'data.dstip',
                  'network.srcIp',
                  'network.destIp',
                  'data.app',
                  'agent.name',
                  'rule.description'
                ],
                type: "best_fields",
                fuzziness: "AUTO"
              }
            }
          ],
          minimum_should_match: 1
        }
      });
    }

    // Add connection type filter if specified
    if (connectionType && connectionType !== 'all') {
      switch (connectionType) {
        case 'outgoingFromServer':
          query.bool.must.push({
            term: { 'data.srccountry.keyword': 'Reserved' }
          });
          break;
        case 'incomingThreat':
        case 'incomingNormal':
          query.bool.must.push({
            term: { 'data.dstcountry.keyword': 'Reserved' }
          });
          break;
        case 'external':
          query.bool.must.push({
            bool: {
              must_not: [
                { term: { 'data.srccountry.keyword': 'Reserved' } },
                { term: { 'data.dstcountry.keyword': 'Reserved' } }
              ]
            }
          });
          break;
      }
    }
    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];
    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    if (indices.length === 0) {
      return res.json({
        logs: [],
        stats: {
          total: 0,
          byConnectionType: [],
          byCountry: [],
          byAgent: [],
          byApp: [],
          timeDistribution: [],
          connectionPairs: []
        },
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    // Get stats and total count in parallel
    const [statsResponse, logsResponse] = await Promise.all([
      // Stats query
      client.search({
        index: indices.join(','),
        body: {
          size: 0,
          track_total_hits: true,
          query: query,
          aggs: {
            src_countries: {
              terms: {
                field: 'data.srccountry.keyword',
                size: 50
              }
            },
            dst_countries: {
              terms: {
                field: 'data.dstcountry.keyword',
                size: 50
              }
            },
            agents: {
              terms: {
                field: 'agent.name',
                size: 50
              }
            },
            apps: {
              terms: {
                field: 'data.app.keyword',
                size: 50
              }
            },
            time_distribution: {
              date_histogram: {
                field: '@timestamp',
                calendar_interval: 'day'
              }
            },
            connection_pairs: {
              composite: {
                sources: [
                  { source: { terms: { field: 'data.srccountry.keyword' } } },
                  { destination: { terms: { field: 'data.dstcountry.keyword' } } }
                ],
                size: 1000
              }
            }
          }
        }
      }),
      // Logs query with pagination
      client.search({
        index: indices.join(','),
        body: {
          from,
          size: pageSize,
          query,
          sort: [
            {
              [sortBy]: {
                order: sortOrder
              }
            }
          ],
          _source: {
            excludes: ['raw_log.command', 'raw_log.script']
          },
          ...(search && search.trim() !== '' ? {
            highlight: {
              fields: {
                "data.srccountry": {},
                "data.dstcountry": {},
                "data.srcip": {},
                "data.dstip": {}
              },
              pre_tags: ["<strong>"],
              post_tags: ["</strong>"]
            }
          } : {})
        }
      })
    ]);

    // Process aggregation results
    const aggs = statsResponse.body.aggregations;
    const connectionPairs = aggs.connection_pairs?.buckets || [];

    // Calculate connection types based on volume
    const connectionStats = {
      outgoingFromServer: 0,
      incomingThreat: 0,
      incomingNormal: 0,
      external: 0
    };

    connectionPairs.forEach(bucket => {
      const { source, destination } = bucket.key;
      const count = bucket.doc_count;

      if (source === 'Reserved') {
        connectionStats.outgoingFromServer += count;
      } else if (destination === 'Reserved') {
        if (count < 20) {
          connectionStats.incomingThreat += count;
        } else {
          connectionStats.incomingNormal += count;
        }
      } else {
        connectionStats.external += count;
      }
    });

    // Create volume map for log classification
    const pairVolumeMap = {};
    connectionPairs.forEach(pair => {
      const key = `${pair.source}-${pair.destination}`;
      pairVolumeMap[key] = pair.doc_count;
    });

    // Format logs with connection type classification
    const logs = logsResponse.body.hits.hits.map(hit => {
      const log = {
        ...hit._source,
        id: hit._id,
        _score: hit._score,
        _highlights: hit.highlight
      };

      // Classify connection type
      const srcCountry = log.data?.srccountry;
      const dstCountry = log.data?.dstcountry;
      const pairKey = `${srcCountry}-${dstCountry}`;
      const volume = pairVolumeMap[pairKey] || 1;

      let connectionType = 'external';
      if (srcCountry === 'Reserved') {
        connectionType = 'outgoingFromServer';
      } else if (dstCountry === 'Reserved') {
        connectionType = volume < 20 ? 'incomingThreat' : 'incomingNormal';
      }

      return {
        ...log,
        connectionType,
        volume
      };
    });

    // Format statistics
    const stats = {
      total: statsResponse.body.hits.total.value,
      byConnectionType: [
        { type: 'outgoingFromServer', count: connectionStats.outgoingFromServer },
        { type: 'incomingThreat', count: connectionStats.incomingThreat },
        { type: 'incomingNormal', count: connectionStats.incomingNormal },
        { type: 'external', count: connectionStats.external }
      ],
      byCountry: [
        ...aggs.src_countries.buckets.map(bucket => ({
          country: bucket.key,
          count: bucket.doc_count,
          type: 'source'
        })),
        ...aggs.dst_countries.buckets.map(bucket => ({
          country: bucket.key,
          count: bucket.doc_count,
          type: 'destination'
        }))
      ],
      byAgent: aggs.agents.buckets.map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      byApp: aggs.apps.buckets.map(bucket => ({
        name: bucket.key,
        count: bucket.doc_count
      })),
      timeDistribution: aggs.time_distribution.buckets.map(bucket => ({
        date: bucket.key_as_string,
        count: bucket.doc_count
      })),
      connectionPairs: connectionPairs.map(bucket => ({
        source: bucket.key.source,
        destination: bucket.key.destination,
        count: bucket.doc_count
      }))
    };

    res.json({
      logs,
      stats,
      pagination: {
        page: currentPage,        // Make sure this matches what frontend expects
        limit: pageSize,
        total: statsResponse.body.hits.total.value,
        pages: Math.ceil(statsResponse.body.hits.total.value / pageSize),
        hasNextPage: currentPage < Math.ceil(statsResponse.body.hits.total.value / pageSize),
        hasPrevPage: currentPage > 1
      }
    });
  } catch (error) {
    console.error('Error in connections page route:', error);
    next(error);
  }
});

// Get logs with pagination, filtering and sorting
// FIXED logs route with proper DQL detection and fallback
// Replace the existing router.get('/', ...) in logs.js with this DEBUGGED version

router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      logType = 'all',
      ruleLevel = 'all',
      sortBy = '@timestamp',
      sortOrder = 'desc',
      timeRange = '24h'
    } = req.query;

    // Calculate pagination values
    const currentPage = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const from = (currentPage - 1) * pageSize;

    // Use the utility function to parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Build query
    const query = {
      bool: {
        must: []
      }
    };

    // FIXED: Enhanced search functionality with better DQL detection and fallback
    if (search && search.trim() !== '') {
      console.log(`Enhanced search for: "${search}"`);

      // Improved DQL detection - check for field:value patterns but be more specific
      const isDQLQuery = /\w+[\.\w]*\s*:\s*\S+/.test(search) && !search.includes(' ');

      console.log(`Is DQL Query: ${isDQLQuery}`);

      if (isDQLQuery) {
        console.log('Using DQL query_string approach');

        // Use query_string for DQL-like queries with SAFE settings
        try {
          query.bool.must.push({
            query_string: {
              query: search,
              fields: [
                // Core fields
                "@timestamp",
                "id",
                "location",

                // Agent fields
                "agent.name^3",
                "agent.id^2",
                "agent.ip^2",

                // Rule fields
                "rule.id^3",
                "rule.level^2",
                "rule.description^3",
                "rule.groups^2",

                // MITRE ATT&CK fields
                "rule.mitre.id^2",
                "rule.mitre.tactic^2",
                "rule.mitre.technique^2",

                // Compliance framework fields
                "rule.gdpr",
                "rule.hipaa",
                "rule.nist",
                "rule.pci_dss",
                "rule.tsc",

                // Network fields
                "network.srcIp^3",
                "network.destIp^3",
                "network.protocol^2",
                "network.srcPort",
                "network.destPort",

                // Data fields (commonly searched)
                "data.srcip^3",
                "data.dstip^3",
                "data.srcuser^2",
                "data.dstuser^2",
                "data.user^2",
                "data.hostname^2",
                "data.app^2",
                "data.msg^2",
                "data.action^2",
                "data.protocol",
                "data.srcport",
                "data.dstport",
                "data.srccountry",
                "data.dstcountry",

                // Windows-specific fields
                "data.win.eventdata.targetUserName^2",
                "data.win.eventdata.processName^2",
                "data.win.eventdata.commandLine",

                // Syscheck fields
                "syscheck.path^3",
                "syscheck.event^2",
                "syscheck.mode",
                "syscheck.diff",

                // AI/ML fields
                "data.AI_response^2",
                "data.ML_logs.anomaly_score",
                "data.ML_logs.severity^2",

                // Vulnerability fields
                "data.vulnerability.cve^3",
                "data.vulnerability.title^2",
                "data.vulnerability.severity^2",
                "data.vulnerability.package.name^2",

                // SCA fields
                "data.sca.policy^2",
                "data.sca.check.title^2",
                "data.sca.check.result^2",

                // Raw log message (fallback)
                "raw_log.message"
              ],
              default_operator: "AND",
              allow_leading_wildcard: true,
              analyze_wildcard: true,
              lenient: true, // This helps with syntax errors
              boost: 1.0
            }
          });
        } catch (queryError) {
          console.log('Query_string failed, falling back to multi_match:', queryError.message);
          // Fallback to multi_match if query_string fails
          query.bool.must.push({
            multi_match: {
              query: search,
              fields: [
                "agent.name^3",
                "rule.description^2",
                "network.srcIp^2",
                "network.destIp^2",
                "data.srcip^2",
                "data.dstip^2",
                "rule.id^2",
                "raw_log.message"
              ],
              type: "best_fields",
              fuzziness: "AUTO"
            }
          });
        }
      } else {
        console.log('Using regular text search approach');

        // Use the ORIGINAL working multi-match approach for regular text searches
        query.bool.must.push({
          bool: {
            should: [
              // Search in raw_log.message field with high boost
              {
                query_string: {
                  query: `*${search}*`,
                  fields: ["raw_log.message^3"],
                  analyze_wildcard: true,
                  lenient: true
                }
              },
              // Search in rule description
              {
                query_string: {
                  query: `*${search}*`,
                  fields: ["rule.description^2"],
                  analyze_wildcard: true,
                  lenient: true
                }
              },
              // Search in other common fields
              {
                multi_match: {
                  query: search,
                  fields: [
                    "agent.name^3",
                    "network.srcIp^2",
                    "network.destIp^2",
                    "data.srcip^2",
                    "data.dstip^2",
                    "data.app^2",
                    "data.msg^1",
                    "rule.id^2",
                    "id^1"
                  ],
                  type: "best_fields",
                  fuzziness: "AUTO"
                }
              }
            ],
            minimum_should_match: 1
          }
        });
      }
    }

    // Filter by log type (existing logic unchanged)
    if (logType !== 'all') {
      if (logType === 'firewall') {
        query.bool.must.push({
          bool: {
            should: [
              { match: { 'rule.groups': 'Firewall' } }
            ],
            minimum_should_match: 1
          }
        });
      } else if (logType === 'ids') {
        query.bool.must.push({
          bool: {
            should: [
              { match: { 'rule.groups': 'ids' } },
              { match: { 'rule.groups': 'ips' } },
              { match: { 'rule.groups': 'IDS/IPS' } }
            ],
            minimum_should_match: 1
          }
        });
      } else if (logType === 'windows') {
        query.bool.must.push({
          bool: {
            should: [
              { match: { 'rule.groups': 'windows' } },
              { match: { 'agent.name': 'windows' } }
            ],
            minimum_should_match: 1
          }
        });
      } else if (logType === 'linux') {
        query.bool.must.push({
          bool: {
            should: [
              { match: { 'rule.groups': 'linux' } },
              { match: { 'rule.groups': 'linuxkernel' } }
            ],
            minimum_should_match: 1
          }
        });
      }
    }

    // Filter by rule level if provided (existing logic unchanged)
    if (ruleLevel !== 'all') {
      const levelNum = parseInt(ruleLevel, 10);
      query.bool.must.push({
        range: {
          'rule.level': {
            gte: levelNum
          }
        }
      });
    }

    // Add date range filter
    query.bool.must.push({
      range: {
        '@timestamp': {
          gte: startDate.toISOString(),
          lte: endDate.toISOString()
        }
      }
    });

    // Add false positive filter
    addFalsePositiveFilter(query);

    // Get all existing indices with logs-* pattern (existing logic unchanged)
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      console.log('No indices found');
      return res.json({
        logs: [],
        pagination: {
          page: currentPage,
          limit: pageSize,
          total: 0,
          pages: 0
        }
      });
    }

    console.log(`Searching in indices: ${indices.join(', ')}`);
    console.log(`From: ${from}, size: ${pageSize}`);
    console.log(`Final Query:`, JSON.stringify(query, null, 2));

    // Execute search query
    const response = await client.search({
      index: indices.join(','),
      body: {
        from,
        size: pageSize,
        query,
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ],
        _source: {
          excludes: ['raw_log.command', 'raw_log.script'] // Exclude potentially large binary fields
        },
        // Add highlight feature for search terms
        ...(search && search.trim() !== '' ? {
          highlight: {
            fields: {
              "raw_log.message": {},
              "rule.description": {},
              "agent.name": {},
              "network.srcIp": {},
              "network.destIp": {},
              "data.srcip": {},
              "data.dstip": {},
              "rule.id": {},
              "data.app": {}
            },
            pre_tags: ["<strong>"],
            post_tags: ["</strong>"]
          }
        } : {})
      }
    });

    console.log(`Search response: found ${response.body.hits.total.value} logs`);

    // Format the response
    const logs = response.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id, // Use id instead of _id to match DataGrid expectations
      _score: hit._score,
      // Add highlight information if available
      _highlights: hit.highlight
    }));

    res.json({
      logs,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: response.body.hits.total.value,
        pages: Math.ceil(response.body.hits.total.value / pageSize)
      }
    });
  } catch (error) {
    console.error('Error in logs route:', error);
    next(error);
  }
});

router.get('/test-search', async (req, res, next) => {
  try {
    const { search = '', timeRange = '24h' } = req.query;

    console.log(`TEST SEARCH: "${search}"`);

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Get indices
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];
    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    if (indices.length === 0) {
      return res.json({ error: 'No indices found', indices: [] });
    }

    // Test 1: Simple match_all query (should return results)
    const simpleQuery = {
      bool: {
        must: [
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          }
        ]
      }
    };

    // Add false positive filter
    addFalsePositiveFilter(simpleQuery);

    console.log('Testing simple query first...');
    const simpleResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 5,
        query: simpleQuery,
        sort: [{ '@timestamp': { order: 'desc' } }]
      }
    });

    console.log(`Simple query returned: ${simpleResponse.body.hits.total.value} logs`);

    // Test 2: If search provided, test it
    let searchResults = null;
    if (search && search.trim() !== '') {
      console.log(`Testing search: "${search}"`);

      // Try the original working search approach
      const searchQuery = {
        bool: {
          must: [
            {
              range: {
                '@timestamp': {
                  gte: startDate.toISOString(),
                  lte: endDate.toISOString()
                }
              }
            },
            {
              bool: {
                should: [
                  {
                    query_string: {
                      query: `*${search}*`,
                      fields: ["raw_log.message^3"],
                      analyze_wildcard: true,
                      lenient: true
                    }
                  },
                  {
                    multi_match: {
                      query: search,
                      fields: ["agent.name^3", "rule.description^2", "rule.id"],
                      type: "best_fields",
                      fuzziness: "AUTO"
                    }
                  }
                ],
                minimum_should_match: 1
              }
            }
          ]
        }
      };

      addFalsePositiveFilter(searchQuery);

      console.log('Search query:', JSON.stringify(searchQuery, null, 2));

      try {
        const searchResponse = await client.search({
          index: indices.join(','),
          body: {
            size: 5,
            query: searchQuery,
            sort: [{ '@timestamp': { order: 'desc' } }]
          }
        });

        console.log(`Search query returned: ${searchResponse.body.hits.total.value} logs`);
        searchResults = {
          total: searchResponse.body.hits.total.value,
          hits: searchResponse.body.hits.hits.length,
          firstResult: searchResponse.body.hits.hits[0] ? {
            id: searchResponse.body.hits.hits[0]._id,
            agent: searchResponse.body.hits.hits[0]._source.agent?.name,
            rule: searchResponse.body.hits.hits[0]._source.rule?.description
          } : null
        };
      } catch (searchError) {
        console.error('Search query failed:', searchError);
        searchResults = { error: searchError.message };
      }
    }

    res.json({
      status: 'debug',
      search: search,
      indices: indices.length,
      indicesList: indices,
      simpleQuery: {
        total: simpleResponse.body.hits.total.value,
        hits: simpleResponse.body.hits.hits.length,
        firstResult: simpleResponse.body.hits.hits[0] ? {
          id: simpleResponse.body.hits.hits[0]._id,
          agent: simpleResponse.body.hits.hits[0]._source.agent?.name,
          rule: simpleResponse.body.hits.hits[0]._source.rule?.description,
          timestamp: simpleResponse.body.hits.hits[0]._source['@timestamp']
        } : null
      },
      searchResults
    });

  } catch (error) {
    console.error('Test route error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Get major logs (rule level >= 12) with statistics


// Get log by ID
router.get('/:id', hasRole(['admin', 'analyst-l1', 'analyst-l2', 'analyst-l3']), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Get all indices with logs-* pattern to search across all daily indices
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    const indices = indicesResponse.body.map(index => index.index).join(',');

    // Search for the log across all indices
    const response = await client.search({
      index: indices,
      body: {
        query: {
          ids: {
            values: [id]
          }
        }
      }
    });

    // Check if log found
    if (response.body.hits.total.value === 0) {
      throw new ApiError(404, 'Log not found');
    }

    // Return the log
    const log = response.body.hits.hits[0]._source;
    log._id = response.body.hits.hits[0]._id;

    res.json(log);
  } catch (error) {
    next(error);
  }
});

// Get log statistics for dashboard
// Get log statistics for dashboard
router.get('/stats/overview', async (req, res, next) => {
  try {
    const { timeRange = '24h' } = req.query;

    // Parse time range
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Get OpenSearch client
    const client = await getOpenSearchClient();

    // Get all existing indices with logs-* pattern
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];

    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    // If no indices found, return empty result
    if (indices.length === 0) {
      return res.json({
        total: 0,
        major: 0,
        normal: 0,
        ruleLevels: [],
        dailyLogs: []
      });
    }

    // Execute search query for total logs
    const totalResponse = await client.count({
      index: indices.join(','),
      body: {
        query: {
          range: {
            '@timestamp': {
              gte: startDate.toISOString(),
              lte: endDate.toISOString()
            }
          }
        }
      }
    });

    // Execute search query for major logs (rule level >= 12)
    const majorResponse = await client.count({
      index: indices.join(','),
      body: {
        query: {
          bool: {
            must: [
              {
                range: {
                  '@timestamp': {
                    gte: startDate.toISOString(),
                    lte: endDate.toISOString()
                  }
                }
              },
              {
                range: {
                  'rule.level': {
                    gte: 12
                  }
                }
              }
            ]
          }
        }
      }
    });

    // Execute aggregation for logs by rule level
    const levelAggResponse = await client.search({
      index: indices.join(','),
      body: {
        size: 0,
        query: {
          range: {
            '@timestamp': {
              gte: startDate.toISOString(),
              lte: endDate.toISOString()
            }
          }
        },
        aggs: {
          rule_levels: {
            terms: {
              field: 'rule.level',
              size: 10
            }
          },
          daily_logs: {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: 'day'
            }
          }
        }
      }
    });

    // Format the response
    const stats = {
      total: totalResponse.body.count,
      major: majorResponse.body.count,
      normal: totalResponse.body.count - majorResponse.body.count,
      ruleLevels: levelAggResponse.body.aggregations.rule_levels.buckets.map(bucket => ({
        level: bucket.key,
        count: bucket.doc_count
      })),
      dailyLogs: levelAggResponse.body.aggregations.daily_logs.buckets.map(bucket => ({
        date: bucket.key_as_string,
        count: bucket.doc_count
      }))
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ===== EXPORT FUNCTIONALITY =====
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// In-memory job storage (could be moved to file-based later)
const exportJobs = new Map();

// Export job status endpoint
router.get('/export/status/:jobId', authenticate, async (req, res, next) => {
  try {
    const { jobId } = req.params;

    // Check if job exists in memory
    if (exportJobs.has(jobId)) {
      return res.json(exportJobs.get(jobId));
    }

    // Check file-based job status
    const jobFile = path.join('/tmp', `export_job_${jobId}.json`);
    try {
      const jobData = await fs.readFile(jobFile, 'utf8');
      const job = JSON.parse(jobData);

      // Cache in memory for faster subsequent checks
      exportJobs.set(jobId, job);

      return res.json(job);
    } catch (error) {
      return res.status(404).json({ error: 'Job not found' });
    }
  } catch (error) {
    next(error);
  }
});

// Start export job endpoint
router.post('/export/start', authenticate, async (req, res, next) => {
  try {
    const { timeRange = '24h' } = req.body;
    const jobId = uuidv4();

    // Parse time range using existing utility
    const { startDate, endDate } = parseTimeRange(timeRange);

    // Create job status
    const job = {
      id: jobId,
      status: 'started',
      progress: { current: 0, total: 0 },
      timeRange,
      startTime: new Date().toISOString(),
      fileName: `security_logs_${formatDateForFileName(new Date())}_${timeRange}.csv`,
      downloadUrl: null,
      error: null
    };

    // Store job status
    exportJobs.set(jobId, job);
    await saveJobToFile(jobId, job);

    // Start background export process
    startExportProcess(jobId, startDate, endDate, timeRange);

    res.json({ jobId, status: 'started' });
  } catch (error) {
    next(error);
  }
});

// Download exported file endpoint
// Update the download endpoint in logs.js
router.get('/export/download/:jobId', authenticate, async (req, res, next) => {
  try {
    const { jobId } = req.params;

    // Get job info first
    let job = exportJobs.get(jobId);
    if (!job) {
      const jobFile = path.join('/tmp', `export_job_${jobId}.json`);
      try {
        const jobData = await fs.readFile(jobFile, 'utf8');
        job = JSON.parse(jobData);
      } catch (error) {
        return res.status(404).json({ error: 'Job information not found' });
      }
    }

    // Determine file path based on whether it's zipped or not
    const filePath = job.isZipped
      ? path.join('/tmp', `export_${jobId}.zip`)
      : path.join('/tmp', `export_${jobId}.csv`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Export file not found or expired' });
    }

    // Set appropriate headers
    const contentType = job.isZipped ? 'application/zip' : 'text/csv; charset=utf-8';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${job.fileName}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Stream the file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    next(error);
  }
});

// Helper function to save job status to file
const saveJobToFile = async (jobId, job) => {
  const jobFile = path.join('/tmp', `export_job_${jobId}.json`);
  await fs.writeFile(jobFile, JSON.stringify(job, null, 2));
};

// Helper function to update job status
const updateJobStatus = async (jobId, updates) => {
  let job = exportJobs.get(jobId);
  if (job) {
    Object.assign(job, updates);
    exportJobs.set(jobId, job);
    await saveJobToFile(jobId, job);
  }
};

// Background export process
// Enhanced background export process with multi-file support
const startExportProcess = async (jobId, startDate, endDate, timeRange) => {
  try {
    const client = await getOpenSearchClient();
    const MAX_ROWS_PER_FILE = 1000000; // 1 million rows per file (safe limit)

    // Get indices
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];
    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    if (indices.length === 0) {
      await updateJobStatus(jobId, {
        status: 'completed',
        progress: { current: 0, total: 0 },
        files: [],
        endTime: new Date().toISOString()
      });
      return;
    }

    // Build query for time range only
    const query = {
      bool: {
        must: [
          {
            range: {
              '@timestamp': {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
              }
            }
          }
        ]
      }
    };

    addFalsePositiveFilter(query);

    // Get total count first
    const countResponse = await client.count({
      index: indices.join(','),
      body: { query }
    });

    const totalCount = countResponse.body.count;
    const totalFiles = Math.ceil(totalCount / MAX_ROWS_PER_FILE);

    await updateJobStatus(jobId, {
      status: 'processing',
      progress: { current: 0, total: totalCount },
      totalFiles: totalFiles,
      files: []
    });

    // CSV Headers
    const csvHeaders = [
      'timestamp', 'agent_name', 'rule_level', 'rule_description',
      'source_ip', 'dest_ip', 'protocol', 'rule_id', 'rule_groups',
      'mitre_tactic', 'mitre_technique', 'mitre_id'
    ];

    const headerRow = csvHeaders.join(',') + '\n';

    // Process in batches
    const batchSize = 10000;
    let processed = 0;
    let currentFileIndex = 1;
    let currentFileRowCount = 0;
    let hasMore = true;
    let searchAfter = null;
    let currentFilePath = null;
    let completedFiles = [];

    // Initialize first file
    const getFilePath = (fileIndex, totalFiles) => {
      if (totalFiles === 1) {
        return path.join('/tmp', `export_${jobId}.csv`);
      } else {
        return path.join('/tmp', `export_${jobId}_part${fileIndex}.csv`);
      }
    };

    const getFileName = (fileIndex, totalFiles) => {
      const baseFileName = `security_logs_${formatDateForFileName(new Date())}_${timeRange}`;
      if (totalFiles === 1) {
        return `${baseFileName}.csv`;
      } else {
        return `${baseFileName}_part${fileIndex}.csv`;
      }
    };

    currentFilePath = getFilePath(currentFileIndex, totalFiles);
    await fs.writeFile(currentFilePath, headerRow);

    while (hasMore) {
      const searchBody = {
        size: batchSize,
        query,
        sort: [{ '@timestamp': { order: 'desc' } }, { '_id': { order: 'asc' } }],
        _source: {
          includes: [
            '@timestamp', 'agent.name', 'rule.level', 'rule.description',
            'network.srcIp', 'network.destIp', 'network.protocol', 'rule.id',
            'rule.groups', 'rule.mitre.tactic', 'rule.mitre.technique', 'rule.mitre.id',
            'data.srcip', 'data.dstip', 'data.protocol'
          ]
        }
      };

      if (searchAfter) {
        searchBody.search_after = searchAfter;
      }

      const response = await client.search({
        index: indices.join(','),
        body: searchBody
      });

      const hits = response.body.hits.hits;

      if (hits.length === 0) {
        hasMore = false;
        break;
      }

      // Convert to CSV rows
      const csvRows = hits.map(hit => {
        const log = hit._source;
        return [
          formatTimestamp(log['@timestamp']),
          escapeCSV(log.agent?.name || ''),
          log.rule?.level || '',
          escapeCSV(log.rule?.description || ''),
          log.network?.srcIp || log.data?.srcip || '',
          log.network?.destIp || log.data?.dstip || '',
          log.network?.protocol || log.data?.protocol || '',
          log.rule?.id || '',
          escapeCSV(Array.isArray(log.rule?.groups) ? log.rule.groups.join(';') : (log.rule?.groups || '')),
          escapeCSV(Array.isArray(log.rule?.mitre?.tactic) ? log.rule.mitre.tactic.join(';') : (log.rule?.mitre?.tactic || '')),
          escapeCSV(Array.isArray(log.rule?.mitre?.technique) ? log.rule.mitre.technique.join(';') : (log.rule?.mitre?.technique || '')),
          escapeCSV(Array.isArray(log.rule?.mitre?.id) ? log.rule.mitre.id.join(';') : (log.rule?.mitre?.id || ''))
        ].join(',');
      });

      // Check if we need to start a new file
      if (currentFileRowCount + csvRows.length > MAX_ROWS_PER_FILE && totalFiles > 1) {
        // Complete current file
        completedFiles.push({
          path: currentFilePath,
          fileName: getFileName(currentFileIndex, totalFiles),
          rowCount: currentFileRowCount
        });

        // Start new file
        currentFileIndex++;
        currentFileRowCount = 0;
        currentFilePath = getFilePath(currentFileIndex, totalFiles);
        await fs.writeFile(currentFilePath, headerRow);
      }

      // Append to current file
      await fs.appendFile(currentFilePath, csvRows.join('\n') + '\n');
      currentFileRowCount += csvRows.length;
      processed += hits.length;

      // Update progress
      await updateJobStatus(jobId, {
        progress: { current: processed, total: totalCount },
        currentFile: currentFileIndex,
        totalFiles: totalFiles
      });

      // Set search_after for next batch
      if (hits.length < batchSize) {
        hasMore = false;
      } else {
        const lastHit = hits[hits.length - 1];
        searchAfter = lastHit.sort;
      }
    }

    // Add final file to completed files
    completedFiles.push({
      path: currentFilePath,
      fileName: getFileName(currentFileIndex, totalFiles),
      rowCount: currentFileRowCount
    });

    // If multiple files, create a ZIP archive
    if (totalFiles > 1) {
      const archiver = require('archiver');
      const zipPath = path.join('/tmp', `export_${jobId}.zip`);
      const output = require('fs').createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', async () => {
        // Clean up individual CSV files
        for (const file of completedFiles) {
          try {
            await fs.unlink(file.path);
          } catch (error) {
            console.error('Error cleaning up individual file:', error);
          }
        }

        // Mark as completed
        await updateJobStatus(jobId, {
          status: 'completed',
          progress: { current: processed, total: totalCount },
          files: completedFiles.map(f => ({ fileName: f.fileName, rowCount: f.rowCount })),
          isZipped: true,
          fileName: `security_logs_${formatDateForFileName(new Date())}_${timeRange}.zip`,
          endTime: new Date().toISOString()
        });
      });

      archive.pipe(output);

      // Add files to archive
      for (const file of completedFiles) {
        archive.file(file.path, { name: file.fileName });
      }

      await archive.finalize();

    } else {
      // Single file - mark as completed
      await updateJobStatus(jobId, {
        status: 'completed',
        progress: { current: processed, total: totalCount },
        files: completedFiles.map(f => ({ fileName: f.fileName, rowCount: f.rowCount })),
        isZipped: false,
        fileName: completedFiles[0].fileName,
        endTime: new Date().toISOString()
      });
    }

    // Schedule cleanup after 10 minutes
    setTimeout(async () => {
      try {
        if (totalFiles > 1) {
          await fs.unlink(path.join('/tmp', `export_${jobId}.zip`));
        } else {
          await fs.unlink(currentFilePath);
        }
        await fs.unlink(path.join('/tmp', `export_job_${jobId}.json`));
        exportJobs.delete(jobId);
      } catch (error) {
        console.error('Error cleaning up export files:', error);
      }
    }, 10 * 60 * 1000);

  } catch (error) {
    console.error('Export process error:', error);
    await updateJobStatus(jobId, {
      status: 'failed',
      error: error.message,
      endTime: new Date().toISOString()
    });
  }
};

// Helper function to escape CSV values
const escapeCSV = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const formatTimestamp = (timestamp) => {
  try {
    if (!timestamp) return 'N/A';
    if (typeof timestamp === 'number') {
      return new Date(timestamp * 1000).toISOString();
    }
    return new Date(timestamp).toISOString();
  } catch (error) {
    return 'Invalid Date';
  }
};

// Add this helper function (reuse from existing code)
const formatDateForFileName = (date) => {
  return date.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .split('.')[0];
};


const UBA_API_CONFIG = {
  host: process.env.UBA_API_HOST || 'localhost',
  port: process.env.UBA_API_PORT || '1616',
  timeout: parseInt(process.env.UBA_API_TIMEOUT) || 30000,
  baseURL: `http://${process.env.UBA_API_HOST || 'localhost'}:${process.env.UBA_API_PORT || '1616'}/api`
};

// Create axios instance for UBA API
const ubaApiClient = axios.create({
  baseURL: UBA_API_CONFIG.baseURL,
  timeout: UBA_API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json'
  }
});

// UBA Analytics endpoints
router.get('/uba/analytics', authenticate, async (req, res, next) => {
  try {
    console.log('🔍 Fetching UBA analytics data...');

    const response = await ubaApiClient.get('/analytics');

    console.log('✅ UBA analytics data fetched successfully');
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 UBA API error:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      return res.status(503).json({
        success: false,
        error: 'UBA service unavailable',
        message: 'Unable to connect to UBA Analytics server. Please check if the service is running.',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: 'UBA API error',
        message: error.response.data.message || 'Unknown error from UBA service',
        code: 'API_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch UBA analytics data',
      code: 'INTERNAL_ERROR'
    });
  }
});

// UBA Service Status
router.get('/uba/status', authenticate, async (req, res, next) => {
  try {
    console.log('🔍 Checking UBA service status...');

    const response = await ubaApiClient.get('/status');

    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 UBA status check error:', error.message);

    res.status(503).json({
      success: false,
      error: 'UBA service unavailable',
      message: 'Unable to connect to UBA Analytics server',
      code: 'SERVICE_UNAVAILABLE'
    });
  }
});

// UBA Health Check
router.get('/uba/health', authenticate, async (req, res, next) => {
  try {
    console.log('🔍 Checking UBA health...');

    const response = await ubaApiClient.get('/health');

    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 UBA health check error:', error.message);

    res.status(503).json({
      success: false,
      error: 'UBA service unhealthy',
      message: 'UBA Analytics server is not responding',
      code: 'SERVICE_UNHEALTHY'
    });
  }
});

// UBA Manual Refresh
router.post('/uba/refresh', authenticate, async (req, res, next) => {
  try {
    console.log('🔄 Triggering UBA data refresh...');

    const response = await ubaApiClient.post('/analytics/refresh');

    console.log('✅ UBA data refresh triggered successfully');
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 UBA refresh error:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      return res.status(503).json({
        success: false,
        error: 'UBA service unavailable',
        message: 'Unable to connect to UBA Analytics server',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Refresh failed',
      message: 'Failed to refresh UBA analytics data',
      code: 'REFRESH_ERROR'
    });
  }
});

// UBA Configuration
router.get('/uba/config', authenticate, async (req, res, next) => {
  try {
    console.log('🔍 Fetching UBA configuration...');

    const response = await ubaApiClient.get('/config');

    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 UBA config fetch error:', error.message);

    res.status(503).json({
      success: false,
      error: 'UBA service unavailable',
      message: 'Unable to fetch UBA configuration',
      code: 'SERVICE_UNAVAILABLE'
    });
  }
});

// UBA Configuration Update
router.post('/uba/config', authenticate, async (req, res, next) => {
  try {
    console.log('🔄 Updating UBA configuration...');

    const response = await ubaApiClient.post('/config', req.body);

    console.log('✅ UBA configuration updated successfully');
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 UBA config update error:', error.message);

    res.status(500).json({
      success: false,
      error: 'Config update failed',
      message: 'Failed to update UBA configuration',
      code: 'CONFIG_UPDATE_ERROR'
    });
  }
});



module.exports = router;

