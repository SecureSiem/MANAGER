import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import cyberSentinelLogo from '../../assets/cybersentinel.png';

import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Typography,
  Avatar,
  Tooltip,
  Collapse,
} from '@mui/material';

import DashboardIcon from '@mui/icons-material/Dashboard';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import PsychologyIcon from '@mui/icons-material/Psychology';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import PublicIcon from '@mui/icons-material/Public';
import SecurityIcon from '@mui/icons-material/Security';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import BugReportIcon from '@mui/icons-material/BugReport';
import WarningIcon from '@mui/icons-material/Warning';
import CoronavirusIcon from '@mui/icons-material/Coronavirus';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import DevicesOtherIcon from '@mui/icons-material/DevicesOther';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import InsertPageBreakIcon from '@mui/icons-material/InsertPageBreak';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import DescriptionIcon from '@mui/icons-material/Description';
import ScreenSearchDesktopIcon from '@mui/icons-material/ScreenSearchDesktop';
import AddModeratorIcon from '@mui/icons-material/AddModerator';
import CrisisAlertIcon from '@mui/icons-material/CrisisAlert';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import ShieldIcon from '@mui/icons-material/Shield';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LaptopIcon from '@mui/icons-material/Laptop';

const drawerWidth = 280;
const collapsedWidth = 100;

