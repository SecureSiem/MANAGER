import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Divider,
  TextField,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import BugReportIcon from '@mui/icons-material/BugReport';
import FilterListIcon from '@mui/icons-material/FilterList';
import LanguageIcon from '@mui/icons-material/Language';
import ShieldIcon from '@mui/icons-material/Shield';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CodeIcon from '@mui/icons-material/Code';
import HttpIcon from '@mui/icons-material/Http';
import LockIcon from '@mui/icons-material/Lock';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useTheme } from '@mui/material/styles';

const ContentFilteringWaf = () => {
  const { setPageTitle } = useOutletContext();
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(0);
  
  // Content Filtering States
  const [openBlockDialog, setOpenBlockDialog] = useState(false);
  const [newBlockUrl, setNewBlockUrl] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockCategory, setBlockCategory] = useState('malicious');
  const [blockedUrls, setBlockedUrls] = useState([
    { id: 1, url: 'malicious-site.com', reason: 'Known malware distribution', category: 'malicious', blockedAt: '2025-10-28 10:30', blockedBy: 'admin' },
    { id: 2, url: 'phishing-example.net', reason: 'Phishing attempt detected', category: 'phishing', blockedAt: '2025-10-28 09:15', blockedBy: 'security_team' },
    { id: 3, url: 'gambling-site.bet', reason: 'Company policy violation', category: 'restricted', blockedAt: '2025-10-27 16:45', blockedBy: 'admin' },
    { id: 4, url: 'torrent-tracker.org', reason: 'Copyright infringement risk', category: 'restricted', blockedAt: '2025-10-27 14:20', blockedBy: 'admin' }
  ]);

  // WAF States
  const [wafEnabled, setWafEnabled] = useState(true);
  const [sqlInjectionDetections, setSqlInjectionDetections] = useState([
    { id: 1, timestamp: '2 min ago', sourceIp: '192.168.1.105', query: "' OR '1'='1", endpoint: '/api/login', action: 'Blocked', severity: 'critical' },
    { id: 2, timestamp: '15 min ago', sourceIp: '10.0.2.45', query: 'UNION SELECT * FROM users', endpoint: '/api/search', action: 'Blocked', severity: 'high' },
    { id: 3, timestamp: '32 min ago', sourceIp: '172.16.0.88', query: 'DROP TABLE products--', endpoint: '/admin/products', action: 'Blocked', severity: 'critical' },
    { id: 4, timestamp: '1 hour ago', sourceIp: '192.168.1.200', query: 'SELECT password FROM users WHERE id=1', endpoint: '/api/profile', action: 'Logged', severity: 'medium' }
  ]);

  // Real-time statistics
  const [stats, setStats] = useState({
    urlsBlocked: 1547,
    sqlInjectionsBlocked: 89,
    requestsInspected: 245678,
    threatsDetected: 342
  });

  // Content Filtering Console URL
  const CONTENT_FILTER_CONSOLE = '192.168.1.189:5173'; // Replace XXX with actual values

  useEffect(() => {
    setPageTitle('Content Filtering & WAF');
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      setStats(prev => ({
        urlsBlocked: prev.urlsBlocked + (Math.random() > 0.9 ? 1 : 0),
        sqlInjectionsBlocked: prev.sqlInjectionsBlocked + (Math.random() > 0.95 ? 1 : 0),
        requestsInspected: prev.requestsInspected + Math.floor(Math.random() * 50),
        threatsDetected: prev.threatsDetected + (Math.random() > 0.92 ? 1 : 0)
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [setPageTitle]);

  const handleOpenBlockDialog = () => {
    setOpenBlockDialog(true);
  };

  const handleCloseBlockDialog = () => {
    setOpenBlockDialog(false);
    setNewBlockUrl('');
    setBlockReason('');
    setBlockCategory('malicious');
  };

  const handleAddBlockedUrl = () => {
    if (newBlockUrl.trim()) {
      const newBlock = {
        id: blockedUrls.length + 1,
        url: newBlockUrl.trim(),
        reason: blockReason.trim() || 'No reason provided',
        category: blockCategory,
        blockedAt: new Date().toLocaleString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        blockedBy: 'current_user'
      };
      setBlockedUrls([newBlock, ...blockedUrls]);
      handleCloseBlockDialog();
    }
  };

  const handleRemoveBlockedUrl = (id) => {
    setBlockedUrls(blockedUrls.filter(url => url.id !== id));
  };

  const handleOpenContentFilterConsole = () => {
    window.open(`http://${CONTENT_FILTER_CONSOLE}`, '_blank');
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'malicious': return 'error';
      case 'phishing': return 'warning';
      case 'restricted': return 'info';
      default: return 'default';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'default';
    }
  };

  const wafFeatures = [
    {
      icon: <BugReportIcon color="error" />,
      title: 'SQL Injection Protection',
      description: 'Detects and blocks SQL injection attempts in real-time across all endpoints'
    },
    {
      icon: <CodeIcon color="warning" />,
      title: 'XSS Prevention',
      description: 'Prevents cross-site scripting attacks by sanitizing user input and output'
    },
    {
      icon: <HttpIcon color="primary" />,
      title: 'HTTP Protocol Validation',
      description: 'Validates HTTP requests against RFC standards and blocks malformed requests'
    },
    {
      icon: <LockIcon color="success" />,
      title: 'Rate Limiting',
      description: 'Protects against DDoS and brute force attacks with intelligent rate limiting'
    }
  ];

  const wafRules = [
    { id: 1, name: 'SQL Injection Detection', enabled: true, threats: 89 },
    { id: 2, name: 'Cross-Site Scripting (XSS)', enabled: true, threats: 145 },
    { id: 3, name: 'Remote Code Execution', enabled: true, threats: 12 },
    { id: 4, name: 'Path Traversal', enabled: true, threats: 34 },
    { id: 5, name: 'Command Injection', enabled: true, threats: 8 },
    { id: 6, name: 'LDAP Injection', enabled: false, threats: 0 }
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
          borderRadius: 2,
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SecurityIcon sx={{ fontSize: 40, mr: 2 }} />
                <Typography variant="h4" fontWeight="500">
                  Content Filtering & Web Application Firewall
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{ ml: 7, maxWidth: '600px', opacity: 0.95 }}
              >
                Monitor web application firewall events and content filtering activities to protect against web-based attacks.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<OpenInNewIcon />}
              onClick={handleOpenContentFilterConsole}
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
              Open Filter Console
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Statistics Dashboard */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'error.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                    URLs Blocked
                  </Typography>
                  <Typography variant="h4" fontWeight="600" sx={{ mt: 1 }}>
                    {stats.urlsBlocked.toLocaleString()}
                  </Typography>
                </Box>
                <BlockIcon sx={{ fontSize: 40, opacity: 0.7 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <Typography variant="caption">Lifetime blocks</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'warning.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                    SQL Injections Blocked
                  </Typography>
                  <Typography variant="h4" fontWeight="600" sx={{ mt: 1 }}>
                    {stats.sqlInjectionsBlocked}
                  </Typography>
                </Box>
                <BugReportIcon sx={{ fontSize: 40, opacity: 0.7 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />
                <Typography variant="caption">Today</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                    Requests Inspected
                  </Typography>
                  <Typography variant="h4" fontWeight="600" sx={{ mt: 1 }}>
                    {stats.requestsInspected.toLocaleString()}
                  </Typography>
                </Box>
                <VisibilityIcon sx={{ fontSize: 40, opacity: 0.7 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <Typography variant="caption">Today</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'success.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                    Threats Detected
                  </Typography>
                  <Typography variant="h4" fontWeight="600" sx={{ mt: 1 }}>
                    {stats.threatsDetected}
                  </Typography>
                </Box>
                <ShieldIcon sx={{ fontSize: 40, opacity: 0.7 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <Typography variant="caption">All threats mitigated</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Content Filter Console Access */}
      <Alert 
        severity="info" 
        sx={{ mb: 4 }}
        action={
          <Button 
            color="inherit" 
            size="small" 
            onClick={handleOpenContentFilterConsole}
            startIcon={<OpenInNewIcon />}
          >
            OPEN
          </Button>
        }
      >
        <Typography variant="body2">
          <strong>Content Filter Console:</strong> Access the full content filtering management console at {CONTENT_FILTER_CONSOLE}
        </Typography>
      </Alert>

      {/* Tabs for Content Filtering and WAF */}
      <Paper sx={{ mb: 4 }}>
        <Tabs 
          value={currentTab} 
          onChange={(e, newValue) => setCurrentTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            label="Content Filtering" 
            icon={<FilterListIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="Web Application Firewall" 
            icon={<ShieldIcon />} 
            iconPosition="start"
          />
        </Tabs>

        {/* Tab 1: Content Filtering */}
        {currentTab === 0 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <BlockIcon sx={{ mr: 1 }} color="error" />
                Blocked URLs & Endpoints
              </Typography>
              <Button
                variant="contained"
                color="error"
                startIcon={<AddCircleIcon />}
                onClick={handleOpenBlockDialog}
              >
                Block New URL
              </Button>
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>URL/Endpoint</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Blocked At</TableCell>
                    <TableCell>Blocked By</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {blockedUrls.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {item.url}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.category.toUpperCase()}
                          size="small"
                          color={getCategoryColor(item.category)}
                        />
                      </TableCell>
                      <TableCell>{item.reason}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {item.blockedAt}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={item.blockedBy} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Remove Block">
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={() => handleRemoveBlockedUrl(item.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {blockedUrls.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <BlockIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                <Typography color="text.secondary">
                  No URLs are currently blocked
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Tab 2: WAF */}
        {currentTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <BugReportIcon sx={{ mr: 1 }} color="warning" />
                SQL Injection Detection Log
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={wafEnabled}
                    onChange={(e) => setWafEnabled(e.target.checked)}
                    color="success"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>
                      WAF Status:
                    </Typography>
                    <Chip
                      label={wafEnabled ? 'ENABLED' : 'DISABLED'}
                      size="small"
                      color={wafEnabled ? 'success' : 'error'}
                    />
                  </Box>
                }
              />
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Source IP</TableCell>
                    <TableCell>Malicious Query</TableCell>
                    <TableCell>Endpoint</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sqlInjectionDetections.map((detection) => (
                    <TableRow key={detection.id} hover>
                      <TableCell>{detection.timestamp}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {detection.sourceIp}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontFamily: 'monospace',
                            bgcolor: 'error.light',
                            color: 'error.contrastText',
                            p: 0.5,
                            borderRadius: 1,
                            display: 'inline-block'
                          }}
                        >
                          {detection.query}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {detection.endpoint}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={detection.severity.toUpperCase()}
                          size="small"
                          color={getSeverityColor(detection.severity)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={detection.action}
                          size="small"
                          color={detection.action === 'Blocked' ? 'error' : 'info'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      {/* WAF Features */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 3, fontWeight: 500 }}>
        WAF Protection Capabilities
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {wafFeatures.map((feature, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card variant="outlined" sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  {React.cloneElement(feature.icon, { sx: { fontSize: 48 } })}
                </Box>
                <Typography variant="h6" align="center" gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  {feature.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* WAF Rules Status */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <ShieldIcon sx={{ mr: 1 }} color="primary" />
          Active WAF Rules
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <List>
          {wafRules.map((rule) => (
            <ListItem
              key={rule.id}
              secondaryAction={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip
                    label={`${rule.threats} threats blocked`}
                    size="small"
                    color={rule.threats > 0 ? 'error' : 'default'}
                  />
                  <Switch
                    edge="end"
                    checked={rule.enabled}
                    color="success"
                  />
                </Box>
              }
            >
              <ListItemIcon>
                {rule.enabled ? (
                  <CheckCircleIcon color="success" />
                ) : (
                  <WarningAmberIcon color="disabled" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={rule.name}
                secondary={rule.enabled ? 'Active and monitoring' : 'Disabled'}
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Block URL Dialog */}
      <Dialog open={openBlockDialog} onClose={handleCloseBlockDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <BlockIcon sx={{ mr: 1 }} color="error" />
            Block New URL or Endpoint
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="URL or Endpoint"
              placeholder="example.com or /api/endpoint"
              value={newBlockUrl}
              onChange={(e) => setNewBlockUrl(e.target.value)}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={blockCategory}
                label="Category"
                onChange={(e) => setBlockCategory(e.target.value)}
              >
                <MenuItem value="malicious">Malicious</MenuItem>
                <MenuItem value="phishing">Phishing</MenuItem>
                <MenuItem value="restricted">Restricted</MenuItem>
                <MenuItem value="spam">Spam</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Reason for Blocking"
              placeholder="Describe why this URL should be blocked"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBlockDialog}>Cancel</Button>
          <Button 
            onClick={handleAddBlockedUrl} 
            variant="contained" 
            color="error"
            disabled={!newBlockUrl.trim()}
          >
            Block URL
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContentFilteringWaf;
