import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Tooltip,
  Avatar
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import Brightness2Icon from '@mui/icons-material/Brightness2';
import WarningIcon from '@mui/icons-material/Warning';
import SmartToyIcon from '@mui/icons-material/SmartToy';

import { motion } from 'framer-motion';
import { serverService } from '../../services/server';
import { getAdvancedAnalytics } from '../../services/logs';

// Animated Background (if you use your own backgrounds, keep this or remove)
const pulseAnimation = keyframes`
  0% {
    background-position: 0% 0%;
  }
  50% {
    background-position: 100% 100%;
  }
  100% {
    background-position: 0% 0%;
  }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// Technical color helper
const getStatusColor = (val) => {
  if (val >= 80) return '#ef4444'; // Red
  if (val >= 50) return '#f59e0b'; // Amber
  return '#10b981'; // Emerald
};

// Critical pulse animation
const criticalPulse = keyframes`
  0% { background-color: rgba(220, 38, 38, 1); }
  50% { background-color: rgba(220, 38, 38, 0.6); }
  100% { background-color: rgba(220, 38, 38, 1); }
`;

// Technical Server Health Widget with labeled columns
const MiniHealthGraph = ({ stats, onClick }) => {
  const metrics = [
    { label: 'CPU', value: stats?.cpu?.percentage || 0 },
    { label: 'MEM', value: stats?.memory?.percentage || 0 },
    { label: 'DSK', value: stats?.disk?.percentage || 0 },
  ];

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        cursor: 'pointer',
        py: 0.5,
        '&:hover .bar-label': {
          color: 'rgba(255,255,255,0.8)',
        },
      }}
    >
      {metrics.map((metric, index) => (
        <Box key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          {/* Bar Container with grid lines */}
          <Box
            sx={{
              height: 32,
              width: 10,
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(71, 85, 105, 0.6)',
              borderRadius: '2px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Grid lines */}
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', opacity: 0.2 }}>
              <Box sx={{ height: '1px', width: '100%', backgroundColor: 'rgba(148, 163, 184, 0.5)' }} />
              <Box sx={{ height: '1px', width: '100%', backgroundColor: 'rgba(148, 163, 184, 0.5)' }} />
              <Box sx={{ height: '1px', width: '100%', backgroundColor: 'rgba(148, 163, 184, 0.5)' }} />
            </Box>
            {/* Animated Bar */}
            <motion.div
              initial={{ height: '5%' }}
              animate={{ height: `${Math.max(metric.value, 5)}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{
                width: '100%',
                backgroundColor: getStatusColor(metric.value),
                borderRadius: '1px',
              }}
            />
          </Box>
          {/* Label */}
          <Typography
            className="bar-label"
            sx={{
              fontSize: '9px',
              fontFamily: 'monospace',
              fontWeight: 700,
              color: 'rgba(148, 163, 184, 0.7)',
              letterSpacing: '0.5px',
              transition: 'color 0.2s',
            }}
          >
            {metric.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

// Critical Alert Widget with danger icon
const CriticalAlertWidget = ({ count, onClick }) => {
  const hasCritical = count > 0;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        cursor: 'pointer',
        py: 0.5,
        position: 'relative',
        '&:hover .alert-icon-container': {
          backgroundColor: 'rgba(30, 41, 59, 0.8)',
          borderColor: 'rgba(71, 85, 105, 0.8)',
        },
        '&:hover .alert-label': {
          color: hasCritical ? '#ef4444' : 'rgba(255,255,255,0.8)',
        },
      }}
    >
      {/* Icon Container with Badge */}
      <Box sx={{ position: 'relative' }}>
        <Box
          className="alert-icon-container"
          sx={{
            p: 0.75,
            borderRadius: '2px',
            border: '1px solid transparent',
            transition: 'all 0.2s',
          }}
        >
          <WarningIcon
            sx={{
              fontSize: 20,
              color: hasCritical ? '#ef4444' : 'rgba(148, 163, 184, 0.6)',
              transition: 'color 0.3s',
            }}
          />
        </Box>

        {/* Badge */}
        {hasCritical && (
          <Box
            component={motion.div}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            sx={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#dc2626',
              borderRadius: '50%',
              border: '2px solid',
              borderColor: 'background.paper',
              animation: `${criticalPulse} 1.5s infinite`,
              zIndex: 1,
            }}
          >
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'white', lineHeight: 1 }}>
              {count > 99 ? '99+' : count}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Label */}
      <Typography
        className="alert-label"
        sx={{
          fontSize: '9px',
          fontFamily: 'monospace',
          fontWeight: 700,
          color: hasCritical ? '#ef4444' : 'rgba(148, 163, 184, 0.7)',
          letterSpacing: '0.5px',
          transition: 'color 0.2s',
        }}
      >
        {hasCritical ? 'CRITICAL' : 'ALERTS'}
      </Typography>
    </Box>
  );
};

