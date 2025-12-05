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
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Alert,
    Chip,
    LinearProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Tooltip
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DescriptionIcon from '@mui/icons-material/Description';
import EmailIcon from '@mui/icons-material/Email';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import InfoIcon from '@mui/icons-material/Info';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useTheme } from '@mui/material/styles';

const DlpMonitoring = () => {
    const { setPageTitle } = useOutletContext();
    const theme = useTheme();

    // Simulated real-time statistics
    const [stats, setStats] = useState({
        totalScans: 15847,
        blockedTransfers: 342,
        suspiciousActivities: 89,
        policiesActive: 24
    });

    const [recentIncidents, setRecentIncidents] = useState([
        { id: 1, time: '2 min ago', type: 'PII Detected', severity: 'high', user: 'john.doe@company.com', action: 'Blocked' },
        { id: 2, time: '8 min ago', type: 'Credit Card Info', severity: 'critical', user: 'sarah.smith@company.com', action: 'Blocked' },
        { id: 3, time: '15 min ago', type: 'Confidential Document', severity: 'high', user: 'mike.johnson@company.com', action: 'Alerted' },
        { id: 4, time: '23 min ago', type: 'Source Code', severity: 'medium', user: 'dev.team@company.com', action: 'Logged' },
        { id: 5, time: '31 min ago', type: 'Financial Data', severity: 'high', user: 'finance@company.com', action: 'Blocked' }
    ]);

    useEffect(() => {
        setPageTitle('Data Loss Prevention');

        // Simulate real-time updates
        const interval = setInterval(() => {
            setStats(prev => ({
                totalScans: prev.totalScans + Math.floor(Math.random() * 5),
                blockedTransfers: prev.blockedTransfers + (Math.random() > 0.7 ? 1 : 0),
                suspiciousActivities: prev.suspiciousActivities + (Math.random() > 0.8 ? 1 : 0),
                policiesActive: prev.policiesActive
            }));
        }, 3000);

        return () => clearInterval(interval);
    }, [setPageTitle]);

    const dlpCapabilities = [
        {
            icon: <DescriptionIcon color="primary" />,
            title: 'Document Classification',
            description: 'Automatically identifies and classifies sensitive documents based on content, metadata, and context.'
        },
        {
            icon: <FingerprintIcon color="success" />,
            title: 'Pattern Recognition',
            description: 'Detects PII, PHI, PCI, credit card numbers, social security numbers, and other sensitive data patterns.'
        },
        {
            icon: <EmailIcon color="info" />,
            title: 'Communication Monitoring',
            description: 'Monitors email, messaging, and file transfers for policy violations and unauthorized data exfiltration.'
        },
        {
            icon: <CloudUploadIcon color="warning" />,
            title: 'Cloud & Endpoint Protection',
            description: 'Protects data across cloud applications, endpoints, and network perimeters with unified policies.'
        }
    ];

    const detectionTypes = {
        patterns: [
            { name: 'Credit Card Numbers (PCI DSS)', pattern: 'Visa, MasterCard, Amex patterns', enabled: true },
            { name: 'Social Security Numbers', pattern: 'XXX-XX-XXXX format', enabled: true },
            { name: 'Email Addresses', pattern: 'RFC 5322 compliant', enabled: true },
            { name: 'IP Addresses (Internal)', pattern: '10.x.x.x, 192.168.x.x', enabled: true },
            { name: 'API Keys & Tokens', pattern: 'AWS, Azure, GitHub patterns', enabled: true },
            { name: 'Phone Numbers', pattern: 'International formats', enabled: false }
        ],
        classifications: [
            { name: 'Confidential Documents', description: 'Board documents, M&A files, strategic plans', risk: 'Critical' },
            { name: 'Financial Records', description: 'Budgets, forecasts, tax documents', risk: 'High' },
            { name: 'Customer Data (PII)', description: 'Names, addresses, contact information', risk: 'High' },
            { name: 'Health Records (PHI)', description: 'Medical records, insurance claims', risk: 'Critical' },
            { name: 'Source Code', description: 'Proprietary software and algorithms', risk: 'Medium' },
            { name: 'Legal Documents', description: 'Contracts, NDAs, agreements', risk: 'High' }
        ]
    };

    const logSources = [
        { source: 'Email Gateway', status: 'active', logs: '12.4K/day', description: 'SMTP/Exchange monitoring' },
        { source: 'Web Proxy', status: 'active', logs: '45.2K/day', description: 'HTTP/HTTPS traffic analysis' },
        { source: 'Endpoint Agents', status: 'active', logs: '8.7K/day', description: 'File operations & USB activity' },
        { source: 'Cloud Apps (SaaS)', status: 'active', logs: '23.1K/day', description: 'Office 365, Google Workspace, Slack' },
        { source: 'File Servers', status: 'active', logs: '6.3K/day', description: 'Network shares & repositories' },
        { source: 'Database Audit', status: 'maintenance', logs: '2.1K/day', description: 'SQL query monitoring' }
    ];

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical': return 'error';
            case 'high': return 'warning';
            case 'medium': return 'info';
            default: return 'default';
        }
    };

    const getRiskChipColor = (risk) => {
        switch (risk) {
            case 'Critical': return 'error';
            case 'High': return 'warning';
            case 'Medium': return 'info';
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
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: 2,
                }}
            >
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={8}>
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <ShieldIcon sx={{ fontSize: 40, mr: 2 }} />
                                <Typography variant="h4" fontWeight="500">
                                    Data Loss Prevention
                                </Typography>
                            </Box>
                            <Typography
                                variant="body2"
                                sx={{ ml: 7, maxWidth: '600px', opacity: 0.95 }}
                            >
                                Prevent sensitive data leakage by monitoring file transfers, email communications, and data access patterns.
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<AssessmentIcon />}
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
                            View Full Report
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Real-time Statistics */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'primary.main', color: 'white', height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box>
                                    <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                                        Total Scans Today
                                    </Typography>
                                    <Typography variant="h4" fontWeight="600" sx={{ mt: 1 }}>
                                        {stats.totalScans.toLocaleString()}
                                    </Typography>
                                </Box>
                                <VisibilityIcon sx={{ fontSize: 40, opacity: 0.7 }} />
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={75}
                                sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }}
                            />
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'error.main', color: 'white', height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box>
                                    <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                                        Blocked Transfers
                                    </Typography>
                                    <Typography variant="h4" fontWeight="600" sx={{ mt: 1 }}>
                                        {stats.blockedTransfers}
                                    </Typography>
                                </Box>
                                <BlockIcon sx={{ fontSize: 40, opacity: 0.7 }} />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                                <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                <Typography variant="caption">+12% from yesterday</Typography>
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
                                        Suspicious Activities
                                    </Typography>
                                    <Typography variant="h4" fontWeight="600" sx={{ mt: 1 }}>
                                        {stats.suspiciousActivities}
                                    </Typography>
                                </Box>
                                <WarningAmberIcon sx={{ fontSize: 40, opacity: 0.7 }} />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                                <Typography variant="caption">Requires investigation</Typography>
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
                                        Active Policies
                                    </Typography>
                                    <Typography variant="h4" fontWeight="600" sx={{ mt: 1 }}>
                                        {stats.policiesActive}
                                    </Typography>
                                </Box>
                                <CheckCircleIcon sx={{ fontSize: 40, opacity: 0.7 }} />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                                <Typography variant="caption">All systems operational</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Recent Incidents */}
            <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <WarningAmberIcon sx={{ mr: 1 }} color="warning" />
                    Recent DLP Incidents
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Time</TableCell>
                                <TableCell>Incident Type</TableCell>
                                <TableCell>User</TableCell>
                                <TableCell>Severity</TableCell>
                                <TableCell>Action Taken</TableCell>
                                <TableCell>Details</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {recentIncidents.map((incident) => (
                                <TableRow key={incident.id} hover>
                                    <TableCell>{incident.time}</TableCell>
                                    <TableCell>{incident.type}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            {incident.user}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={incident.severity.toUpperCase()}
                                            size="small"
                                            color={getSeverityColor(incident.severity)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={incident.action}
                                            size="small"
                                            variant="outlined"
                                            color={incident.action === 'Blocked' ? 'error' : 'info'}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title="View Details">
                                            <IconButton size="small" color="primary">
                                                <InfoIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* DLP Capabilities */}
            <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 3, fontWeight: 500 }}>
                Core DLP Capabilities
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {dlpCapabilities.map((capability, index) => (
                    <Grid item xs={12} sm={6} md={3} key={index}>
                        <Card variant="outlined" sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                                    {React.cloneElement(capability.icon, { sx: { fontSize: 48 } })}
                                </Box>
                                <Typography variant="h6" align="center" gutterBottom>
                                    {capability.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" align="center">
                                    {capability.description}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Detection Capabilities */}
            <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 3, fontWeight: 500 }}>
                Detection & Classification
            </Typography>
            <Grid container spacing={3}>
                {/* Pattern Detection */}
                <Grid item xs={12} md={6}>
                    <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <FingerprintIcon sx={{ mr: 1 }} color="primary" />
                                <Typography variant="h6">Pattern-Based Detection</Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <List disablePadding>
                                {detectionTypes.patterns.map((pattern, index) => (
                                    <React.Fragment key={index}>
                                        {index > 0 && <Divider />}
                                        <ListItem>
                                            <ListItemIcon>
                                                {pattern.enabled ? (
                                                    <CheckCircleIcon color="success" />
                                                ) : (
                                                    <BlockIcon color="disabled" />
                                                )}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={pattern.name}
                                                secondary={pattern.pattern}
                                            />
                                            <Chip
                                                label={pattern.enabled ? 'Active' : 'Disabled'}
                                                size="small"
                                                color={pattern.enabled ? 'success' : 'default'}
                                            />
                                        </ListItem>
                                    </React.Fragment>
                                ))}
                            </List>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Content Classification */}
                <Grid item xs={12} md={6}>
                    <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <DescriptionIcon sx={{ mr: 1 }} color="primary" />
                                <Typography variant="h6">Content Classification</Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <List disablePadding>
                                {detectionTypes.classifications.map((classification, index) => (
                                    <React.Fragment key={index}>
                                        {index > 0 && <Divider />}
                                        <ListItem>
                                            <ListItemIcon>
                                                <LockIcon color="action" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={classification.name}
                                                secondary={classification.description}
                                            />
                                            <Chip
                                                label={classification.risk}
                                                size="small"
                                                color={getRiskChipColor(classification.risk)}
                                            />
                                        </ListItem>
                                    </React.Fragment>
                                ))}
                            </List>
                        </AccordionDetails>
                    </Accordion>
                </Grid>
            </Grid>

            {/* Log Sources */}
            <Paper sx={{ p: 3, mt: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <AssessmentIcon sx={{ mr: 1 }} color="primary" />
                    Log Sources & Integration Points
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                    {logSources.map((source, index) => (
                        <Grid item xs={12} sm={6} md={4} key={index}>
                            <Card variant="outlined">
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="subtitle1" fontWeight="600">
                                            {source.source}
                                        </Typography>
                                        <Chip
                                            label={source.status}
                                            size="small"
                                            color={source.status === 'active' ? 'success' : 'warning'}
                                        />
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        {source.description}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Typography variant="caption" color="primary" fontWeight="600">
                                            {source.logs}
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Paper>

            {/* Information Alert */}
            <Alert severity="info" sx={{ mt: 4 }}>
                <Typography variant="body2">
                    <strong>Log Retention:</strong> DLP logs are retained for 90 days with full event details.
                    Archived logs are available for compliance reporting for up to 7 years. All sensitive data
                    patterns are hashed and tokenized before storage.
                </Typography>
            </Alert>
        </Box>
    );
};

export default DlpMonitoring;
