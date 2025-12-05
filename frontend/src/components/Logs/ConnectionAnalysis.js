// frontend/src/components/Logs/ConnectionAnalysis.js
import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
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
    Dialog,
    DialogContent,
    DialogTitle,
    DialogActions,
    useTheme,
    Divider,
    Tabs,
    Tab,
    TextField,
    InputAdornment,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    Snackbar,
    Zoom
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import PieChartIcon from '@mui/icons-material/PieChart';
import TimelineIcon from '@mui/icons-material/Timeline';
import PublicIcon from '@mui/icons-material/Public';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventIcon from '@mui/icons-material/Event';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';

// Import TimeRangeSelector component
import TimeRangeSelector from '../Common/TimeRangeSelector';
import { StructuredLogView } from './StructuredLogView';

// Import export utility
import { exportReportToPdf } from '../Reports/Export';

// Import chart libraries
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip as ChartTooltip,
    Legend,
    ArcElement,
    LineElement,
    PointElement,
    RadialLinearScale,
    Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import api from '../../services/auth';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    ChartTooltip,
    Legend,
    ArcElement,
    LineElement,
    PointElement,
    RadialLinearScale,
    Filler
);

// CSV Export utility
const exportToCSV = (logs, fileName = 'connection_logs.csv') => {
    if (!logs || logs.length === 0) {
        console.error('No logs to export');
        return false;
    }

    try {
        // Define headers for connection logs
        const headers = [
            'timestamp', 'source_country', 'destination_country', 'source_ip', 'destination_ip',
            'source_port', 'destination_port', 'protocol', 'agent_name', 'application',
            'connection_type', 'direction', 'rule_description', 'rule_level'
        ];

        // Create CSV header row
        let csv = headers.join(',') + '\n';

        // Add data rows
        logs.forEach(log => {
            const row = [
                log['@timestamp'] || '',
                log.data?.srccountry || '',
                log.data?.dstcountry || '',
                log.data?.srcip || log.network?.srcIp || '',
                log.data?.dstip || log.network?.destIp || '',
                log.data?.srcport || log.network?.srcPort || '',
                log.data?.dstport || log.network?.destPort || '',
                log.network?.protocol || log.data?.proto || '',
                log.agent?.name || '',
                log.data?.app || '',
                log.connectionType || '',
                log.data?.direction || '',
                log.rule?.description || '',
                log.rule?.level || ''
            ].map(field => `"${String(field).replace(/"/g, '""')}"`);

            csv += row.join(',') + '\n';
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

// Format date for file name
const formatDateForFileName = (date) => {
    return date.toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0];
};

const ConnectionAnalysis = () => {
    const theme = useTheme();
    const { setPageTitle } = useOutletContext();
    const [searchParams, setSearchParams] = useSearchParams();
    const [tabValue, setTabValue] = useState(0);
    const [timeRange, setTimeRange] = useState('7d');
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Server-side pagination states
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const [totalRows, setTotalRows] = useState(0);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [connectionTypeFilter, setConnectionTypeFilter] = useState('all');

    // UI states
    const [selectedLog, setSelectedLog] = useState(null);
    const [fullscreenChart, setFullscreenChart] = useState(null);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const dashboardRef = useRef(null);

    // Connection Type Mapping
    const connectionTypeLabels = {
        outgoingFromServer: { label: 'Outgoing from Server', color: '#00FF00', description: 'Traffic originating from Reserved location' },
        incomingThreat: { label: 'Incoming Threat', color: '#FF0000', description: 'Low volume incoming traffic (<20 events)' },
        incomingNormal: { label: 'Normal Incoming', color: '#0000FF', description: 'High volume incoming traffic (≥20 events)' },
        external: { label: 'External Connection', color: '#FFFF00', description: 'Traffic between external locations' }
    };

    // Chart colors
    const chartColors = {
        bar: [
            'rgba(75, 192, 192, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)',
            'rgba(255, 99, 132, 0.7)',
        ],
        pie: [
            'rgba(0, 255, 0, 0.7)',    // Outgoing from Server
            'rgba(255, 0, 0, 0.7)',    // Incoming Threat
            'rgba(0, 0, 255, 0.7)',    // Normal Incoming
            'rgba(255, 255, 0, 0.7)',  // External
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)',
        ],
        line: 'rgba(75, 192, 192, 0.7)',
        lineBackground: 'rgba(75, 192, 192, 0.2)'
    };

    useEffect(() => {
        setPageTitle('Connection Analysis');
        // Only fetch data on initial load and time range changes
        fetchConnectionLogs();
    }, [timeRange, setPageTitle]);

    // Separate effect for URL parameter handling
    useEffect(() => {
        const typeParam = searchParams.get('type');
        if (typeParam && connectionTypeLabels[typeParam]) {
            setConnectionTypeFilter(typeParam);
            // Don't fetch here, let the next useEffect handle it
        }
    }, [searchParams]);

    useEffect(() => {
        // Only fetch data when switching to Events tab (tab 1)
        if (tabValue === 1) {
            console.log('Switched to Events tab, fetching data');
            fetchConnectionLogs(page, pageSize, searchTerm, connectionTypeFilter);
        }
    }, [tabValue]);

    useEffect(() => {
        // Only fetch if we're on the Events tab and not loading
        if (tabValue === 1 && !loading) {
            console.log('Page or page size changed, refetching data');
            fetchConnectionLogs(page, pageSize, searchTerm, connectionTypeFilter);
        }
    }, [page, pageSize]);

    useEffect(() => {
        console.log('Pagination state updated:', {
            page,
            pageSize,
            totalRows,
            totalPages: Math.ceil(totalRows / pageSize),
            tabValue
        });
    }, [page, pageSize, totalRows, tabValue]);

    const fetchConnectionLogs = async (currentPage = 0, limit = pageSize, search = searchTerm, connType = connectionTypeFilter) => {
        try {
            setLoading(true);
            setError(null);

            // Convert to 1-indexed for API
            const apiPage = currentPage + 1;

            console.log(`Fetching connection logs - Frontend page: ${currentPage}, API page: ${apiPage}, limit: ${limit}`);
            console.log(`Search: "${search}", ConnectionType: "${connType}", TimeRange: "${timeRange}"`);

            const response = await api.get('/logs/connectionspage', {
                params: {
                    page: apiPage,  // Send 1-based page to API
                    limit,
                    search,
                    timeRange,
                    connectionType: connType !== 'all' ? connType : undefined
                }
            });

            if (response && response.data) {
                console.log('Response received:', {
                    logsCount: response.data.logs?.length,
                    totalRows: response.data.pagination?.total,
                    currentPage: response.data.pagination?.page,
                    totalPages: response.data.pagination?.pages
                });

                setLogs(response.data.logs || []);
                setStats(response.data.stats || null);
                setTotalRows(response.data.pagination?.total || 0);

                // Don't update page state here - let the calling function handle it
                console.log(`Successfully loaded ${response.data.logs?.length} logs, total: ${response.data.pagination?.total}`);
            } else {
                console.error('Invalid response format:', response);
                setError('Invalid response from server');
            }
        } catch (error) {
            console.error('Error fetching connection logs:', error);
            setError('Failed to fetch connection logs. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    const handleRefresh = () => {
        console.log('Refresh requested');
        // Don't reset page on refresh, just reload current page
        fetchConnectionLogs(page, pageSize, searchTerm, connectionTypeFilter);
    };

    const handleExport = () => {
        if (tabValue === 0) {
            // Export dashboard as PDF
            exportReportToPdf(dashboardRef.current, timeRange, new Date(), 'Connection Analysis');
        } else {
            // Export logs to CSV
            setExportDialogOpen(true);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        console.log('Search initiated:', searchTerm);
        setPage(0);  // Reset to first page
        fetchConnectionLogs(0, pageSize, searchTerm, connectionTypeFilter);
    };

    const handleConnectionTypeFilterChange = (newFilter) => {
        console.log('Connection type filter changed to:', newFilter);
        setConnectionTypeFilter(newFilter);
        setPage(0);  // Reset to first page
        fetchConnectionLogs(0, pageSize, searchTerm, newFilter);
    };

    const handleViewDetails = (log) => {
        setSelectedLog(log);
    };

    const handleCloseDetails = () => {
        setSelectedLog(null);
    };


    const handleDeleteSuccess = (deletedId) => {
        setLogs(prevLogs => prevLogs.filter(log => log.id !== deletedId));
    };

    const handlePageChange = (newPage) => {
        console.log(`Page change requested from ${page} to ${newPage}`);

        // Validate the new page
        if (newPage < 0 || (totalRows > 0 && newPage >= Math.ceil(totalRows / pageSize))) {
            console.log(`Page ${newPage} is out of bounds`);
            return;
        }

        // Update page state first
        setPage(newPage);

        // Then fetch new data
        fetchConnectionLogs(newPage, pageSize, searchTerm, connectionTypeFilter);
    };

    const handlePageSizeChange = (newPageSize) => {
        console.log(`Page size change from ${pageSize} to ${newPageSize}`);

        if (newPageSize !== pageSize) {
            setPageSize(newPageSize);
            setPage(0);  // Reset to first page when changing page size
            fetchConnectionLogs(0, newPageSize, searchTerm, connectionTypeFilter);
        }
    };

    const openFullscreen = (chartId) => {
        setFullscreenChart(chartId);
    };

    const closeFullscreen = () => {
        setFullscreenChart(null);
    };

    // Export current page logs
    const exportCurrentPage = () => {
        setExportDialogOpen(false);
        const success = exportToCSV(logs, `connection_logs_page_${page + 1}_${formatDateForFileName(new Date())}.csv`);
        setSnackbar({
            open: true,
            message: success ? 'Logs exported successfully' : 'Failed to export logs',
            severity: success ? 'success' : 'error'
        });
    };

    // Export all logs for current filters
    const exportAllLogs = async () => {
        setExportDialogOpen(false);
        setLoading(true);

        try {
            // Fetch all logs with current filters but larger page size
            const maxResults = Math.min(totalRows, 10000); // Limit to 10,000 to prevent memory issues

            const response = await api.get('/logs/connectionspage', {
                params: {
                    page: 1,
                    limit: maxResults,
                    search: searchTerm,
                    timeRange,
                    connectionType: connectionTypeFilter !== 'all' ? connectionTypeFilter : undefined
                }
            });

            const success = exportToCSV(
                response.data.logs || [],
                `all_connection_logs_${formatDateForFileName(new Date())}.csv`
            );

            setSnackbar({
                open: true,
                message: success
                    ? `Exported ${response.data.logs?.length || 0} logs successfully`
                    : 'Failed to export logs',
                severity: success ? 'success' : 'error'
            });
        } catch (error) {
            console.error('Error exporting all logs:', error);
            setSnackbar({
                open: true,
                message: 'Failed to export logs',
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    // Helper to get connection type color
    const getConnectionTypeColor = (type) => {
        return connectionTypeLabels[type]?.color || '#cccccc';
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

    // Chart data generators
    const getConnectionTypeData = () => {
        if (!stats?.byConnectionType) return { labels: [], datasets: [] };

        return {
            labels: stats.byConnectionType.map(item => connectionTypeLabels[item.type]?.label || item.type),
            datasets: [
                {
                    data: stats.byConnectionType.map(item => item.count),
                    backgroundColor: stats.byConnectionType.map(item => connectionTypeLabels[item.type]?.color || '#cccccc'),
                    borderColor: stats.byConnectionType.map(item => connectionTypeLabels[item.type]?.color || '#cccccc'),
                    borderWidth: 1,
                },
            ],
        };
    };

    const getTimeSeriesData = () => {
        if (!stats?.timeDistribution) return { labels: [], datasets: [] };

        return {
            labels: stats.timeDistribution.map(item => {
                const date = new Date(item.date);
                return date.toLocaleDateString();
            }),
            datasets: [
                {
                    label: 'Connection Events',
                    data: stats.timeDistribution.map(item => item.count),
                    borderColor: chartColors.line,
                    backgroundColor: chartColors.lineBackground,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: chartColors.line,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                }
            ],
        };
    };

    // Top Source Countries (where connections are coming FROM)
    const getTopSourceCountriesData = () => {
        if (!stats?.byCountry) return { labels: [], datasets: [] };

        // Filter and aggregate source countries
        const sourceCountries = {};
        stats.byCountry.forEach(item => {
            // Check if this is source country data
            const country = item.sourceCountry || item.srccountry || item.country;
            if (country && item.type !== 'destination') {
                sourceCountries[country] = (sourceCountries[country] || 0) + item.count;
            }
        });

        const sortedCountries = Object.entries(sourceCountries)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

        return {
            labels: sortedCountries.map(([country]) => country),
            datasets: [
                {
                    label: 'Connections From',
                    data: sortedCountries.map(([, count]) => count),
                    backgroundColor: 'rgba(255, 99, 132, 0.7)', // Red for threats/sources
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                },
            ],
        };
    };

    // Top Destination Countries (where connections are going TO)
    const getTopDestinationCountriesData = () => {
        if (!stats?.byCountry) return { labels: [], datasets: [] };

        // Filter and aggregate destination countries
        const destCountries = {};
        stats.byCountry.forEach(item => {
            // Check if this is destination country data
            const country = item.destinationCountry || item.dstcountry || item.country;
            if (country && item.type !== 'source') {
                destCountries[country] = (destCountries[country] || 0) + item.count;
            }
        });

        const sortedCountries = Object.entries(destCountries)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

        return {
            labels: sortedCountries.map(([country]) => country),
            datasets: [
                {
                    label: 'Connections To',
                    data: sortedCountries.map(([, count]) => count),
                    backgroundColor: 'rgba(54, 162, 235, 0.7)', // Blue for destinations
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                },
            ],
        };
    };

    const getTopAppsData = () => {
        if (!stats?.byApp) return { labels: [], datasets: [] };

        const topApps = stats.byApp.slice(0, 10);
        return {
            labels: topApps.map(app => app.name || 'Unknown'),
            datasets: [
                {
                    label: 'Application Usage',
                    data: topApps.map(app => app.count),
                    backgroundColor: chartColors.bar,
                    borderColor: chartColors.bar.map(color => color.replace('0.7', '1')),
                    borderWidth: 1,
                },
            ],
        };
    };

    // Chart options
    const getChartOptions = (title) => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: { family: theme.typography.fontFamily },
                    color: theme.palette.text.primary
                }
            },
            title: {
                display: true,
                text: title,
                font: { family: theme.typography.fontFamily, size: 16, weight: 'bold' },
                color: theme.palette.text.primary
            },
            tooltip: {
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                titleColor: theme.palette.mode === 'dark' ? '#fff' : '#000',
                bodyColor: theme.palette.mode === 'dark' ? '#fff' : '#000',
                borderColor: theme.palette.divider,
                borderWidth: 1
            }
        },
        scales: {
            x: {
                grid: { color: theme.palette.divider },
                ticks: { color: theme.palette.text.secondary }
            },
            y: {
                beginAtZero: true,
                grid: { color: theme.palette.divider },
                ticks: { color: theme.palette.text.secondary }
            }
        }
    });

    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    font: { family: theme.typography.fontFamily },
                    color: theme.palette.text.primary
                }
            },
            title: {
                display: true,
                text: 'Connection Analysis Distribution',
                font: { family: theme.typography.fontFamily, size: 16, weight: 'bold' },
                color: theme.palette.text.primary
            },
            tooltip: {
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                titleColor: theme.palette.mode === 'dark' ? '#fff' : '#000',
                bodyColor: theme.palette.mode === 'dark' ? '#fff' : '#000',
                borderColor: theme.palette.divider,
                borderWidth: 1
            }
        }
    };

    // Render chart component
    const renderChart = (chartId, chartComponent, title, icon) => (
        <Paper elevation={2} sx={{ p: 2, height: '100%', borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                    {icon}
                    <Box component="span" sx={{ ml: 1 }}>{title}</Box>
                </Typography>
                <Tooltip title="View Fullscreen">
                    <span>
                        <IconButton
                            size="small"
                            onClick={() => openFullscreen(chartId)}
                            disabled={loading}
                        >
                            <FullscreenIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ flexGrow: 1, height: 'calc(100% - 40px)', minHeight: '300px' }}>
                {chartComponent}
            </Box>
        </Paper>
    );

    // DataGrid column definitions
    const columns = [
        {
            field: 'connectionType',
            headerName: 'Type',
            width: 180,
            renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box
                        sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: getConnectionTypeColor(params.value),
                            mr: 1
                        }}
                    />
                    <Typography variant="body2" noWrap>
                        {connectionTypeLabels[params.value]?.label || params.value}
                    </Typography>
                </Box>
            )
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
            field: 'data.srccountry',
            headerName: 'Source',
            flex: 1,
            minWidth: 150,
            valueGetter: (params) => params.row.data?.srccountry || 'N/A',
            renderCell: (params) => (
                <Box>
                    <Typography variant="body2" noWrap>
                        {params.row.data?.srccountry || 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                        {params.row.data?.srcip || params.row.network?.srcIp || 'N/A'}
                        {(params.row.data?.srcport || params.row.network?.srcPort) && `:${params.row.data?.srcport || params.row.network?.srcPort}`}
                    </Typography>
                </Box>
            )
        },
        {
            field: 'data.dstcountry',
            headerName: 'Destination',
            flex: 1,
            minWidth: 150,
            valueGetter: (params) => params.row.data?.dstcountry || 'N/A',
            renderCell: (params) => (
                <Box>
                    <Typography variant="body2" noWrap>
                        {params.row.data?.dstcountry || 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                        {params.row.data?.dstip || params.row.network?.destIp || 'N/A'}
                        {(params.row.data?.dstport || params.row.network?.destPort) && `:${params.row.data?.dstport || params.row.network?.destPort}`}
                    </Typography>
                </Box>
            )
        },
        {
            field: 'data.app',
            headerName: 'Application',
            flex: 1,
            minWidth: 120,
            valueGetter: (params) => params.row.data?.app || 'N/A',
            renderCell: (params) => (
                <Typography variant="body2" noWrap>
                    {params.row.data?.app || 'N/A'}
                </Typography>
            )
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
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PublicIcon sx={{ color: 'primary.main', mr: 1.5 }} />
                        <Typography variant="h4">
                            Connection Analysis
                        </Typography>
                    </Box>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 5.5, maxWidth: '600px' }}
                    >
                        Visualize network connections, analyze traffic patterns, and identify suspicious communication channels.
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TimeRangeSelector
                        value={timeRange}
                        onChange={setTimeRange}
                        disabled={loading}
                    />

                    <Tooltip title={loading ? "Loading..." : "Refresh Data"}>
                        <span>
                            <IconButton
                                color="primary"
                                onClick={handleRefresh}
                                disabled={loading}
                                sx={{
                                    bgcolor: 'background.paper',
                                    boxShadow: 1,
                                    '&:hover': {
                                        bgcolor: theme.palette.action.hover
                                    }
                                }}
                            >
                                {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
                            </IconButton>
                        </span>
                    </Tooltip>

                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<FileDownloadIcon />}
                        onClick={handleExport}
                        disabled={loading}
                    >
                        Export {tabValue === 0 ? 'PDF' : 'CSV'}
                    </Button>
                </Box>
            </Box>

            <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    indicatorColor="primary"
                    textColor="primary"
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab
                        icon={<DashboardIcon />}
                        iconPosition="start"
                        label="Dashboard"
                        id="connection-analysis-tab-0"
                        aria-controls="connection-analysis-tabpanel-0"
                    />
                    <Tab
                        icon={<EventIcon />}
                        iconPosition="start"
                        label="Connection Events"
                        id="connection-analysis-tab-1"
                        aria-controls="connection-analysis-tabpanel-1"
                    />
                </Tabs>
            </Paper>

            {loading && !logs.length && !stats ? (
                <Box display="flex" justifyContent="center" alignItems="center" height={400}>
                    <CircularProgress />
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
                        id="connection-analysis-tabpanel-0"
                        aria-labelledby="connection-analysis-tab-0"
                        ref={dashboardRef}
                    >
                        {tabValue === 0 && (
                            <>
                                {/* Summary Cards */}
                                <Grid container spacing={3} sx={{ mb: 4 }}>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card elevation={2} sx={{ borderRadius: 2 }}>
                                            <CardContent>
                                                <Typography color="text.secondary" gutterBottom>
                                                    Total Incoming
                                                </Typography>
                                                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                                    {stats?.total?.toLocaleString() || 0}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card elevation={2} sx={{ borderRadius: 2 }}>
                                            <CardContent>
                                                <Typography color="text.secondary" gutterBottom>
                                                    Total Outgoing
                                                </Typography>
                                                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#00AA00' }}>
                                                    {stats?.byConnectionType?.find(t => t.type === 'outgoingFromServer')?.count?.toLocaleString() || 0}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card elevation={2} sx={{ borderRadius: 2 }}>
                                            <CardContent>
                                                <Typography color="text.secondary" gutterBottom>
                                                    Incoming Threats
                                                </Typography>
                                                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                                                    {stats?.byConnectionType?.find(t => t.type === 'incomingThreat')?.count?.toLocaleString() || 0}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card elevation={2} sx={{ borderRadius: 2 }}>
                                            <CardContent>
                                                <Typography color="text.secondary" gutterBottom>
                                                    External Connections
                                                </Typography>
                                                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#CCAA00' }}>
                                                    {stats?.byConnectionType?.find(t => t.type === 'external')?.count?.toLocaleString() || 0}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                </Grid>

                                {/* Charts */}
                                <Grid container spacing={3}>
                                    {/* Connection Types Distribution */}
                                    <Grid item xs={12} md={6}>
                                        {renderChart(
                                            'connectionTypes',
                                            <Doughnut data={getConnectionTypeData()} options={pieOptions} />,
                                            'Connection Analysis',
                                            <PieChartIcon color="primary" sx={{ mr: 1 }} />
                                        )}
                                    </Grid>

                                    {/* Time Trend */}
                                    <Grid item xs={12} md={6}>
                                        {renderChart(
                                            'timeTrend',
                                            <Line data={getTimeSeriesData()} options={getChartOptions('Connection Trend Over Time')} />,
                                            'Time Trend',
                                            <TimelineIcon color="info" sx={{ mr: 1 }} />
                                        )}
                                    </Grid>

                                    {/* Top Source Countries */}
                                    <Grid item xs={12} md={6}>
                                        {renderChart(
                                            'topSourceCountries',
                                            <Bar data={getTopSourceCountriesData()} options={getChartOptions('Top 10 Source Countries')} />,
                                            'Top Source Countries',
                                            <PublicIcon color="error" sx={{ mr: 1 }} />
                                        )}
                                    </Grid>

                                    {/* Top Destination Countries */}
                                    <Grid item xs={12} md={6}>
                                        {renderChart(
                                            'topDestCountries',
                                            <Bar data={getTopDestinationCountriesData()} options={getChartOptions('Top 10 Destination Countries')} />,
                                            'Top Destination Countries',
                                            <PublicIcon color="success" sx={{ mr: 1 }} />
                                        )}
                                    </Grid>
                                </Grid>
                            </>
                        )}
                    </Box>

                    {/* Connection Events Tab */}
                    <Box
                        role="tabpanel"
                        hidden={tabValue !== 1}
                        id="connection-analysis-tabpanel-1"
                        aria-labelledby="connection-analysis-tab-1"
                    >
                        {tabValue === 1 && (
                            <>
                                {/* Filter Section */}
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
                                            Connection Events Search
                                        </Typography>
                                    </Box>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={6}>
                                            <form onSubmit={handleSearch}>
                                                <TextField
                                                    fullWidth
                                                    variant="outlined"
                                                    placeholder="Search by country, IP, application, or agent..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    size="small"
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
                                                                        fetchConnectionLogs(0, pageSize, '', connectionTypeFilter);
                                                                    }}
                                                                >
                                                                    <CloseIcon fontSize="small" />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        ) : null
                                                    }}
                                                />
                                            </form>
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Connection Type</InputLabel>
                                                <Select
                                                    value={connectionTypeFilter}
                                                    onChange={(e) => handleConnectionTypeFilterChange(e.target.value)}
                                                    label="Connection Type"
                                                >
                                                    <MenuItem value="all">All Connection Types</MenuItem>
                                                    {Object.entries(connectionTypeLabels).map(([key, config]) => (
                                                        <MenuItem key={key} value={key}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <Box
                                                                    sx={{
                                                                        width: 12,
                                                                        height: 12,
                                                                        borderRadius: '50%',
                                                                        bgcolor: config.color,
                                                                        mr: 1
                                                                    }}
                                                                />
                                                                {config.label}
                                                            </Box>
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    </Grid>
                                </Paper>

                                {/* Results Summary */}
                                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {loading ? 'Loading connections...' : `${totalRows.toLocaleString()} connection events found`}
                                    </Typography>

                                    {/* Connection Type Legend */}
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        {Object.entries(connectionTypeLabels).map(([key, config]) => (
                                            <Chip
                                                key={key}
                                                label={config.label}
                                                size="small"
                                                sx={{
                                                    bgcolor: config.color,
                                                    color: key === 'outgoingFromServer' || key === 'external' ? '#000' : '#fff',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                        ))}
                                    </Box>
                                </Box>

                                {/* Data Grid */}
                                <Paper
                                    sx={{
                                        height: 'calc(100vh - 330px)',
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
                                            <PublicIcon sx={{ fontSize: 64, mb: 2, color: 'text.secondary', opacity: 0.3 }} />
                                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                                No connection events found
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" align="center">
                                                Try adjusting your search terms or time range to see more results.
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                startIcon={<RefreshIcon />}
                                                sx={{ mt: 2 }}
                                                onClick={() => {
                                                    setSearchTerm('');
                                                    setConnectionTypeFilter('all');
                                                    fetchConnectionLogs();
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
                                            onPageChange={(newPage, details) => {
                                                console.log('DataGrid onPageChange called:', { newPage, currentPage: page, details });
                                                // Only call handlePageChange if the page actually changed
                                                if (newPage !== page) {
                                                    handlePageChange(newPage);
                                                }
                                            }}
                                            onPageSizeChange={(newPageSize, details) => {
                                                console.log('DataGrid onPageSizeChange called:', { newPageSize, currentPageSize: pageSize, details });
                                                // Only call handlePageSizeChange if the page size actually changed
                                                if (newPageSize !== pageSize) {
                                                    handlePageSizeChange(newPageSize);
                                                }
                                            }}
                                            rowsPerPageOptions={[25, 50, 100]}
                                            disableSelectionOnClick
                                            loading={loading}
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
                                                '& .MuiDataGrid-footerContainer': {
                                                    borderTop: `1px solid ${theme.palette.divider}`,
                                                },
                                            }}
                                            onRowClick={(params) => handleViewDetails(params.row)}
                                        />
                                    )}
                                </Paper>
                            </>
                        )}
                    </Box>
                </>
            )}

            {/* Log Details Modal */}
            {selectedLog && (
                <StructuredLogView
                    data={selectedLog}
                    onClose={handleCloseDetails}
                    open={!!selectedLog}
                    onDeleteSuccess={handleDeleteSuccess}
                />
            )}
            {/* change by raman */}
            {/* Fullscreen Chart Dialog */}
            <Dialog
                open={!!fullscreenChart}
                onClose={closeFullscreen}
                fullScreen
                PaperProps={{
                    sx: {
                        width: '100vw',
                        height: '100vh',
                        maxWidth: '100vw',
                        maxHeight: '100vh',
                        borderRadius: 0,
                        overflow: 'hidden',
                        boxShadow: 'none',
                    }
                }}
                TransitionComponent={Zoom}
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 500 }}>
                            {fullscreenChart === 'connectionTypes' && 'Connection Analysis Distribution'}
                            {fullscreenChart === 'timeTrend' && 'Connection Trend Over Time'}
                            {fullscreenChart === 'topSourceCountries' && 'Top 10 Source Countries (Threats From)'}
                            {fullscreenChart === 'topDestCountries' && 'Top 10 Destination Countries (Connections To)'}
                            {fullscreenChart === 'topApps' && 'Top 10 Applications'}
                        </Typography>
                        <IconButton edge="end" color="inherit" onClick={closeFullscreen}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>

                <DialogContent dividers sx={{ p: 2, height: 'calc(100vh - 120px)' }}>
                    <Box sx={{ height: '100%', width: '100%' }}>
                        {fullscreenChart && (
                            <>
                                {fullscreenChart === 'connectionTypes' && (
                                    <Doughnut
                                        data={getConnectionTypeData()}
                                        options={pieOptions}
                                    />
                                )}
                                {fullscreenChart === 'timeTrend' && (
                                    <Line
                                        data={getTimeSeriesData()}
                                        options={getChartOptions('Connection Trend Over Time')}
                                    />
                                )}
                                {fullscreenChart === 'topSourceCountries' && (
                                    <Bar
                                        data={getTopSourceCountriesData()}
                                        options={getChartOptions('Top 10 Source Countries (Threats From)')}
                                    />
                                )}
                                {fullscreenChart === 'topDestCountries' && (
                                    <Bar
                                        data={getTopDestinationCountriesData()}
                                        options={getChartOptions('Top 10 Destination Countries (Connections To)')}
                                    />
                                )}
                                {fullscreenChart === 'topApps' && (
                                    <Bar
                                        data={getTopAppsData()}
                                        options={getChartOptions('Top 10 Applications')}
                                    />
                                )}
                            </>
                        )}
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={closeFullscreen} startIcon={<FullscreenExitIcon />}>
                        Exit Fullscreen
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Export Dialog */}
            <Dialog
                open={exportDialogOpen}
                onClose={() => setExportDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Export Connection Logs to CSV
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
                        >
                            Export Current Page ({logs.length} events)
                        </Button>

                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<DownloadIcon />}
                            onClick={exportAllLogs}
                            fullWidth
                            disabled={totalRows > 10000}
                        >
                            Export All Connection Events ({totalRows.toLocaleString()} events)
                        </Button>

                        {totalRows > 10000 && (
                            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                                Too many events to export at once (maximum 10,000). Please refine your search filters.
                            </Typography>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
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

export default ConnectionAnalysis;