// Divider component
const HeaderDivider = () => (
  <Box sx={{ height: 32, width: '1px', backgroundColor: 'rgba(71, 85, 105, 0.6)', mx: 1.5 }} />
);

const Header = ({ open, toggleDrawer, title, onAIChatToggle, isAIChatOpen }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [serverStats, setServerStats] = useState(null);
  const [criticalCount, setCriticalCount] = useState(0);
  const { currentUser, logout } = useAuth();
  const { themeMode, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();

  // Fetch server stats and critical count
  useEffect(() => {
    const fetchData = async () => {
      try {
        const stats = await serverService.getServerStats();
        setServerStats(stats);
      } catch (err) {
        console.error('Failed to fetch server stats:', err);
      }

      try {
        const response = await getAdvancedAnalytics('24h');
        setCriticalCount(response?.summary?.critical || 0);
      } catch (err) {
        console.error('Failed to fetch critical count:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleProfile = () => {
    handleClose();
    navigate('/profile');
  };

  // const handleSettings = () => {
  //   handleClose();
  //   navigate('/settings');
  // };

  return (
    <>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <AppBar
          position="fixed"
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 1,
            transition: (theme) => theme.transitions.create(['width', 'margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="toggle drawer"
              onClick={toggleDrawer}
              edge="start"
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>

            {/* <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              {title || 'Security Log Manager'}
            </Typography> */}

            <Box sx={{ flexGrow: 1 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {/* Sentinel-AI Toggle - First Position */}
              <Tooltip title={isAIChatOpen ? 'Close Sentinel-AI' : 'Open Sentinel-AI'} arrow>
                <Box
                  onClick={onAIChatToggle}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    py: 0.5,
                    '&:hover .sentinel-container': {
                      backgroundColor: 'rgba(30, 41, 59, 0.8)',
                      borderColor: 'rgba(99, 102, 241, 0.6)',
                    },
                    '&:hover .sentinel-label': {
                      color: '#6366f1',
                    },
                  }}
                >
                  <Box
                    className="sentinel-container"
                    sx={{
                      p: 0.75,
                      borderRadius: '2px',
                      border: isAIChatOpen ? '1px solid rgba(99, 102, 241, 0.6)' : '1px solid transparent',
                      backgroundColor: isAIChatOpen ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      transition: 'all 0.2s',
                    }}
                  >
                    <SmartToyIcon
                      sx={{
                        fontSize: 20,
                        color: isAIChatOpen ? '#6366f1' : 'rgba(148, 163, 184, 0.6)',
                        transition: 'color 0.3s',
                      }}
                    />
                  </Box>
                  <Typography
                    className="sentinel-label"
                    sx={{
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: isAIChatOpen ? '#6366f1' : 'rgba(148, 163, 184, 0.7)',
                      letterSpacing: '0.5px',
                      transition: 'color 0.2s',
                    }}
                  >
                    AI
                  </Typography>
                </Box>
              </Tooltip>

              <HeaderDivider />

              {/* Server Health Graph */}
              <Tooltip title="Server Health - Click to view" arrow>
                <span>
                  <MiniHealthGraph stats={serverStats} onClick={() => navigate('/profile')} />
                </span>
              </Tooltip>

              <HeaderDivider />

              {/* Critical Alert Widget */}
              <Tooltip title={`${criticalCount} Critical Alerts`} arrow>
                <span>
                  <CriticalAlertWidget count={criticalCount} onClick={() => navigate('/majorlogs')} />
                </span>
              </Tooltip>

              <HeaderDivider />

              {/* Theme Toggle - Technical Style */}
              <Tooltip title={themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'} arrow>
                <Box
                  onClick={toggleTheme}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    py: 0.5,
                    '&:hover .theme-icon-container': {
                      backgroundColor: 'rgba(30, 41, 59, 0.8)',
                      borderColor: 'rgba(71, 85, 105, 0.8)',
                    },
                    '&:hover .theme-label': {
                      color: 'rgba(255,255,255,0.8)',
                    },
                  }}
                >
                  <Box
                    className="theme-icon-container"
                    sx={{
                      p: 0.75,
                      borderRadius: '2px',
                      border: '1px solid transparent',
                      transition: 'all 0.2s',
                    }}
                  >
                    <motion.div
                      key={themeMode}
                      initial={{ rotate: 0, scale: 0.8 }}
                      animate={{ rotate: 360, scale: 1 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    >
                      {themeMode === 'light' ? (
                        <WbSunnyIcon sx={{ fontSize: 20, color: '#f59e0b' }} />
                      ) : (
                        <Brightness2Icon sx={{ fontSize: 20, color: '#6366f1' }} />
                      )}
                    </motion.div>
                  </Box>
                  <Typography
                    className="theme-label"
                    sx={{
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: 'rgba(148, 163, 184, 0.7)',
                      letterSpacing: '0.5px',
                      transition: 'color 0.2s',
                    }}
                  >
                    {themeMode === 'dark' ? 'DARK' : 'LIGHT'}
                  </Typography>
                </Box>
              </Tooltip>

              <HeaderDivider />

              {/* User Profile - Technical Style */}
              <Tooltip title="Profile" arrow>
                <Box
                  onClick={handleMenu}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    py: 0.5,
                    '&:hover .profile-container': {
                      backgroundColor: 'rgba(30, 41, 59, 0.8)',
                      borderColor: 'rgba(71, 85, 105, 0.8)',
                    },
                    '&:hover .profile-label': {
                      color: 'rgba(255,255,255,0.8)',
                    },
                  }}
                >
                  <Box
                    className="profile-container"
                    sx={{
                      p: 0.5,
                      borderRadius: '2px',
                      border: '1px solid transparent',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '2px',
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        border: '1px solid rgba(71, 85, 105, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#6366f1',
                        fontFamily: 'monospace',
                      }}
                    >
                      {currentUser?.name?.charAt(0).toUpperCase() ||
                        currentUser?.username?.charAt(0).toUpperCase() || 'U'}
                    </Box>
                  </Box>
                  <Typography
                    className="profile-label"
                    sx={{
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: 'rgba(148, 163, 184, 0.7)',
                      letterSpacing: '0.5px',
                      transition: 'color 0.2s',
                      textTransform: 'uppercase',
                    }}
                  >
                    {currentUser?.username?.slice(0, 5) || 'USER'}
                  </Typography>
                </Box>
              </Tooltip>

              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem onClick={handleProfile}>
                  <AccountCircleIcon sx={{ mr: 1 }} /> Profile
                </MenuItem>
                {/* <MenuItem onClick={handleSettings}>
                  <SettingsIcon sx={{ mr: 1 }} /> Settings
                </MenuItem> */}
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon sx={{ mr: 1 }} /> Logout
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>
      </motion.div>
    </>
  );
};

export default Header;



// remove the server part from here and created a single server component to use 