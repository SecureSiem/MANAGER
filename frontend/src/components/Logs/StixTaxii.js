import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, Grid, Card, CardContent, Divider,
  TextField, Alert, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  Tab, Tabs, Badge, LinearProgress, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import SecurityIcon from '@mui/icons-material/Security';
import PublicIcon from '@mui/icons-material/Public';
import StorageIcon from '@mui/icons-material/Storage';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import CodeIcon from '@mui/icons-material/Code';
import TableChartIcon from '@mui/icons-material/TableChart';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTheme } from '@mui/material/styles';
import taxiiService from '../../services/taxii';

const StixTaxii = () => {
  const { setPageTitle } = useOutletContext();
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(0);
  const logsEndRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // WebSocket State
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState(null);

  // Live Logs State
  const [liveLogs, setLiveLogs] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [logStats, setLogStats] = useState({
    total: 0,
    lastReceived: null,
    rate: 0
  });

  // NEW: View mode state (table or raw)
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'raw'
  
  // NEW: Expanded log state for raw view
  const [expandedLogs, setExpandedLogs] = useState(new Set());

  // NEW: Selected log for detail view
  const [selectedLog, setSelectedLog] = useState(null);
  const [logDetailOpen, setLogDetailOpen] = useState(false);

  // Outbound Endpoints State
  const [openOutboundDialog, setOpenOutboundDialog] = useState(false);
  const [outboundEndpoints, setOutboundEndpoints] = useState([
    {
      id: 1,
      name: 'Primary Threat Intel Server',
      url: 'https://taxii.cybersentinel.com/api/v2/',
      apiRoot: 'threat-intelligence',
      collection: 'indicators',
      status: 'active',
      lastSync: '2 min ago',
      recordsSent: 1547
    }
  ]);

  // Inbound Endpoints State
  const [openInboundDialog, setOpenInboundDialog] = useState(false);
  const [inboundEndpoints, setInboundEndpoints] = useState([]);
  const [loadingEndpoints, setLoadingEndpoints] = useState(false);

  // Form States
  const [endpointForm, setEndpointForm] = useState({
    name: '',
    url: '',
    apiRoot: '',
    collection: '',
    username: '',
    password: '',
    trustLevel: 'medium'
  });

  // Test connection state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState(null);

  // Statistics
  const [stats, setStats] = useState({
    totalInbound: 0,
    totalOutbound: 2439,
    activeFeeds: 0,
    lastUpdate: 'Just now'
  });

  useEffect(() => {
    setPageTitle('STIX/TAXII Integration');
    loadEndpoints();

    return () => {
      if (wsConnected) {
        taxiiService.disconnect();
      }
    };
  }, [setPageTitle]);

  const loadEndpoints = async () => {
    setLoadingEndpoints(true);
    try {
      const response = await taxiiService.getEndpoints();
      if (response.success) {
        setInboundEndpoints(response.endpoints);
        setStats(prev => ({
          ...prev,
          activeFeeds: response.endpoints.length,
          totalInbound: liveLogs.length
        }));
      }
    } catch (error) {
      console.error('Failed to load endpoints:', error);
    } finally {
      setLoadingEndpoints(false);
    }
  };

  const initializeWebSocket = () => {
    taxiiService.connect(
      (data) => {
        handleWebSocketMessage(data);
      },
      (error) => {
        setWsError('WebSocket connection error');
        setWsConnected(false);
      },
      () => {
        setWsConnected(true);
        setWsError(null);
      }
    );
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'connected':
        console.log('WebSocket connected:', data.clientId);
        break;

      case 'logs':
        handleIncomingLogs(data);
        break;

      case 'subscribed':
        console.log('Subscribed to:', data.endpointId);
        break;

      case 'unsubscribed':
        console.log('Unsubscribed from:', data.endpointId);
        break;

      case 'error':
        console.error('WebSocket error:', data.error);
        setWsError(data.error);
        break;

      case 'endpoint_added':
        loadEndpoints();
        break;

      case 'endpoint_removed':
        loadEndpoints();
        break;

      default:
        break;
    }
  };

  const handleIncomingLogs = (data) => {
    const newLogs = data.logs.map(log => ({
      ...log,
      _id: `${log._received_at}_${Math.random()}`,
      _endpointId: data.endpointId
    }));

    setLiveLogs(prev => {
      const updated = [...prev, ...newLogs];
      return updated.slice(-1000);
    });

    setLogStats(prev => ({
      total: prev.total + newLogs.length,
      lastReceived: new Date().toISOString(),
      rate: newLogs.length
    }));

    setStats(prev => ({
      ...prev,
      totalInbound: prev.totalInbound + newLogs.length,
      lastUpdate: 'Just now'
    }));

    if (autoScroll && logsEndRef.current) {
      setTimeout(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const startStreaming = (endpoint) => {
    if (!wsConnected) {
      initializeWebSocket();
      setTimeout(() => {
        taxiiService.subscribe(endpoint.id);
        setSelectedEndpoint(endpoint);
        setIsStreaming(true);
      }, 1000);
    } else {
      taxiiService.subscribe(endpoint.id);
      setSelectedEndpoint(endpoint);
      setIsStreaming(true);
    }
  };

  const stopStreaming = () => {
    if (selectedEndpoint && wsConnected) {
      taxiiService.unsubscribe(selectedEndpoint.id);
    }
    setIsStreaming(false);
    setSelectedEndpoint(null);
  };

  const clearLogs = () => {
    setLiveLogs([]);
    setExpandedLogs(new Set());
    setLogStats({
      total: 0,
      lastReceived: null,
      rate: 0
    });
  };

  const handleAddInboundEndpoint = async () => {
    if (endpointForm.name && endpointForm.url) {
      try {
        const response = await taxiiService.addEndpoint({
          name: endpointForm.name,
          url: endpointForm.url,
          apiRoot: endpointForm.apiRoot || 'default',
          collection: endpointForm.collection || 'default'
        });

        if (response.success) {
          await loadEndpoints();
          handleCloseInboundDialog();
          setConnectionTestResult(null);
        }
      } catch (error) {
        console.error('Failed to add endpoint:', error);
      }
    }
  };

  const handleDeleteInbound = async (id) => {
    try {
      await taxiiService.removeEndpoint(id);
      await loadEndpoints();
    } catch (error) {
      console.error('Failed to delete endpoint:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!endpointForm.url) return;

    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const result = await taxiiService.testConnection(endpointForm.url);
      setConnectionTestResult({
        success: result.success,
        message: result.message,
        bufferSize: result.bufferSize
      });
    } catch (error) {
      setConnectionTestResult({
        success: false,
        message: error.response?.data?.message || 'Connection failed'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const formatLogPreview = (log) => {
    if (log.rule?.description) {
      return log.rule.description;
    }
    if (log.data) {
      return JSON.stringify(log.data).substring(0, 100) + '...';
    }
    return 'No description available';
  };

  const getSeverityColor = (log) => {
    const level = log.rule?.level || 0;
    if (level >= 12) return 'error';
    if (level >= 7) return 'warning';
    if (level >= 3) return 'info';
    return 'default';
  };

  // NEW: Toggle log expansion
  const toggleLogExpansion = (logId) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // NEW: Copy log to clipboard
  const copyLogToClipboard = (log) => {
    const logJson = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(logJson).then(() => {
      alert('Log copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  // NEW: Open log detail dialog
  const openLogDetail = (log) => {
    setSelectedLog(log);
    setLogDetailOpen(true);
  };

  const handleCloseInboundDialog = () => {
    setOpenInboundDialog(false);
    setEndpointForm({
      name: '',
      url: '',
      apiRoot: '',
      collection: '',
      username: '',
      password: '',
      trustLevel: 'medium'
    });
    setConnectionTestResult(null);
  };

  const handleOpenInboundDialog = () => {
    setOpenInboundDialog(true);
  };

  const handleFormChange = (field, value) => {
    setEndpointForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getTrustLevelColor = (level) => {
    switch (level) {
      case 'high': return 'success';
      case 'medium': return 'warning';
      case 'low': return 'error';
      default: return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Box>
      {/* Hero Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          color: 'white',
          borderRadius: 2,
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PublicIcon sx={{ fontSize: 40, mr: 2 }} />
                <Typography variant="h4" fontWeight="500">
                  STIX/TAXII Threat Intelligence Platform
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{ ml: 7, maxWidth: '600px', opacity: 0.95 }}
              >
                Integrate and analyze structured threat intelligence feeds using STIX/TAXII standards for enhanced threat detection.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
              <Chip
                icon={<FiberManualRecordIcon />}
                label={wsConnected ? "WebSocket Connected" : "WebSocket Disconnected"}
                sx={{
                  bgcolor: wsConnected ? 'success.main' : 'grey.500',
                  color: 'white',
                  fontWeight: 600
                }}
              />
              <Chip
                icon={<CheckCircleIcon />}
                label="STIX 2.1 | TAXII 2.1"
                sx={{
                  bgcolor: 'white',
                  color: theme.palette.primary.main,
                  fontWeight: 600
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Statistics Dashboard */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                    Inbound Records
                  </Typography>
                  <Typography variant="h4" fontWeight="600" sx={{ mt: 1 }}>
                    {stats.totalInbound.toLocaleString()}
                  </Typography>
                </Box>
                <CloudDownloadIcon sx={{ fontSize: 40, opacity: 0.7 }} />
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
                    Live Logs
                  </Typography>
                  <Typography variant="h4" fontWeight="600" sx={{ mt: 1 }}>
                    {liveLogs.length.toLocaleString()}
                  </Typography>
                </Box>
                <VisibilityIcon sx={{ fontSize: 40, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'info.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                    Active Feeds
                  </Typography>
                  <Typography variant="h4" fontWeight="600" sx={{ mt: 1 }}>
                    {stats.activeFeeds}
                  </Typography>
                </Box>
                <StorageIcon sx={{ fontSize: 40, opacity: 0.7 }} />
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
                    Streaming
                  </Typography>
                  <Typography variant="h4" fontWeight="600" sx={{ mt: 1 }}>
                    {isStreaming ? 'Active' : 'Inactive'}
                  </Typography>
                </Box>
                <SyncIcon sx={{ fontSize: 40, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* WebSocket Error Alert */}
      {wsError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setWsError(null)}>
          {wsError}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 4 }}>
        <Tabs 
          value={currentTab} 
          onChange={(e, newValue) => setCurrentTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            label={
              <Badge badgeContent={liveLogs.length} color="primary" max={999}>
                Live Logs
              </Badge>
            }
            icon={<VisibilityIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="Inbound Feeds" 
            icon={<CloudDownloadIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="Outbound Servers" 
            icon={<CloudUploadIcon />} 
            iconPosition="start"
          />
        </Tabs>

        {/* Tab 0: Live Logs */}
        {currentTab === 0 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <VisibilityIcon sx={{ mr: 1 }} color="primary" />
                Live Log Stream {isStreaming && `from ${selectedEndpoint?.name}`}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {/* NEW: View Mode Toggle */}
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(e, newMode) => newMode && setViewMode(newMode)}
                  size="small"
                >
                  <ToggleButton value="table">
                    <TableChartIcon sx={{ mr: 0.5 }} />
                    Table
                  </ToggleButton>
                  <ToggleButton value="raw">
                    <CodeIcon sx={{ mr: 0.5 }} />
                    Raw JSON
                  </ToggleButton>
                </ToggleButtonGroup>

                <Button
                  variant={autoScroll ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setAutoScroll(!autoScroll)}
                >
                  Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={clearLogs}
                  disabled={liveLogs.length === 0}
                >
                  Clear Logs
                </Button>
              </Box>
            </Box>

            {!isStreaming && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  Select an endpoint from the <strong>Inbound Feeds</strong> tab to start streaming logs in real-time.
                  Logs are not stored permanently and will be cleared when you leave this page.
                </Typography>
              </Alert>
            )}

            {isStreaming && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress />
                <Typography variant="caption" color="text.secondary">
                  Streaming from: {selectedEndpoint?.url} | Rate: ~{logStats.rate} logs/sec | Total: {logStats.total}
                </Typography>
              </Box>
            )}

            {/* TABLE VIEW */}
            {viewMode === 'table' && (
              <Paper sx={{ maxHeight: 600, overflow: 'auto' }}>
                <TableContainer>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Rule</TableCell>
                        <TableCell>Level</TableCell>
                        <TableCell>Agent</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Source</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {liveLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">
                              {isStreaming ? 'Waiting for logs...' : 'No logs to display'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        liveLogs.map((log, index) => (
                          <TableRow key={log._id || index} hover>
                            <TableCell>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                {new Date(log._received_at || log.timestamp).toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={log.rule?.id || 'N/A'} 
                                size="small" 
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={log.rule?.level || 0} 
                                size="small" 
                                color={getSeverityColor(log)}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {log.agent?.name || log.agent?.id || 'Unknown'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                                {formatLogPreview(log)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={log._source || 'wazuh'} 
                                size="small" 
                                color="default"
                              />
                            </TableCell>
                            <TableCell>
                              <IconButton 
                                size="small" 
                                onClick={() => openLogDetail(log)}
                                color="primary"
                              >
                                <CodeIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <div ref={logsEndRef} />
              </Paper>
            )}

            {/* NEW: RAW JSON VIEW */}
            {viewMode === 'raw' && (
              <Paper sx={{ maxHeight: 600, overflow: 'auto', p: 2 }}>
                {liveLogs.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <CodeIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                    <Typography color="text.secondary">
                      {isStreaming ? 'Waiting for logs...' : 'No logs to display'}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {liveLogs.map((log, index) => {
                      const isExpanded = expandedLogs.has(log._id);
                      return (
                        <Paper 
                          key={log._id || index} 
                          variant="outlined" 
                          sx={{ 
                            p: 2,
                            bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                            border: `1px solid ${theme.palette.divider}`
                          }}
                        >
                          {/* Log Header */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Chip 
                                label={`#${liveLogs.length - index}`} 
                                size="small" 
                                color="primary"
                              />
                              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                {new Date(log._received_at || log.timestamp).toLocaleString()}
                              </Typography>
                              <Chip 
                                label={`Level ${log.rule?.level || 0}`} 
                                size="small" 
                                color={getSeverityColor(log)}
                              />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="Copy JSON">
                                <IconButton 
                                  size="small" 
                                  onClick={() => copyLogToClipboard(log)}
                                >
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={isExpanded ? "Collapse" : "Expand"}>
                                <IconButton 
                                  size="small" 
                                  onClick={() => toggleLogExpansion(log._id)}
                                >
                                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>

                          {/* Log Content */}
                          {isExpanded ? (
                            <Box 
                              sx={{ 
                                bgcolor: theme.palette.mode === 'dark' ? '#000' : '#fff',
                                p: 2, 
                                borderRadius: 1,
                                overflow: 'auto',
                                maxHeight: 400
                              }}
                            >
                              <pre style={{ 
                                margin: 0, 
                                fontFamily: 'monospace', 
                                fontSize: '0.85rem',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all'
                              }}>
                                {JSON.stringify(log, null, 2)}
                              </pre>
                            </Box>
                          ) : (
                            <Box 
                              sx={{ 
                                bgcolor: theme.palette.mode === 'dark' ? '#000' : '#fff',
                                p: 1.5, 
                                borderRadius: 1,
                                overflow: 'hidden'
                              }}
                            >
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontFamily: 'monospace',
                                  fontSize: '0.85rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {JSON.stringify(log).substring(0, 200)}...
                              </Typography>
                            </Box>
                          )}
                        </Paper>
                      );
                    })}
                  </Box>
                )}
                <div ref={logsEndRef} />
              </Paper>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              * Showing last {liveLogs.length} of maximum 1000 logs (in-memory only, not persisted)
            </Typography>
          </Box>
        )}

        {/* Tab 1: Inbound Feeds */}
        {currentTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <CloudDownloadIcon sx={{ mr: 1 }} color="primary" />
                Inbound Threat Intelligence Feeds
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddCircleIcon />}
                onClick={handleOpenInboundDialog}
              >
                Add Inbound Feed
              </Button>
            </Box>

            {loadingEndpoints && <LinearProgress sx={{ mb: 2 }} />}

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Feed Name</TableCell>
                    <TableCell>Endpoint URL</TableCell>
                    <TableCell>API Root</TableCell>
                    <TableCell>Collection</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inboundEndpoints.map((endpoint) => (
                    <TableRow key={endpoint.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="600">
                          {endpoint.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {endpoint.url}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={endpoint.apiRoot} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip label={endpoint.collection} size="small" variant="outlined" color="info" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={isStreaming && selectedEndpoint?.id === endpoint.id ? <FiberManualRecordIcon /> : <CheckCircleIcon />}
                          label={isStreaming && selectedEndpoint?.id === endpoint.id ? 'STREAMING' : 'READY'}
                          size="small"
                          color={isStreaming && selectedEndpoint?.id === endpoint.id ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {!isStreaming || selectedEndpoint?.id !== endpoint.id ? (
                            <Tooltip title="Start Streaming">
                              <IconButton 
                                size="small" 
                                color="success"
                                onClick={() => startStreaming(endpoint)}
                              >
                                <PlayArrowIcon />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Stop Streaming">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={stopStreaming}
                              >
                                <StopIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Delete">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => handleDeleteInbound(endpoint.id)}
                              disabled={isStreaming && selectedEndpoint?.id === endpoint.id}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {inboundEndpoints.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <CloudDownloadIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                <Typography color="text.secondary">
                  No inbound feeds configured. Add your first feed to start streaming logs!
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Tab 2: Outbound Servers */}
        {currentTab === 2 && (
          <Box sx={{ p: 3 }}>
            <Alert severity="info">
              Outbound server configuration coming soon. This will allow you to send threat intelligence to external TAXII servers.
            </Alert>
          </Box>
        )}
      </Paper>

      {/* Inbound Endpoint Dialog */}
      <Dialog open={openInboundDialog} onClose={handleCloseInboundDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CloudDownloadIcon sx={{ mr: 1 }} color="primary" />
            Configure Inbound Threat Feed
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Feed Name"
                  placeholder="e.g., Wazuh Production Server"
                  value={endpointForm.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="TAXII Server URL"
                  placeholder="http://192.168.1.69:5000/TAXII"
                  value={endpointForm.url}
                  onChange={(e) => handleFormChange('url', e.target.value)}
                  helperText="Full URL including protocol (http:// or https://)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="API Root"
                  placeholder="e.g., threat-intelligence"
                  value={endpointForm.apiRoot}
                  onChange={(e) => handleFormChange('apiRoot', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Collection ID"
                  placeholder="e.g., wazuh-alerts"
                  value={endpointForm.collection}
                  onChange={(e) => handleFormChange('collection', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={handleTestConnection}
                    disabled={!endpointForm.url || testingConnection}
                    fullWidth
                  >
                    {testingConnection ? 'Testing...' : 'Test Connection'}
                  </Button>
                </Box>
                {connectionTestResult && (
                  <Alert 
                    severity={connectionTestResult.success ? 'success' : 'error'} 
                    sx={{ mt: 2 }}
                  >
                    {connectionTestResult.message}
                    {connectionTestResult.bufferSize !== undefined && (
                      <Typography variant="caption" display="block">
                        Buffer size: {connectionTestResult.bufferSize} logs
                      </Typography>
                    )}
                  </Alert>
                )}
              </Grid>
              <Grid item xs={12}>
                <Alert severity="info" icon={<InfoIcon />}>
                  This endpoint will be polled every 2 seconds when you start streaming. Logs are kept in memory only (max 1000 logs).
                </Alert>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseInboundDialog}>Cancel</Button>
          <Button 
            onClick={handleAddInboundEndpoint} 
            variant="contained" 
            color="primary"
            disabled={!endpointForm.name || !endpointForm.url}
          >
            Add Inbound Feed
          </Button>
        </DialogActions>
      </Dialog>

      {/* NEW: Log Detail Dialog */}
      <Dialog 
        open={logDetailOpen} 
        onClose={() => setLogDetailOpen(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CodeIcon sx={{ mr: 1 }} color="primary" />
              Raw Log Details
            </Box>
            <IconButton 
              size="small" 
              onClick={() => selectedLog && copyLogToClipboard(selectedLog)}
            >
              <ContentCopyIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedLog && (
            <Box>
              {/* Quick Info */}
              <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip 
                  label={`Timestamp: ${new Date(selectedLog._received_at || selectedLog.timestamp).toLocaleString()}`}
                  size="small"
                  icon={<InfoIcon />}
                />
                <Chip 
                  label={`Rule: ${selectedLog.rule?.id || 'N/A'}`}
                  size="small"
                  variant="outlined"
                />
                <Chip 
                  label={`Level: ${selectedLog.rule?.level || 0}`}
                  size="small"
                  color={getSeverityColor(selectedLog)}
                />
                <Chip 
                  label={`Agent: ${selectedLog.agent?.name || selectedLog.agent?.id || 'Unknown'}`}
                  size="small"
                />
                <Chip 
                  label={`Source: ${selectedLog._source || 'wazuh'}`}
                  size="small"
                  color="default"
                />
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Full JSON */}
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  bgcolor: theme.palette.mode === 'dark' ? '#000' : '#f5f5f5',
                  maxHeight: 500,
                  overflow: 'auto'
                }}
              >
                <pre style={{ 
                  margin: 0, 
                  fontFamily: 'monospace', 
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogDetailOpen(false)}>Close</Button>
          <Button 
            onClick={() => selectedLog && copyLogToClipboard(selectedLog)}
            startIcon={<ContentCopyIcon />}
            variant="contained"
          >
            Copy JSON
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StixTaxii;