const menuItems = [
  { title: 'Dashboard', icon: <DashboardIcon />, path: '/', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
  {
    title: 'Security Analytics',
    icon: <AnalyticsIcon />,
    subItems: [
      { title: 'Forensics Analysis', icon: <ManageSearchIcon />, path: '/logs', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
      { title: 'Advanced Analytics', icon: <PsychologyIcon />, path: '/advanced-analytics', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
      
      { title: 'Session Analysis', icon: <VpnKeyIcon />, path: '/sessions', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
      { title: 'Connection Analysis', icon: <PublicIcon />, path: '/connectionspage', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
      
    ],
    roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst']
  },
  { title: 'UEBA', icon: <LaptopIcon />, path: '/endpoint-analytics', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
  { title: 'Dark-Web Monitoring', icon: <VpnKeyIcon />, path: '/tor-browser', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
  {
    title: 'Threat Intelligence',
    icon: <SecurityIcon />,
    subItems: [
      { title: 'Malware Detection', icon: <ViewInArIcon />, path: '/malware', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
      { title: 'Vulnerability Detection', icon: <BugReportIcon />, path: '/threatintelligence/vulnerability', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
      { title: 'Threat Hunting', icon: <BugReportIcon />, path: '/threatintelligence/threathunting', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] }
    ],
    roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst']
  },
  { title: 'Major Alert', icon: <WarningIcon />, path: '/majorlogs', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
  { title: 'False Positives', icon: <CoronavirusIcon />, path: '/false-positives', roles: ['administrator', 'L3-Analyst'] },
  { title: 'STIX/TAXII', icon: <PublicIcon />, path: '/stix-taxii', roles: ['administrator', 'L3-Analyst'] },
  {
    title: 'Remediation',
    icon: <HistoryEduIcon />,
    subItems: [
      { title: 'Manual Remediation', icon: <DevicesOtherIcon />, path: '/remediation', roles: ['administrator', 'L3-Analyst'] },
      { title: 'SOAR', icon: <AutoFixHighIcon />, path: '/soar', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] }
    ],
    roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst']
  },
  { title: 'Patch Management', icon: <SystemUpdateAltIcon />, path: '/patch-management', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
  { title: 'File Integrity Monitoring', icon: <InsertPageBreakIcon />, path: '/fim', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
  { title: 'CyberSentinel AI/ML', icon: <SmartToyIcon />, path: '/sentinelai', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
  { title: 'Data Loss Prevention', icon: <ShieldIcon />, path: '/dlp-monitoring', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
  { title: 'Content Filtering & WAF', icon: <SecurityIcon />, path: '/content-filtering-waf', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
  {
    title: 'Compliance Standards',
    icon: <FolderSpecialIcon />,
    subItems: [
      { title: 'Reports', icon: <DescriptionIcon />, path: '/reports', roles: ['administrator', 'L2-Analyst', 'L3-Analyst'] },
      { title: 'Executive Report', icon: <DescriptionIcon />, path: '/executive-report', roles: ['administrator', 'L2-Analyst', 'L3-Analyst'] },
      { title: 'System Configuration Assessment', icon: <ScreenSearchDesktopIcon />, path: '/sca', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] },
      { title: 'TSC', icon: <AddModeratorIcon />, path: '/compliance/tsc', roles: ['administrator', 'L2-Analyst', 'L3-Analyst'] },
      { title: 'MITRE ATT&CK', icon: <CrisisAlertIcon />, path: '/compliance/mitre', roles: ['administrator', 'L2-Analyst', 'L3-Analyst'] },
      { title: 'HIPAA', icon: <HealthAndSafetyIcon />, path: '/compliance/hipaa', roles: ['administrator', 'L2-Analyst', 'L3-Analyst'] },
      { title: 'GDPR', icon: <ShieldIcon />, path: '/compliance/gdpr', roles: ['administrator', 'L2-Analyst', 'L3-Analyst'] },
      { title: 'NIST', icon: <AssignmentTurnedInIcon />, path: '/compliance/nist', roles: ['administrator', 'L2-Analyst', 'L3-Analyst'] },
      { title: 'PCI-DSS', icon: <AssuredWorkloadIcon />, path: '/compliance/pcidss', roles: ['administrator', 'L2-Analyst', 'L3-Analyst'] }
    ],
    roles: ['administrator', 'L2-Analyst', 'L3-Analyst']
  },
  { title: 'Case Management', icon: <ConfirmationNumberIcon />, path: '/tickets', roles: ['administrator', 'L1-Analyst', 'L2-Analyst', 'L3-Analyst'] }
];

const Sidebar = ({ open, toggleDrawer }) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [subMenuOpenStates, setSubMenuOpenStates] = useState({});

  const hasAccess = roles => currentUser && Array.isArray(roles) && roles.includes(currentUser.role);

  useEffect(() => {
    const expandedMenus = {};
    menuItems.forEach(item => {
      if (item.subItems && item.subItems.some(sub => location.pathname === sub.path)) {
        expandedMenus[item.title] = true;
      }
    });
    setSubMenuOpenStates(s => ({ ...s, ...expandedMenus }));
  }, [location.pathname]);

  const toggleSubMenu = (title) => setSubMenuOpenStates(prev => ({
    ...prev,
    [title]: !prev[title],
  }));

  const getInitial = () => {
    if (!currentUser) return 'U';
    if (currentUser.fullName) return currentUser.fullName.charAt(0).toUpperCase();
    if (currentUser.username) return currentUser.username.charAt(0).toUpperCase();
    return 'U';
  };

  const renderedMenu = useMemo(
    () =>
      menuItems.map((item) => {
        if (!hasAccess(item.roles)) return null;

        if (item.subItems) {
          const isOpen = subMenuOpenStates[item.title] || false;
          const isActive = item.subItems.some(subItem => location.pathname === subItem.path);

          return (
            <React.Fragment key={item.title}>
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => toggleSubMenu(item.title)}
                  sx={{
                    minHeight: 48,
                    justifyContent: open ? 'initial' : 'center',
                    px: open ? 2.5 : 0,
                    mx: 0,
                    borderRadius: 2,
                    background: isActive
                      ? (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(33, 150, 243, 0.15)'
                          : 'rgba(33, 150, 243, 0.1)'
                      : 'transparent',
                    border: isActive
                      ? (theme) => `1px solid ${theme.palette.primary.main}`
                      : '1px solid transparent',
                    transition: 'background-color 0.3s, border-color 0.3s',
                    '&:hover': {
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.05)',
                      borderColor: (theme) => theme.palette.primary.main,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      width: open ? 36 : collapsedWidth,
                      maxWidth: collapsedWidth,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: 0,
                      color: isActive
                        ? (theme) => theme.palette.primary.main
                        : (theme) => theme.palette.text.primary,
                      transition: 'all 0.3s',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    sx={{
                      opacity: open ? 1 : 0,
                      width: open ? 'auto' : 0,
                      transition: 'opacity 0.3s, width 0.3s',
                      whiteSpace: 'normal', // allow wrapping
                      overflow: 'visible',
                      textOverflow: 'unset',
                      lineHeight: 1.3,
                      fontSize: '0.98rem',
                      pointerEvents: open ? 'auto' : 'none',
                      '& .MuiListItemText-primary': {
                        color: isActive
                          ? (theme) => theme.palette.primary.main
                          : (theme) => theme.palette.text.primary,
                        fontWeight: 600,
                      },
                    }}
                  />
                  {open && (
                    <Box
                      sx={{
                        color: isActive
                          ? (theme) => theme.palette.primary.main
                          : (theme) => theme.palette.text.secondary,
                        ml: 1,
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'transform 0.3s',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      <ExpandMore />
                    </Box>
                  )}
                </ListItemButton>
              </ListItem>
              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <List
                  component="div"
                  disablePadding
                  sx={{
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    pl: 0,
                    pr: 0,
                    ml: 0,
                    mr: 0,
                  }}
                >
                  {item.subItems.map((sub) => {
                    if (!hasAccess(sub.roles)) return null;
                    const selected = location.pathname === sub.path;
                    return (
                      <ListItem key={sub.title} disablePadding sx={{ mb: 0.5 }}>
                        <ListItemButton
                          component={NavLink}
                          to={sub.path}
                          selected={selected}
                          sx={{
                            minHeight: 40,
                            pl: open ? 6 : 2.5,
                            pr: 0,
                            ml: 0,
                            mr: 0,
                            borderRadius: 1.5,
                            justifyContent: open ? 'initial' : 'center',
                            backgroundColor: selected
                              ? (theme) =>
                                theme.palette.mode === 'dark'
                                  ? 'rgba(33, 150, 243, 0.15)'
                                  : 'rgba(33, 150, 243, 0.1)'
                              : 'transparent',
                            '&:hover': {
                              backgroundColor: (theme) =>
                                theme.palette.mode === 'dark'
                                  ? 'rgba(255,255,255,0.08)'
                                  : 'rgba(0,0,0,0.04)',
                            },
                            transition: 'background-color 0.3s',
                          }}
                        >
                          <ListItemIcon
                            sx={{
                              minWidth: 0,
                              width: open ? 36 : collapsedWidth,
                              maxWidth: collapsedWidth,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              margin: 0,
                              color: selected
                                ? (theme) => theme.palette.primary.main
                                : (theme) => theme.palette.text.secondary,
                              transition: 'all 0.3s',
                            }}
                          >
                            {sub.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={sub.title}
                            sx={{
                              opacity: open ? 1 : 0,
                              width: open ? 'auto' : 0,
                              transition: 'opacity 0.3s, width 0.3s',
                              whiteSpace: 'normal',
                              overflow: 'visible',
                              textOverflow: 'unset',
                              lineHeight: 1.2,
                              fontSize: '0.95rem',
                              pointerEvents: open ? 'auto' : 'none',
                              '& .MuiListItemText-primary': {
                                color: selected
                                  ? (theme) => theme.palette.primary.main
                                  : (theme) => theme.palette.text.secondary,
                              },
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Collapse>
            </React.Fragment>
          );
        }

        // Flat menu item
        const selected = location.pathname === item.path;
        return (
          <ListItem key={item.title} disablePadding sx={{ mb: 0.5 }}>
            <Tooltip title={open ? '' : item.title} placement="right">
              <ListItemButton
                component={NavLink}
                to={item.path}
                selected={selected}
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: open ? 2.5 : 0,
                  mx: 0,
                  borderRadius: 2,
                  backgroundColor: selected
                    ? (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(33, 150, 243, 0.15)'
                        : 'rgba(33, 150, 243, 0.1)'
                    : 'transparent',
                  border: selected
                    ? (theme) => `1.5px solid ${theme.palette.primary.main}`
                    : '1.5px solid transparent',
                  boxShadow: selected ? 3 : 'none',
                  transition: 'background-color 0.3s, border-color 0.3s, box-shadow 0.3s',
                  '&:hover': {
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.05)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    width: open ? 36 : collapsedWidth,
                    maxWidth: collapsedWidth,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: 0,
                    color: selected
                      ? (theme) => theme.palette.primary.main
                      : (theme) => theme.palette.text.primary,
                    transition: 'all 0.3s',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  sx={{
                    opacity: open ? 1 : 0,
                    width: open ? 'auto' : 0,
                    transition: 'opacity 0.3s, width 0.3s',
                    whiteSpace: 'normal',
                    overflow: 'visible',
                    textOverflow: 'unset',
                    lineHeight: 1.3,
                    fontSize: '0.98rem',
                    pointerEvents: open ? 'auto' : 'none',
                    '& .MuiListItemText-primary': {
                      color: selected
                        ? (theme) => theme.palette.primary.main
                        : (theme) => theme.palette.text.primary,
                      fontWeight: 600,
                    },
                  }}
                />
              </ListItemButton>
            </Tooltip>
          </ListItem>
        );
      }),
    [subMenuOpenStates, open, location.pathname, currentUser]
  );

  return (
    <Drawer
      variant="permanent"
      open={open}
      sx={{
        width: open ? drawerWidth : collapsedWidth,
        minWidth: open ? drawerWidth : collapsedWidth,
        maxWidth: open ? drawerWidth : collapsedWidth,
        transition: (theme) =>
          theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
        '& .MuiDrawer-paper': {
          width: open ? drawerWidth : collapsedWidth,
          minWidth: open ? drawerWidth : collapsedWidth,
          maxWidth: open ? drawerWidth : collapsedWidth,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          backdropFilter: 'blur(20px)',
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(18, 18, 18, 0.86)' : 'rgba(255,255,255,0.94)',
          borderRight: (theme) =>
            `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
            }`,
          boxShadow: (theme) =>
            theme.palette.mode === 'dark' ? '0 8px 32px rgba(0,0,0,0.31)' : '0 8px 32px rgba(0,0,0,0.12)',
          transition: (theme) =>
            theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
          transform: 'translateZ(0)',
        },
      }}
    >
      {/* Logo and Toggle Drawer */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'flex-end' : 'center',
          py: 2,
          px: open ? 1 : 0,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        {open && (
          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
              ml: 2,
              fontWeight: 700,
              letterSpacing: 1,
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)'
                  : 'linear-gradient(45deg, #1976D2 40%, #2196F3 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              userSelect: 'none',
            }}
          >
            LogManager
          </Typography>
        )}
        <IconButton
          onClick={toggleDrawer}
          sx={{
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
            '&:hover': {
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.14)',
            },
            ml: open ? 0 : 2,
            mr: open ? 0 : 1,
            transition: 'background-color 0.3s',
          }}
          aria-label="toggle sidebar"
        >
          {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      {open && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            py: 2,
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(248, 244, 244, 0.93)' : 'transparent',
            borderRadius: 1,
            mx: 1,
            mb: 2,
          }}
        >
          <Box
            component="img"
            src={cyberSentinelLogo}
            alt="Cyber Sentinel"
            sx={{
              maxWidth: '85%',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 2,
              transition: 'box-shadow 0.3s',
              // boxShadow: (theme) =>
              //   theme.palette.mode === 'dark'
              //     ? '0 4px 24px rgba(33,150,243,0.12)'
              //     : '0 1px 6px rgba(33,150,243,0.09)',
            }}
          />
        </Box>
      )}

      <List sx={{ flexGrow: 1 }}>{renderedMenu}</List>

      <Divider
        sx={{
          mt: 'auto',
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.14)',
        }}
      />

      {/* Profile section */}
      <Box sx={{ px: 1, py: 2 }}>
        <Tooltip title={open ? '' : 'Profile'} placement="right">
          <ListItemButton
            component={NavLink}
            to="/profile"
            selected={location.pathname === '/profile'}
            sx={{
              minHeight: 48,
              justifyContent: open ? 'start' : 'center',
              px: 2.5,
              mx: 0.5,
              mb: 1,
              borderRadius: 2,
              gap: 2,
              background:
                location.pathname === '/profile'
                  ? (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, rgba(33,150,243,0.18),rgba(33,203,243,0.09))'
                      : 'linear-gradient(135deg, rgba(33,150,243,0.09),rgba(33,203,243,0.03))'
                  : 'transparent',
              border:
                location.pathname === '/profile'
                  ? (theme) => `1.5px solid ${theme.palette.primary.main}`
                  : '1.5px solid transparent',
              transition: 'background 0.3s, border-color 0.3s',
              '&:hover': {
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.03)',
              },
            }}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: (theme) =>
                  location.pathname === '/profile' ? theme.palette.primary.main : theme.palette.secondary.main,
                color: (theme) =>
                  theme.palette.getContrastText(
                    location.pathname === '/profile' ? theme.palette.primary.main : theme.palette.secondary.main
                  ),
                fontWeight: 700,
                fontSize: 16,
                transition: 'background-color 0.3s, color 0.3s',
              }}
            >
              {getInitial()}
            </Avatar>
            {open && (
              <Box
                sx={{
                  flexDirection: 'column',
                  ml: 2,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                <Typography
                  variant="body1"
                  fontWeight={700}
                  sx={{ color: (theme) => theme.palette.text.primary, fontSize: 16, lineHeight: 1.1, userSelect: 'none' }}
                >
                  User Settings
                </Typography>
                {/* <Typography
                  variant="caption"
                  fontWeight={400}
                  sx={{ color: (theme) => theme.palette.text.secondary, userSelect: 'none' }}
                  noWrap
                >
                  {currentUser?.role}
                </Typography> */}

              </Box>
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
