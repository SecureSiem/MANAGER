import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    Button,
    CircularProgress,
    IconButton,
    Tooltip,
    useTheme,
    Divider,
    Tabs,
    Tab,
    TextField,
    InputAdornment,
    Chip,
    Alert,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Zoom
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventIcon from '@mui/icons-material/Event';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import PublicIcon from '@mui/icons-material/Public';
import SecurityIcon from '@mui/icons-material/Security';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import HttpsIcon from '@mui/icons-material/Https';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import TimeRangeSelector from '../Common/TimeRangeSelector';
import { StructuredLogView } from './StructuredLogView';
import { getTorBrowserLogs } from '../../services/logs';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip as ChartTooltip,
    Legend,
    LineElement,
    PointElement,
    ArcElement
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

// Distinct Cyber Sentinel chart palette
const chartColors = [
    '#06B6D4', // cyan
    '#EF4444', // red
    '#22C55E', // green
    '#F59E0B', // amber
    '#8B5CF6', // violet
    '#0EA5E9', // sky blue
    '#F97316', // orange
    '#1BFD9C', // neon green
    '#b299eb', // cyber-light purple
    '#64748B', // slate gray fallback
];


ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    ChartTooltip,
    Legend,
    LineElement,
    PointElement,
    ArcElement
);

