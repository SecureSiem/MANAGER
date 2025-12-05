import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  useTheme,
  Zoom,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Chip,
  Tabs,
  Tab,
  TextField,
  InputAdornment
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import TimeRangeSelector from '../Common/TimeRangeSelector';
import { exportReportToPdf } from '../Reports/Export';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';

// Icons
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import BarChartIcon from '@mui/icons-material/BarChart';
import TimelineIcon from '@mui/icons-material/Timeline';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SecurityIcon from '@mui/icons-material/Security';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import LaptopIcon from '@mui/icons-material/Laptop';
import StorageIcon from '@mui/icons-material/Storage';
import EventIcon from '@mui/icons-material/Event';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';

// Services
import { getAdvancedAnalytics, getEndpointAnalytics } from '../../services/logs';
import { StructuredLogView } from '../Logs/StructuredLogView';

const EndpointAnalytics = ({ timeRange, setTimeRange }) => {
  const theme = useTheme();
  const { setPageTitle } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fullscreenChart, setFullscreenChart] = useState(null);
  const [fullscreenTitle, setFullscreenTitle] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [endpoints, setEndpoints] = useState([]);
  const [endpointLoading, setEndpointLoading] = useState(false);
  const [endpointData, setEndpointData] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // New state for events tab
  const [tabValue, setTabValue] = useState(0);
  const [endpointLogs, setEndpointLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(0);
  const [logsPageSize, setLogsPageSize] = useState(50);
  const [logsTotalRows, setLogsTotalRows] = useState(0);
  const [logsSearchTerm, setLogsSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  // Refs for exporting
  const endpointAnalyticsRef = useRef(null);

  // Chart color and style configuration
  const chartColors = useMemo(() => ({
    primary: {
      main: theme.palette.primary.main,
      light: theme.palette.primary.light,
      dark: theme.palette.primary.dark,
    },
    secondary: {
      main: theme.palette.secondary.main,
      light: theme.palette.secondary.light,
      dark: theme.palette.secondary.dark,
    },
    success: {
      main: theme.palette.success.main,
      light: theme.palette.success.light,
      dark: theme.palette.success.dark,
    },
    warning: {
      main: theme.palette.warning.main,
      light: theme.palette.warning.light,
      dark: theme.palette.warning.dark,
    },
    error: {
      main: theme.palette.error.main,
      light: theme.palette.error.light,
      dark: theme.palette.error.dark,
    },
    info: {
      main: theme.palette.info.main,
      light: theme.palette.info.light,
      dark: theme.palette.info.dark,
    },
    severity: {
      normal: theme.palette.info.main,
      warning: theme.palette.warning.main,
      critical: theme.palette.error.main
    },
    text: {
      primary: theme.palette.text.primary,
      secondary: theme.palette.text.secondary,
    },
    background: {
      paper: theme.palette.background.paper,
      default: theme.palette.background.default,
    },
    categorical: [
      '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
      '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#5470c6'
    ],
    rainbow: [
      '#d94e2a', '#ebc844', '#da621e', '#e9a448', '#ad36cc',
      '#4cb04c', '#4474d3', '#d63a69', '#339795', '#ca45be'
    ],
    gradient: (color, reverse = false) => {
      return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: reverse ? 1 : 0, color: color + 'ff' },
        { offset: reverse ? 0 : 1, color: color + '50' }
      ]);
    }
  }), [theme]);

  // Chart common options for consistent styling
  const getChartBaseOptions = (showLegend = true) => {
    return {
      textStyle: {
        fontFamily: theme.typography.fontFamily,
        color: theme.palette.text.primary
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(50,50,50,0.9)' : 'rgba(255,255,255,0.9)',
        borderColor: theme.palette.divider,
        textStyle: {
          color: theme.palette.text.primary,
          fontFamily: theme.typography.fontFamily
        },
        extraCssText: 'box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);'
      },
      grid: {
        top: 40,
        bottom: showLegend ? 60 : 30,
        left: 40,
        right: 20,
        containLabel: true
      },
      xAxis: {
        axisLine: {
          lineStyle: {
            color: theme.palette.divider
          }
        },
        axisLabel: {
          color: theme.palette.text.secondary,
          fontFamily: theme.typography.fontFamily
        },
        splitLine: {
          show: false
        }
      },
      yAxis: {
        axisLine: {
          lineStyle: {
            color: theme.palette.divider
          }
        },
        axisLabel: {
          color: theme.palette.text.secondary,
          fontFamily: theme.typography.fontFamily
        },
        splitLine: {
          lineStyle: {
            color: theme.palette.divider,
            opacity: 0.3
          }
        }
      },
      backgroundColor: 'transparent'
    };
  };

  // Fetch list of endpoints from advanced analytics (to get topAgents)
  const fetchEndpoints = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getAdvancedAnalytics(timeRange);
      if (data.topAgents && Array.isArray(data.topAgents)) {
        setEndpoints(data.topAgents.map(agent => ({ name: agent.name, count: agent.count })));
      }

      // Reset selected endpoint when time range changes
      setSelectedEndpoint('');
      setEndpointData(null);
      setEndpointLogs([]);
    } catch (error) {
      console.error('Error fetching endpoints:', error);
      setError('Failed to load endpoints. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    setPageTitle('Endpoint Analytics');
    fetchEndpoints();
  }, [timeRange, fetchEndpoints, setPageTitle]);

  // Fetch endpoint specific analytics
  const fetchEndpointData = async (endpoint) => {
    if (!endpoint) return;

    try {
      setEndpointLoading(true);
      // Combined endpoint returns { analytics: {...}, logs: [...], pagination: {...} }
      const data = await getEndpointAnalytics(endpoint, timeRange, 1, 50, '');

      console.log('RAW API Response:', data);
      console.log('Analytics portion:', data.analytics);
      console.log('Rule Levels:', data.analytics?.ruleLevels);

      // Extract analytics portion for the analytics tab
      setEndpointData(data.analytics || {});
    } catch (error) {
      console.error('Error fetching endpoint data:', error);
      setSnackbar({
        open: true,
        message: `Failed to load data for ${endpoint}`,
        severity: 'error'
      });
    } finally {
      setEndpointLoading(false);
    }
  };

  // Fetch endpoint logs for events tab
  const fetchEndpointLogs = async (page = 0, pageSize = logsPageSize, search = logsSearchTerm) => {
    if (!selectedEndpoint) return;

    try {
      setLogsLoading(true);
      // Combined endpoint returns { analytics: {...}, logs: [...], pagination: {...} }
      const response = await getEndpointAnalytics(selectedEndpoint, timeRange, page + 1, pageSize, search);

      if (response && response.logs) {
        setEndpointLogs(response.logs || []);
        setLogsTotalRows(response.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Error fetching endpoint logs:', error);
      setSnackbar({
        open: true,
        message: `Failed to load logs for ${selectedEndpoint}`,
        severity: 'error'
      });
    } finally {
      setLogsLoading(false);
    }
  };

  // Handle endpoint change
  const handleEndpointChange = (event) => {
    const endpointName = event.target.value;
    setSelectedEndpoint(endpointName);
    setEndpointData(null);
    setEndpointLogs([]);
    setTabValue(0); // Reset to analytics tab
    
    if (endpointName) {
      fetchEndpointData(endpointName);
    }
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    
    // If switching to events tab and we have a selected endpoint but no logs, fetch them
    if (newValue === 1 && selectedEndpoint && endpointLogs.length === 0) {
      fetchEndpointLogs();
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchEndpoints();
    if (selectedEndpoint) {
      fetchEndpointData(selectedEndpoint);
      if (tabValue === 1) {
        fetchEndpointLogs();
      }
    }
  };

  // Handle export
  const handleExport = () => {
    if (endpointAnalyticsRef.current && selectedEndpoint) {
      exportReportToPdf(
        endpointAnalyticsRef.current,
        timeRange,
        new Date(),
        `Endpoint Analysis: ${selectedEndpoint}`
      );
      setSnackbar({
        open: true,
        message: 'Report exported successfully',
        severity: 'success'
      });
    } else {
      setSnackbar({
        open: true,
        message: 'Unable to export report',
        severity: 'error'
      });
    }
  };

  // Handle log search
  const handleLogsSearch = (e) => {
    e.preventDefault();
    setLogsPage(0);
    fetchEndpointLogs(0, logsPageSize, logsSearchTerm);
  };

  // Handle log pagination
  const handleLogsPageChange = (newPage) => {
    setLogsPage(newPage);
    fetchEndpointLogs(newPage, logsPageSize, logsSearchTerm);
  };

  const handleLogsPageSizeChange = (newPageSize) => {
    setLogsPageSize(newPageSize);
    setLogsPage(0);
    fetchEndpointLogs(0, newPageSize, logsSearchTerm);
  };

  // Handle log details view
  const handleViewLogDetails = (log) => {
    setSelectedLog(log);
  };

  const handleCloseLogDetails = () => {
    setSelectedLog(null);
  };

  // Fullscreen chart handling
  const openFullscreen = (chartOption, title) => {
    setFullscreenChart(chartOption);
    setFullscreenTitle(title);
  };

  const closeFullscreen = () => {
    setFullscreenChart(null);
    setFullscreenTitle('');
  };

  // Helper to get rule level color
  const getRuleLevelColor = (level) => {
    const numLevel = parseInt(level, 10);
    if (numLevel >= 15) return 'error';
    if (numLevel >= 13) return 'error';
    if (numLevel >= 12) return 'warning';
    if (numLevel >= 7) return 'info';
    return 'success';
  };

  // Helper to get rule level label
  const getRuleLevelLabel = (level) => {
    const numLevel = parseInt(level, 10);
    if (numLevel >= 15) return 'Critical';
    if (numLevel >= 13) return 'High';
    if (numLevel === 12) return 'Major';
    if (numLevel >= 7) return 'Warning';
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

  // DataGrid column definitions for endpoint logs
  const logsColumns = [
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
      field: 'rule.groups',
      headerName: 'Rule Groups',
      flex: 1,
      minWidth: 150,
      valueGetter: (params) => {
        const groups = params.row.rule?.groups;
        if (!groups || !Array.isArray(groups) || groups.length === 0) return 'N/A';
        return groups[0];
      },
      renderCell: (params) => {
        const groups = params.row.rule?.groups;
        if (!groups || !Array.isArray(groups) || groups.length === 0) {
          return <Typography variant="body2" noWrap>N/A</Typography>;
        }

        // Show first group + count if multiple
        const displayText = groups.length > 1
          ? `${groups[0]} (+${groups.length - 1})`
          : groups[0];

        return (
          <Tooltip title={groups.join(', ')}>
            <Typography variant="body2" noWrap>
              {displayText}
            </Typography>
          </Tooltip>
        );
      }
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
              handleViewLogDetails(params.row);
            }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )
    }
  ];

  // Enhanced UEBA Analysis Function
  const analyzeAgentBehavior = (endpointData) => {
    if (!endpointData) return null;

    const ruleLevels = endpointData.ruleLevels || [];
    const ruleGroups = endpointData.ruleGroups || [];
    const ruleDescriptions = endpointData.ruleDescriptions || [];

    const total = ruleLevels.reduce((sum, level) => sum + level.count, 0);
    if (total === 0) return null;

    const levelCounts = { low: 0, medium: 0, high: 0 };

    ruleLevels.forEach(level => {
      const lvl = parseInt(level.level);
      if (lvl >= 12) levelCounts.high += level.count;
      else if (lvl >= 7) levelCounts.medium += level.count;
      else levelCounts.low += level.count;
    });

    const sortedGroups = ruleGroups
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate risk components
    const criticalWeight = levelCounts.high * 3;
    const warningWeight = levelCounts.medium * 2;
    const diversityWeight = ruleDescriptions.length * 0.5;

    // Enhanced risk score calculation
    const riskScore = Math.min(
      100,
      ((criticalWeight + warningWeight + diversityWeight) / Math.max(total, 1) * 100)
    );

    // Calculate percentages
    const criticalPercent = ((levelCounts.high / total) * 100).toFixed(1);
    const warningPercent = ((levelCounts.medium / total) * 100).toFixed(1);
    const normalPercent = ((levelCounts.low / total) * 100).toFixed(1);

    // Determine risk level with enhanced descriptions
    let riskLevel, riskExplanation, recommendations;
    if (riskScore > 70) {
      riskLevel = 'High Risk';
      riskExplanation = 'This endpoint exhibits significant security concerns with multiple critical events indicating potential compromise or malicious activity.';
      recommendations = [
        'Immediate security investigation required',
        'Isolate endpoint from network if confirmed threats',
        'Conduct deep forensic analysis',
        'Review user access and permissions',
        'Implement enhanced monitoring controls'
      ];
    } else if (riskScore > 40) {
      riskLevel = 'Medium Risk';
      riskExplanation = 'This endpoint shows elevated security activity that warrants attention and monitoring for potential threats.';
      recommendations = [
        'Enhanced monitoring and logging',
        'Review security policies and configurations',
        'Conduct user behavior analysis',
        'Update endpoint protection rules',
        'Schedule security assessment'
      ];
    } else {
      riskLevel = 'Low Risk';
      riskExplanation = 'This endpoint demonstrates normal security behavior patterns with minimal security concerns.';
      recommendations = [
        'Continue regular security monitoring',
        'Maintain current security configurations',
        'Periodic security reviews',
        'User security awareness training'
      ];
    }

    // Enhanced AI-powered summary
    const summary = `Security analysis of ${selectedEndpoint} reveals ${total.toLocaleString()} total security events over the selected period. 
Critical security events constitute ${criticalPercent}% (${levelCounts.high.toLocaleString()} events), indicating significant security concerns. 
Warning-level activities account for ${warningPercent}% (${levelCounts.medium.toLocaleString()} events), while normal operations represent ${normalPercent}% (${levelCounts.low.toLocaleString()} events). 
The most prominent security categories include ${sortedGroups.slice(0, 3).map(g => g.name).join(', ')}. 
${riskExplanation} Our AI analysis recommends ${recommendations.length} specific security actions to mitigate identified risks.`;

    // Risk calculation breakdown
    const riskBreakdown = {
      criticalImpact: ((criticalWeight / Math.max(total, 1)) * 100).toFixed(1),
      warningImpact: ((warningWeight / Math.max(total, 1)) * 100).toFixed(1),
      diversityImpact: ((diversityWeight / Math.max(total, 1)) * 100).toFixed(1),
    };

    return {
      total,
      levelCounts,
      sortedGroups,
      riskScore,
      riskLevel,
      riskExplanation,
      summary,
      criticalPercent,
      warningPercent,
      normalPercent,
      riskBreakdown,
      recommendations
    };
  };

  // UEBA Chart Options
  const getUEBARiskGaugeOption = (risk) => ({
    ...getChartBaseOptions(false),
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 10,
        axisLine: {
          lineStyle: {
            width: 24,
            color: [
              [0.4, chartColors.success.main],
              [0.7, chartColors.warning.main],
              [1, chartColors.error.main],
            ],
          },
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '70%',
          width: 12,
          offsetCenter: [0, '-25%'],
          itemStyle: {
            color: 'auto'
          }
        },
        axisTick: {
          distance: -24,
          length: 8,
          lineStyle: {
            color: '#fff',
            width: 2
          }
        },
        splitLine: {
          distance: -24,
          length: 14,
          lineStyle: {
            color: '#fff',
            width: 3
          }
        },
        axisLabel: {
          color: theme.palette.text.secondary,
          fontSize: 14,
          distance: 30,
          formatter: '{value}'
        },
        title: {
          fontSize: 16,
          color: theme.palette.text.secondary,
          offsetCenter: [0, '100%']
        },
        detail: {
          valueAnimation: true,
          fontSize: 36,
          fontWeight: 'bold',
          formatter: '{value}',
          color: theme.palette.text.primary,
          offsetCenter: [0, '80%']
        },
        data: [{ value: risk.toFixed(1), name: 'Risk Score' }],
      },
    ],
  });

  const getUEBAGroupRadarOption = (groups) => {
    if (!groups || groups.length === 0) return getChartBaseOptions(false);

    return {
      ...getChartBaseOptions(false),
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} events'
      },
      legend: {
        show: true,
        bottom: 5,
        textStyle: {
          color: theme.palette.text.primary,
          fontSize: 12
        }
      },
      radar: {
        indicator: groups.map(g => ({
          name: g.name.length > 18 ? g.name.substring(0, 15) + '...' : g.name,
          max: Math.max(...groups.map(x => x.count)) * 1.3
        })),
        center: ['50%', '50%'],
        radius: '60%',
        axisName: {
          color: theme.palette.text.primary,
          fontSize: 12,
          fontWeight: 500
        },
        axisLine: {
          lineStyle: {
            color: theme.palette.divider
          }
        },
        splitLine: {
          lineStyle: {
            color: theme.palette.divider
          }
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: theme.palette.mode === 'dark'
              ? ['rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.06)']
              : ['rgba(0, 0, 0, 0.03)', 'rgba(0, 0, 0, 0.06)']
          }
        }
      },
      series: [
        {
          name: 'Rule Group Activity',
          type: 'radar',
          symbol: 'circle',
          symbolSize: 8,
          data: [
            {
              value: groups.map(g => g.count),
              name: 'Event Count',
              areaStyle: {
                color: theme.palette.mode === 'dark'
                  ? 'rgba(66, 165, 245, 0.3)'
                  : 'rgba(25, 118, 210, 0.3)'
              },
              lineStyle: {
                color: chartColors.primary.main,
                width: 3
              },
              itemStyle: {
                color: chartColors.primary.main,
                borderWidth: 2,
                borderColor: '#fff'
              },
              label: {
                show: true,
                formatter: '{c}',
                color: theme.palette.text.primary,
                fontSize: 11,
                fontWeight: 'bold'
              }
            },
          ],
        },
      ],
    };
  };

  // Endpoint rule level distribution
  const getEndpointRuleLevelChartOption = () => {
    if (!endpointData?.ruleLevels || endpointData.ruleLevels.length === 0) {
      return {
        ...getChartBaseOptions(),
        title: {
          text: 'No endpoint rule level data available',
          left: 'center',
          textStyle: {
            fontFamily: theme.typography.fontFamily,
            color: theme.palette.text.secondary
          }
        }
      };
    }

    const ruleLevelData = endpointData.ruleLevels
      .sort((a, b) => parseInt(a.level) - parseInt(b.level));

    return {
      ...getChartBaseOptions(),
      title: {
        text: `Rule Level Distribution for ${selectedEndpoint}`,
        left: 'center',
        textStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: 16,
          fontWeight: 'bold',
          color: theme.palette.text.primary
        }
      },
      radar: {
        indicator: ruleLevelData.map(level => ({
          name: `Level ${level.level}`,
          max: Math.max(...ruleLevelData.map(l => l.count)) * 1.2
        })),
        center: ['50%', '55%'],
        radius: '70%',
        axisName: {
          color: theme.palette.text.secondary,
          fontFamily: theme.typography.fontFamily,
          fontSize: 12
        },
        axisLine: {
          lineStyle: {
            color: theme.palette.divider
          }
        },
        splitLine: {
          lineStyle: {
            color: [theme.palette.divider]
          }
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: theme.palette.mode === 'dark'
              ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.05)']
              : ['rgba(0, 0, 0, 0.02)', 'rgba(0, 0, 0, 0.05)']
          }
        }
      },
      series: [
        {
          name: 'Rule Levels',
          type: 'radar',
          data: [
            {
              value: ruleLevelData.map(level => level.count),
              name: 'Event Count',
              symbol: 'circle',
              symbolSize: 8,
              areaStyle: {
                color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.5, [
                  {
                    offset: 0,
                    color: chartColors.primary.main
                  },
                  {
                    offset: 1,
                    color: chartColors.primary.main
                  }
                ])
              },
              lineStyle: {
                width: 3,
                color: chartColors.primary.main
              },
              itemStyle: {
                color: chartColors.primary.main
              },
              label: {
                show: true,
                formatter: '{c}',
                color: theme.palette.text.primary
              }
            }
          ]
        }
      ],
      animationDuration: 1500
    };
  };

  // Endpoint rule groups chart
  const getEndpointRuleGroupsChartOption = () => {
    if (!endpointData?.ruleGroups || endpointData.ruleGroups.length === 0) {
      return {
        ...getChartBaseOptions(),
        title: {
          text: 'No endpoint rule groups data available',
          left: 'center',
          textStyle: {
            fontFamily: theme.typography.fontFamily,
            color: theme.palette.text.secondary
          }
        }
      };
    }

    const ruleGroupData = endpointData.ruleGroups
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      ...getChartBaseOptions(),
      title: {
        text: `Top Rule Groups for ${selectedEndpoint}`,
        left: 'center',
        textStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: 16,
          fontWeight: 'bold',
          color: theme.palette.text.primary
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: {
          color: theme.palette.text.secondary
        }
      },
      series: [
        {
          name: 'Rule Group',
          type: 'pie',
          radius: '65%',
          center: ['40%', '50%'],
          data: ruleGroupData.map((group, index) => ({
            name: group.name,
            value: group.count,
            itemStyle: {
              color: chartColors.categorical[index % chartColors.categorical.length]
            }
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          label: {
            formatter: '{b}: {c} ({d}%)',
            color: theme.palette.text.primary
          },
          labelLine: {
            smooth: true
          }
        }
      ],
      animationEasing: 'cubicInOut',
      animationDuration: 1500
    };
  };

  // Endpoint rule descriptions chart
  const getEndpointRuleDescriptionsChartOption = () => {
    if (!endpointData?.ruleDescriptions || endpointData.ruleDescriptions.length === 0) {
      return {
        ...getChartBaseOptions(),
        title: {
          text: 'No endpoint rule descriptions data available',
          left: 'center',
          textStyle: {
            fontFamily: theme.typography.fontFamily,
            color: theme.palette.text.secondary
          }
        }
      };
    }

    const descriptionsData = endpointData.ruleDescriptions
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    return {
      ...getChartBaseOptions(),
      title: {
        text: `Top Rule Descriptions for ${selectedEndpoint}`,
        left: 'center',
        textStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: 16,
          fontWeight: 'bold',
          color: theme.palette.text.primary
        }
      },
      grid: {
        left: '3%',
        right: '15%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: 'Count',
        nameTextStyle: {
          fontWeight: 'bold'
        }
      },
      yAxis: {
        type: 'category',
        data: descriptionsData.map(d => {
          const desc = d.description;
          return desc.length > 40 ? desc.substring(0, 37) + '...' : desc;
        }),
        inverse: true,
        axisLabel: {
          width: 250,
          overflow: 'truncate'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function (params) {
          const data = params[0].data;
          return `<div style="font-weight:bold">${data.description}</div>
       <div>Count: ${data.value}</div>`;
        }
      },
      series: [
        {
          name: 'Rule Description',
          type: 'bar',
          data: descriptionsData.map((d, index) => ({
            value: d.count,
            description: d.description,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                {
                  offset: 0,
                  color: chartColors.categorical[index % chartColors.categorical.length]
                },
                {
                  offset: 1,
                  color: chartColors.categorical[index % chartColors.categorical.length]
                }
              ])
            }
          })),
          label: {
            show: true,
            position: 'right',
            formatter: '{c}',
            color: theme.palette.text.primary
          }
        }
      ],
      animationEasing: 'elasticOut',
      animationDelay: function (idx) {
        return idx * 50;
      }
    };
  };

  // Endpoint timeline chart
  const getEndpointTimelineChartOption = () => {
    if (!endpointData?.timeline || endpointData.timeline.length === 0) {
      return {
        ...getChartBaseOptions(),
        title: {
          text: 'No endpoint timeline data available',
          left: 'center',
          textStyle: {
            fontFamily: theme.typography.fontFamily,
            color: theme.palette.text.secondary
          }
        }
      };
    }

    const timeData = endpointData.timeline.map(item => ({
      date: new Date(item.timestamp).toLocaleDateString(),
      value: item.count
    }));

    return {
      ...getChartBaseOptions(),
      title: {
        text: `Event Timeline for ${selectedEndpoint}`,
        left: 'center',
        textStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: 16,
          fontWeight: 'bold',
          color: theme.palette.text.primary
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          animation: false,
          lineStyle: {
            color: theme.palette.primary.main
          }
        },
        formatter: function (params) {
          return `${params[0].name}<br/>${params[0].seriesName}: ${params[0].value}`;
        }
      },
      xAxis: {
        type: 'category',
        data: timeData.map(item => item.date),
        boundaryGap: false
      },
      yAxis: {
        type: 'value',
        name: 'Event Count',
        nameTextStyle: {
          fontWeight: 'bold'
        }
      },
      visualMap: {
        show: false,
        dimension: 1,
        pieces: [
          {
            lte: 10,
            color: chartColors.success.main
          },
          {
            gt: 10,
            lte: 50,
            color: chartColors.info.main
          },
          {
            gt: 50,
            lte: 100,
            color: chartColors.warning.main
          },
          {
            gt: 100,
            color: chartColors.error.main
          }
        ]
      },
      series: [
        {
          name: 'Events',
          type: 'line',
          data: timeData.map(item => item.value),
          smooth: true,
          showSymbol: true,
          symbol: 'emptyCircle',
          symbolSize: 8,
          sampling: 'average',
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: theme.palette.primary.main
              },
              {
                offset: 1,
                color: theme.palette.primary.main
              }
            ])
          },
          itemStyle: {
            borderWidth: 2
          },
          emphasis: {
            scale: true
          }
        }
      ],
      animationEasing: 'quadraticInOut',
      animationDuration: 1000
    };
  };

  // Render chart component with fullscreen capability
  const renderChart = (chartId, option, title, icon, height = 400) => {
    return (
      <Paper
        elevation={2}
        sx={{
          p: 2,
          height: '100%',
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          transition: 'box-shadow 0.3s ease',
          '&:hover': {
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
            '& .fullscreen-icon': {
              opacity: 1
            }
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            {icon}
            <Box component="span" sx={{ ml: 1 }}>{title}</Box>
          </Typography>
          <Tooltip title="View Fullscreen">
            <IconButton
              size="small"
              onClick={() => openFullscreen(option, title)}
              className="fullscreen-icon"
              sx={{
                bgcolor: theme.palette.background.paper,
                boxShadow: 1,
                opacity: 0.7,
                transition: 'opacity 0.2s ease',
                '&:hover': {
                  bgcolor: theme.palette.action.hover
                }
              }}
            >
              <FullscreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ flexGrow: 1, minHeight: height }}>
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            theme={theme.palette.mode === 'dark' ? 'dark' : undefined}
            notMerge={true}
            lazyUpdate={true}
          />
        </Box>
      </Paper>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <BarChartIcon sx={{ mr: 1.5, fontSize: 32 }} />
            User and Entity Behavior Analytics (UEBA)
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: '600px', lineHeight: 1.6 }}
          >
            Analyze individual endpoints with detailed event patterns, rule insights, and AI-powered behavioral risk assessments to detect threats and anomalies effectively.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
            disabled={loading || endpointLoading}
          />

          <Tooltip title="Refresh Data">
            <IconButton
              color="primary"
              onClick={handleRefresh}
              disabled={loading || endpointLoading}
              sx={{
                bgcolor: 'background.paper',
                boxShadow: 1,
                '&:hover': {
                  bgcolor: theme.palette.action.hover
                }
              }}
            >
              {loading || endpointLoading ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={loading || endpointLoading || !selectedEndpoint}
          >
            Export PDF
          </Button>
        </Box>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      )}

      {error && !loading && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <Box>
          <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>
              Select Endpoint for Analysis
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Choose an endpoint to view detailed security analytics for that specific device.
            </Typography>

            <FormControl fullWidth variant="outlined">
              <InputLabel id="endpoint-select-label">Endpoint</InputLabel>
              <Select
                labelId="endpoint-select-label"
                id="endpoint-select"
                value={selectedEndpoint}
                onChange={handleEndpointChange}
                label="Endpoint"
                disabled={endpointLoading}
              >
                <MenuItem value="">
                  <em>Select an endpoint</em>
                </MenuItem>
                {endpoints.map((endpoint) => (
                  <MenuItem key={endpoint.name} value={endpoint.name}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <Typography>{endpoint.name}</Typography>
                      <Chip
                        label={`${endpoint.count} events`}
                        size="small"
                        sx={{ ml: 2 }}
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>

          {endpointLoading && (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="30vh">
              <CircularProgress />
            </Box>
          )}

          {!endpointLoading && selectedEndpoint && (
            <Box ref={endpointAnalyticsRef}>
              {/* Tabs for Analytics and Events */}
              <Paper sx={{ mb: 3 }}>
                <Tabs
                  value={tabValue}
                  onChange={handleTabChange}
                  aria-label="endpoint analytics tabs"
                  indicatorColor="primary"
                  textColor="primary"
                  sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                  <Tab 
                    icon={<BarChartIcon />} 
                    iconPosition="start" 
                    label="Analytics" 
                    id="endpoint-tab-0"
                    aria-controls="endpoint-tabpanel-0"
                  />
                  <Tab 
                    icon={<EventIcon />} 
                    iconPosition="start" 
                    label="Events" 
                    id="endpoint-tab-1"
                    aria-controls="endpoint-tabpanel-1"
                  />
                </Tabs>
              </Paper>

              {/* Analytics Tab */}
              <Box
                role="tabpanel"
                hidden={tabValue !== 0}
                id="endpoint-tabpanel-0"
                aria-labelledby="endpoint-tab-0"
              >
                {tabValue === 0 && endpointData && (
                  <>
                    <Typography variant="h5" sx={{ mb: 3, fontWeight: 500 }}>
                      <LaptopIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Endpoint Analysis: {selectedEndpoint}
                    </Typography>

                    {/* Endpoint Charts */}
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                      <Grid item xs={12} md={6}>
                        {renderChart(
                          'endpointRuleLevelChart',
                          getEndpointRuleLevelChartOption(),
                          `Rule Level Distribution for ${selectedEndpoint}`,
                          <SecurityIcon color="primary" sx={{ mr: 1 }} />
                        )}
                      </Grid>
                      <Grid item xs={12} md={6}>
                        {renderChart(
                          'endpointTimelineChart',
                          getEndpointTimelineChartOption(),
                          `Event Timeline for ${selectedEndpoint}`,
                          <TimelineIcon color="primary" sx={{ mr: 1 }} />
                        )}
                      </Grid>
                    </Grid>

                    <Grid container spacing={3}>
                      <Grid item xs={12} md={5}>
                        {renderChart(
                          'endpointRuleGroupsChart',
                          getEndpointRuleGroupsChartOption(),
                          `Top Rule Groups for ${selectedEndpoint}`,
                          <DonutLargeIcon color="primary" sx={{ mr: 1 }} />
                        )}
                      </Grid>
                      <Grid item xs={12} md={7}>
                        {renderChart(
                          'endpointRuleDescriptionsChart',
                          getEndpointRuleDescriptionsChartOption(),
                          `Top Rule Descriptions for ${selectedEndpoint}`,
                          <BarChartIcon color="primary" sx={{ mr: 1 }} />
                        )}
                      </Grid>
                    </Grid>

                    {/* UEBA Behaviour Analysis Section */}
                    {endpointData && (
                      <Paper
                        elevation={4}
                        sx={{
                          mt: 4,
                          p: 4,
                          borderRadius: 3,
                          background: theme.palette.mode === 'dark'
                            ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'
                            : 'linear-gradient(135deg, rgba(248, 250, 252, 0.95) 0%, rgba(241, 245, 249, 0.95) 100%)',
                          border: `2px solid ${theme.palette.primary.main}30`,
                          position: 'relative',
                          overflow: 'hidden',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '4px',
                            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
                            backgroundSize: '200% 100%',
                            animation: 'gradient 3s ease infinite',
                          },
                          '@keyframes gradient': {
                            '0%, 100%': { backgroundPosition: '0% 50%' },
                            '50%': { backgroundPosition: '100% 50%' },
                          }
                        }}
                      >
                        {/* Header Section */}
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              bgcolor: `${theme.palette.primary.main}20`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mr: 2
                            }}
                          >
                            <SecurityIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5, color: theme.palette.text.primary }}>
                              User & Entity Behaviour Analysis (UEBA)
                            </Typography>
                            <Typography variant="body1" sx={{ color: theme.palette.text.secondary, fontWeight: 500 }}>
                              AI-Powered Behavioural Risk Assessment & Security Intelligence
                            </Typography>
                          </Box>
                          <Chip
                            icon={<LaptopIcon />}
                            label={selectedEndpoint}
                            color="primary"
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              px: 2,
                              py: 2.5,
                              '& .MuiChip-icon': { fontSize: 20 }
                            }}
                          />
                        </Box>

                        {(() => {
                          const analysis = analyzeAgentBehavior(endpointData);
                          if (!analysis) {
                            return (
                              <Alert
                                severity="info"
                                icon={<InfoIcon />}
                                sx={{
                                  borderRadius: 2,
                                  fontSize: '1rem',
                                  '& .MuiAlert-icon': { fontSize: 28 }
                                }}
                              >
                                Insufficient data available for comprehensive behavioural analysis. More data collection is required.
                              </Alert>
                            );
                          }

                          return (
                            <>
                              {/* Key Metrics Overview Cards */}
                              <Grid container spacing={3} sx={{ mb: 4 }}>
                                <Grid item xs={12} sm={6} md={3}>
                                  <Card
                                    elevation={3}
                                    sx={{
                                      height: '100%',
                                      borderRadius: 2,
                                      background: theme.palette.mode === 'dark'
                                        ? 'linear-gradient(135deg, rgba(66, 165, 245, 0.15) 0%, rgba(33, 150, 243, 0.05) 100%)'
                                        : 'linear-gradient(135deg, rgba(66, 165, 245, 0.1) 0%, rgba(227, 242, 253, 0.8) 100%)',
                                      border: `1px solid ${chartColors.info.main}40`,
                                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                      '&:hover': {
                                        transform: 'translateY(-8px)',
                                        boxShadow: `0 12px 24px ${chartColors.info.main}30`,
                                      }
                                    }}
                                  >
                                    <CardContent sx={{ p: 3 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                                        <Box sx={{
                                          p: 1.5,
                                          borderRadius: 2,
                                          bgcolor: `${chartColors.info.main}20`,
                                          display: 'flex'
                                        }}>
                                          <StorageIcon sx={{ fontSize: 32, color: chartColors.info.main }} />
                                        </Box>
                                      </Box>
                                      <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: theme.palette.text.primary }}>
                                        {analysis.total.toLocaleString()}
                                      </Typography>
                                      <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Total Events
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 1 }}>
                                        Analyzed over selected period
                                      </Typography>
                                    </CardContent>
                                  </Card>
                                </Grid>

                                <Grid item xs={12} sm={6} md={3}>
                                  <Card
                                    elevation={3}
                                    sx={{
                                      height: '100%',
                                      borderRadius: 2,
                                      background: theme.palette.mode === 'dark'
                                        ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(56, 142, 60, 0.05) 100%)'
                                        : 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(232, 245, 233, 0.8) 100%)',
                                      border: `1px solid ${chartColors.success.main}40`,
                                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                      '&:hover': {
                                        transform: 'translateY(-8px)',
                                        boxShadow: `0 12px 24px ${chartColors.success.main}30`,
                                      }
                                    }}
                                  >
                                    <CardContent sx={{ p: 3 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                                        <Box sx={{
                                          p: 1.5,
                                          borderRadius: 2,
                                          bgcolor: `${chartColors.success.main}20`,
                                          display: 'flex'
                                        }}>
                                          <InfoIcon sx={{ fontSize: 32, color: chartColors.success.main }} />
                                        </Box>
                                      </Box>
                                      <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: theme.palette.text.primary }}>
                                        {analysis.normalPercent}%
                                      </Typography>
                                      <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Normal Events
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 1 }}>
                                        {analysis.levelCounts.low.toLocaleString()} low-severity events
                                      </Typography>
                                    </CardContent>
                                  </Card>
                                </Grid>

                                <Grid item xs={12} sm={6} md={3}>
                                  <Card
                                    elevation={3}
                                    sx={{
                                      height: '100%',
                                      borderRadius: 2,
                                      background: theme.palette.mode === 'dark'
                                        ? 'linear-gradient(135deg, rgba(255, 152, 0, 0.15) 0%, rgba(245, 124, 0, 0.05) 100%)'
                                        : 'linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 243, 224, 0.8) 100%)',
                                      border: `1px solid ${chartColors.warning.main}40`,
                                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                      '&:hover': {
                                        transform: 'translateY(-8px)',
                                        boxShadow: `0 12px 24px ${chartColors.warning.main}30`,
                                      }
                                    }}
                                  >
                                    <CardContent sx={{ p: 3 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                                        <Box sx={{
                                          p: 1.5,
                                          borderRadius: 2,
                                          bgcolor: `${chartColors.warning.main}20`,
                                          display: 'flex'
                                        }}>
                                          <WarningIcon sx={{ fontSize: 32, color: chartColors.warning.main }} />
                                        </Box>
                                      </Box>
                                      <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: theme.palette.text.primary }}>
                                        {analysis.warningPercent}%
                                      </Typography>
                                      <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Warning Events
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 1 }}>
                                        {analysis.levelCounts.medium.toLocaleString()} medium-severity events
                                      </Typography>
                                    </CardContent>
                                  </Card>
                                </Grid>

                                <Grid item xs={12} sm={6} md={3}>
                                  <Card
                                    elevation={3}
                                    sx={{
                                      height: '100%',
                                      borderRadius: 2,
                                      background: theme.palette.mode === 'dark'
                                        ? 'linear-gradient(135deg, rgba(244, 67, 54, 0.15) 0%, rgba(211, 47, 47, 0.05) 100%)'
                                        : 'linear-gradient(135deg, rgba(244, 67, 54, 0.1) 0%, rgba(255, 235, 238, 0.8) 100%)',
                                      border: `1px solid ${chartColors.error.main}40`,
                                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                      '&:hover': {
                                        transform: 'translateY(-8px)',
                                        boxShadow: `0 12px 24px ${chartColors.error.main}30`,
                                      }
                                    }}
                                  >
                                    <CardContent sx={{ p: 3 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                                        <Box sx={{
                                          p: 1.5,
                                          borderRadius: 2,
                                          bgcolor: `${chartColors.error.main}20`,
                                          display: 'flex'
                                        }}>
                                          <ErrorIcon sx={{ fontSize: 32, color: chartColors.error.main }} />
                                        </Box>
                                      </Box>
                                      <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: theme.palette.text.primary }}>
                                        {analysis.criticalPercent}%
                                      </Typography>
                                      <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Critical Events
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 1 }}>
                                        {analysis.levelCounts.high.toLocaleString()} high-severity events
                                      </Typography>
                                    </CardContent>
                                  </Card>
                                </Grid>
                              </Grid>

                              {/* Main Analytics Grid */}
                              <Grid container spacing={3} sx={{ mb: 4 }}>
                                {/* Behavioral Risk Assessment - Gauge */}
                                <Grid item xs={12} md={6}>
                                  <Box
                                    sx={{
                                      p: 3,
                                      height: '100%',
                                      borderRadius: 3,
                                      background: theme.palette.mode === 'dark'
                                        ? 'rgba(30, 41, 59, 0.6)'
                                        : 'rgba(255, 255, 255, 0.9)',
                                      border: `2px solid ${analysis.riskScore > 70
                                        ? chartColors.error.main
                                        : analysis.riskScore > 40
                                          ? chartColors.warning.main
                                          : chartColors.success.main
                                        }`,
                                      boxShadow: `0 8px 32px ${analysis.riskScore > 70
                                        ? chartColors.error.main
                                        : analysis.riskScore > 40
                                          ? chartColors.warning.main
                                          : chartColors.success.main
                                        }20`,
                                      backdropFilter: 'blur(10px)',
                                      WebkitBackdropFilter: 'blur(10px)',
                                    }}
                                  >
                                    <Typography
                                      variant="h5"
                                      gutterBottom
                                      align="center"
                                      sx={{
                                        fontWeight: 700,
                                        mb: 2,
                                        color: theme.palette.text.primary,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 1,
                                      }}
                                    >
                                      <SecurityIcon color="primary" />
                                      Behavioural Risk Assessment
                                    </Typography>

                                    <ReactECharts
                                      option={getUEBARiskGaugeOption(analysis.riskScore)}
                                      style={{ height: 300, width: '100%' }}
                                      theme={theme.palette.mode === 'dark' ? 'dark' : undefined}
                                    />

                                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                                      <Chip
                                        label={analysis.riskLevel}
                                        color={
                                          analysis.riskScore > 70
                                            ? 'error'
                                            : analysis.riskScore > 40
                                              ? 'warning'
                                              : 'success'
                                        }
                                        sx={{
                                          fontWeight: 700,
                                          fontSize: '1.1rem',
                                          px: 3,
                                          py: 3,
                                          height: 'auto',
                                          '& .MuiChip-label': { px: 2 },
                                        }}
                                      />
                                    </Box>
                                  </Box>
                                </Grid>

                                {/* Security Activity Pattern - Radar Chart */}
                                <Grid item xs={12} md={6}>
                                  <Box
                                    sx={{
                                      p: 3,
                                      height: '100%',
                                      borderRadius: 3,
                                      background: theme.palette.mode === 'dark'
                                        ? 'rgba(30, 41, 59, 0.6)'
                                        : 'rgba(255, 255, 255, 0.9)',
                                      backdropFilter: 'blur(10px)',
                                      WebkitBackdropFilter: 'blur(10px)',
                                    }}
                                  >
                                    <Typography
                                      variant="h5"
                                      gutterBottom
                                      align="center"
                                      sx={{
                                        fontWeight: 700,
                                        mb: 3,
                                        color: theme.palette.text.primary,
                                      }}
                                    >
                                      Security Activity Pattern
                                    </Typography>

                                    <ReactECharts
                                      option={getUEBAGroupRadarOption(analysis.sortedGroups)}
                                      style={{ height: 380, width: '100%' }}
                                      theme={theme.palette.mode === 'dark' ? 'dark' : undefined}
                                    />
                                  </Box>
                                </Grid>
                              </Grid>

                              {/* AI Analysis Summary - Bot Speaking Style */}
                              <Paper
                                elevation={2}
                                sx={{
                                  p: 0,
                                  mb: 4,
                                  borderRadius: 3,
                                  background: theme.palette.mode === 'dark'
                                    ? 'linear-gradient(135deg, rgba(66, 165, 245, 0.08) 0%, rgba(33, 150, 243, 0.03) 100%)'
                                    : 'linear-gradient(135deg, rgba(66, 165, 245, 0.06) 0%, rgba(227, 242, 253, 0.6) 100%)',
                                  border: `1px solid ${theme.palette.info.main}30`,
                                  overflow: 'hidden'
                                }}
                              >
                                <Box
                                  sx={{
                                    p: 2.5,
                                    background: `linear-gradient(90deg, ${theme.palette.info.main}20 0%, transparent 100%)`,
                                    borderBottom: `2px solid ${theme.palette.info.main}30`
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Box
                                      sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: '50%',
                                        background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: `0 4px 14px ${theme.palette.info.main}40`,
                                        position: 'relative',
                                        '&::after': {
                                          content: '""',
                                          position: 'absolute',
                                          width: '100%',
                                          height: '100%',
                                          borderRadius: '50%',
                                          background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`,
                                          animation: 'pulse 2s ease-in-out infinite',
                                        },
                                        '@keyframes pulse': {
                                          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                                          '50%': { opacity: 0.5, transform: 'scale(1.1)' },
                                        }
                                      }}
                                    >
                                      <SecurityIcon sx={{ color: '#fff', fontSize: 28, zIndex: 1 }} />
                                    </Box>
                                    <Box>
                                      <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        AI Security Analyst
                                        <Chip
                                          label="LIVE"
                                          size="small"
                                          sx={{
                                            bgcolor: chartColors.success.main,
                                            color: '#fff',
                                            fontWeight: 700,
                                            fontSize: '0.65rem',
                                            height: 20,
                                            animation: 'blink 2s ease-in-out infinite',
                                            '@keyframes blink': {
                                              '0%, 100%': { opacity: 1 },
                                              '50%': { opacity: 0.6 },
                                            }
                                          }}
                                        />
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 500 }}>
                                        Behavioural Analysis Report • {new Date().toLocaleString()}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </Box>

                                <Box sx={{ p: 3 }}>
                                  <Alert
                                    severity={analysis.riskScore > 70 ? 'error' : analysis.riskScore > 40 ? 'warning' : 'success'}
                                    icon={false}
                                    sx={{
                                      borderRadius: 2,
                                      bgcolor: 'transparent',
                                      border: 'none',
                                      p: 0,
                                      '& .MuiAlert-message': { width: '100%', p: 0 }
                                    }}
                                  >
                                    <Box sx={{
                                      position: 'relative',
                                      pl: 2,
                                      '&::before': {
                                        content: '""',
                                        position: 'absolute',
                                        left: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: 4,
                                        borderRadius: 2,
                                        background: analysis.riskScore > 70
                                          ? chartColors.error.main
                                          : analysis.riskScore > 40
                                            ? chartColors.warning.main
                                            : chartColors.success.main,
                                      }
                                    }}>
                                      <Typography
                                        variant="body1"
                                        sx={{
                                          lineHeight: 1.8,
                                          color: theme.palette.text.primary,
                                          fontSize: '1rem',
                                          fontWeight: 500,
                                          fontFamily: 'system-ui, -apple-system, sans-serif',
                                          '&::first-letter': {
                                            fontSize: '1.5em',
                                            fontWeight: 700,
                                            color: analysis.riskScore > 70
                                              ? chartColors.error.main
                                              : analysis.riskScore > 40
                                                ? chartColors.warning.main
                                                : chartColors.success.main,
                                          }
                                        }}
                                      >
                                        {analysis.summary}
                                      </Typography>
                                    </Box>
                                  </Alert>
                                </Box>
                              </Paper>

                              {/* Recommended Actions - Note Style */}
                              <Paper
                                elevation={3}
                                sx={{
                                  p: 0,
                                  borderRadius: 3,
                                  overflow: 'hidden',
                                  background: theme.palette.mode === 'dark'
                                    ? 'rgba(30, 41, 59, 0.6)'
                                    : 'rgba(255, 255, 255, 0.95)',
                                  border: `2px solid ${analysis.riskScore > 70
                                    ? chartColors.error.main
                                    : analysis.riskScore > 40
                                      ? chartColors.warning.main
                                      : chartColors.success.main
                                    }40`,
                                }}
                              >
                                <Box
                                  sx={{
                                    p: 3,
                                    background: analysis.riskScore > 70
                                      ? `linear-gradient(135deg, ${chartColors.error.main}15, ${chartColors.error.main}05)`
                                      : analysis.riskScore > 40
                                        ? `linear-gradient(135deg, ${chartColors.warning.main}15, ${chartColors.warning.main}05)`
                                        : `linear-gradient(135deg, ${chartColors.success.main}15, ${chartColors.success.main}05)`,
                                    borderBottom: `2px solid ${analysis.riskScore > 70
                                      ? chartColors.error.main
                                      : analysis.riskScore > 40
                                        ? chartColors.warning.main
                                        : chartColors.success.main
                                      }30`,
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                      <Box sx={{
                                        p: 1.5,
                                        borderRadius: 2,
                                        bgcolor: theme.palette.background.paper,
                                        boxShadow: 2,
                                        mr: 2
                                      }}>
                                        <WarningIcon
                                          sx={{
                                            fontSize: 32,
                                            color: analysis.riskScore > 70
                                              ? chartColors.error.main
                                              : analysis.riskScore > 40
                                                ? chartColors.warning.main
                                                : chartColors.success.main
                                          }}
                                        />
                                      </Box>
                                      <Box>
                                        <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                                          Recommended Security Actions
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
                                          Priority tasks based on risk assessment • {analysis.recommendations.length} actions identified
                                        </Typography>
                                      </Box>
                                    </Box>
                                    <Chip
                                      label={`Priority: ${analysis.riskScore > 70 ? 'URGENT' : analysis.riskScore > 40 ? 'HIGH' : 'NORMAL'}`}
                                      color={analysis.riskScore > 70 ? 'error' : analysis.riskScore > 40 ? 'warning' : 'success'}
                                      sx={{
                                        fontWeight: 700,
                                        fontSize: '0.875rem',
                                        px: 2,
                                        py: 2.5
                                      }}
                                    />
                                  </Box>
                                </Box>

                                <Box sx={{ p: 3 }}>
                                  <Grid container spacing={2}>
                                    {analysis.recommendations.map((rec, index) => (
                                      <Grid item xs={12} key={index}>
                                        <Box
                                          sx={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            p: 2.5,
                                            bgcolor: theme.palette.mode === 'dark'
                                              ? 'rgba(255, 255, 255, 0.03)'
                                              : 'rgba(0, 0, 0, 0.02)',
                                            borderRadius: 2,
                                            border: `2px solid ${theme.palette.divider}`,
                                            position: 'relative',
                                            overflow: 'hidden',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            '&:hover': {
                                              transform: 'translateX(8px)',
                                              borderColor: analysis.riskScore > 70
                                                ? chartColors.error.main
                                                : analysis.riskScore > 40
                                                  ? chartColors.warning.main
                                                  : chartColors.primary.main,
                                              bgcolor: theme.palette.mode === 'dark'
                                                ? 'rgba(255, 255, 255, 0.05)'
                                                : 'rgba(0, 0, 0, 0.03)',
                                              boxShadow: `0 4px 12px ${analysis.riskScore > 70
                                                ? chartColors.error.main
                                                : analysis.riskScore > 40
                                                  ? chartColors.warning.main
                                                  : chartColors.primary.main
                                                }20`,
                                              '&::before': {
                                                width: '6px'
                                              }
                                            },
                                            '&::before': {
                                              content: '""',
                                              position: 'absolute',
                                              left: 0,
                                              top: 0,
                                              bottom: 0,
                                              width: '4px',
                                              background: `linear-gradient(180deg, ${analysis.riskScore > 70
                                                ? chartColors.error.main
                                                : analysis.riskScore > 40
                                                  ? chartColors.warning.main
                                                  : chartColors.primary.main
                                                }, ${analysis.riskScore > 70
                                                  ? chartColors.error.dark
                                                  : analysis.riskScore > 40
                                                    ? chartColors.warning.dark
                                                    : chartColors.primary.dark
                                                })`,
                                              transition: 'width 0.3s ease',
                                            }
                                          }}
                                        >
                                          <Box
                                            sx={{
                                              minWidth: 40,
                                              height: 40,
                                              borderRadius: '50%',
                                              background: `linear-gradient(135deg, ${analysis.riskScore > 70
                                                ? chartColors.error.main
                                                : analysis.riskScore > 40
                                                  ? chartColors.warning.main
                                                  : chartColors.primary.main
                                                }, ${analysis.riskScore > 70
                                                  ? chartColors.error.dark
                                                  : analysis.riskScore > 40
                                                    ? chartColors.warning.dark
                                                    : chartColors.primary.dark
                                                })`,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              mr: 2,
                                              boxShadow: `0 4px 12px ${analysis.riskScore > 70
                                                ? chartColors.error.main
                                                : analysis.riskScore > 40
                                                  ? chartColors.warning.main
                                                  : chartColors.primary.main
                                                }40`,
                                              flexShrink: 0
                                            }}
                                          >
                                            <Typography
                                              variant="h6"
                                              sx={{
                                                color: '#fff',
                                                fontWeight: 800,
                                                fontSize: '1.1rem'
                                              }}
                                            >
                                              {index + 1}
                                            </Typography>
                                          </Box>
                                          <Box sx={{ flex: 1 }}>
                                            <Typography
                                              variant="body1"
                                              sx={{
                                                color: theme.palette.text.primary,
                                                fontWeight: 600,
                                                lineHeight: 1.6,
                                                fontSize: '1rem'
                                              }}
                                            >
                                              {rec}
                                            </Typography>
                                          </Box>
                                          {index === 0 && analysis.riskScore > 70 && (
                                            <Chip
                                              label="URGENT"
                                              size="small"
                                              color="error"
                                              sx={{
                                                fontWeight: 700,
                                                ml: 2,
                                                animation: 'pulse-urgent 2s ease-in-out infinite',
                                                '@keyframes pulse-urgent': {
                                                  '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                                                  '50%': { opacity: 0.8, transform: 'scale(1.05)' },
                                                }
                                              }}
                                            />
                                          )}
                                        </Box>
                                      </Grid>
                                    ))}
                                  </Grid>
                                </Box>
                              </Paper>
                            </>
                          );
                        })()}
                      </Paper>
                    )}
                  </>
                )}
              </Box>

              {/* Events Tab */}
              <Box
                role="tabpanel"
                hidden={tabValue !== 1}
                id="endpoint-tabpanel-1"
                aria-labelledby="endpoint-tab-1"
              >
                {tabValue === 1 && (
                  <>
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
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 500 }}>
                          Endpoint Events Search - {selectedEndpoint}
                        </Typography>
                      </Box>
                      
                      <form onSubmit={handleLogsSearch}>
                        <TextField
                          fullWidth
                          variant="outlined"
                          placeholder="Search events by description, rule group, or any field..."
                          value={logsSearchTerm}
                          onChange={(e) => setLogsSearchTerm(e.target.value)}
                          size="small"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon />
                              </InputAdornment>
                            ),
                            endAdornment: logsLoading ? (
                              <InputAdornment position="end">
                                <CircularProgress size={20} />
                              </InputAdornment>
                            ) : logsSearchTerm ? (
                              <InputAdornment position="end">
                                <IconButton 
                                  size="small" 
                                  onClick={() => {
                                    setLogsSearchTerm('');
                                    fetchEndpointLogs(0, logsPageSize, '');
                                  }}
                                >
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ) : null
                          }}
                        />
                      </form>
                    </Paper>

                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {logsLoading ? 'Loading events...' : `${logsTotalRows.toLocaleString()} events found for ${selectedEndpoint}`}
                      </Typography>
                    </Box>

                    <Paper 
                      sx={{ 
                        height: 'calc(100vh - 400px)', 
                        width: '100%', 
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'background.paper',
                      }}
                    >
                      {logsLoading && endpointLogs.length === 0 ? (
                        <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                          <CircularProgress />
                        </Box>
                      ) : endpointLogs.length === 0 ? (
                        <Box display="flex" justifyContent="center" alignItems="center" height="100%" flexDirection="column" p={3}>
                          <EventIcon sx={{ fontSize: 64, mb: 2, color: 'text.secondary', opacity: 0.3 }} />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No events found
                          </Typography>
                          <Typography variant="body2" color="text.secondary" align="center">
                            {selectedEndpoint ? 
                              'No events found for this endpoint in the selected time range.' : 
                              'Select an endpoint to view events.'
                            }
                          </Typography>
                          <Button 
                            variant="outlined" 
                            startIcon={<RefreshIcon />} 
                            sx={{ mt: 2 }}
                            onClick={() => {
                              setLogsSearchTerm('');
                              fetchEndpointLogs();
                            }}
                          >
                            Reset Filters
                          </Button>
                        </Box>
                      ) : (
                        <DataGrid
                          rows={endpointLogs}
                          columns={logsColumns}
                          pagination
                          paginationMode="server"
                          rowCount={logsTotalRows}
                          page={logsPage}
                          pageSize={logsPageSize}
                          onPageChange={handleLogsPageChange}
                          onPageSizeChange={handleLogsPageSizeChange}
                          rowsPerPageOptions={[25, 50, 100]}
                          disableSelectionOnClick
                          loading={logsLoading}
                          getRowId={(row) => row.id || row._id || `row-${Math.random()}`}
                          components={{
                            Toolbar: GridToolbar,
                          }}
                          componentsProps={{
                            toolbar: {
                              showQuickFilter: false,
                              quickFilterProps: { debounceMs: 500 },
                            },
                          }}
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
                          onRowClick={(params) => handleViewLogDetails(params.row)}
                        />
                      )}
                    </Paper>
                  </>
                )}
              </Box>
            </Box>
          )}

          {!endpointLoading && !selectedEndpoint && (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="30vh" flexDirection="column">
              <LaptopIcon sx={{ fontSize: 64, mb: 2, color: 'text.secondary', opacity: 0.3 }} />
              <Typography variant="h6" color="textSecondary" gutterBottom>
                No endpoint selected
              </Typography>
              <Typography variant="body2" color="textSecondary" align="center">
                Select an endpoint from the dropdown above to view detailed analysis.
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Log Details Dialog */}
      {selectedLog && (
        <StructuredLogView
          data={selectedLog}
          onClose={handleCloseLogDetails}
          open={!!selectedLog}
        />
      )}

      {/* Fullscreen Chart Dialog */}
      <Dialog
        open={!!fullscreenChart}
        onClose={closeFullscreen}
        fullScreen
        PaperProps={{
          sx: {
            borderRadius: 0,
            overflow: 'hidden',
            boxShadow: 'none'
          }
        }}
        TransitionComponent={Zoom}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              {fullscreenTitle}
            </Typography>
            <IconButton edge="end" color="inherit" onClick={closeFullscreen}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ height: 'calc(100vh - 120px)', width: '100%', p: 2 }}>
            {fullscreenChart && (
              <ReactECharts
                option={fullscreenChart}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
                theme={theme.palette.mode === 'dark' ? 'dark' : ''}
                notMerge
                lazyUpdate
              />
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeFullscreen} startIcon={<FullscreenExitIcon />}>
            Exit Fullscreen
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

export default EndpointAnalytics;