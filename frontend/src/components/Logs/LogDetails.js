// frontend/src/components/Logs/LogDetails.js - Enhanced Version with DQL Support
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Alert,
  TextField,
  InputAdornment,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Button,
  Divider,
  Snackbar,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Stack,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Popper,
  ClickAwayListener,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import PauseIcon from '@mui/icons-material/Pause';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import SecurityIcon from '@mui/icons-material/Security';
import FilterListIcon from '@mui/icons-material/FilterList';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import TimeRangeSelector from '../Common/TimeRangeSelector';
import { getLogs } from '../../services/logs';
import { StructuredLogView } from './StructuredLogView';
import { startLogExport, getExportStatus } from '../../services/logs';
import api from '../../services/auth';

// DQL field suggestions based on your log schema
const DQL_SUGGESTIONS = {
  'Core Fields': [
    { field: '@timestamp', example: '@timestamp:[2024-01-01 TO 2024-01-31]', description: 'Log timestamp' },
    { field: 'id', example: 'id:gen-1234567890', description: 'Log ID' },
    { field: 'location', example: 'location:/var/log/auth.log', description: 'Log location' }
  ],
  'Agent Fields': [
    { field: 'agent.name', example: 'agent.name:firewall', description: 'Agent name' },
    { field: 'agent.id', example: 'agent.id:001', description: 'Agent ID' },
    { field: 'agent.ip', example: 'agent.ip:192.168.1.1', description: 'Agent IP address' }
  ],
  'Rule Fields': [
    { field: 'rule.id', example: 'rule.id:31100', description: 'Rule ID' },
    { field: 'rule.level', example: 'rule.level:>=12', description: 'Rule severity level' },
    { field: 'rule.description', example: 'rule.description:"login attempt"', description: 'Rule description' },
    { field: 'rule.groups', example: 'rule.groups:authentication', description: 'Rule groups' }
  ],
  'Network Fields': [
    { field: 'network.srcIp', example: 'network.srcIp:192.168.1.100', description: 'Source IP' },
    { field: 'network.destIp', example: 'network.destIp:10.0.0.1', description: 'Destination IP' },
    { field: 'network.protocol', example: 'network.protocol:TCP', description: 'Network protocol' },
    { field: 'data.srcip', example: 'data.srcip:192.168.1.*', description: 'Source IP (data field)' },
    { field: 'data.dstip', example: 'data.dstip:192.168.1.*', description: 'Destination IP (data field)' }
  ],
  'MITRE ATT&CK': [
    { field: 'rule.mitre.id', example: 'rule.mitre.id:T1078', description: 'MITRE technique ID' },
    { field: 'rule.mitre.tactic', example: 'rule.mitre.tactic:"Initial Access"', description: 'MITRE tactic' },
    { field: 'rule.mitre.technique', example: 'rule.mitre.technique:"Valid Accounts"', description: 'MITRE technique' }
  ],
  'Compliance': [
    { field: 'rule.gdpr', example: 'rule.gdpr:IV_35.7.d', description: 'GDPR compliance' },
    { field: 'rule.hipaa', example: 'rule.hipaa:164.312.b', description: 'HIPAA compliance' },
    { field: 'rule.nist', example: 'rule.nist:AC-2', description: 'NIST compliance' },
    { field: 'rule.pci_dss', example: 'rule.pci_dss:10.2.1', description: 'PCI DSS compliance' }
  ],
  'Data Fields': [
    { field: 'data.srcuser', example: 'data.srcuser:admin', description: 'Source user' },
    { field: 'data.dstuser', example: 'data.dstuser:guest', description: 'Destination user' },
    { field: 'data.hostname', example: 'data.hostname:web-server', description: 'Hostname' },
    { field: 'data.app', example: 'data.app:ssh', description: 'Application' },
    { field: 'data.action', example: 'data.action:deny', description: 'Action taken' }
  ],
  'File Integrity': [
    { field: 'syscheck.path', example: 'syscheck.path:/etc/passwd', description: 'File path' },
    { field: 'syscheck.event', example: 'syscheck.event:modified', description: 'File event type' }
  ],
  'Security Events': [
    { field: 'data.vulnerability.cve', example: 'data.vulnerability.cve:CVE-2023-*', description: 'CVE identifier' },
    { field: 'data.AI_response', example: 'data.AI_response:"threat detected"', description: 'AI analysis result' }
  ]
};

