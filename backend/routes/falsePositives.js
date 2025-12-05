// backend/routes/falsePositives.js
const express = require('express');
const router = express.Router();
const { getOpenSearchClient, getIndexNameForDate } = require('../config/opensearch');
const { ApiError } = require('../utils/errorHandler');
const { authenticate, hasRole } = require('../middleware/authMiddleware');

router.use(authenticate);

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
        return false; // If field doesn't exist, rule doesn't match
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
    return true; // All conditions matched
  } catch (error) {
    console.error('Error matching rule:', error);
    return false;
  }
};

// Get all false positive rules
router.get('/', hasRole(['administrator', 'L3-Analyst']), async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const currentPage = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const from = (currentPage - 1) * pageSize;

    const client = await getOpenSearchClient();

    // Build query
    const query = {
      bool: {
        must: []
      }
    };

    // Add search if provided
    if (search && search.trim() !== '') {
      query.bool.must.push({
        multi_match: {
          query: search,
          fields: [
            'rule_name^3',
            'description^2',
            'field_path',
            'field_value',
            'created_by.username'
          ],
          type: "best_fields",
          fuzziness: "AUTO"
        }
      });
    }

    // Execute search
    const response = await client.search({
      index: 'false_positives',
      body: {
        from,
        size: pageSize,
        query: query.bool.must.length > 0 ? query : { match_all: {} },
        sort: [
          {
            [sortBy]: {
              order: sortOrder
            }
          }
        ]
      }
    });

    const rules = response.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id
    }));

    res.json({
      rules,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: response.body.hits.total.value,
        pages: Math.ceil(response.body.hits.total.value / pageSize)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create a new false positive rule
router.post('/', hasRole(['administrator', 'L3-Analyst']), async (req, res, next) => {
  try {
    const { rule_name, description, conditions } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    // Validate input
    if (!rule_name || !conditions || !Array.isArray(conditions) || conditions.length === 0) {
      throw new ApiError(400, 'Rule name and conditions are required');
    }

    // Validate conditions
    for (const condition of conditions) {
      if (!condition.field_path || !condition.value) {
        throw new ApiError(400, 'Each condition must have field_path and value');
      }
      if (!['equals', 'regex'].includes(condition.operator)) {
        throw new ApiError(400, 'Operator must be either "equals" or "regex"');
      }
    }

    const client = await getOpenSearchClient();

    // Create the rule
    const rule = {
      rule_name,
      description: description || '',
      conditions,
      created_by: {
        id: userId,
        username: username
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      match_count: 0,
      last_matched: null
    };

    const createResponse = await client.index({
      index: 'false_positives',
      body: rule,
      refresh: true
    });

    const ruleId = createResponse.body._id;

    res.status(201).json({
      message: 'False positive rule created successfully',
      rule: {
        ...rule,
        id: ruleId
      }
    });
  } catch (error) {
    next(error);
  }
});

// Test a rule against existing logs (preview)
router.post('/test', hasRole(['administrator', 'L3-Analyst']), async (req, res, next) => {
  try {
    const { conditions, timeRange = '24h' } = req.body;

    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      throw new ApiError(400, 'Conditions are required for testing');
    }

    const client = await getOpenSearchClient();

    // Parse time range
    const now = new Date();
    let startDate = new Date(now);
    
    switch (timeRange) {
      case '1h':
        startDate.setHours(startDate.getHours() - 1);
        break;
      case '24h':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      default:
        startDate.setDate(startDate.getDate() - 1);
    }

    // Build OpenSearch query from conditions
    const mustQueries = [];
    
    // Add time range
    mustQueries.push({
      range: {
        '@timestamp': {
          gte: startDate.toISOString(),
          lte: now.toISOString()
        }
      }
    });

    // Add condition queries
    for (const condition of conditions) {
      if (condition.operator === 'equals') {
        mustQueries.push({
          term: {
            [`${condition.field_path}.keyword`]: condition.value
          }
        });
      } else if (condition.operator === 'regex') {
        mustQueries.push({
          regexp: {
            [`${condition.field_path}.keyword`]: {
              value: condition.value,
              flags: "ALL",
              case_insensitive: true
            }
          }
        });
      }
    }

    // Get all existing indices
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];
    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    if (indices.length === 0) {
      return res.json({ count: 0 });
    }

    // Execute count query
    const countResponse = await client.count({
      index: indices.join(','),
      body: {
        query: {
          bool: {
            must: mustQueries
          }
        }
      }
    });

    res.json({
      count: countResponse.body.count,
      timeRange
    });
  } catch (error) {
    next(error);
  }
});

// Update a false positive rule
router.put('/:id', hasRole(['administrator', 'L3-Analyst']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rule_name, description, conditions, is_active } = req.body;

    const client = await getOpenSearchClient();

    // Get existing rule
    const existingResponse = await client.get({
      index: 'false_positives',
      id: id
    });

    if (!existingResponse.body.found) {
      throw new ApiError(404, 'False positive rule not found');
    }

    const existingRule = existingResponse.body._source;

    // Update rule
    const updatedRule = {
      ...existingRule,
      rule_name: rule_name || existingRule.rule_name,
      description: description !== undefined ? description : existingRule.description,
      conditions: conditions || existingRule.conditions,
      is_active: is_active !== undefined ? is_active : existingRule.is_active,
      updated_at: new Date().toISOString()
    };

    await client.index({
      index: 'false_positives',
      id: id,
      body: updatedRule,
      refresh: true
    });

    res.json({
      message: 'False positive rule updated successfully',
      rule: {
        ...updatedRule,
        id
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete a false positive rule
router.delete('/:id', hasRole(['administrator', 'L3-Analyst']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await getOpenSearchClient();

    // Get the rule before deletion
    const ruleResponse = await client.get({
      index: 'false_positives',
      id: id
    });

    if (!ruleResponse.body.found) {
      throw new ApiError(404, 'False positive rule not found');
    }

    // Delete the rule
    await client.delete({
      index: 'false_positives',
      id: id,
      refresh: true
    });

    // Immediately update logs that were marked by this rule
    // Get all existing indices
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let indices = [];
    if (indicesResponse.body && indicesResponse.body.length > 0) {
      indices = indicesResponse.body.map(index => index.index);
    }

    if (indices.length > 0) {
      // Build query to find logs that match this rule and are marked as false positive
      const rule = ruleResponse.body._source;
      const mustQueries = [{
        term: { 'is_false_positive': true }
      }];

      // Add the rule conditions to find matching logs
      for (const condition of rule.conditions) {
        if (condition.operator === 'equals') {
          mustQueries.push({
            term: {
              [`${condition.field_path}.keyword`]: condition.value
            }
          });
        } else if (condition.operator === 'regex') {
          mustQueries.push({
            regexp: {
              [`${condition.field_path}.keyword`]: {
                value: condition.value,
                flags: "ALL",
                case_insensitive: true
              }
            }
          });
        }
      }

      // Update logs in batches
      await client.updateByQuery({
        index: indices.join(','),
        body: {
          query: {
            bool: {
              must: mustQueries
            }
          },
          script: {
            source: 'ctx._source.is_false_positive = false; ctx._source.false_positive_rules = null;',
            lang: 'painless'
          }
        },
        refresh: true,
        wait_for_completion: false // Run in background
      });
    }

    res.json({
      message: 'False positive rule deleted successfully and affected logs updated'
    });
  } catch (error) {
    next(error);
  }
});

// Get statistics
router.get('/stats', hasRole(['administrator', 'L3-Analyst']), async (req, res, next) => {
  try {
    const client = await getOpenSearchClient();

    // Get total rules count
    const rulesCount = await client.count({
      index: 'false_positives'
    });

    // Get active rules count
    const activeRulesCount = await client.count({
      index: 'false_positives',
      body: {
        query: {
          term: { 'is_active': true }
        }
      }
    });

    // Get total false positive logs count from all log indices
    const indicesResponse = await client.cat.indices({
      index: 'logs-*',
      format: 'json'
    });

    let falsePositiveLogsCount = 0;
    if (indicesResponse.body && indicesResponse.body.length > 0) {
      const indices = indicesResponse.body.map(index => index.index);
      
      const fpLogsResponse = await client.count({
        index: indices.join(','),
        body: {
          query: {
            term: { 'is_false_positive': true }
          }
        }
      });
      
      falsePositiveLogsCount = fpLogsResponse.body.count;
    }

    res.json({
      total_rules: rulesCount.body.count,
      active_rules: activeRulesCount.body.count,
      inactive_rules: rulesCount.body.count - activeRulesCount.body.count,
      total_false_positive_logs: falsePositiveLogsCount
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;