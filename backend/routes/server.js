// backend/routes/server.js
const express = require('express');
const os = require('os');
const fs = require('fs');
const { promisify } = require('util');
const router = express.Router();

// Helper function to format uptime
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

// Improved disk usage function for Linux
const getDiskUsage = async () => {
  try {
    // Use df command for more accurate disk usage on Linux
    const exec = promisify(require('child_process').exec);
    const { stdout } = await exec('df -k /');
    const lines = stdout.trim().split('\n');
    const diskInfo = lines[1].split(/\s+/);
    
    const total = parseInt(diskInfo[1]) * 1024;
    const used = parseInt(diskInfo[2]) * 1024;
    const free = parseInt(diskInfo[3]) * 1024;
    
    return {
      total,
      used,
      free,
      percentage: (used / total) * 100
    };
  } catch (error) {
    console.error('Error getting disk usage:', error);
    // Fallback to OS module if df command fails
    try {
      const stats = fs.statfsSync('/');
      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;
      
      return {
        total,
        used,
        free,
        percentage: (used / total) * 100
      };
    } catch (err) {
      console.error('Fallback disk usage error:', err);
      return {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0
      };
    }
  }
};

// Get comprehensive server statistics
router.get('/stats', async (req, res) => {
  try {
    // Memory information
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // CPU information - improved calculation
    const cpus = os.cpus();
    let cpuPercentage = 0;
    
    // Calculate CPU usage by comparing idle times
    if (cpus.length > 0) {
      const firstMeasure = cpus.map(cpu => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b);
        return { idle: cpu.times.idle, total };
      });
      
      // Wait a second to get a comparison
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const secondMeasure = os.cpus().map(cpu => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b);
        return { idle: cpu.times.idle, total };
      });
      
      // Calculate percentage
      cpuPercentage = firstMeasure.map((first, i) => {
        const second = secondMeasure[i];
        const idleDiff = second.idle - first.idle;
        const totalDiff = second.total - first.total;
        return 100 - (idleDiff / totalDiff) * 100;
      }).reduce((a, b) => a + b, 0) / cpus.length;
    }

    // Disk usage
    const diskUsage = await getDiskUsage();

    // System uptime
    const uptime = os.uptime();

    const serverStats = {
      timestamp: new Date().toISOString(),
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        percentage: memoryPercentage
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        percentage: cpuPercentage,
        loadAverage: os.loadavg()
      },
      disk: {
        total: diskUsage.total,
        used: diskUsage.used,
        free: diskUsage.free,
        percentage: diskUsage.percentage
      },
      uptime: formatUptime(uptime),
      uptimeSeconds: uptime,
      platform: os.platform(),
      architecture: os.arch(),
      hostname: os.hostname()
    };

    res.json(serverStats);
  } catch (error) {
    console.error('Error fetching server stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch server statistics',
      message: error.message 
    });
  }
});

// Get server health status (simplified)
router.get('/health', async (req, res) => {
  try {
    // Get fresh stats
    const statsResponse = await router.get('/stats', { originalUrl: '/server/stats' }, res);
    const serverStats = statsResponse.json();
    
    // Determine overall health status
    const maxUsage = Math.max(
      serverStats.memory.percentage, 
      serverStats.cpu.percentage, 
      serverStats.disk.percentage
    );
    
    let status = 'healthy';
    if (maxUsage > 80) {
      status = 'critical';
    } else if (maxUsage > 60) {
      status = 'warning';
    }

    res.json({
      status,
      memory: serverStats.memory.percentage.toFixed(1),
      cpu: serverStats.cpu.percentage.toFixed(1),
      disk: serverStats.disk.percentage.toFixed(1),
      maxUsage: maxUsage.toFixed(1),
      timestamp: serverStats.timestamp
    });
  } catch (error) {
    console.error('Error fetching server health:', error);
    res.status(500).json({ 
      status: 'unknown',
      error: 'Failed to fetch server health',
      message: error.message 
    });
  }
});

module.exports = router;