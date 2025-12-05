// backend/utils/optimizedLogTransformer.js
// Complete log transformation with all fields (optimized for performance)

// Pre-compile regex for better performance
const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

// Cache for timestamp field lookup
const TIMESTAMP_FIELDS = ['timestamp', '@timestamp', 'time', 'date', 'Timestamp', 'TimeStamp', 'TIMESTAMP'];
const ID_FIELDS = ['id', '_id', 'ID', 'Id', 'log_id', 'logId', 'uniqueIdentifier'];

// Fast IP validation (optimized)
const isValidIPFast = (ip) => {
  if (typeof ip !== 'string' || ip === 'unknown' || ip.length > 15 || ip.length < 7) {
    return false;
  }
  
  const match = ip.match(IPV4_REGEX);
  if (!match) return false;
  
  // Quick octet validation
  for (let i = 1; i <= 4; i++) {
    const num = parseInt(match[i], 10);
    if (num > 255) return false;
  }
  return true;
};

// Fast timestamp extraction
const extractTimestampFast = (log) => {
  for (const field of TIMESTAMP_FIELDS) {
    if (log[field]) {
      try {
        if (log[field] instanceof Date) {
          return log[field].toISOString();
        }
        
        if (typeof log[field] === 'number') {
          // Handle Unix timestamps
          const timestamp = log[field] < 10000000000 ? log[field] * 1000 : log[field];
          return new Date(timestamp).toISOString();
        }
        
        return new Date(log[field]).toISOString();
      } catch (error) {
        continue; // Try next field
      }
    }
  }
  return new Date().toISOString();
};