const QUERY_OPERATORS = [
  { operator: 'AND', example: 'rule.level:>=12 AND agent.name:firewall', description: 'Both conditions must match' },
  { operator: 'OR', example: 'rule.level:15 OR rule.level:12', description: 'Either condition can match' },
  { operator: 'NOT', example: 'NOT rule.groups:test', description: 'Exclude matching results' },
  { operator: '>=', example: 'rule.level:>=12', description: 'Greater than or equal' },
  { operator: '<=', example: 'rule.level:<=8', description: 'Less than or equal' },
  { operator: '>', example: 'rule.level:>10', description: 'Greater than' },
  { operator: '<', example: 'rule.level:<5', description: 'Less than' },
  { operator: '*', example: 'agent.name:web*', description: 'Wildcard matching' },
  { operator: '[x TO y]', example: 'rule.level:[12 TO 15]', description: 'Range query' },
  { operator: '"phrase"', example: 'rule.description:"login failed"', description: 'Exact phrase match' }
];

// Function to export logs to CSV
const exportToCSV = (logs, fileName = 'security_logs.csv') => {
  if (!logs || logs.length === 0) {
    console.error('No logs to export');
    return false;
  }

  try {
    // Get all unique keys from the logs
    const allKeys = new Set();
    logs.forEach(log => {
      Object.keys(log).forEach(key => {
        if (key !== '_score' && key !== 'raw_log' && typeof log[key] !== 'object') {
          allKeys.add(key);
        }
      });

      // Add common nested properties
      if (log.rule) allKeys.add('rule.description');
      if (log.rule) allKeys.add('rule.level');
      if (log.agent) allKeys.add('agent.name');
      if (log.network) allKeys.add('network.srcIp');
      if (log.network) allKeys.add('network.destIp');
    });

    // Convert Set to Array and sort
    const headers = Array.from(allKeys).sort();

    // Create CSV header row
    let csv = headers.join(',') + '\n';

    // Add data rows
    logs.forEach(log => {
      const row = headers.map(key => {
        // Handle nested properties
        if (key.includes('.')) {
          const [parent, child] = key.split('.');
          return log[parent] && log[parent][child]
            ? `"${String(log[parent][child]).replace(/"/g, '""')}"`
            : '';
        }

        // Handle regular properties
        if (log[key] === undefined || log[key] === null) return '';
        if (typeof log[key] === 'object') return '';

        // Escape quotes and format as CSV cell
        return `"${String(log[key]).replace(/"/g, '""')}"`;
      }).join(',');

      csv += row + '\n';
    });

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return true;
  } catch (error) {
    console.error('Error exporting CSV:', error);
    return false;
  }
};

