import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getShuffleConfig } from '../../services/shuffle';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
  Alert,
  Button,
  CircularProgress
} from '@mui/material';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import LaunchIcon from '@mui/icons-material/Launch';
import {
  AutoFixHigh,
  Speed,
  PlayArrow,
  CheckCircle,
  Timeline,
  Security,
  Build,
  Notifications,
  TrendingUp
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const SOAR = () => {
  // Access the setPageTitle function from outlet context
  const { setPageTitle } = useOutletContext();
  const theme = useTheme();
  const [shuffleConfig, setShuffleConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState(null);

  // Set page title when component mounts
  useEffect(() => {
    setPageTitle('SOAR Platform');
  }, [setPageTitle]);

  const fetchShuffleConfig = async () => {
    try {
      setLoadingConfig(true);
      setConfigError(null);
      const config = await getShuffleConfig();
      setShuffleConfig(config);
    } catch (error) {
      console.error('Failed to fetch SHUFFLE config:', error);
      setConfigError(error.message || 'Failed to fetch SHUFFLE configuration');
    } finally {
      setLoadingConfig(false);
    }
  };

  // Load config on component mount
  useEffect(() => {
    fetchShuffleConfig();
  }, []);

  const handleOpenShuffle = () => {
    if (shuffleConfig?.url) {
      window.open(shuffleConfig.url, '_blank');
    } else {
      alert('SHUFFLE configuration not loaded');
    }
  };

  const capabilities = [
    {
      title: 'Security Orchestration',
      description: 'Integrate and coordinate security tools and processes across the organization',
      icon: <IntegrationInstructionsIcon color="primary" />
    },
    {
      title: 'Automation',
      description: 'Automate repetitive security tasks and response procedures',
      icon: <AutoFixHigh color="primary" />
    },
    {
      title: 'Incident Response',
      description: 'Streamline and accelerate incident response workflows',
      icon: <Speed color="primary" />
    },
    {
      title: 'Threat Intelligence',
      description: 'Aggregate and analyze threat data from multiple sources',
      icon: <Security color="primary" />
    }
  ];

  const useCases = [
    'Automated Threat Detection & Response',
    'Incident Investigation & Forensics',
    'Vulnerability Management',
    'Compliance Reporting',
    'Threat Hunting Operations',
    'Security Alert Triage'
  ];

  const benefits = [
    { metric: 'Response Time', improvement: '85% Faster', icon: <Speed /> },
    { metric: 'Accuracy', improvement: '95% Precision', icon: <CheckCircle /> },
    { metric: 'Efficiency', improvement: '70% Less Manual Work', icon: <TrendingUp /> },
    { metric: 'Coverage', improvement: '24/7 Monitoring', icon: <Notifications /> }
  ];

  return (
    <Box>
      {/* Header Section with Launch Button */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          background: 'linear-gradient(135deg, #8a5cf6d8, #6365f192)', // violet to indigo
          color: 'white',
          borderRadius: 2,
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography variant="h4" gutterBottom fontWeight="500">
              SOAR Platform
            </Typography>
            <Typography variant="subtitle1">
              Security Orchestration, Automation, and Response - Enhancing cybersecurity operations through intelligent automation
            </Typography>
          </Grid>
          <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<LaunchIcon />}
              onClick={handleOpenShuffle}
              disabled={loadingConfig || !shuffleConfig}
              sx={{
                bgcolor: 'white',
                color: theme.palette.primary.main,
                '&:hover': {
                  bgcolor: theme.palette.grey[100]
                },
                py: 1.5,
                px: 3
              }}
            >
              {loadingConfig ? 'Loading...' : 'Launch SHUFFLE'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* SHUFFLE Access Info */}
      {shuffleConfig && (
        <Paper
          sx={{
            p: 2,
            mb: 4,
            background: 'linear-gradient(135deg, #5cf6da60, #63d7f1c2)',
            color: '#ffffff',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            SHUFFLE Access Information
          </Typography>
          <Typography variant="body2">
            <strong>URL:</strong> {shuffleConfig.url}
          </Typography>
          <Typography variant="body2">
            <strong>Username:</strong> {shuffleConfig.username}
          </Typography>
          <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
            Password is managed securely on the server side.
          </Typography>
        </Paper>
      )}

      {configError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load SHUFFLE configuration: {configError}
        </Alert>
      )}
      
      <Alert severity="info" sx={{ mb: 3 }}>
        Security Orchestration, Automation, and Response (SOAR) - Enhancing cybersecurity operations through intelligent automation
      </Alert>

      <Grid container spacing={3}>
        {/* Overview Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Build color="primary" />
              What is SOAR?
            </Typography>
            <Typography variant="body1" paragraph>
              SOAR (Security Orchestration, Automation, and Response) is a comprehensive cybersecurity 
              approach that combines three key capabilities: orchestrating security tools, automating 
              repetitive tasks, and responding to security incidents. This integrated platform enables 
              organizations to improve their security posture while reducing response times and operational overhead.
            </Typography>
          </Paper>
        </Grid>

        {/* Core Capabilities */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoFixHigh color="primary" />
              Core Capabilities
            </Typography>
            <Grid container spacing={2}>
              {capabilities.map((capability, index) => (
                <Grid item xs={12} sm={6} key={index}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        {capability.icon}
                        <Typography variant="h6">{capability.title}</Typography>
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        {capability.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Key Metrics */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timeline color="primary" />
              Key Benefits
            </Typography>
            {benefits.map((benefit, index) => (
              <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {benefit.icon}
                  <Typography variant="subtitle2">{benefit.metric}</Typography>
                </Box>
                <Typography variant="h6" color="primary.main">
                  {benefit.improvement}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Grid>

        {/* Use Cases Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlayArrow color="primary" />
              Common Use Cases
            </Typography>
            <List>
              {useCases.map((useCase, index) => (
                <React.Fragment key={index}>
                  <ListItem>
                    <ListItemIcon>
                      <Chip 
                        label={index + 1} 
                        color="primary" 
                        size="small" 
                        sx={{ minWidth: 32, height: 24 }}
                      />
                    </ListItemIcon>
                    <ListItemText primary={useCase} />
                  </ListItem>
                  {index < useCases.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Implementation Strategy */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Security color="primary" />
              Implementation Strategy
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Assessment & Planning" 
                  secondary="Evaluate current security tools and processes"
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Tool Integration" 
                  secondary="Connect existing security tools and data sources"
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Playbook Development" 
                  secondary="Create automated response workflows"
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                <ListItemText 
                  primary="Testing & Optimization" 
                  secondary="Validate automation and refine processes"
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* Advanced SOAR Features */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mt: 2, bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <IntegrationInstructionsIcon sx={{ mr: 1 }} color="secondary" />
              <Typography variant="h6">Advanced SOAR Operations</Typography>
            </Box>

            <Typography paragraph>
              Launch the SHUFFLE platform to access advanced SOAR capabilities:
            </Typography>

            <List>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Create and manage automated security playbooks"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Integrate multiple security tools and platforms"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Monitor and orchestrate incident response workflows"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Analyze security metrics and performance"
                />
              </ListItem>
            </List>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Button
                variant="contained"
                color="secondary"
                size="large"
                startIcon={<LaunchIcon />}
                onClick={handleOpenShuffle}
                disabled={loadingConfig || !shuffleConfig}
                sx={{
                  py: 1.5,
                  px: 3,
                  borderRadius: '8px',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  fontSize: '1rem',
                  textTransform: 'none',
                  background: (theme) => `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.light})`,
                  color: (theme) => theme.palette.secondary.contrastText,
                  boxShadow: (theme) => `0 4px 20px ${theme.palette.secondary.main}40`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: (theme) => `linear-gradient(135deg, ${theme.palette.secondary.dark}, ${theme.palette.secondary.main})`,
                    transform: 'scale(1.02)',
                    boxShadow: (theme) => `0 6px 30px ${theme.palette.secondary.main}66`
                  },
                  '&:disabled': {
                    opacity: 0.6,
                    cursor: 'not-allowed',
                    boxShadow: 'none',
                    transform: 'none',
                  },
                }}
              >
                Launch SHUFFLE Platform
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SOAR;
