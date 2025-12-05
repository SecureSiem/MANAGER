import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Chip, Grid, Grow, CircularProgress, CardContent
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import SpeedIcon from '@mui/icons-material/Speed';
import ComputerIcon from '@mui/icons-material/Computer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReplayIcon from '@mui/icons-material/Replay';
import { IconButton, Tooltip } from '@mui/material';

import { serverService } from '../../services/server';

// --- Animation Keyframes ---
const pulseAnimation = keyframes`
  0% { background-position: 0% 0%; }
  50% { background-position: 100% 100%; }
  100% { background-position: 0% 0%; }
`;
const floatAnimation = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;
const glowAnimation = keyframes`
  0% { box-shadow: 0 0 5px rgba(25, 118, 210, 0.5); }
  50% { box-shadow: 0 0 20px rgba(25, 118, 210, 0.8), 0 0 30px rgba(25, 118, 210, 0.6);}
  100% { box-shadow: 0 0 5px rgba(25, 118, 210, 0.5);}
`;

// ---- Glassmorphic Modern Stats Card ----
const GlassCard = styled(Paper)(({ theme, severity = 'success' }) => {
  const bg = {
    error: 'rgba(244, 67, 54, 0.18)',
    warning: 'rgba(255, 193, 7, 0.16)',
    success: 'rgba(76, 175, 80, 0.12)',
    default: 'rgba(33, 150, 243, 0.09)'
  }[severity] || 'rgba(33, 150, 243, 0.09)';
  return {
    background: `${bg}`,
    backdropFilter: 'blur(7px)',
    borderRadius: 22,
    border: '1px solid rgba(255,255,255,0.14)',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15), 0 1.5px 3px rgba(0,0,0,0.06)',
    color: theme.palette.text.primary,
    position: 'relative',
    overflow: 'hidden',
    transition: 'all 0.3s',
    '&:hover': {
      boxShadow: '0 12px 28px 0 rgba(33, 150, 243, .16)',
      border: `1.5px solid ${theme.palette.primary.light}`,
      transform: 'scale(1.028) translateY(-3px)'
    }
  };
});

const AnimatedProgress = styled('div')(({ theme }) => ({
  height: 14,
  borderRadius: 7,
  background: 'rgba(255,255,255,0.08)',
  boxShadow: '0 3px 20px 0 rgba(33,150,243,0.11)'
}));

const CircularMetric = styled(Box)(() => ({
  position: 'relative',
  display: 'inline-flex',
  animation: `${floatAnimation} 3s ease-in-out infinite`,
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(4),
  background: theme.palette.mode === 'dark'
    ? `${theme.palette.background.paper}95`
    : `${theme.palette.primary.light}20`,
  color: theme.palette.text.primary,
  borderRadius: 12,
  position: 'relative',
  overflow: 'hidden'
}));