const LogDetails = () => {
  const theme = useTheme();
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalRows, setTotalRows] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const [logType, setLogType] = useState('all');
  const [ruleLevel, setRuleLevel] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [refreshInterval, setRefreshInterval] = useState('paused');
  const [refreshTimerRef, setRefreshTimerRef] = useState(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [viewMode, setViewMode] = useState('grid'); // 'table' or 'grid'
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchExecuted, setSearchExecuted] = useState(false);
  const [exportBatchSize, setExportBatchSize] = useState(1000);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [isExporting, setIsExporting] = useState(false);

  // DQL Help states
  const [showHelp, setShowHelp] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const helpRef = useRef(null);

  const { setPageTitle } = useOutletContext();
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    setPageTitle('Log Analysis');

    // Fetch logs on initial load
    fetchLogs(0, pageSize, searchTerm, logType, ruleLevel, timeRange);

    // Cleanup on unmount
    return () => {
      if (refreshTimerRef) {
        clearInterval(refreshTimerRef);
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Effect for search term changes - debounce search
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Only perform search if a search term has been entered and the user has stopped typing
    if (searchTerm) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(() => {
        setPage(0);
        fetchLogs(0, pageSize, searchTerm, logType, ruleLevel, timeRange);
        setSearchExecuted(true);
      }, 500); // 500ms debounce
    } else if (searchExecuted) {
      // If search term was cleared and we had previously executed a search
      setPage(0);
      fetchLogs(0, pageSize, '', logType, ruleLevel, timeRange);
      setSearchExecuted(false);
    }
  }, [searchTerm]);

  // Effect for filter changes
  useEffect(() => {
    setPage(0);
    fetchLogs(0, pageSize, searchTerm, logType, ruleLevel, timeRange);
  }, [logType, ruleLevel, timeRange]);

  // Set up auto-refresh
  useEffect(() => {
    if (refreshInterval !== 'paused') {
      let milliseconds;
      switch (refreshInterval) {
        case '10s': milliseconds = 10000; break;
        case '30s': milliseconds = 30000; break;
        case '1m': milliseconds = 60000; break;
        case '5m': milliseconds = 300000; break;
        default: milliseconds = null;
      }

      if (milliseconds) {
        // Clear any existing timer
        if (refreshTimerRef) {
          clearInterval(refreshTimerRef);
          setRefreshTimerRef(null);
        }

        // Set new timer
        const timerId = setInterval(() => {
          fetchLogs(page, pageSize, searchTerm, logType, ruleLevel, timeRange);
        }, milliseconds);
        setRefreshTimerRef(timerId);
        return () => clearInterval(timerId);
      }
    } else if (refreshTimerRef) {
      clearInterval(refreshTimerRef);
      setRefreshTimerRef(null);
    }
  }, [refreshInterval, page, pageSize, searchTerm, logType, ruleLevel, timeRange]);

  const handleDeleteSuccess = (deletedId) => {
  setLogs(prevLogs => prevLogs.filter(log => log.id !== deletedId));
};

  
  
  // DQL Help functions
  const handleHelpClick = (event) => {
    setAnchorEl(anchorEl ? null : helpRef.current);
    setShowHelp(!showHelp);
  };

  const handleHelpClose = () => {
    setShowHelp(false);
    setAnchorEl(null);
  };

  const insertFieldExample = (field, example) => {
    const currentValue = searchTerm;
    const newValue = currentValue ? `${currentValue} AND ${example}` : example;
    setSearchTerm(newValue);
    handleHelpClose();
  };

  // Helper to get rule level color
  const getRuleLevelColor = (level) => {
    const numLevel = parseInt(level, 10);
    if (numLevel >= 15) return 'error';
    if (numLevel >= 12) return 'error';
    if (numLevel >= 8) return 'warning';
    if (numLevel >= 4) return 'info';
    return 'success';
  };

  // Helper to get rule level label
  const getRuleLevelLabel = (level) => {
    const numLevel = parseInt(level, 10);
    if (numLevel >= 15) return 'Critical';
    if (numLevel >= 12) return 'High';
    if (numLevel >= 8) return 'Medium';
    if (numLevel >= 4) return 'Low';
    return 'Info';
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    try {
      if (!timestamp) return 'N/A';
      if (typeof timestamp === 'number') {
        return new Date(timestamp * 1000).toLocaleString();
      }
      return new Date(timestamp).toLocaleString();
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Improved fetch logs from API with better error handling
  const fetchLogs = async (currentPage, limit, search, type, level, timeRangeParam) => {
    try {
      setLoading(true);
      setError(null);

      // Convert to 1-indexed for API (this is correct)
      const apiPage = currentPage + 1;

      console.log(`Fetching logs - Page: ${apiPage}, Limit: ${limit}, Search: "${search}"`);

      const response = await getLogs({
        page: apiPage,
        limit,
        search,
        logType: type,
        ruleLevel: level,
        timeRange: timeRangeParam
      });

      console.log(`Got response: ${response.logs?.length} logs, total: ${response.pagination?.total}`);

      setLogs(response.logs || []);
      setTotalRows(response.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setError('Failed to fetch logs. Please try again later.');
    } finally {
      setLoading(false);
      setIsSearching(false); // Add this to stop the searching indicator
    }
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    console.log(`handlePageChange called: ${page} → ${newPage}`);

    // Prevent unnecessary API calls
    if (newPage === page) {
      console.log('Page unchanged, skipping fetch');
      return;
    }

    // Update the state
    setPage(newPage);

    // Immediately fetch with the new page
    fetchLogs(newPage, pageSize, searchTerm, logType, ruleLevel, timeRange);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize) => {
    console.log(`handlePageSizeChange called: ${pageSize} → ${newPageSize}`);

    // Prevent unnecessary API calls
    if (newPageSize === pageSize) {
      console.log('Page size unchanged, skipping fetch');
      return;
    }

    setPageSize(newPageSize);
    setPage(0); // Reset to first page

    // Fetch with new page size and reset page
    fetchLogs(0, newPageSize, searchTerm, logType, ruleLevel, timeRange);
  };

  // Handle log type change
  const handleLogTypeChange = (event) => {
    setLogType(event.target.value);
  };

  // Handle rule level change
  const handleRuleLevelChange = (event) => {
    setRuleLevel(event.target.value);
  };

  // Handle refresh interval change
  const handleRefreshIntervalChange = (event) => {
    setRefreshInterval(event.target.value);
  };

  // Handle log selection for details view
  const handleViewDetails = (log) => {
    setSelectedLog(log);
  };

  // Close log details dialog
  const handleCloseDetails = () => {
    setSelectedLog(null);
  };

  // Handle manual refresh
  const handleManualRefresh = () => {
    fetchLogs(page, pageSize, searchTerm, logType, ruleLevel, timeRange);
  };

  // Handle search submit - immediately execute search
  const handleSearchSubmit = (e) => {
    e.preventDefault();

    // Clear any pending debounced search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    setPage(0);
    setIsSearching(true);
    fetchLogs(0, pageSize, searchTerm, logType, ruleLevel, timeRange);
    setSearchExecuted(!!searchTerm);
  };

  // Toggle filters expanded/collapsed
  const toggleFilters = () => {
    setFiltersExpanded(!filtersExpanded);
  };

  // Toggle view mode
  const toggleViewMode = () => {
    setViewMode(viewMode === 'table' ? 'grid' : 'table');
  };

  // Handle export
  const handleExport = () => {
    // Open export dialog
    setExportDialogOpen(true);
  };

  // Export current page logs
  const exportCurrentPage = () => {
    setExportDialogOpen(false);
    const success = exportToCSV(logs, `security_logs_page_${page + 1}_${formatDateForFileName(new Date())}.csv`);
    setSnackbar({
      open: true,
      message: success ? 'Logs exported successfully' : 'Failed to export logs',
      severity: success ? 'success' : 'error'
    });
  };

  // Export logs using background job approach
  const exportAllLogs = async () => {
    setExportDialogOpen(false);
    setIsExporting(true);

    try {
      // Start the export job
      const { jobId } = await startLogExport(timeRange);

      // Start polling for progress
      const pollInterval = setInterval(async () => {
        try {
          const status = await getExportStatus(jobId);

          setExportProgress({
            current: status.progress.current,
            total: status.progress.total
          });

          if (status.status === 'completed') {
            clearInterval(pollInterval);
            setIsExporting(false);

            // Trigger download with authentication - FIXED VERSION
            try {
              const response = await api.get(`/logs/export/download/${jobId}`, {
                responseType: 'blob' // Important: tell axios to handle binary data
              });

              // Determine content type based on whether it's zipped or not
              const contentType = status.isZipped ? 'application/zip' : 'text/csv';

              // Create blob with correct content type
              const blob = new Blob([response.data], { type: contentType });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = status.fileName;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);

              setSnackbar({
                open: true,
                message: `Successfully exported ${status.progress.current.toLocaleString()} logs${status.isZipped ? ' (zipped)' : ''}`,
                severity: 'success'
              });
            } catch (downloadError) {
              console.error('Download error:', downloadError);
              setSnackbar({
                open: true,
                message: 'Export completed but download failed. Please try again.',
                severity: 'warning'
              });
            }
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            setIsExporting(false);

            setSnackbar({
              open: true,
              message: `Export failed: ${status.error || 'Unknown error'}`,
              severity: 'error'
            });
          }

        } catch (error) {
          clearInterval(pollInterval);
          setIsExporting(false);

          setSnackbar({
            open: true,
            message: `Export failed: ${error.message}`,
            severity: 'error'
          });
        }
      }, 3000); // Poll every 3 seconds

      setSnackbar({
        open: true,
        message: 'Export started in background. You can continue browsing while it processes.',
        severity: 'info'
      });

    } catch (error) {
      setIsExporting(false);
      setSnackbar({
        open: true,
        message: `Failed to start export: ${error.message}`,
        severity: 'error'
      });
    }
  };

  // Format date for file name
  const formatDateForFileName = (date) => {
    return date.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .split('.')[0];
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm('');
    setLogType('all');
    setRuleLevel('all');
    setPage(0);
    setSearchExecuted(false);
    fetchLogs(0, pageSize, '', 'all', 'all', timeRange);
  };

  // DataGrid column definitions
  const columns = [
    {
      field: 'severity',
      headerName: '',
      width: 60,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const level = params.row.rule?.level || 0;
        const color = getRuleLevelColor(level);
        return (
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: theme.palette[color].main,
              boxShadow: `0 0 0 2px ${theme.palette[color].lighter}`
            }}
          />
        );
      },
      sortable: false
    },
    {
      field: '@timestamp',
      headerName: 'Timestamp',
      flex: 1.2,
      minWidth: 180,
      valueGetter: (params) => formatTimestamp(params.row['@timestamp']),
      renderCell: (params) => (
        <Typography variant="body2">
          {formatTimestamp(params.row['@timestamp'])}
        </Typography>
      )
    },
    {
      field: 'rule.level',
      headerName: 'Severity',
      flex: 0.8,
      minWidth: 120,
      valueGetter: (params) => params.row.rule?.level || 0,
      renderCell: (params) => {
        const level = params.row.rule?.level || 0;
        return (
          <Chip
            label={`${level} - ${getRuleLevelLabel(level)}`}
            color={getRuleLevelColor(level)}
            size="small"
            sx={{
              height: '24px',
              fontWeight: 500
            }}
          />
        );
      }
    },
    {
      field: 'agent.name',
      headerName: 'Agent',
      flex: 1,
      minWidth: 150,
      valueGetter: (params) => params.row.agent?.name || 'N/A',
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.row.agent?.name || 'N/A'}
        </Typography>
      )
    },
    {
      field: 'network.srcIp',
      headerName: 'Source IP',
      flex: 1,
      minWidth: 130,
      valueGetter: (params) => params.row.network?.srcIp || 'N/A',
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.row.network?.srcIp || 'N/A'}
        </Typography>
      )
    },
    {
      field: 'rule.description',
      headerName: 'Description',
      flex: 2,
      minWidth: 250,
      valueGetter: (params) => params.row.rule?.description || 'N/A',
      renderCell: (params) => (
        <Tooltip title={params.row.rule?.description || 'N/A'}>
          <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
            {params.row.rule?.description || 'N/A'}
          </Typography>
        </Tooltip>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 0.5,
      minWidth: 80,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="View Details">
          <IconButton
            size="small"
            color="primary"
            onClick={(event) => {
              event.stopPropagation();
              handleViewDetails(params.row);
            }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )
    }
  ];

  // Grid view card for logs
  const LogCard = ({ log }) => {
    const level = log.rule?.level || 0;

    return (
      <Card
        elevation={2}
        sx={{
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 6
          },
          height: '100%'
        }}
        onClick={() => handleViewDetails(log)}
      >
        <CardContent>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Chip
              label={`${level} - ${getRuleLevelLabel(level)}`}
              color={getRuleLevelColor(level)}
              size="small"
            />

            {/* changes made by raman */}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.90rem' }}>
              {formatTimestamp(log['@timestamp'])}
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />


          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontSize: '0.90rem' }}>
            Source
          </Typography>
          <Typography variant="body2" noWrap gutterBottom sx={{ fontSize: '1rem' }}>
            {log.agent?.name || 'N/A'}
          </Typography>

          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontSize: '0.90rem' }}>
            Source IP / Destination IP
          </Typography>
          <Typography variant="body2" noWrap gutterBottom sx={{ fontSize: '1rem' }}>
            {log.network?.srcIp || 'N/A'} → {log.network?.destIp || 'N/A'}
          </Typography>

          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontSize: '0.90rem' }}>
            Description
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, minHeight: 40, fontSize: '1rem' }}>
            {log.rule?.description || 'N/A'}
          </Typography>

          {/* by raman */}


          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                handleViewDetails(log);
              }}
            >
              <MoreVertIcon />
            </IconButton>
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2,
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.50',
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SecurityIcon sx={{ mr: 1.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 500 }}>
                Security Log Analysis
              </Typography>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ ml: 5.5, maxWidth: '600px' }}
            >
              Search, filter, and analyze security logs using DQL syntax to identify patterns and investigate incidents across your environment.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TimeRangeSelector
              value={timeRange}
              onChange={setTimeRange}
              disabled={loading}
            />

            <Tooltip title="Toggle Filters">
              <IconButton
                color="primary"
                onClick={toggleFilters}
                sx={{
                  boxShadow: 1,
                  bgcolor: 'background.paper',
                }}
              >
                {filtersExpanded ? <FilterAltOffIcon /> : <FilterAltIcon />}
              </IconButton>
            </Tooltip>

            <Tooltip title={viewMode === 'table' ? 'Switch to Grid View' : 'Switch to Table View'}>
              <IconButton
                color="primary"
                onClick={toggleViewMode}
                sx={{
                  boxShadow: 1,
                  bgcolor: 'background.paper',
                }}
              >
                {viewMode === 'table' ? <ViewModuleIcon /> : <ViewListIcon />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Export Logs">
              <IconButton
                color="primary"
                onClick={handleExport}
                disabled={logs.length === 0 || isExporting}
                sx={{
                  boxShadow: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {filtersExpanded && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel id="log-type-label">Log Type</InputLabel>
                <Select
                  labelId="log-type-label"
                  value={logType}
                  onChange={handleLogTypeChange}
                  label="Log Type"
                >
                  <MenuItem value="all">All Logs</MenuItem>
                  <MenuItem value="firewall">Firewall Logs</MenuItem>
                  <MenuItem value="ids">IDS/IPS Logs</MenuItem>
                  <MenuItem value="windows">Windows Logs</MenuItem>
                  <MenuItem value="linux">Linux Logs</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel id="rule-level-label">Rule Level</InputLabel>
                <Select
                  labelId="rule-level-label"
                  value={ruleLevel}
                  onChange={handleRuleLevelChange}
                  label="Rule Level"
                >
                  <MenuItem value="all">All Levels</MenuItem>
                  <MenuItem value="0">Level 0+</MenuItem>
                  <MenuItem value="4">Level 4+</MenuItem>
                  <MenuItem value="8">Level 8+</MenuItem>
                  <MenuItem value="12">Level 12+</MenuItem>
                  <MenuItem value="15">Level 15+</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="refresh-interval-label">Auto Refresh</InputLabel>
                <Select
                  labelId="refresh-interval-label"
                  value={refreshInterval}
                  onChange={handleRefreshIntervalChange}
                  label="Auto Refresh"
                >
                  <MenuItem value="paused">
                    <Box display="flex" alignItems="center">
                      <PauseIcon fontSize="small" sx={{ mr: 1 }} />
                      Paused
                    </Box>
                  </MenuItem>
                  <MenuItem value="10s">
                    <Box display="flex" alignItems="center">
                      <PlayArrowIcon fontSize="small" sx={{ mr: 1 }} />
                      10 seconds
                    </Box>
                  </MenuItem>
                  <MenuItem value="30s">
                    <Box display="flex" alignItems="center">
                      <PlayArrowIcon fontSize="small" sx={{ mr: 1 }} />
                      30 seconds
                    </Box>
                  </MenuItem>
                  <MenuItem value="1m">
                    <Box display="flex" alignItems="center">
                      <PlayArrowIcon fontSize="small" sx={{ mr: 1 }} />
                      1 minute
                    </Box>
                  </MenuItem>
                  <MenuItem value="5m">
                    <Box display="flex" alignItems="center">
                      <PlayArrowIcon fontSize="small" sx={{ mr: 1 }} />
                      5 minutes
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={handleManualRefresh}
                  disabled={loading}
                  fullWidth
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  onClick={resetFilters}
                  disabled={loading}
                >
                  Reset
                </Button>
              </Box>
            </Grid>
          </Grid>
        )}

        {/* Enhanced Search Component - INTEGRATED DIRECTLY */}
        <form onSubmit={handleSearchSubmit}>
          <Box sx={{ position: 'relative' }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search with DQL syntax: rule.level:>=12 AND agent.name:firewall OR use plain text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {(isSearching || loading) && <CircularProgress size={20} />}

                      <Tooltip title="DQL Query Help">
                        <IconButton
                          ref={helpRef}
                          size="small"
                          onClick={handleHelpClick}
                          color={showHelp ? 'primary' : 'default'}
                        >
                          <HelpOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      {searchTerm && (
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSearchTerm('');
                            if (searchExecuted) {
                              fetchLogs(0, pageSize, '', logType, ruleLevel, timeRange);
                            }
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </InputAdornment>
                )
              }}
              sx={{

                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'background.paper',
                  '&:hover': {
                    backgroundColor: 'background.paper',
                  },
                  '&.Mui-focused': {
                    backgroundColor: 'background.paper',
                  }
                }
              }}
            />

            {/* Quick examples */}
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label="High Severity: rule.level:>=12"
                variant="outlined"
                onClick={() => setSearchTerm('rule.level:>=12')}
                sx={{ fontSize: '1rem' }}
              />
              <Chip
                size="small"
                label="Authentication: rule.groups:authentication"
                variant="outlined"
                onClick={() => setSearchTerm('rule.groups:authentication')}
                sx={{ fontSize: '1rem' }}
              />
              <Chip
                size="small"
                label="Firewall Logs: agent.name:firewall"
                variant="outlined"
                onClick={() => setSearchTerm('agent.name:firewall')}
                sx={{ fontSize: '1rem' }}
              />
              <Chip
                size="small"
                label="IP Range: network.srcIp:192.168.1.*"
                variant="outlined"
                onClick={() => setSearchTerm('network.srcIp:192.168.1.*')}
                sx={{ fontSize: '1rem' }}
              />
            </Box>
          </Box>
        </form>

        {/* DQL Help Popper */}
        <Popper
          open={showHelp}
          anchorEl={anchorEl}
          placement="bottom-end"
          sx={{ zIndex: 2000 }}
        >
          <ClickAwayListener onClickAway={handleHelpClose}>
            <Paper
              elevation={8}
              sx={{
                maxWidth: 600,
                maxHeight: 500,
                overflow: 'auto',
                p: 2,
                mt: 1
              }}
            >
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                  <AddTaskRoundedIcon sx={{ mr: 1 }} />
                  DQL Query Reference
                </Typography>
                <IconButton size="small" onClick={handleHelpClose}>
                  <CloseIcon />
                </IconButton>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Use Data Query Language (DQL) syntax to search specific fields. Click any example to insert it.
              </Typography>

              {/* Query Operators */}
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Query Operators
              </Typography>
              <List dense sx={{ mb: 2 }}>
                {QUERY_OPERATORS.map((op, index) => (
                  <ListItem
                    key={index}
                    button
                    onClick={() => insertFieldExample('', op.example)}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip size="small" label={op.operator} color="primary" variant="outlined" />
                          <Typography variant="body2" component="code" sx={{ bgcolor: 'grey.100', px: 1, borderRadius: 0.5 }}>
                            {op.example}
                          </Typography>
                        </Box>
                      }
                      secondary={op.description}
                    />
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 2 }} />

              {/* Field Suggestions */}
              {Object.entries(DQL_SUGGESTIONS).map(([category, fields]) => (
                <Box key={category} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {category}
                  </Typography>
                  <List dense>
                    {fields.map((field, index) => (
                      <ListItem
                        key={index}
                        button
                        onClick={() => insertFieldExample(field.field, field.example)}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip size="small" label={field.field} color="secondary" variant="outlined" />
                              <Typography variant="body2" component="code" sx={{ bgcolor: 'grey.100', px: 1, borderRadius: 0.5 }}>
                                {field.example}
                              </Typography>
                            </Box>
                          }
                          secondary={field.description}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              ))}
            </Paper>
          </ClickAwayListener>
        </Popper>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {loading ? 'Loading logs...' : `${totalRows.toLocaleString()} logs found`}
          {isSearching && ' (searching...)'}
        </Typography>

        {refreshInterval !== 'paused' && (
          <Chip
            color="primary"
            size="small"
            icon={<PlayArrowIcon />}
            label={`Auto-refresh: ${refreshInterval}`}
            variant="outlined"
            onDelete={() => setRefreshInterval('paused')}
            deleteIcon={<PauseIcon />}
          />
        )}
      </Box>

      <Paper
        sx={{
          height: 'calc(100vh - 280px)',
          width: '100%',
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'background.paper',
        }}
      >
        {loading && logs.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <CircularProgress />
          </Box>
        ) : logs.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%" flexDirection="column" p={3}>
            <SecurityIcon sx={{ fontSize: 64, mb: 2, color: 'text.secondary', opacity: 0.3 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No logs found
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Try adjusting your filters or search terms to see more results.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              sx={{ mt: 2 }}
              onClick={resetFilters}
            >
              Reset Filters
            </Button>
          </Box>
        ) : viewMode === 'table' ? (
          <DataGrid
            rows={logs}
            columns={columns}
            pagination
            paginationMode="server"
            rowCount={totalRows}
            paginationModel={{
              page: page,
              pageSize: pageSize,
            }}
            onPaginationModelChange={(model) => {
              console.log(`Pagination model change:`, model);
              console.log(`Current state - page: ${page}, pageSize: ${pageSize}`);

              // Handle page change
              if (model.page !== page) {
                console.log(`Page changing: ${page} → ${model.page}`);
                handlePageChange(model.page);
              }

              // Handle page size change
              if (model.pageSize !== pageSize) {
                console.log(`Page size changing: ${pageSize} → ${model.pageSize}`);
                handlePageSizeChange(model.pageSize);
              }
            }}
            pageSizeOptions={[25, 50, 100]}
            disableRowSelectionOnClick
            loading={loading}
            getRowId={(row) => row.id || row._id || `row-${Math.random()}`}
            slots={{
              toolbar: GridToolbar,
            }}
            slotProps={{
              toolbar: {
                showQuickFilter: false,
                quickFilterProps: { debounceMs: 500 },
              },
            }}
            checkboxSelection={false}
            disableColumnMenu={false}
            sx={{
              border: 'none',
              '& .MuiDataGrid-cell': {
                cursor: 'pointer',
                borderBottom: `1px solid ${theme.palette.divider}`
              },
              '& .MuiDataGrid-columnHeaders': {
                borderBottom: `2px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
              },
            }}
            onRowClick={(params) => handleViewDetails(params.row)}
          />
        ) : (
          // Grid View
          <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
            <Grid container spacing={2}>
              {logs.map((log) => (
                <Grid item xs={12} sm={6} md={4} key={log.id || log._id || Math.random()}>
                  <LogCard log={log} />
                </Grid>
              ))}
            </Grid>

            {/* Pagination Controls for Grid View */}
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="outlined"
                  disabled={page === 0 || loading}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Previous Page
                </Button>

                <Typography variant="body2">
                  Page {page + 1} of {Math.max(1, Math.ceil(totalRows / pageSize))}
                </Typography>

                <Button
                  variant="outlined"
                  disabled={page >= Math.ceil(totalRows / pageSize) - 1 || loading}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next Page
                </Button>
              </Stack>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Log Details View */}
      {selectedLog && (
        <StructuredLogView
          data={selectedLog}
          onClose={handleCloseDetails}
          open={!!selectedLog}
          onDeleteSuccess={handleDeleteSuccess}
        />
      )}

      {/* Export Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => !isExporting && setExportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Export Logs to CSV
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            Choose which logs to export:
          </Typography>

          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={exportCurrentPage}
              fullWidth
              sx={{ mb: 2 }}
              disabled={isExporting}
            >
              Export Current Page ({logs.length} logs)
            </Button>

            <Button
              variant="contained"
              color="primary"
              startIcon={<DownloadIcon />}
              onClick={exportAllLogs}
              fullWidth
              disabled={isExporting}
            >
              Export All Filtered Logs ({totalRows.toLocaleString()} logs)
            </Button>

            {isExporting && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <CircularProgress size={24} sx={{ mb: 1 }} />
                <Typography variant="body2">
                  {exportProgress.total > 0
                    ? `Processing: ${exportProgress.current.toLocaleString()} / ${exportProgress.total.toLocaleString()} logs (${Math.round((exportProgress.current / exportProgress.total) * 100)}%)`
                    : 'Starting export...'
                  }
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {exportProgress.total > 1000000
                    ? 'Large export detected - will be split into multiple files and zipped.'
                    : 'Export is running in the background. You can continue using the application.'
                  }
                </Typography>
              </Box>
            )}

            {!isExporting && totalRows > 10000 && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
                A large number of logs will be exported. This may take some time and require significant memory.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setExportDialogOpen(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          elevation={6}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LogDetails;