const TorBrowser = () => {
    const theme = useTheme();
    const { setPageTitle } = useOutletContext();
    const [tabValue, setTabValue] = useState(0);
    const [timeRange, setTimeRange] = useState('24h');
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const [totalRows, setTotalRows] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [fullscreenChart, setFullscreenChart] = useState(null);
    const [fullscreenTitle, setFullscreenTitle] = useState('');

    const dashboardRef = useRef(null);

    useEffect(() => {
        setPageTitle('Dark Web Monitoring - Tor Browser');
        fetchTorBrowserLogs();
    }, [timeRange]);

    useEffect(() => {
        if (tabValue === 1) {
            fetchTorBrowserLogs(page, pageSize, searchTerm);
        }
    }, [tabValue, page, pageSize]);

    const fetchTorBrowserLogs = async (currentPage = 0, limit = pageSize, search = searchTerm) => {
        try {
            setLoading(true);
            setError(null);
            const apiPage = currentPage + 1;

            const response = await getTorBrowserLogs({
                page: apiPage,
                limit,
                search,
                timeRange
            });

            if (response) {
                setLogs(response.logs || []);
                setStats(response.stats || null);
                setTotalRows(response.pagination?.total || 0);
            } else {
                setError('Invalid response from server');
            }
        } catch (error) {
            console.error('Error fetching Tor Browser logs:', error);
            setError('Failed to fetch Tor Browser logs. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    const handleRefresh = () => {
        fetchTorBrowserLogs(page, pageSize, searchTerm);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(0);
        fetchTorBrowserLogs(0, pageSize, searchTerm);
    };

    const handleViewDetails = (log) => {
        setSelectedLog(log);
    };

    const handleCloseDetails = () => {
        setSelectedLog(null);
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        fetchTorBrowserLogs(newPage, pageSize, searchTerm);
    };

    const handlePageSizeChange = (newPageSize) => {
        setPageSize(newPageSize);
        setPage(0);
        fetchTorBrowserLogs(0, newPageSize, searchTerm);
    };

    const handleDeleteSuccess = (deletedId) => {
        setLogs(prevLogs => prevLogs.filter(log => log.id !== deletedId));
    };

    const openFullscreen = (chartData, title) => {
        setFullscreenChart(chartData);
        setFullscreenTitle(title);
    };

    const closeFullscreen = () => {
        setFullscreenChart(null);
        setFullscreenTitle('');
    };

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

    const getTimeSeriesData = () => {
        if (!stats?.timeDistribution) return {
            labels: [],
            datasets: []
        };

        return {
            labels: stats.timeDistribution.map(item => {
                const date = new Date(item.date);
                return date.toLocaleTimeString();
            }),
            datasets: [
                {
                    label: 'Tor Connections',
                    data: stats.timeDistribution.map(item => item.count),
                    borderColor: chartColors[0],
                    backgroundColor: chartColors[0] + '40',
                    tension: 0.4,
                    fill: true,
                }
            ],
        };
    };

    const getDestinationIpData = () => {
        if (!stats?.byDestinationIp) return {
            labels: [],
            datasets: []
        };

        return {
            labels: stats.byDestinationIp.slice(0, 10).map(item => item.ip),
            datasets: [
                {
                    label: 'Connection Count',
                    data: stats.byDestinationIp.slice(0, 10).map(item => item.count),
                    backgroundColor: chartColors.slice(0, 10),
                    borderColor: chartColors.slice(0, 10),
                    borderWidth: 1,
                },
            ],
        };
    };


    const getProtocolDistribution = () => {
        if (!stats?.byPort) return {
            labels: [],
            datasets: []
        };

        const portLabels = stats.byPort.slice(0, 5).map(item => {
            if (item.port === '443') return 'HTTPS (443)';
            if (item.port === '80') return 'HTTP (80)';
            return `Port ${item.port}`;
        });

        return {
            labels: portLabels,
            datasets: [
                {
                    data: stats.byPort.slice(0, 5).map(item => item.count),
                    backgroundColor: chartColors.slice(0, 5),
                    borderColor: chartColors.slice(0, 5),
                    borderWidth: 1,
                },
            ],
        };
    };


    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
        },
        scales: {
            x: {
                grid: {
                    display: true,
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    display: true,
                }
            }
        }
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
            }
        }
    };

    const columns = [
        {
            field: '@timestamp',
            headerName: 'Timestamp',
            flex: 1.2,
            minWidth: 180,
            valueGetter: (params) => formatTimestamp(params.row['@timestamp']),
            renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {formatTimestamp(params.row['@timestamp'])}
                    </Typography>
                </Box>
            )
        },
        {
            field: 'agent.name',
            headerName: 'Agent',
            flex: 1,
            minWidth: 150,
            valueGetter: (params) => params.row.agent?.name || 'N/A',
            renderCell: (params) => (
                <Chip
                    icon={<SecurityIcon sx={{ fontSize: 16 }} />}
                    label={params.row.agent?.name || 'N/A'}
                    size="small"
                    color="primary"
                />
            )
        },
        {
            field: 'data.win.eventdata.sourceIp',
            headerName: 'Source IP',
            flex: 1,
            minWidth: 130,
            valueGetter: (params) => params.row.data?.win?.eventdata?.sourceIp || 'N/A',
            renderCell: (params) => (
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    {params.row.data?.win?.eventdata?.sourceIp || 'N/A'}
                </Typography>
            )
        },
        {
            field: 'data.win.eventdata.destinationIp',
            headerName: 'Destination IP',
            flex: 1,
            minWidth: 130,
            valueGetter: (params) => params.row.data?.win?.eventdata?.destinationIp || 'N/A',
            renderCell: (params) => (
                <Chip
                    icon={<PublicIcon sx={{ fontSize: 16 }} />}
                    label={params.row.data?.win?.eventdata?.destinationIp || 'N/A'}
                    size="small"
                    color="secondary"
                />
            )
        },
        {
            field: 'data.win.eventdata.destinationPort',
            headerName: 'Port',
            flex: 0.8,
            minWidth: 80,
            valueGetter: (params) => params.row.data?.win?.eventdata?.destinationPort || 'N/A',
            renderCell: (params) => {
                const port = params.row.data?.win?.eventdata?.destinationPort;
                return (
                    <Chip
                        label={port || 'N/A'}
                        size="small"
                        color={port === '443' ? 'success' : port === '80' ? 'warning' : 'default'}
                    />
                );
            }
        },
        {
            field: 'data.win.eventdata.protocol',
            headerName: 'Protocol',
            flex: 0.8,
            minWidth: 100,
            valueGetter: (params) => params.row.data?.win?.eventdata?.protocol || 'N/A',
            renderCell: (params) => (
                <Chip
                    label={params.row.data?.win?.eventdata?.protocol?.toUpperCase() || 'N/A'}
                    size="small"
                    color="secondary"
                />
            )
        },
        {
            field: 'rule.level',
            headerName: 'Risk',
            flex: 0.6,
            minWidth: 80,
            valueGetter: (params) => params.row.rule?.level || 0,
            renderCell: (params) => {
                const level = params.row.rule?.level || 0;
                let color = 'success';
                let icon = null;
                if (level >= 10) {
                    color = 'error';
                    icon = <WarningAmberIcon sx={{ fontSize: 16 }} />;
                } else if (level >= 7) {
                    color = 'warning';
                    icon = <WarningAmberIcon sx={{ fontSize: 16 }} />;
                }
                return (
                    <Chip
                        icon={icon}
                        label={`Level ${level}`}
                        size="small"
                        color={color}
                    />
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
                            handleViewDetails(params.row);
                        }}
                    >
                        <VisibilityIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )
        }
    ];

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3
            }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <TravelExploreIcon color="primary" sx={{ fontSize: 40, mr: 1.5 }} />
                        <Typography variant="h4" fontWeight={700}>
                            Dark Web Monitoring
                        </Typography>
                    </Box>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 7, maxWidth: '600px' }}
                    >
                        Monitor Dark-Web usage and anonymous network activities that may indicate policy violations or data exfiltration.
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TimeRangeSelector
                        value={timeRange}
                        onChange={setTimeRange}
                        disabled={loading}
                    />

                    <Tooltip title="Refresh Data">
                        <IconButton
                            onClick={handleRefresh}
                            disabled={loading}
                            color="primary"
                        >
                            {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Tabs */}
            <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    aria-label="tor browser tabs"
                >
                    <Tab
                        icon={<DashboardIcon />}
                        iconPosition="start"
                        label="Dashboard"
                    />
                    <Tab
                        icon={<EventIcon />}
                        iconPosition="start"
                        label="Events"
                    />
                </Tabs>
            </Paper>

            {loading && !logs.length && !stats ? (
                <Box display="flex" justifyContent="center" alignItems="center" height={400}>
                    <Box sx={{ textAlign: 'center' }}>
                        <CircularProgress size={60} sx={{ mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                            Loading Tor Browser data...
                        </Typography>
                    </Box>
                </Box>
            ) : error ? (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            ) : (
                <>
                    {/* Dashboard Tab */}
                    <Box
                        role="tabpanel"
                        hidden={tabValue !== 0}
                        ref={dashboardRef}
                    >
                        {tabValue === 0 && (
                            <>
                                {/* Summary Cards */}
                                <Grid container spacing={3} sx={{ mb: 4 }}>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card>
                                            <CardContent>
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    <VpnKeyIcon color="primary" sx={{ mr: 1 }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        Total Connections
                                                    </Typography>
                                                </Box>
                                                <Typography variant="h3" fontWeight={700}>
                                                    {stats?.total?.toLocaleString() || 0}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Active Tor Sessions
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card>
                                            <CardContent>
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    <PublicIcon color="secondary" sx={{ mr: 1 }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        Unique Destinations
                                                    </Typography>
                                                </Box>
                                                <Typography variant="h3" fontWeight={700}>
                                                    {stats?.byDestinationIp?.length || 0}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Dark Web Nodes
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card>
                                            <CardContent>
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    <SecurityIcon color="info" sx={{ mr: 1 }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        Active Agents
                                                    </Typography>
                                                </Box>
                                                <Typography variant="h3" fontWeight={700}>
                                                    {stats?.byAgent?.length || 0}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Monitored Systems
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card>
                                            <CardContent>
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    <HttpsIcon color="success" sx={{ mr: 1 }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        HTTPS Connections
                                                    </Typography>
                                                </Box>
                                                <Typography variant="h3" fontWeight={700}>
                                                    {stats?.byPort?.find(p => p.port === '443')?.count || 0}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Encrypted Traffic
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                </Grid>

                                {/* Charts */}
                                <Grid container spacing={3} sx={{ mb: 3 }}>
                                    {/* Connection Timeline */}
                                    <Grid item xs={12} lg={8}>
                                        <Card>
                                            <CardContent>
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <ScheduleIcon color="primary" sx={{ mr: 1 }} />
                                                        <Typography variant="h6" fontWeight={700}>
                                                            Connection Timeline
                                                        </Typography>
                                                    </Box>
                                                    <Tooltip title="Fullscreen">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => openFullscreen(getTimeSeriesData(), 'Connection Timeline')}
                                                        >
                                                            <FullscreenIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                                <Divider sx={{ mb: 2 }} />
                                                <Box sx={{ height: 300 }}>
                                                    <Line data={getTimeSeriesData()} options={chartOptions} />
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>

                                    {/* Protocol Distribution */}
                                    <Grid item xs={12} lg={4}>
                                        <Card>
                                            <CardContent>
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <HttpsIcon color="secondary" sx={{ mr: 1 }} />
                                                        <Typography variant="h6" fontWeight={700}>
                                                            Protocol Types
                                                        </Typography>
                                                    </Box>
                                                    <Tooltip title="Fullscreen">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => openFullscreen(getProtocolDistribution(), 'Protocol Types')}
                                                        >
                                                            <FullscreenIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                                <Divider sx={{ mb: 2 }} />
                                                <Box sx={{ height: 300 }}>
                                                    <Doughnut data={getProtocolDistribution()} options={doughnutOptions} />
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                </Grid>

                                {/* Top Destinations Chart */}
                                <Grid container spacing={3}>
                                    <Grid item xs={12}>
                                        <Card>
                                            <CardContent>
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <PublicIcon color="primary" sx={{ mr: 1 }} />
                                                        <Typography variant="h6" fontWeight={700}>
                                                            Top Dark Web Destinations
                                                        </Typography>
                                                    </Box>
                                                    <Tooltip title="Fullscreen">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => openFullscreen(getDestinationIpData(), 'Top Dark Web Destinations')}
                                                        >
                                                            <FullscreenIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                                <Divider sx={{ mb: 2 }} />
                                                <Box sx={{ height: 350 }}>
                                                    <Bar data={getDestinationIpData()} options={chartOptions} />
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                </Grid>

                                {/* Connection Details Tables */}
                                <Grid container spacing={3} sx={{ mt: 1 }}>
                                    <Grid item xs={12} md={6}>
                                        <Card>
                                            <CardContent>
                                                <Typography variant="h6" sx={{ mb: 2 }} fontWeight={700}>
                                                    Most Contacted IPs
                                                </Typography>
                                                <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
                                                    {stats?.byDestinationIp?.slice(0, 10).map((item, index) => (
                                                        <Box
                                                            key={item.ip}
                                                            sx={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                py: 1.5,
                                                                px: 2,
                                                                mb: 1,
                                                                bgcolor: 'action.hover',
                                                                borderRadius: 1,
                                                            }}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                                <Typography variant="body2" color="primary" fontWeight={700}>
                                                                    #{index + 1}
                                                                </Typography>
                                                                <Box>
                                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                                        {item.ip}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        Destination Node
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                            <Chip
                                                                label={`${item.count} conn.`}
                                                                size="small"
                                                                color="primary"
                                                            />
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <Card>
                                            <CardContent>
                                                <Typography variant="h6" sx={{ mb: 2 }} fontWeight={700}>
                                                    Port Distribution
                                                </Typography>
                                                <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
                                                    {stats?.byPort?.slice(0, 10).map((item, index) => (
                                                        <Box
                                                            key={item.port}
                                                            sx={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                py: 1.5,
                                                                px: 2,
                                                                mb: 1,
                                                                bgcolor: 'action.hover',
                                                                borderRadius: 1,
                                                            }}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                                {item.port === '443' ? (
                                                                    <HttpsIcon color="success" />
                                                                ) : (
                                                                    <PublicIcon color="primary" />
                                                                )}
                                                                <Box>
                                                                    <Typography variant="body2" fontWeight={600}>
                                                                        Port {item.port}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {item.port === '443' ? 'HTTPS Encrypted' : item.port === '80' ? 'HTTP Standard' : 'Custom Port'}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                            <Chip
                                                                label={item.count}
                                                                size="small"
                                                                color={item.port === '443' ? 'success' : 'default'}
                                                            />
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                </Grid>
                            </>
                        )}
                    </Box>

                    {/* Events Tab */}
                    <Box role="tabpanel" hidden={tabValue !== 1}>
                        {tabValue === 1 && (
                            <>
                                <Card sx={{ mb: 3, p: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <SearchIcon color="primary" sx={{ mr: 1 }} />
                                        <Typography variant="h6" fontWeight={700}>
                                            Search Connections
                                        </Typography>
                                    </Box>

                                    <form onSubmit={handleSearch}>
                                        <TextField
                                            fullWidth
                                            variant="outlined"
                                            placeholder="Search by destination IP, agent, protocol..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: loading ? (
                                                    <InputAdornment position="end">
                                                        <CircularProgress size={20} />
                                                    </InputAdornment>
                                                ) : searchTerm ? (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                setSearchTerm('');
                                                                fetchTorBrowserLogs(0, pageSize, '');
                                                            }}
                                                        >
                                                            <CloseIcon fontSize="small" />
                                                        </IconButton>
                                                    </InputAdornment>
                                                ) : null
                                            }}
                                        />
                                    </form>
                                </Card>

                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {loading ? 'Loading...' : `${totalRows.toLocaleString()} connections found`}
                                    </Typography>
                                </Box>

                                <Card>
                                    <Box sx={{ height: 'calc(100vh - 380px)', width: '100%', minHeight: 400 }}>
                                        {loading && logs.length === 0 ? (
                                            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <CircularProgress size={60} sx={{ mb: 2 }} />
                                                    <Typography variant="h6" color="text.secondary">
                                                        Loading logs...
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        ) : logs.length === 0 ? (
                                            <Box display="flex" justifyContent="center" alignItems="center" height="100%" flexDirection="column" p={3}>
                                                <TravelExploreIcon sx={{ fontSize: 80, mb: 3, color: 'text.secondary' }} />
                                                <Typography variant="h5" fontWeight={700} mb={1}>
                                                    No connections found
                                                </Typography>
                                                <Typography variant="body1" color="text.secondary" align="center" mb={3}>
                                                    Try adjusting your search or time range
                                                </Typography>
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<RefreshIcon />}
                                                    onClick={() => {
                                                        setSearchTerm('');
                                                        fetchTorBrowserLogs();
                                                    }}
                                                >
                                                    Reset Filters
                                                </Button>
                                            </Box>
                                        ) : (
                                            <DataGrid
                                                rows={logs}
                                                columns={columns}
                                                pagination
                                                paginationMode="server"
                                                rowCount={totalRows}
                                                page={page}
                                                pageSize={pageSize}
                                                onPageChange={handlePageChange}
                                                onPageSizeChange={handlePageSizeChange}
                                                rowsPerPageOptions={[25, 50, 100]}
                                                disableSelectionOnClick
                                                loading={loading}
                                                getRowId={(row) => row.id || row._id || `row-${Math.random()}`}
                                                components={{
                                                    Toolbar: GridToolbar,
                                                }}
                                                sx={{
                                                    border: 'none',
                                                    '& .MuiDataGrid-cell': {
                                                        borderBottom: 1,
                                                        borderColor: 'divider',
                                                    },
                                                    '& .MuiDataGrid-columnHeaders': {
                                                        borderBottom: 2,
                                                        borderColor: 'divider',
                                                        bgcolor: 'action.hover',
                                                    },
                                                }}
                                                onRowClick={(params) => handleViewDetails(params.row)}
                                            />
                                        )}
                                    </Box>
                                </Card>
                            </>
                        )}
                    </Box>
                </>
            )}

            {/* Log Details View */}
            {selectedLog && (
                <StructuredLogView
                    data={selectedLog}
                    onClose={handleCloseDetails}
                    open={!!selectedLog}
                    onDeleteSuccess={handleDeleteSuccess}
                />
            )}

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
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

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
                        <Typography variant="h6" fontWeight={500}>
                            {fullscreenTitle}
                        </Typography>
                        <IconButton edge="end" color="inherit" onClick={closeFullscreen}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ height: 'calc(100vh - 120px)', width: '100%', p: 2 }}>
                        {fullscreenChart && fullscreenTitle.includes('Timeline') && (
                            <Line
                                data={fullscreenChart}
                                options={{ ...chartOptions, maintainAspectRatio: false }}
                                style={{ height: '100%', width: '100%' }}
                            />
                        )}
                        {fullscreenChart && fullscreenTitle.includes('Protocol') && (
                            <Doughnut
                                data={fullscreenChart}
                                options={{ ...doughnutOptions, maintainAspectRatio: false }}
                                style={{ height: '100%', width: '100%' }}
                            />
                        )}
                        {fullscreenChart && fullscreenTitle.includes('Destinations') && (
                            <Bar
                                data={fullscreenChart}
                                options={{ ...chartOptions, maintainAspectRatio: false }}
                                style={{ height: '100%', width: '100%' }}
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

export default TorBrowser;