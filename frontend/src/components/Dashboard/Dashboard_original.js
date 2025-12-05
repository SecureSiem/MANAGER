// src/components/Dashboard.js
import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Box, Grid, Paper, Typography, Card, CardContent, Divider, CircularProgress, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Tooltip, useTheme, Zoom, TableContainer, TableBody, TableCell, Chip, TableHead, TableRow, Table, Tabs, Tab
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { getLogStats, getConnectionData } from '../../services/logs';
import TimeRangeSelector from '../Common/TimeRangeSelector';
import WorldConnection from '../Common/WorldConnection';
import SecurityIcon from '@mui/icons-material/Security';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import TimelineIcon from '@mui/icons-material/Timeline';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import CloseIcon from '@mui/icons-material/Close';
import * as echarts from 'echarts/core';
import { getWazuhAgents, getManagerInfo, checkWazuhHealth } from '../../services/wazuh';
import ComputerIcon from '@mui/icons-material/Computer';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import PersonIcon from '@mui/icons-material/Person';
import { getDeviceNames } from '../../services/audits';
import RefreshIcon from '@mui/icons-material/Refresh';
import RouterIcon from '@mui/icons-material/Router';
import SwitchIcon from '@mui/icons-material/Hub';
import LoadBalancerIcon from '@mui/icons-material/Balance';


const Dashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    major: 0,
    normal: 0,
    ruleLevels: [],
    dailyLogs: []
  });
  const [connectionData, setConnectionData] = useState([]);
  const [fullscreenChart, setFullscreenChart] = useState(null);
  const [fullscreenTitle, setFullscreenTitle] = useState('');
  const [tabValue, setTabValue] = useState(0); // For the agent status tabs

  const { setPageTitle } = useOutletContext();
  const [auditData, setAuditData] = useState({
    devices: [],
    lastUpdate: null,
    summary: {
      total: 0,
      online: 0,
      offline: 0,
      error: 0
    }
  });
  const [deviceData, setDeviceData] = useState({
    devices: [],
    totalDevices: 0
  });
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [deviceError, setDeviceError] = useState(null);

  // Add this function to fetch audit data
  const fetchDeviceData = async () => {
    try {
      setDeviceLoading(true);
      setDeviceError(null);

      const response = await getDeviceNames();
      setDeviceData({
        devices: response.devices || [],
        totalDevices: response.totalDevices || 0
      });
    } catch (error) {
      console.error('Error fetching device data:', error);
      setDeviceError(error.message || 'Failed to load devices');
    } finally {
      setDeviceLoading(false);
    }
  };

  // Add this function to handle manual refresh


  // Add this function to get device icon
  const getDeviceIcon = (type) => {
    switch (type) {
      case 'router':
        return <RouterIcon />;
      case 'firewall':
        return <SecurityIcon />;
      case 'switch':
        return <SwitchIcon />;
      case 'loadbalancer':
        return <LoadBalancerIcon />;
      default:
        return <RouterIcon />;
    }
  };

  // Add this function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return '#4CAF50';
      case 'offline':
        return '#FF9800';
      case 'error': // Keep this for backward compatibility
      case 'delayed': // New status
        return '#FFEE58'; // Pale yellow color
      default:
        return '#9E9E9E';
    }
  };

  // Add this function to get audit chart options
  const getAuditStatusChartOption = () => {
    const statusData = [
      { name: 'Online', value: auditData.summary.online, color: '#4CAF50' },
      { name: 'Offline', value: auditData.summary.offline, color: '#FF9800' },
      { name: 'Delayed', value: auditData.summary.error, color: '#FFEE58' }
    ].filter(item => item.value > 0); // Only show non-zero values

    return {
      title: {
        text: 'Network Device Status',
        left: 'center',
        textStyle: {
          color: theme.palette.mode === 'dark' ? '#fff' : '#333',
          fontFamily: theme.typography.fontFamily,
          fontSize: 16,
          fontWeight: 500
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(50,50,50,0.9)' : 'rgba(255,255,255,0.9)',
        borderColor: theme.palette.divider,
        textStyle: {
          color: theme.palette.mode === 'dark' ? '#fff' : '#333'
        }
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: {
          color: theme.palette.text.primary,
          fontFamily: theme.typography.fontFamily
        }
      },
      series: [
        {
          name: 'Device Status',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: theme.palette.background.paper,
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '18',
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: statusData.map(item => ({
            value: item.value,
            name: item.name,
            itemStyle: {
              color: item.color
            }
          }))
        }
      ],
      backgroundColor: 'transparent'
    };
  };

  const [wazuhData, setWazuhData] = useState({
    totalAgents: 0,
    activeAgents: [],
    disconnectedAgents: [],
    neverConnectedAgents: [],
    agentsByOS: {},
    statusSummary: {},
    lastUpdate: null
  });
  const [wazuhLoading, setWazuhLoading] = useState(true);
  const [wazuhError, setWazuhError] = useState(null);
  const [managerInfo, setManagerInfo] = useState(null);

  useEffect(() => {
    // Set page title
    setPageTitle('Dashboard');

    // Load dashboard statistics
    fetchDashboardStats();
    fetchConnectionData();
    fetchWazuhData();
    fetchDeviceData()
  }, [setPageTitle, timeRange]);

  const fetchWazuhData = async () => {
    try {
      setWazuhLoading(true);
      setWazuhError(null);

      // 🟡 Step 1: Get agent list from backend
      const agentsResponse = await getWazuhAgents();

      // 🟢 Step 2: Extract data safely
      let totalAgents = 0;
      let activeAgents = [];
      let disconnectedAgents = [];
      let neverConnectedAgents = [];
      let agentsByOS = {};
      let agentNames = []; // New array to store agent names

      if (agentsResponse.success && agentsResponse.data?.data?.affected_items) {
        const agents = agentsResponse.data.data.affected_items;

        totalAgents = agents.length;
        activeAgents = agents.filter(agent => agent.status === 'active');
        disconnectedAgents = agents.filter(agent => agent.status === 'disconnected');
        neverConnectedAgents = agents.filter(agent => agent.status === 'never_connected');

        // Extract agent names
        agentNames = agents.map(agent => ({
          id: agent.id,
          name: agent.name || 'Unknown',
          ip: agent.ip || 'N/A',
          status: agent.status,
          os: agent.os?.name || 'Unknown'
        }));

        // Group by OS
        agentsByOS = agents.reduce((acc, agent) => {
          const os = agent.os?.name || 'Unknown';
          acc[os] = (acc[os] || 0) + 1;
          return acc;
        }, {});
      }

      // 🟢 Step 3: Save to state
      setWazuhData({
        totalAgents,
        activeAgents,
        disconnectedAgents,
        neverConnectedAgents,
        agentsByOS,
        agentNames, // Add agent names to state
        lastUpdate: new Date().toISOString()
      });

      console.log('✅ wazuhData set:', {
        totalAgents,
        activeAgents: activeAgents.length,
        disconnectedAgents: disconnectedAgents.length,
        neverConnectedAgents: neverConnectedAgents.length,
        agentsByOS,
        agentNames // Log agent names
      });

      // 🟡 Step 4: Get summary from backend
      const managerResponse = await getManagerInfo();
      if (managerResponse.success && managerResponse.data?.data) {
        setManagerInfo(managerResponse.data.data);
        console.log('✅ Cybersentinel Manager Summary:', managerResponse.data.data);
      }

    } catch (error) {
      console.error('Error fetching Cybersentinel data:', error);
      setWazuhError(error.message || 'Failed to load Cybersentinel data');
    } finally {
      setWazuhLoading(false);
    }
  };


  const getWazuhAgentStatusChartOption = () => {
    const statusData = [
      { name: 'Active', value: wazuhData.activeAgents?.length || 0, color: '#4CAF50' },
      { name: 'Disconnected', value: wazuhData.disconnectedAgents?.length || 0, color: '#FF9800' },
      { name: 'Never Connected', value: wazuhData.neverConnectedAgents?.length || 0, color: '#F44336' }
    ];

    return {
      title: {
        text: 'Cybersentinel Agents Status',
        left: 'center',
        textStyle: {
          color: theme.palette.mode === 'dark' ? '#fff' : '#333',
          fontFamily: theme.typography.fontFamily,
          fontSize: 16,
          fontWeight: 500
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(50,50,50,0.9)' : 'rgba(255,255,255,0.9)',
        borderColor: theme.palette.divider,
        textStyle: {
          color: theme.palette.mode === 'dark' ? '#fff' : '#333'
        }
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: {
          color: theme.palette.text.primary,
          fontFamily: theme.typography.fontFamily
        }
      },
      series: [
        {
          name: 'Agent Status',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: theme.palette.background.paper,
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '18',
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: statusData.map(item => ({
            value: item.value,
            name: item.name,
            itemStyle: {
              color: item.color
            }
          }))
        }
      ],
      backgroundColor: 'transparent'
    };
  };

  // Prepare ECharts options for Wazuh OS distribution
  const getWazuhOSChartOption = () => {
    const osData = Object.entries(wazuhData.agentsByOS || {}).map(([os, count]) => ({
      name: os,
      value: count
    }));

    return {
      title: {
        text: 'Agents by Operating System',
        left: 'center',
        textStyle: {
          color: theme.palette.mode === 'dark' ? '#fff' : '#333',
          fontFamily: theme.typography.fontFamily,
          fontSize: 16,
          fontWeight: 500
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(50,50,50,0.9)' : 'rgba(255,255,255,0.9)',
        borderColor: theme.palette.divider,
        textStyle: {
          color: theme.palette.mode === 'dark' ? '#fff' : '#333'
        }
      },
      series: [
        {
          name: 'Operating Systems',
          type: 'pie',
          radius: '70%',
          data: osData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ],
      backgroundColor: 'transparent'
    };
  };
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getLogStats(timeRange);
      setStats(data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setError(error.message || 'Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchConnectionData = async () => {
    try {
      setConnectionLoading(true);

      const data = await getConnectionData(timeRange);

      // Process connection data for the world map
      const connections = [];

      // Format data for connections
      if (data && data.connections) {
        data.connections.forEach(conn => {
          // Only add if we have valid source and destination
          if (conn.source && conn.destination && conn.count) {
            // Look up coordinates
            const srcCoordinates = countryCoordinates[conn.source];
            const dstCoordinates = countryCoordinates[conn.destination];

            if (srcCoordinates && dstCoordinates) {
              connections.push({
                source: conn.source,
                target: conn.destination,
                value: conn.count,
                srcLatitude: srcCoordinates.latitude,
                srcLongitude: srcCoordinates.longitude,
                dstLatitude: dstCoordinates.latitude,
                dstLongitude: dstCoordinates.longitude
              });
            }
          }
        });
      }

      setConnectionData(connections);
    } catch (error) {
      console.error('Error fetching connection data:', error);
      // Don't set a global error for this
    } finally {
      setConnectionLoading(false);
    }
  };

  // Navigate to respective pages
  const navigateToMajorLogs = () => {
    navigate('/majorlogs');
  };

  const navigateToAllLogs = () => {
    navigate('/logs');
  };

  // Prepare ECharts options for rule level distribution
  // Prepare ECharts options for rule level distribution
  const getRuleLevelChartOption = () => {
    const levelData = stats.ruleLevels || [];

    // Group levels into three categories
    const groupedData = [
      {
        name: 'Normal (0-11)',
        value: levelData.reduce((sum, level) => level.level < 12 ? sum + level.count : sum, 0),
        color: '#4CAF50' // Green
      },
      {
        name: 'Major (12-14)',
        value: levelData.reduce((sum, level) => level.level >= 12 && level.level < 15 ? sum + level.count : sum, 0),
        color: '#FFC107' // Yellow
      },
      {
        name: 'Critical (15+)',
        value: levelData.reduce((sum, level) => level.level >= 15 ? sum + level.count : sum, 0),
        color: '#F44336' // Red
      }
    ].filter(item => item.value > 0); // Only show categories with data

    return {
      title: {
        text: 'Rule Level Distribution',
        left: 'center',
        textStyle: {
          color: theme.palette.mode === 'dark' ? '#fff' : '#333',
          fontFamily: theme.typography.fontFamily,
          fontSize: 16,
          fontWeight: 500
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(50,50,50,0.9)' : 'rgba(255,255,255,0.9)',
        borderColor: theme.palette.divider,
        textStyle: {
          color: theme.palette.mode === 'dark' ? '#fff' : '#333'
        }
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: {
          color: theme.palette.text.primary,
          fontFamily: theme.typography.fontFamily
        }
      },
      series: [
        {
          name: 'Rule Levels',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: theme.palette.background.paper,
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '18',
              fontWeight: 'bold'
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          labelLine: {
            show: false
          },
          data: groupedData.map(item => ({
            value: item.value,
            name: item.name,
            itemStyle: {
              color: item.color
            }
          }))
        }
      ],
      backgroundColor: 'transparent'
    };
  };

  // Prepare ECharts options for daily logs timeline
  // Prepare ECharts options for daily logs timeline with 3-hour intervals
  const getDailyLogsChartOption = () => {
    const timelineData = stats.dailyLogs || [];

    // Group data into 3-hour intervals if needed (assuming your backend can provide this)
    // If your backend already provides hourly data, you can process it here
    // This example assumes stats.dailyLogs contains data with timestamps

    // Generate time labels for 3-hour intervals
    const timeLabels = [];
    for (let i = 0; i < 24; i += 3) {
      const hour = i.toString().padStart(2, '0');
      timeLabels.push(`${hour}:00 - ${hour}:59`);
    }

    // Process data - this is a simplified example
    // You'll need to adjust based on your actual data structure
    const processedData = [];
    if (timelineData.length > 0) {
      // Example processing - you should replace this with your actual data processing
      // This assumes timelineData is an array of { timestamp, count } objects
      const date = new Date(timelineData[0].date);
      const dayStr = date.toLocaleDateString();

      // Group into 3-hour intervals
      const intervalCounts = Array(8).fill(0);
      timelineData.forEach(log => {
        const logDate = new Date(log.date);
        const hours = logDate.getHours();
        const intervalIndex = Math.floor(hours / 3);
        intervalCounts[intervalIndex] += log.count || 0;
      });

      processedData.push(...intervalCounts);
    }

    return {
      title: {
        text: 'Daily Log Activity (3-hour intervals)',
        left: 'center',
        textStyle: {
          color: theme.palette.mode === 'dark' ? '#fff' : '#333',
          fontFamily: theme.typography.fontFamily,
          fontSize: 16,
          fontWeight: 500
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(50,50,50,0.9)' : 'rgba(255,255,255,0.9)',
        borderColor: theme.palette.divider,
        textStyle: {
          color: theme.palette.mode === 'dark' ? '#fff' : '#333'
        },
        formatter: function (params) {
          const param = params[0];
          return `<strong>${param.name}</strong><br />
               Count: <span style="color:${param.color};font-weight:bold">${param.value}</span>`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: timeLabels,
        axisLabel: {
          color: theme.palette.text.secondary,
          rotate: 45,
          fontFamily: theme.typography.fontFamily,
          interval: 0 // Show all labels
        },
        axisLine: {
          lineStyle: {
            color: theme.palette.divider
          }
        }
      },
      yAxis: {
        type: 'value',
        name: 'Event Count',
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: {
          color: theme.palette.text.secondary,
          fontFamily: theme.typography.fontFamily,
          fontSize: 14
        },
        axisLabel: {
          color: theme.palette.text.secondary,
          fontFamily: theme.typography.fontFamily
        },
        axisLine: {
          lineStyle: {
            color: theme.palette.divider
          }
        },
        splitLine: {
          lineStyle: {
            color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          }
        }
      },
      series: [{
        name: 'Log Events',
        data: processedData.length > 0 ? processedData : timelineData.map(day => day.count),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: {
          color: '#2196F3'
        },
        lineStyle: {
          width: 3,
          color: '#2196F3'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(33, 150, 243, 0.5)' },
            { offset: 1, color: 'rgba(33, 150, 243, 0.1)' }
          ])
        },
        emphasis: {
          itemStyle: {
            color: '#2196F3',
            borderColor: '#2196F3',
            borderWidth: 2,
            shadowColor: 'rgba(0,0,0,0.3)',
            shadowBlur: 10
          }
        }
      }],
      backgroundColor: 'transparent'
    };
  };


  // Fullscreen handling (similar to ThreatHunting.js)
  const openFullscreen = (chartOption, title) => {
    setFullscreenChart(chartOption);
    setFullscreenTitle(title || 'Chart Details');
  };

  const closeFullscreen = () => {
    setFullscreenChart(null);
    setFullscreenTitle('');
  };

  // Country coordinates lookup for the world map connection
  const countryCoordinates = {
    "United States": { latitude: 39.7837304, longitude: -100.4458825 }, "India": { latitude: 20.5937, longitude: 78.9629 },
    "Germany": { latitude: 51.1657, longitude: 10.4515 }, "France": { latitude: 46.6034, longitude: 1.8883 }, "Netherlands": { latitude: 52.1326, longitude: 5.2913 },
    "Singapore": { latitude: 1.3521, longitude: 103.8198 }, "Japan": { latitude: 36.2048, longitude: 138.2529 }, "Luxembourg": { latitude: 49.8153, longitude: 6.1296 },
    "Reserved": { latitude: -5.0000, longitude: 73.5000 }, "China": { latitude: 35.8617, longitude: 104.1954 }, "United Kingdom": { latitude: 55.3781, longitude: -3.4360 },
    "Canada": { latitude: 56.1304, longitude: -106.3468 }, "Australia": { latitude: -25.2744, longitude: 133.7751 }, "Brazil": { latitude: -14.2350, longitude: -51.9253 },
    "Russian Federation": { latitude: 61.5240, longitude: 105.3188 }, "South Korea": { latitude: 35.9078, longitude: 127.7669 }, "Italy": { latitude: 41.8719, longitude: 12.5674 },
    "Spain": { latitude: 40.4637, longitude: -3.7492 }, "Mexico": { latitude: 23.6345, longitude: -102.5528 }, "Indonesia": { latitude: -0.7893, longitude: 113.9213 },
    "South Africa": { latitude: -30.5595, longitude: 22.9375 }, "Korea, Republic of": { latitude: 40.339852, longitude: 127.510093 },
    "Hong Kong": { latitude: 22.319303, longitude: 114.169361 }, "Afghanistan": { latitude: 33.9391, longitude: 67.709953 },
    "Albania": { latitude: 41.1533, longitude: 20.1683 }, "Algeria": { latitude: 28.0339, longitude: 1.6596 }, "Andorra": { latitude: 42.5078, longitude: 1.5211 },
    "Angola": { latitude: -11.2027, longitude: 17.8739 }, "Argentina": { latitude: -38.4161, longitude: -63.6167 }, "Armenia": { latitude: 40.0691, longitude: 45.0382 },
    "Austria": { latitude: 47.5162, longitude: 14.5501 }, "Azerbaijan": { latitude: 40.1431, longitude: 47.5769 }, "Bahamas": { latitude: 25.0343, longitude: -77.3963 },
    "Bahrain": { latitude: 26.0667, longitude: 50.5577 }, "Bangladesh": { latitude: 23.685, longitude: 90.3563 }, "Belarus": { latitude: 53.9006, longitude: 27.559 },
    "Belgium": { latitude: 50.8503, longitude: 4.3517 }, "Belize": { latitude: 17.1899, longitude: -88.4976 }, "Benin": { latitude: 9.3077, longitude: 2.3158 },
    "Bhutan": { latitude: 27.5142, longitude: 90.4336 }, "Bolivia": { latitude: -16.2902, longitude: -63.5887 }, "Botswana": { latitude: -22.3285, longitude: 24.6849 },
    "Brunei": { latitude: 4.5353, longitude: 114.7277 }, "Bulgaria": { latitude: 42.7339, longitude: 25.4858 }, "Burkina Faso": { latitude: 12.2383, longitude: -1.5616 },
    "Burundi": { latitude: -3.3731, longitude: 29.9189 }, "Cambodia": { latitude: 12.5657, longitude: 104.991 }, "Cameroon": { latitude: 7.3697, longitude: 12.3547 },
    "Chile": { latitude: -35.6751, longitude: -71.543 }, "Colombia": { latitude: 4.5709, longitude: -74.2973 }, "Costa Rica": { latitude: 9.7489, longitude: -83.7534 },
    "Croatia": { latitude: 45.1, longitude: 15.2 }, "Cuba": { latitude: 21.5218, longitude: -77.7812 }, "Cyprus": { latitude: 35.1264, longitude: 33.4299 },
    "Czech Republic": { latitude: 49.8175, longitude: 15.473 }, "Denmark": { latitude: 56.2639, longitude: 9.5018 }, "Dominican Republic": { latitude: 18.7357, longitude: -70.1627 },
    "Ecuador": { latitude: -1.8312, longitude: -78.1834 }, "Egypt": { latitude: 26.8206, longitude: 30.8025 }, "El Salvador": { latitude: 13.7942, longitude: -88.8965 },
    "Estonia": { latitude: 58.5953, longitude: 25.0136 }, "Ethiopia": { latitude: 9.145, longitude: 40.4897 }, "Finland": { latitude: 61.9241, longitude: 25.7482 },
    "Ghana": { latitude: 7.9465, longitude: -1.0232 }, "Greece": { latitude: 39.0742, longitude: 21.8243 }, "Guatemala": { latitude: 15.7835, longitude: -90.2308 },
    "Honduras": { latitude: 15.1999, longitude: -86.2419 }, "Hungary": { latitude: 47.1625, longitude: 19.5033 }, "Iceland": { latitude: 64.9631, longitude: -19.0208 },
    "Iran, Islamic Republic of": { latitude: 32.4279, longitude: 53.688 }, "Iraq": { latitude: 33.2232, longitude: 43.6793 }, "Ireland": { latitude: 53.4129, longitude: -8.2439 },
    "Israel": { latitude: 31.0461, longitude: 34.8516 }, "Jamaica": { latitude: 18.1096, longitude: -77.2975 }, "Jordan": { latitude: 30.5852, longitude: 36.2384 },
    "Kazakhstan": { latitude: 48.0196, longitude: 66.9237 }, "Kuwait": { latitude: 29.3117, longitude: 47.4818 }, "Latvia": { latitude: 56.8796, longitude: 24.6032 },
    "Lebanon": { latitude: 33.8547, longitude: 35.8623 }, "Lithuania": { latitude: 55.1694, longitude: 23.8813 }, "Madagascar": { latitude: -18.7669, longitude: 46.8691 },
    "Malaysia": { latitude: 4.2105, longitude: 101.9758 }, "Malta": { latitude: 35.9375, longitude: 14.3754 }, "Nepal": { latitude: 28.3949, longitude: 84.124 },
    "New Zealand": { latitude: -40.9006, longitude: 174.886 }, "Norway": { latitude: 60.472, longitude: 8.4689 }, "Pakistan": { latitude: 30.3753, longitude: 69.3451 },
    "Philippines": { latitude: 12.8797, longitude: 121.774 }, "Poland": { latitude: 51.9194, longitude: 19.1451 }, "Portugal": { latitude: 39.3999, longitude: -8.2245 },
    "Sweden": { latitude: 60.1282, longitude: 18.6435 }, "Switzerland": { latitude: 46.8182, longitude: 8.2275 }, "Thailand": { latitude: 15.870, longitude: 100.9925 },
    "Vietnam": { latitude: 14.0583, longitude: 108.2772 }, "United Arab Emirates": { latitude: 23.4241, longitude: 53.8478 }, "Taiwan": { latitude: 23.6978, longitude: 120.9605 },
    "Turkey": { latitude: 38.9637, longitude: 35.2433 }, "Ukraine": { latitude: 48.3794, longitude: 31.1656 }, "Sri Lanka": { latitude: 7.8731, longitude: 80.7718 }
  };

  if (loading && !stats.total) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error" variant="h6">
          {error}
        </Typography>
        <Typography variant="body1" mt={2}>
          Please try refreshing the page or contact your administrator.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom fontWeight="600">
          Security Dashboard
        </Typography>
        <TimeRangeSelector
          value={timeRange}
          onChange={setTimeRange}
          disabled={loading}
        />
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card
            raised
            sx={{
              height: '100%',
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              color: 'white',
              cursor: 'pointer',
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.02)',
                boxShadow: '0 8px 20px rgba(33, 150, 243, 0.3)'
              }
            }}
            onClick={navigateToAllLogs}
          >
            <CardContent sx={{
              position: 'relative',
              overflow: 'hidden',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start'
            }}>
              <StorageIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6" gutterBottom fontWeight="500">
                Total Logs
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {stats.total.toLocaleString()}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  opacity: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  position: 'absolute',
                  bottom: 16,
                  right: 16
                }}
              >

              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            raised
            sx={{
              height: '100%',
              background: 'linear-gradient(45deg, #FF5722 30%, #FF9800 90%)',
              color: 'white',
              cursor: 'pointer',
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.02)',
                boxShadow: '0 8px 20px rgba(255, 87, 34, 0.3)'
              }
            }}
            onClick={navigateToMajorLogs}
          >
            <CardContent sx={{
              position: 'relative',
              overflow: 'hidden',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start'
            }}>
              <WarningIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6" gutterBottom fontWeight="500">
                Major Events
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {stats.major.toLocaleString()}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  opacity: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  position: 'absolute',
                  bottom: 16,
                  right: 16
                }}
              >

              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            raised
            sx={{
              height: '100%',
              background: 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)',
              color: 'white',
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.02)',
                boxShadow: '0 8px 20px rgba(76, 175, 80, 0.3)'
              }
            }}
          >
            <CardContent sx={{
              position: 'relative',
              overflow: 'hidden',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start'
            }}>
              <SecurityIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6" gutterBottom fontWeight="500">
                Normal Events
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {stats.normal.toLocaleString()}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  opacity: 0.8
                }}
              >
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* World Map */}
      <Paper
        elevation={3}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <SecurityIcon sx={{ mr: 1 }} />
          Global Threat Map
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {connectionLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height={400}>
            <CircularProgress />
          </Box>
        ) : connectionData.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" flexDirection="column" height={400}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No connection data available
            </Typography>
            <Typography variant="body2" color="textSecondary" align="center" maxWidth={600} mb={2}>
              There is no traffic data for the selected time period or the countries are not recognized.
            </Typography>
          </Box>
        ) : (
          <WorldConnection connectionData={connectionData} height={500} title="Global Threat Map" />
        )}
      </Paper>

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{
            p: 3,
            height: '100%',
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden',
            '&:hover': {
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
              '& .fullscreen-icon': {
                opacity: 1
              }
            },
            transition: 'box-shadow 0.3s ease'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <DonutLargeIcon sx={{ mr: 1 }} />
                Rule Level Distribution
              </Typography>
              <Tooltip title="View Fullscreen">
                <IconButton
                  size="small"
                  onClick={() => openFullscreen(getRuleLevelChartOption(), 'Rule Level Distribution')}
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
            <Divider sx={{ mb: 3 }} />
            <Box sx={{ height: 300 }}>
              <ReactECharts
                option={getRuleLevelChartOption()}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
                theme={theme.palette.mode === 'dark' ? 'dark' : ''}
                notMerge={true}
                lazyUpdate={true}
              />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{
            p: 3,
            height: '100%',
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden',
            '&:hover': {
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
              '& .fullscreen-icon': {
                opacity: 1
              }
            },
            transition: 'box-shadow 0.3s ease'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <TimelineIcon sx={{ mr: 1 }} />
                Daily Log Activity
              </Typography>
              <Tooltip title="View Fullscreen">
                <IconButton
                  size="small"
                  onClick={() => openFullscreen(getDailyLogsChartOption(), 'Daily Log Activity')}
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
            <Divider sx={{ mb: 3 }} />
            <Box sx={{ height: 300 }}>
              <ReactECharts
                option={getDailyLogsChartOption()}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
                theme={theme.palette.mode === 'dark' ? 'dark' : ''}
                notMerge={true}
                lazyUpdate={true}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Wazuh Section */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <ComputerIcon sx={{ mr: 1 }} />
          Cybersentinel Agent Management
        </Typography>

        {/* Wazuh Metrics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={3}>
            <Card
              raised
              sx={{
                height: '100%',
                background: 'linear-gradient(45deg, #9C27B0 30%, #E91E63 90%)',
                color: 'white',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.02)',
                  boxShadow: '0 8px 20px rgba(156, 39, 176, 0.3)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <PersonIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h6" gutterBottom fontWeight="500">
                  Total Agents
                </Typography>
                <Typography variant="h3" fontWeight="bold">
                  {wazuhLoading ? '...' : (wazuhData.totalAgents ?? 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card
              raised
              sx={{
                height: '100%',
                background: 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)',
                color: 'white',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.02)',
                  boxShadow: '0 8px 20px rgba(76, 175, 80, 0.3)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <NetworkCheckIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h6" gutterBottom fontWeight="500">
                  Active Agents
                </Typography>
                <Typography variant="h3" fontWeight="bold">
                  {wazuhLoading ? '...' : (wazuhData.activeAgents?.length ?? 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card
              raised
              sx={{
                height: '100%',
                background: 'linear-gradient(45deg, #FF9800 30%, #FFC107 90%)',
                color: 'white',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.02)',
                  boxShadow: '0 8px 20px rgba(255, 152, 0, 0.3)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <WarningIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h6" gutterBottom fontWeight="500">
                  Disconnected
                </Typography>
                <Typography variant="h3" fontWeight="bold">
                  {wazuhLoading ? '...' : (wazuhData.disconnectedAgents?.length ?? 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card
              raised
              sx={{
                height: '100%',
                background: 'linear-gradient(45deg, #F44336 30%, #E91E63 90%)',
                color: 'white',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.02)',
                  boxShadow: '0 8px 20px rgba(244, 67, 54, 0.3)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <SecurityIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h6" gutterBottom fontWeight="500">
                  Never Connected
                </Typography>
                <Typography variant="h3" fontWeight="bold">
                  {wazuhLoading ? '...' : (wazuhData.neverConnectedAgents?.length ?? 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Paper
              elevation={8}
              sx={{
                p: 4,
                borderRadius: 3,
                background: theme.palette.mode === 'dark'
                  ? 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(50,50,50,0.95) 100%)'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
                backdropFilter: 'blur(10px)',
                border: theme.palette.mode === 'dark'
                  ? '1px solid rgba(255,255,255,0.1)'
                  : '1px solid rgba(0,0,0,0.05)',
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)'
                  : '0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.8)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                  zIndex: 1
                }
              }}
            >
              {/* Header Section */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                mb: 4,
                position: 'relative',
                zIndex: 2
              }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1.5,
                  borderRadius: 2,
                  background: theme.palette.mode === 'dark'
                    ? 'rgba(102, 126, 234, 0.15)'
                    : 'rgba(102, 126, 234, 0.08)',
                  mr: 2
                }}>
                  <RouterIcon sx={{
                    fontSize: 28,
                    color: '#667eea',
                    filter: 'drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3))'
                  }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="h5"
                    fontWeight="700"
                    sx={{
                      background: theme.palette.mode === 'dark'
                        ? 'linear-gradient(45deg, #ffffff 0%, #e0e7ff 100%)'
                        : 'linear-gradient(45deg, #1a202c 0%, #2d3748 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 0.5
                    }}
                  >
                    Network Devices
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                      fontWeight: 500
                    }}
                  >
                    {deviceData.totalDevices} devices configured • Live monitoring
                  </Typography>
                </Box>

                {/* Status indicator */}
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  background: theme.palette.mode === 'dark'
                    ? 'rgba(76, 175, 80, 0.15)'
                    : 'rgba(76, 175, 80, 0.08)',
                  border: theme.palette.mode === 'dark'
                    ? '1px solid rgba(76, 175, 80, 0.3)'
                    : '1px solid rgba(76, 175, 80, 0.2)'
                }}>
                  <Box sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#4CAF50',
                    mr: 1,
                    boxShadow: '0 0 8px rgba(76, 175, 80, 0.6)',
                    animation: 'pulse 2s infinite'
                  }} />
                  <Typography variant="caption" fontWeight="600" color="#4CAF50">
                    ACTIVE
                  </Typography>
                </Box>
              </Box>

              {deviceError ? (
                <Box sx={{
                  textAlign: 'center',
                  py: 6,
                  borderRadius: 2,
                  background: theme.palette.mode === 'dark'
                    ? 'rgba(244, 67, 54, 0.1)'
                    : 'rgba(244, 67, 54, 0.05)',
                  border: theme.palette.mode === 'dark'
                    ? '1px dashed rgba(244, 67, 54, 0.3)'
                    : '1px dashed rgba(244, 67, 54, 0.2)'
                }}>
                  <Typography color="error" variant="h6" fontWeight="600">
                    Unable to load devices
                  </Typography>
                  <Typography color="error" variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                    {deviceError}
                  </Typography>
                </Box>
              ) : (
                <Box>
                  {/* Device Grid */}
                  <Grid container spacing={2.5}>
                    {deviceLoading ? (
                      // Enhanced loading skeleton
                      Array.from({ length: 10 }).map((_, index) => (
                        <Grid item xs={12} sm={6} md={4} lg={2.4} xl={2.4} key={index}>
                          <Card sx={{
                            p: 2.5,
                            minHeight: 90,
                            display: 'flex',
                            alignItems: 'center',
                            background: theme.palette.mode === 'dark'
                              ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
                              : 'linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 100%)',
                            borderRadius: 2,
                            border: theme.palette.mode === 'dark'
                              ? '1px solid rgba(255,255,255,0.1)'
                              : '1px solid rgba(0,0,0,0.08)',
                            position: 'relative',
                            overflow: 'hidden',
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: '-100%',
                              width: '100%',
                              height: '100%',
                              background: `linear-gradient(90deg, transparent, ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                }, transparent)`,
                              animation: 'shimmer 1.5s infinite'
                            }
                          }}>
                            <Box sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                              mr: 2
                            }} />
                            <RouterIcon sx={{
                              fontSize: 20,
                              color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                              mr: 1.5
                            }} />
                            <Box sx={{
                              height: 18,
                              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              borderRadius: 1,
                              flex: 1
                            }} />
                          </Card>
                        </Grid>
                      ))
                    ) : deviceData.devices.length === 0 ? (
                      <Grid item xs={12}>
                        <Box sx={{
                          textAlign: 'center',
                          py: 8,
                          borderRadius: 3,
                          background: theme.palette.mode === 'dark'
                            ? 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 100%)'
                            : 'linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 100%)',
                          border: theme.palette.mode === 'dark'
                            ? '2px dashed rgba(255,255,255,0.1)'
                            : '2px dashed rgba(0,0,0,0.1)'
                        }}>
                          <RouterIcon sx={{
                            fontSize: 48,
                            color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                            mb: 2
                          }} />
                          <Typography
                            variant="h6"
                            color="textSecondary"
                            fontWeight="600"
                            sx={{ mb: 1 }}
                          >
                            No devices configured
                          </Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ opacity: 0.7 }}>
                            Add devices to your network configuration to see them here
                          </Typography>
                        </Box>
                      </Grid>
                    ) : (
                      deviceData.devices.map((device, index) => (
                        <Grid item xs={12} sm={6} md={4} lg={2.4} xl={2.4} key={index}>
                          <Card sx={{
                            p: 2.5,
                            minHeight: 90,
                            display: 'flex',
                            alignItems: 'center',
                            background: theme.palette.mode === 'dark'
                              ? 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
                              : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.8) 100%)',
                            borderRadius: 2,
                            border: theme.palette.mode === 'dark'
                              ? '1px solid rgba(255,255,255,0.15)'
                              : '1px solid rgba(0,0,0,0.08)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                            backdropFilter: 'blur(10px)',
                            '&:hover': {
                              transform: 'translateY(-4px) scale(1.02)',
                              boxShadow: theme.palette.mode === 'dark'
                                ? '0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.2)'
                                : '0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(102, 126, 234, 0.2)',
                              background: theme.palette.mode === 'dark'
                                ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.1) 100%)'
                                : 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.05) 100%)',
                              '& .device-dot': {
                                boxShadow: '0 0 12px rgba(76, 175, 80, 0.8)',
                                transform: 'scale(1.2)'
                              },
                              '& .device-icon': {
                                color: '#667eea',
                                transform: 'scale(1.1)'
                              },
                              '& .device-name': {
                                color: theme.palette.mode === 'dark' ? '#ffffff' : '#1a202c'
                              }
                            },
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '2px',
                              background: 'linear-gradient(90deg, transparent, #4CAF50, transparent)',
                              opacity: 0,
                              transition: 'opacity 0.3s ease'
                            },
                            '&:hover::before': {
                              opacity: 1
                            }
                          }}>
                            {/* Enhanced green dot with pulse effect */}
                            <Box
                              className="device-dot"
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: '#4CAF50',
                                mr: 2,
                                flexShrink: 0,
                                position: 'relative',
                                boxShadow: '0 0 8px rgba(76, 175, 80, 0.6)',
                                transition: 'all 0.3s ease',
                                '&::before': {
                                  content: '""',
                                  position: 'absolute',
                                  top: -2,
                                  left: -2,
                                  right: -2,
                                  bottom: -2,
                                  borderRadius: '50%',
                                  background: 'rgba(76, 175, 80, 0.3)',
                                  animation: 'pulse 2s infinite'
                                }
                              }}
                            />

                            {/* Enhanced router icon */}
                            <RouterIcon
                              className="device-icon"
                              sx={{
                                fontSize: 22,
                                color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                                mr: 1.5,
                                flexShrink: 0,
                                transition: 'all 0.3s ease',
                                filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))'
                              }}
                            />

                            {/* Enhanced device name */}
                            <Typography
                              className="device-name"
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                                color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)',
                                transition: 'color 0.3s ease',
                                fontSize: '0.875rem',
                                letterSpacing: '0.025em'
                              }}
                              title={device.name}
                            >
                              {device.name}
                            </Typography>
                          </Card>
                        </Grid>
                      ))
                    )}
                  </Grid>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Wazuh Charts */}
        {!wazuhLoading && !wazuhError && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{
                p: 3,
                height: '100%',
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
                  '& .fullscreen-icon': {
                    opacity: 1
                  }
                },
                transition: 'box-shadow 0.3s ease'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                    <ComputerIcon sx={{ mr: 1 }} />
                    Agent Status Distribution
                  </Typography>
                  <Tooltip title="View Fullscreen">
                    <IconButton
                      size="small"
                      onClick={() => openFullscreen(getWazuhAgentStatusChartOption(), 'Agent Status Distribution')}
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
                <Divider sx={{ mb: 3 }} />
                <Box sx={{ height: 300 }}>
                  <ReactECharts
                    option={getWazuhAgentStatusChartOption()}
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'canvas' }}
                    theme={theme.palette.mode === 'dark' ? 'dark' : ''}
                    notMerge={true}
                    lazyUpdate={true}
                  />
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{
                p: 3,
                height: '100%',
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
                  '& .fullscreen-icon': {
                    opacity: 1
                  }
                },
                transition: 'box-shadow 0.3s ease'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                    <StorageIcon sx={{ mr: 1 }} />
                    Operating System Distribution
                  </Typography>
                  <Tooltip title="View Fullscreen">
                    <IconButton
                      size="small"
                      onClick={() => openFullscreen(getWazuhOSChartOption(), 'Operating System Distribution')}
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
                <Divider sx={{ mb: 3 }} />
                <Box sx={{ height: 300 }}>
                  <ReactECharts
                    option={getWazuhOSChartOption()}
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'canvas' }}
                    theme={theme.palette.mode === 'dark' ? 'dark' : ''}
                    notMerge={true}
                    lazyUpdate={true}
                  />
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Wazuh Error State */}
        {wazuhError && (
          <Paper sx={{ p: 3, mb: 3, bgcolor: 'error.light', color: 'error.contrastText' }}>
            <Typography variant="h6" gutterBottom>
              Cybersentinel Connection Error
            </Typography>
            <Typography variant="body1">
              {wazuhError}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              sx={{ mt: 2 }}
              onClick={fetchWazuhData}
            >
              Retry Connection
            </Button>
          </Paper>
        )}

        {/* Wazuh Loading State */}
        {wazuhLoading && (
          <Box display="flex" justifyContent="center" alignItems="center" height={200}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Loading Cybersentinel data...</Typography>
          </Box>
        )}
      </Box>

      {/* Agent List Table with Status Tabs */}
      <Paper sx={{ mt: 4, p: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ComputerIcon sx={{ mr: 1 }} />
          Agent List
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {wazuhLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height={200}>
            <CircularProgress />
          </Box>
        ) : wazuhData.agentNames?.length > 0 ? (
          <Box>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                <Tab label={`Active (${wazuhData.activeAgents?.length || 0})`} />
                <Tab label={`Disconnected (${wazuhData.disconnectedAgents?.length || 0})`} />
                <Tab label={`Never Connected (${wazuhData.neverConnectedAgents?.length || 0})`} />
              </Tabs>
            </Box>

            <Box sx={{ overflow: 'auto' }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>IP Address</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>OS</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {wazuhData.agentNames
                      .filter(agent => {
                        if (tabValue === 0) return agent.status === 'active';
                        if (tabValue === 1) return agent.status === 'disconnected';
                        return agent.status === 'never_connected';
                      })
                      .sort((a, b) => a.id - b.id) // Sort by ID
                      .map((agent) => (
                        <TableRow key={agent.id}>
                          <TableCell>{agent.id}</TableCell>
                          <TableCell>{agent.name}</TableCell>
                          <TableCell>{agent.ip}</TableCell>
                          <TableCell>
                            <Chip
                              label={agent.status}
                              color={
                                agent.status === 'active' ? 'success' :
                                  agent.status === 'disconnected' ? 'warning' : 'error'
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{agent.os}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>
        ) : (
          <Typography variant="body1" color="textSecondary" align="center" py={4}>
            No agent data available
          </Typography>
        )}
      </Paper>

      {/* Fullscreen Chart Dialog - Similar to ThreatHunting.js */}
      <Dialog
        open={!!fullscreenChart}
        onClose={closeFullscreen}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh',
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
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
        <DialogContent dividers>
          <Box sx={{ height: 'calc(100% - 20px)', width: '100%', p: 2 }}>
            {fullscreenChart && (
              <ReactECharts
                option={fullscreenChart}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
                theme={theme.palette.mode === 'dark' ? 'dark' : ''}
                notMerge={true}
                lazyUpdate={true}
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
    </Box>
  );
};

export default Dashboard;