const ServerHealth = () => {
  const [serverStats, setServerStats] = useState(null);
  const [loading, setLoading] = useState(false);

  // Helpers (unchanged)
  const getHealthColor = (percentage) => {
    if (percentage === undefined || percentage === null) return 'primary';
    if (percentage < 50) return 'success';
    if (percentage < 80) return 'warning';
    return 'error';
  };
  const getHealthSeverity = (percentage) => {
    if (percentage === undefined || percentage === null) return 'success';
    if (percentage < 50) return 'success';
    if (percentage < 80) return 'warning';
    return 'error';
  };
  const getHealthStatus = (stats) => {
    if (!stats) return 'unknown';
    const maxUsage = Math.max(stats.memory.percentage, stats.disk.percentage, stats.cpu.percentage);
    if (maxUsage < 50) return 'healthy';
    if (maxUsage < 80) return 'warning';
    return 'critical';
  };
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const CircularProgressWithLabel = ({ value, color, size = 120, label, icon }) => (
    <CircularMetric>
      <CircularProgress
        variant="determinate"
        value={value}
        size={size}
        thickness={6}
        sx={{
          color: (theme) => theme.palette[color].main,
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
          }
        }}
      />
      <Box
        sx={{
          top: 0, left: 0, bottom: 0, right: 0, position: 'absolute',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'
        }}
      >
        {icon}
        <Typography variant="h6" component="div" color="text.secondary" fontWeight="bold">
          {`${Math.round(value)}%`}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </CircularMetric>
  );

  // Fetch server stats on mount
  useEffect(() => {
    fetchStats();
    // Optional: Uncomment for auto-refresh every 60s
    // const interval = setInterval(fetchStats, 60000);
    // return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const stats = await serverService.getServerStats();
      setServerStats(stats);
    } catch {
      setServerStats(null);
    } finally {
      setLoading(false);
    }
  };

  // ---- UI ----
  if (loading) {
    return (
      <LoadingContainer>
        <CircularProgress size={60} thickness={4} sx={{ mb: 2 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          Loading server statistics...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please wait while we fetch the latest data
        </Typography>
      </LoadingContainer>
    );
  }
  if (!serverStats) {
    return (
      <Paper elevation={2} sx={{
        p: 4, textAlign: 'center', borderRadius: 3,
        background: 'linear-gradient(135deg, rgba(244, 67, 54, 0.1), rgba(229, 115, 115, 0.1))',
      }}>
        <StorageIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
        <Typography variant="h6" color="error" gutterBottom>
          Failed to load server statistics
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please check your connection and try again.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 4, mb: 4, bgcolor: 'transparent', boxShadow: 'none'}}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
  <Box display="flex" alignItems="center" gap={2}>
    <ComputerIcon sx={{ fontSize: 42, color: 'primary.main' }} />
    <Typography variant="h5" fontWeight={700}>
      Server Health Monitor
    </Typography>
    <Chip
      label={getHealthStatus(serverStats).toUpperCase()}
      color={getHealthColor(Math.max(
        serverStats.memory.percentage,
        serverStats.disk.percentage,
        serverStats.cpu.percentage))}
      size="medium"
      variant="outlined"
      sx={{ fontWeight: 900, letterSpacing: 1, borderRadius: 8, mx: 1 }}
    />
  </Box>
  <Tooltip title="Refresh now">
    <span>
      <IconButton
        color="primary"
        onClick={fetchStats}
        disabled={loading}
        sx={{
          bgcolor: 'white',
          border: '1.5px solid',
          borderColor: 'primary.light',
          boxShadow: '0 2px 12px rgba(33,150,243,.10)',
          '&:hover': { bgcolor: 'primary.light', color: 'white' }
        }}
      >
        <ReplayIcon />
      </IconButton>
    </span>
  </Tooltip>
</Box>

      <Typography variant="body2" color="text.secondary" mb={2}>
        Live server health statistics
      </Typography>

      <Grid container spacing={4} justifyContent="center" mb={3}>
        <Grid item xs={12} md={4}>
          <GlassCard severity={getHealthSeverity(serverStats.cpu.percentage)} sx={{ p: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <SpeedIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                <Typography variant="h6" fontWeight={700}>CPU Usage</Typography>
              </Box>
              <CircularProgressWithLabel
                value={serverStats.cpu.percentage}
                color={getHealthColor(serverStats.cpu.percentage)}
                label="CPU"
                icon={<SpeedIcon sx={{ mb: 1, color: 'primary.main' }} />}
              />
              <Box display="flex" alignItems="center" mt={2}>
                <AnimatedProgress sx={{ width: '100%', mr: 2 }}>
                  <Box sx={{
                    width: `${serverStats.cpu.percentage}%`,
                    height: 14,
                    background: 'linear-gradient(90deg, #42e695 0%, #3bb2b8 70%, #1976d2 100%)',
                    borderRadius: 7,
                    animation: `${pulseAnimation} 2s linear infinite`
                  }} />
                </AnimatedProgress>
                <Typography variant="h6" fontWeight={800} color="primary">
                  {serverStats.cpu.percentage.toFixed(1)}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mt={1}>
                Load Average: {serverStats.cpu.loadAverage.join(', ')}
              </Typography>
            </CardContent>
          </GlassCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <GlassCard severity={getHealthSeverity(serverStats.memory.percentage)} sx={{ p: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <MemoryIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                <Typography variant="h6" fontWeight={700}>Memory Usage</Typography>
              </Box>
              <CircularProgressWithLabel
                value={serverStats.memory.percentage}
                color={getHealthColor(serverStats.memory.percentage)}
                label="Memory"
                icon={<MemoryIcon sx={{ mb: 1, color: 'primary.main' }} />}
              />
              <Box display="flex" alignItems="center" mt={2}>
                <AnimatedProgress sx={{ width: '100%', mr: 2 }}>
                  <Box sx={{
                    width: `${serverStats.memory.percentage}%`,
                    height: 14,
                    background: 'linear-gradient(90deg, #8fd3f4 0%, #84fab0 70%, #43e97b 100%)',
                    borderRadius: 7,
                    animation: `${pulseAnimation} 2s linear infinite`
                  }} />
                </AnimatedProgress>
                <Typography variant="h6" fontWeight={800} color="primary">
                  {serverStats.memory.percentage.toFixed(1)}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mt={1}>
                {formatBytes(serverStats.memory.used)} / {formatBytes(serverStats.memory.total)}
              </Typography>
            </CardContent>
          </GlassCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <GlassCard severity={getHealthSeverity(serverStats.disk.percentage)} sx={{ p: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <StorageIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                <Typography variant="h6" fontWeight={700}>Disk Usage</Typography>
              </Box>
              <CircularProgressWithLabel
                value={serverStats.disk.percentage}
                color={getHealthColor(serverStats.disk.percentage)}
                label="Disk"
                icon={<StorageIcon sx={{ mb: 1, color: 'primary.main' }} />}
              />
              <Box display="flex" alignItems="center" mt={2}>
                <AnimatedProgress sx={{ width: '100%', mr: 2 }}>
                  <Box sx={{
                    width: `${serverStats.disk.percentage}%`,
                    height: 14,
                    background: 'linear-gradient(90deg, #f7797d 0%, #FBD786 70%, #C6FFDD 100%)',
                    borderRadius: 7,
                    animation: `${pulseAnimation} 2s linear infinite`
                  }} />
                </AnimatedProgress>
                <Typography variant="h6" fontWeight={800} color="primary">
                  {serverStats.disk.percentage.toFixed(1)}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mt={1}>
                {formatBytes(serverStats.disk.used)} / {formatBytes(serverStats.disk.total)} available
              </Typography>
            </CardContent>
          </GlassCard>
        </Grid>
        <Grid item xs={12} mt={2}>
          <GlassCard sx={{ p: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <AccessTimeIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                <Typography variant="h6" fontWeight={700}>System Information</Typography>
              </Box>
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" alignItems="center">
                  <TrendingUpIcon sx={{ mr: 1, fontSize: 18, color: 'success.main' }} />
                  <Typography variant="body2" color="text.secondary">
                    Uptime: {serverStats.uptime}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <AccessTimeIcon sx={{ mr: 1, fontSize: 18, color: 'info.main' }} />
                  <Typography variant="body2" color="text.secondary">
                    Last Updated: {new Date(serverStats.timestamp).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </GlassCard>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default ServerHealth;
