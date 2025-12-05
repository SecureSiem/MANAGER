import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getJumpServerAssets, getJumpServerConfig } from '../../services/jumpserver';
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Chip
} from '@mui/material';
import TerminalIcon from '@mui/icons-material/Terminal';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningIcon from '@mui/icons-material/Warning';
import LaptopIcon from '@mui/icons-material/Laptop';
import StorageIcon from '@mui/icons-material/Storage';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTheme } from '@mui/material/styles';

const ManualRemediation = () => {
  // Access the setPageTitle function from outlet context
  const { setPageTitle } = useOutletContext();
  const theme = useTheme();
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetsError, setAssetsError] = useState(null);
  const [jumpServerConfig, setJumpServerConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState(null);

  // Set page title when component mounts
  useEffect(() => {
    setPageTitle('Manual Remediation');
  }, [setPageTitle]);

  const fetchJumpServerConfig = async () => {
    try {
      setLoadingConfig(true);
      setConfigError(null);
      const config = await getJumpServerConfig();
      setJumpServerConfig(config);
    } catch (error) {
      console.error('Failed to fetch JumpServer config:', error);
      setConfigError(error.message || 'Failed to fetch JumpServer configuration');
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchAssets = async () => {
    try {
      setLoadingAssets(true);
      setAssetsError(null);
      const assetsData = await getJumpServerAssets();
      setAssets(assetsData);
    } catch (error) {
      console.error('Failed to fetch assets:', error);
      setAssetsError(error.message || 'Failed to fetch assets');
    } finally {
      setLoadingAssets(false);
    }
  };

  // Load config and assets on component mount
  useEffect(() => {
    fetchJumpServerConfig();
    fetchAssets();
  }, []);

  const handleOpenConsole = () => {
    if (jumpServerConfig?.url) {
      window.open(jumpServerConfig.url, '_blank');
    } else {
      alert('JumpServer configuration not loaded');
    }
  };

  // Common remediation commands
  const remediationCommands = {
    linux: [
      {
        title: 'Isolate Compromised Host',
        command: 'iptables -I INPUT -j DROP && iptables -I OUTPUT -j DROP',
        description: 'Emergency isolation: Blocks all incoming and outgoing traffic'
      },
      {
        title: 'Identify Running Processes',
        command: 'ps -aux --forest | grep -i [suspicious process]',
        description: 'Lists all running processes in tree format to find suspicious activity'
      },
      {
        title: 'Check for Connections',
        command: 'netstat -tupan | grep ESTABLISHED',
        description: 'Shows all established network connections and the associated processes'
      },
      {
        title: 'View Recent Logins',
        command: 'last -a | head -20',
        description: 'Displays most recent login attempts including source IP addresses'
      },
      {
        title: 'Check System Logs',
        command: 'tail -f /var/log/syslog | grep -i error',
        description: 'Monitor system logs for error messages in real-time'
      },
      {
        title: 'Find Large Files',
        command: 'find / -type f -size +100M -exec ls -lh {} \\; 2>/dev/null',
        description: 'Locate files larger than 100MB that might be suspicious'
      }
    ],
    windows: [
      {
        title: 'Check for Suspicious Connections',
        command: 'netstat -nao | findstr ESTABLISHED',
        description: 'Lists all established connections with associated process IDs'
      },
      {
        title: 'Kill Suspicious Process',
        command: 'taskkill /F /PID [process-id]',
        description: 'Forcefully terminates a process by its ID'
      },
      {
        title: 'View Running Services',
        command: 'Get-Service | Where-Object {$_.Status -eq "Running"}',
        description: 'PowerShell command to list all running services'
      },
      {
        title: 'Network Isolation',
        command: 'netsh advfirewall set allprofiles firewallpolicy blockinbound,blockoutbound',
        description: 'Blocks all inbound and outbound network traffic'
      },
      {
        title: 'Check Event Logs',
        command: 'Get-EventLog -LogName Security -Newest 50 | Where-Object {$_.EntryType -eq "FailureAudit"}',
        description: 'PowerShell command to check recent security failures'
      },
      {
        title: 'List Startup Programs',
        command: 'Get-CimInstance Win32_StartupCommand | Select-Object Name, command, Location',
        description: 'List all programs that start automatically with Windows'
      }
    ]
  };

  // Best practices
  const bestPractices = [
    {
      title: 'Document Everything',
      icon: <CheckCircleOutlineIcon color="primary" />,
      description: 'Record all actions taken, findings, and changes made during remediation for later analysis and reporting.'
    },
    {
      title: 'Minimal Changes',
      icon: <WarningIcon color="warning" />,
      description: 'Make the minimum changes necessary to contain the threat while preserving evidence for forensic analysis.'
    },
    {
      title: 'Verify Isolation',
      icon: <WifiOffIcon color="error" />,
      description: 'Always confirm that compromised systems are properly isolated before beginning remediation to prevent threat spread.'
    },
    {
      title: 'Backup Before Removal',
      icon: <CloudSyncIcon color="success" />,
      description: 'Create forensic backups of malicious files or evidence before removal for later analysis.'
    }
  ];

  return (
    <Box>
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
              CyberSentinel Manual Remediation
            </Typography>
            <Typography variant="subtitle1">
              Securely access and remediate compromised endpoints with advanced privilege controls
            </Typography>
          </Grid>
          <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<TerminalIcon />}
              onClick={handleOpenConsole}
              disabled={loadingConfig || !jumpServerConfig}
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
              {loadingConfig ? 'Loading...' : 'Launch Console'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Alert severity="info" sx={{ mb: 4 }}>
        <Typography variant="body1">
          <strong>Note:</strong> Use the CyberSentinel Manual Remediation Console only for authorized remediation activities. All actions are logged and monitored.
        </Typography>
      </Alert>


      {/* Console Access Info */}
      {jumpServerConfig && (
        <Paper
          sx={{
            p: 2,
            mb: 4,
            background: 'linear-gradient(135deg, #5cf6da60, #63d7f1c2)', // violet to indigo
            color: '#ffffff',
            borderRadius: 2,
          }}
        // change by raman
        >
          <Typography variant="h6" gutterBottom>
            Console Access Information
          </Typography>
          <Typography variant="body2">
            <strong>URL:</strong> {jumpServerConfig.url}
          </Typography>
          <Typography variant="body2">
            <strong>Username:</strong> {jumpServerConfig.username}
          </Typography>
          <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
            Password is managed securely on the server side.
          </Typography>
        </Paper>
      )}

      {configError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load JumpServer configuration: {configError}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <StorageIcon sx={{ mr: 1 }} color="primary" />
            Available Assets
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={fetchAssets}
            disabled={loadingAssets}
            startIcon={loadingAssets ? <CircularProgress size={16} /> : <CloudSyncIcon />}
          >
            Refresh
          </Button>
        </Box>

        {assetsError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {assetsError}
          </Alert>
        )}

        {loadingAssets ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : assets.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Hostname</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Platform</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assets.map((asset, index) => (
                  <TableRow key={asset.id || index}>
                    <TableCell>{String(asset.hostname || asset.name || 'N/A')}</TableCell>
                    <TableCell>{String(asset.ip || 'N/A')}</TableCell>
                    <TableCell>
                      <Chip
                        label={String(asset.platform || 'Unknown')}
                        size="small"
                        color={asset.platform === 'Linux' ? 'success' : 'primary'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={asset.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        color={asset.is_active ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<TerminalIcon />}
                        onClick={() =>
                          jumpServerConfig?.url &&
                          window.open(`${jumpServerConfig.url}/luna/?login_to=${asset.id}`, '_blank')
                        }
                        disabled={!asset.is_active || !jumpServerConfig}
                      >
                        Connect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No assets available
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Best Practices Section */}
      <Typography variant="h5" gutterBottom sx={{ mt: 2, mb: 3, fontWeight: 500 }}>
        Best Practices for Effective Remediation
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {bestPractices.map((practice, index) => (
          <Grid item xs={12} sm={6} key={index}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {practice.icon}
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    {practice.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {practice.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Common Commands Section */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 3, fontWeight: 500 }}>
        Common Remediation Commands
      </Typography>

      <Grid container spacing={3}>
        {/* Linux Commands */}
        <Grid item xs={12} md={6}>
          <Accordion defaultExpanded>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="linux-commands-content"
              id="linux-commands-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <StorageIcon sx={{ mr: 1 }} color="primary" />
                <Typography variant="h6">Linux Systems</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List disablePadding>
                {remediationCommands.linux.map((cmd, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <Divider variant="middle" component="li" />}
                    <ListItem alignItems="flex-start">
                      <ListItemIcon>
                        <TerminalIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={cmd.title}
                        secondary={
                          <>
                            <Typography
                              component="span"
                              variant="body2"
                              sx={{
                                display: 'inline',
                                fontFamily: 'monospace',
                                bgcolor: 'grey.100',
                                color: '#111', // Ensures high contrast
                                p: 0.5,
                                borderRadius: 1,
                              }}
                            // change by raman

                            >
                              {cmd.command}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {cmd.description}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Windows Commands */}
        <Grid item xs={12} md={6}>
          <Accordion defaultExpanded>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="windows-commands-content"
              id="windows-commands-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LaptopIcon sx={{ mr: 1 }} color="primary" />
                <Typography variant="h6">Windows Systems</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List disablePadding>
                {remediationCommands.windows.map((cmd, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <Divider variant="middle" component="li" />}
                    <ListItem alignItems="flex-start">
                      <ListItemIcon>
                        <TerminalIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={cmd.title}
                        secondary={
                          <>
                            <Typography
                              component="span"
                              variant="body2"
                              sx={{
                                display: 'inline',
                                fontFamily: 'monospace',
                                bgcolor: 'grey.100',
                                color: '#111', // Ensures high contrast
                                p: 0.5,
                                borderRadius: 1,
                              }}
                            // change by raman
                            >
                              {cmd.command}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {cmd.description}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>

      {/* Advanced Remediation Section */}
      <Paper sx={{ p: 3, mt: 4, bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SecurityIcon sx={{ mr: 1 }} color="secondary" />
          <Typography variant="h6">Advanced Remediation</Typography>
        </Box>

        <Typography paragraph>
          For complex security incidents, use the CyberSentinel Manual Remediation Console to:
        </Typography>

        <List>
          <ListItem>
            <ListItemIcon>
              <CheckCircleOutlineIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Isolate compromised systems from the network while maintaining administrative access"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleOutlineIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Extract forensic evidence for further analysis"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleOutlineIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Deploy remediation scripts with elevated privileges"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleOutlineIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Perform memory analysis to identify persistent threats"
            />
          </ListItem>
        </List>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button
            variant="contained"
            color="secondary"
            size="large"
            startIcon={<TerminalIcon />}
            onClick={handleOpenConsole}
            disabled={loadingConfig || !jumpServerConfig}
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
          // change by raman
          >
            Launch Manual Remediation Console
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ManualRemediation;