// Fast ID generation
const generateId = (log) => {
  for (const field of ID_FIELDS) {
    if (log[field]) {
      return String(log[field]);
    }
  }
  
  // Fast ID generation
  return `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Extract location with multiple source checking
const extractLocation = (log, messageData) => {
  // Check top-level location
  if (log.location) return log.location;

  // Check in raw_log if it exists
  if (log.raw_log) {
    if (typeof log.raw_log === 'object' && log.raw_log.location) {
      return log.raw_log.location;
    }
    // Handle case where raw_log is a string containing JSON
    if (typeof log.raw_log === 'string') {
      try {
        const parsedRawLog = JSON.parse(log.raw_log);
        if (parsedRawLog.location) return parsedRawLog.location;
      } catch (e) {
        // Silent fail for performance
      }
    }
  }

  // Check in message data if exists
  if (messageData && messageData.location) return messageData.location;

  return null;
};

// Complete agent extraction
const extractAgentComplete = (log, messageData) => {
  const agent = {
    name: 'unknown',
    id: 'unknown',
    ip: null
  };

  // Extract from top-level fields
  if (log.agent_name) agent.name = log.agent_name;

  // Check if agent object exists directly in log
  if (log.agent) {
    agent.name = log.agent.name || log.agent.agent_name || agent.name;
    agent.id = log.agent.id || log.agent.agent_id || agent.id;

    // Only set IP if it's a valid IP address
    if (log.agent.ip && isValidIPFast(log.agent.ip)) {
      agent.ip = log.agent.ip;
    }
  }

  // Extract from message data if available
  if (messageData && messageData.agent) {
    if (messageData.agent.name) agent.name = messageData.agent.name;
    if (messageData.agent.id) agent.id = messageData.agent.id;
    if (messageData.agent.ip && isValidIPFast(messageData.agent.ip)) {
      agent.ip = messageData.agent.ip;
    }
  }

  return agent;
};

// Complete rule extraction with all compliance frameworks
const extractRuleComplete = (log, messageData) => {
  const rule = {
    id: 'unknown',
    level: 0,
    description: 'No description',
    groups: [],
    mitre: {
      id: [],
      tactic: [],
      technique: []
    },
    gdpr: [],
    hipaa: [],
    gpg13: [],
    nist: [],
    pci_dss: [],
    tsc: []
  };

  // Extract from top-level fields
  if (log.rule_id) rule.id = log.rule_id;
  if (log.rule_level) rule.level = parseInt(log.rule_level, 10) || 0;
  if (log.rule_description) rule.description = log.rule_description;

  // Extract from rule object if it exists in log
  if (log.rule) {
    if (log.rule.id) rule.id = log.rule.id;
    if (log.rule.level) rule.level = parseInt(log.rule.level, 10) || 0;
    if (log.rule.description) rule.description = log.rule.description;

    // Extract groups
    if (log.rule.groups && Array.isArray(log.rule.groups)) {
      rule.groups = log.rule.groups;
    }

    // Extract compliance frameworks
    if (log.rule.gdpr) rule.gdpr = Array.isArray(log.rule.gdpr) ? log.rule.gdpr : [log.rule.gdpr];
    if (log.rule.hipaa) rule.hipaa = Array.isArray(log.rule.hipaa) ? log.rule.hipaa : [log.rule.hipaa];
    if (log.rule.gpg13) rule.gpg13 = Array.isArray(log.rule.gpg13) ? log.rule.gpg13 : [log.rule.gpg13];
    if (log.rule.nist_800_53) rule.nist = Array.isArray(log.rule.nist_800_53) ? log.rule.nist_800_53 : [log.rule.nist_800_53];
    if (log.rule.pci_dss) rule.pci_dss = Array.isArray(log.rule.pci_dss) ? log.rule.pci_dss : [log.rule.pci_dss];
    if (log.rule.tsc) rule.tsc = Array.isArray(log.rule.tsc) ? log.rule.tsc : [log.rule.tsc];

    // Extract MITRE ATT&CK info - Handle both string and object formats
    if (log.rule.mitre) {
      if (typeof log.rule.mitre === 'object' && !Array.isArray(log.rule.mitre)) {
        // Object format with id, tactic, technique fields
        if (log.rule.mitre.id) {
          rule.mitre.id = Array.isArray(log.rule.mitre.id) ? log.rule.mitre.id : [log.rule.mitre.id];
        }
        if (log.rule.mitre.tactic) {
          rule.mitre.tactic = Array.isArray(log.rule.mitre.tactic) ? log.rule.mitre.tactic : [log.rule.mitre.tactic];
        }
        if (log.rule.mitre.technique) {
          rule.mitre.technique = Array.isArray(log.rule.mitre.technique) ? log.rule.mitre.technique : [log.rule.mitre.technique];
        }
      } else if (Array.isArray(log.rule.mitre)) {
        // Array format (usually just IDs)
        rule.mitre.id = log.rule.mitre;
      } else if (typeof log.rule.mitre === 'string') {
        // String format (single ID)
        rule.mitre.id = [log.rule.mitre];
      }
    }
  }

  // Extract from message data if available
  if (messageData && messageData.rule) {
    if (messageData.rule.id) rule.id = messageData.rule.id;
    if (messageData.rule.level) rule.level = parseInt(messageData.rule.level, 10) || 0;
    if (messageData.rule.description) rule.description = messageData.rule.description;

    // Extract groups
    if (messageData.rule.groups && Array.isArray(messageData.rule.groups)) {
      rule.groups = messageData.rule.groups;
    }

    // Extract compliance frameworks
    if (messageData.rule.gdpr) rule.gdpr = Array.isArray(messageData.rule.gdpr) ? messageData.rule.gdpr : [messageData.rule.gdpr];
    if (messageData.rule.hipaa) rule.hipaa = Array.isArray(messageData.rule.hipaa) ? messageData.rule.hipaa : [messageData.rule.hipaa];
    if (messageData.rule.gpg13) rule.gpg13 = Array.isArray(messageData.rule.gpg13) ? messageData.rule.gpg13 : [messageData.rule.gpg13];
    if (messageData.rule.nist_800_53) rule.nist = Array.isArray(messageData.rule.nist_800_53) ? messageData.rule.nist_800_53 : [messageData.rule.nist_800_53];
    if (messageData.rule.pci_dss) rule.pci_dss = Array.isArray(messageData.rule.pci_dss) ? messageData.rule.pci_dss : [messageData.rule.pci_dss];
    if (messageData.rule.tsc) rule.tsc = Array.isArray(messageData.rule.tsc) ? messageData.rule.tsc : [messageData.rule.tsc];

    // Extract MITRE ATT&CK info from message data
    if (messageData.rule.mitre) {
      if (typeof messageData.rule.mitre === 'object' && !Array.isArray(messageData.rule.mitre)) {
        if (messageData.rule.mitre.id) {
          rule.mitre.id = Array.isArray(messageData.rule.mitre.id) ?
            messageData.rule.mitre.id : [messageData.rule.mitre.id];
        }
        if (messageData.rule.mitre.tactic) {
          rule.mitre.tactic = Array.isArray(messageData.rule.mitre.tactic) ?
            messageData.rule.mitre.tactic : [messageData.rule.mitre.tactic];
        }
        if (messageData.rule.mitre.technique) {
          rule.mitre.technique = Array.isArray(messageData.rule.mitre.technique) ?
            messageData.rule.mitre.technique : [messageData.rule.mitre.technique];
        }
      } else if (Array.isArray(messageData.rule.mitre)) {
        rule.mitre.id = messageData.rule.mitre;
      } else if (typeof messageData.rule.mitre === 'string') {
        rule.mitre.id = [messageData.rule.mitre];
      }
    }
  }

  return rule;
};

// Complete network extraction
const extractNetworkComplete = (log, messageData) => {
  const network = {
    srcIp: 'unknown',
    destIp: 'unknown',
    protocol: 'unknown',
    srcPort: null,
    destPort: null,
    flow: {
      state: null,
      pktsToServer: null,
      bytesToServer: null,
      pktsToClient: null,
      bytesToClient: null
    }
  };

  // Extract from top-level fields
  if (log.src_ip) network.srcIp = log.src_ip;
  if (log.dest_ip) network.destIp = log.dest_ip;

  // Check for data field with network info
  if (log.data) {
    if (log.data.srcip) network.srcIp = log.data.srcip;
    if (log.data.src_ip) network.srcIp = log.data.src_ip;
    if (log.data.dstip) network.destIp = log.data.dstip;
    if (log.data.dst_ip) network.destIp = log.data.dst_ip;
    if (log.data.proto) network.protocol = log.data.proto;
    if (log.data.srcport) network.srcPort = log.data.srcport;
    if (log.data.dstport) network.destPort = log.data.dstport;

    // Extract flow information
    if (log.data.flow) {
      Object.assign(network.flow, log.data.flow);
    }
  }

  // Extract from message data if available
  if (messageData && messageData.data) {
    if (messageData.data.srcip) network.srcIp = messageData.data.srcip;
    if (messageData.data.src_ip) network.srcIp = messageData.data.src_ip;
    if (messageData.data.dstip) network.destIp = messageData.data.dstip;
    if (messageData.data.dst_ip) network.destIp = messageData.data.dst_ip;
    if (messageData.data.proto) network.protocol = messageData.data.proto;
    if (messageData.data.srcport) network.srcPort = messageData.data.srcport;
    if (messageData.data.dstport) network.destPort = messageData.data.dstport;

    // Extract flow information from message data
    if (messageData.data.flow) {
      Object.assign(network.flow, messageData.data.flow);
    }
  }

  return network;
};

// Complete syscheck extraction
const extractSyscheckComplete = (log, messageData) => {
  const syscheck = {
    path: null,
    mode: null,
    size_after: null,
    size_before: null,
    uid_after: null,
    uid_before: null,
    gid_after: null,
    gid_before: null,
    md5_after: null,
    md5_before: null,
    sha1_after: null,
    sha1_before: null,
    sha256_after: null,
    sha256_before: null,
    uname_after: null,
    uname_before: null,
    mtime_after: null,
    mtime_before: null,
    changed_attributes: [],
    event: null,
    diff: null,
    attrs_after: [],
    attrs_before: [],
    win_perm_after: [],
    win_perm_before: [],
    audit: {
      user: {
        id: null,
        name: null
      },
      process: {
        id: null,
        name: null
      }
    }
  };

  // Check if syscheck object exists directly in log
  if (log.syscheck && typeof log.syscheck === 'object') {
    Object.assign(syscheck, log.syscheck);

    // Ensure arrays are arrays
    if (syscheck.changed_attributes && !Array.isArray(syscheck.changed_attributes)) {
      syscheck.changed_attributes = [syscheck.changed_attributes];
    }
    if (syscheck.attrs_after && !Array.isArray(syscheck.attrs_after)) {
      syscheck.attrs_after = [syscheck.attrs_after];
    }
    if (syscheck.attrs_before && !Array.isArray(syscheck.attrs_before)) {
      syscheck.attrs_before = [syscheck.attrs_before];
    }

    // Convert date strings to ISO format (fast conversion)
    if (syscheck.mtime_after && typeof syscheck.mtime_after === 'string') {
      try {
        syscheck.mtime_after = new Date(syscheck.mtime_after).toISOString();
      } catch (error) {
        // Keep original value if conversion fails
      }
    }
    if (syscheck.mtime_before && typeof syscheck.mtime_before === 'string') {
      try {
        syscheck.mtime_before = new Date(syscheck.mtime_before).toISOString();
      } catch (error) {
        // Keep original value if conversion fails
      }
    }
  }

  // Check in message data if exists
  if (messageData && messageData.syscheck && typeof messageData.syscheck === 'object') {
    Object.assign(syscheck, messageData.syscheck);

    // Same processing as above
    if (syscheck.changed_attributes && !Array.isArray(syscheck.changed_attributes)) {
      syscheck.changed_attributes = [syscheck.changed_attributes];
    }
    if (syscheck.attrs_after && !Array.isArray(syscheck.attrs_after)) {
      syscheck.attrs_after = [syscheck.attrs_after];
    }
    if (syscheck.attrs_before && !Array.isArray(syscheck.attrs_before)) {
      syscheck.attrs_before = [syscheck.attrs_before];
    }

    // Convert date strings to ISO format
    if (syscheck.mtime_after && typeof syscheck.mtime_after === 'string') {
      try {
        syscheck.mtime_after = new Date(syscheck.mtime_after).toISOString();
      } catch (error) {
        // Keep original value if conversion fails
      }
    }
    if (syscheck.mtime_before && typeof syscheck.mtime_before === 'string') {
      try {
        syscheck.mtime_before = new Date(syscheck.mtime_before).toISOString();
      } catch (error) {
        // Keep original value if conversion fails
      }
    }
  }

  return syscheck;
};

// Complete data field extraction
const extractDataComplete = (log, messageData) => {
  let data = {};

  // Start with log.data
  if (log.data && typeof log.data === 'object') {
    data = { ...log.data };
  }

  // Merge with messageData.data if available
  if (messageData && messageData.data && typeof messageData.data === 'object') {
    data = { ...data, ...messageData.data };
  }

  // Ensure important nested objects exist
  if (data.win && typeof data.win !== 'object') {
    data.win = {};
  }

  return data;
};

// Complete AI/ML data extraction
const extractAiMlLogsComplete = (log, messageData) => {
  // First, check for ai_ml_logs field directly in log
  if (log.ai_ml_logs && typeof log.ai_ml_logs === 'object') {
    return log.ai_ml_logs;
  }

  // Check in messageData
  if (messageData && messageData.ai_ml_logs && typeof messageData.ai_ml_logs === 'object') {
    return messageData.ai_ml_logs;
  }

  // Check for AI_response inside data (alternate format)
  if (log.data && log.data.AI_response) {
    return {
      ai_response: log.data.AI_response,
      timestamp: log.timestamp || new Date().toISOString()
    };
  }

  // Check for AI_response in messageData.data
  if (messageData && messageData.data && messageData.data.AI_response) {
    return {
      ai_response: messageData.data.AI_response,
      timestamp: messageData.timestamp || new Date().toISOString()
    };
  }

  // Return empty object if no AI/ML data found
  return {};
};

// Main complete transformation function (optimized but comprehensive)
const transformLogFast = async (rawLog) => {
  try {
    // Handle string parsing
    if (typeof rawLog === 'string') {
      try {
        rawLog = JSON.parse(rawLog);
      } catch (error) {
        return createErrorLog('Failed to parse log string', rawLog);
      }
    }

    if (!rawLog || typeof rawLog !== 'object') {
      return createErrorLog('Invalid log format', rawLog);
    }

    // Extract message data if it exists (fast check)
    let messageData = null;
    if (rawLog.message && typeof rawLog.message === 'string' && rawLog.message.charAt(0) === '{') {
      try {
        messageData = JSON.parse(rawLog.message);
      } catch (error) {
        // Ignore parsing errors for performance
      }
    }

    // Complete transformation with all fields
    const structuredLog = {
      '@timestamp': extractTimestampFast(rawLog),
      'id': generateId(rawLog),
      'location': extractLocation(rawLog, messageData),
      'agent': extractAgentComplete(rawLog, messageData),
      'rule': extractRuleComplete(rawLog, messageData),
      'network': extractNetworkComplete(rawLog, messageData),
      'data': extractDataComplete(rawLog, messageData),
      'syscheck': extractSyscheckComplete(rawLog, messageData),
      'ai_ml_logs': extractAiMlLogsComplete(rawLog, messageData),
      'is_false_positive': false, // Set to false for real-time processing
      'raw_log': rawLog
    };

    return structuredLog;
    
  } catch (error) {
    console.error('Error in complete log transformation:', error.message);
    return createErrorLog('Transformation error', rawLog);
  }
};

// Create error log structure
const createErrorLog = (errorMsg, originalLog) => {
  return {
    '@timestamp': new Date().toISOString(),
    'id': `error-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    'is_false_positive': false,
    'error': errorMsg,
    'location': null,
    'agent': { name: 'unknown', id: 'unknown', ip: null },
    'rule': { 
      id: 'unknown', 
      level: 0, 
      description: errorMsg, 
      groups: [], 
      mitre: { id: [], tactic: [], technique: [] },
      gdpr: [],
      hipaa: [],
      gpg13: [],
      nist: [],
      pci_dss: [],
      tsc: []
    },
    'network': { 
      srcIp: 'unknown', 
      destIp: 'unknown', 
      protocol: 'unknown', 
      srcPort: null, 
      destPort: null,
      flow: { state: null, pktsToServer: null, bytesToServer: null, pktsToClient: null, bytesToClient: null }
    },
    'data': {},
    'syscheck': {
      path: null,
      mode: null,
      size_after: null,
      size_before: null,
      uid_after: null,
      uid_before: null,
      gid_after: null,
      gid_before: null,
      md5_after: null,
      md5_before: null,
      sha1_after: null,
      sha1_before: null,
      sha256_after: null,
      sha256_before: null,
      uname_after: null,
      uname_before: null,
      mtime_after: null,
      mtime_before: null,
      changed_attributes: [],
      event: null,
      diff: null,
      attrs_after: [],
      attrs_before: [],
      win_perm_after: [],
      win_perm_before: [],
      audit: { user: { id: null, name: null }, process: { id: null, name: null } }
    },
    'ai_ml_logs': {},
    'raw_log': originalLog
  };
};

// CRITICAL: Export the function
module.exports = {
  transformLogFast
};