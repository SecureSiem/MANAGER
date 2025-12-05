// src/components/Logs/AdvancedAnalytics.js
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import { useOutletContext } from 'react-router-dom';
import {
    Box,
    Grid,
    Paper,
    Typography,
    Tabs,
    Tab,
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
    Switch,
    FormControlLabel
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import * as d3 from 'd3';
import TimeRangeSelector from '../Common/TimeRangeSelector';
import { exportReportToPdf } from '../Reports/Export';

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
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';

import SecurityIcon from '@mui/icons-material/Security';
import DnsIcon from '@mui/icons-material/Dns';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import LaptopIcon from '@mui/icons-material/Laptop';
import StorageIcon from '@mui/icons-material/Storage';


// Services
import { getAdvancedAnalytics, getEndpointAnalytics } from '../../services/logs';

// =============================================
// D3 NETWORK FLOW UTILITIES
// =============================================
const getProtocolColor = (protocol) => {
    const p = (protocol || '').toLowerCase();
    // Common protocols
    if (p === 'tcp') return '#22c55e';         // Green
    if (p === 'udp') return '#06b6d4';         // Cyan
    if (p === 'icmp' || p === 'icmpv6') return '#f97316'; // Orange

    // Routing & tunneling protocols
    if (p === 'gre') return '#ef4444';         // Red
    if (p === 'ospf') return '#eab308';        // Yellow
    if (p === 'eigrp') return '#a3e635';       // Lime
    if (p === 'ipip') return '#14b8a6';        // Teal
    if (p === 'ipv6') return '#0ea5e9';        // Sky blue

    // Security protocols
    if (p === 'esp') return '#ec4899';         // Pink
    if (p === 'ah') return '#f43f5e';          // Rose

    // Other protocols
    if (p === 'sctp') return '#8b5cf6';        // Purple
    if (p === 'igmp') return '#6366f1';        // Indigo
    if (p === 'pim') return '#a855f7';         // Fuchsia
    if (p === 'vrrp') return '#d946ef';        // Magenta

    return '#64748b';                           // Slate (unknown/other)
};

const getProtocolName = (protocol) => {
    const p = (protocol || '').toLowerCase();
    // Common protocols
    if (p === 'tcp') return 'TCP';
    if (p === 'udp') return 'UDP';
    if (p === 'icmp' || p === 'icmpv6') return 'ICMP';

    // Routing & tunneling protocols
    if (p === 'gre') return 'GRE';
    if (p === 'ospf') return 'OSPF';
    if (p === 'eigrp') return 'EIGRP';
    if (p === 'ipip') return 'IP-in-IP';
    if (p === 'ipv6') return 'IPv6';

    // Security protocols
    if (p === 'esp') return 'ESP';
    if (p === 'ah') return 'AH';

    // Other protocols
    if (p === 'sctp') return 'SCTP';
    if (p === 'igmp') return 'IGMP';
    if (p === 'pim') return 'PIM';
    if (p === 'vrrp') return 'VRRP';

    return protocol.toUpperCase();
};

const formatBytes = (bytes) => {
    if (bytes >= 1000000000) return `${(bytes / 1000000000).toFixed(2)} GB`;
    if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(2)} MB`;
    if (bytes >= 1000) return `${(bytes / 1000).toFixed(1)} KB`;
    return `${bytes} B`;
};

const formatDuration = (ms) => {
    if (!ms || ms < 0) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
};

const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch {
        return 'Invalid date';
    }
};

const AdvancedAnalytics = () => {
    const theme = useTheme();
    const { setPageTitle } = useOutletContext();
    const [tabValue, setTabValue] = useState(0);
    const [timeRange, setTimeRange] = useState('7d');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fullscreenChart, setFullscreenChart] = useState(null);
    const [fullscreenTitle, setFullscreenTitle] = useState('');
    const [analytics, setAnalytics] = useState({
        summary: {
            total: 0,
            warnings: 0,
            critical: 0,
            normal: 0
        },
        timeline: [],
        ruleLevels: [],
        ruleDescriptions: [],
        topAgents: [],
        // topProtocols: [],
        topservice: [],
        networkFlows: []
    });

    // Endpoint Analysis State
    const [selectedEndpoint, setSelectedEndpoint] = useState('');
    const [endpoints, setEndpoints] = useState([]);
    const [endpointLoading, setEndpointLoading] = useState(false);
    const [endpointData, setEndpointData] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // D3 Network Graph State
    const [protocolFilter, setProtocolFilter] = useState('all');
    const [showParticles, setShowParticles] = useState(true);
    const [selectedEdge, setSelectedEdge] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [networkData, setNetworkData] = useState({ nodes: [], links: [] });
    const [networkStats, setNetworkStats] = useState({
        totalFlows: 0,
        totalBytes: 0,
        uniqueIPs: 0,
        protocols: {}
    });
    const [isNetworkFullscreen, setIsNetworkFullscreen] = useState(false);

    // Refs for exporting and D3
    const analyticsRef = useRef(null);
    const endpointAnalyticsRef = useRef(null);
    const svgRef = useRef(null);
    const simulationRef = useRef(null);
    const tooltipRef = useRef(null);
    const fullscreenSvgRef = useRef(null);
    const fullscreenSimulationRef = useRef(null);

    // Initialize component


    // Fetch analytics data based on time range

    const fetchAnalyticsData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await getAdvancedAnalytics(timeRange);
            setAnalytics(data);

            // Set available endpoints
            if (data.topAgents && Array.isArray(data.topAgents)) {
                setEndpoints(data.topAgents.map(agent => ({ name: agent.name, count: agent.count })));
            }

            // Process network flows for D3 graph
            const flows = data.networkFlows || [];
            const filteredFlows = protocolFilter === 'all'
                ? flows
                : flows.filter(f => f.protocol.toLowerCase() === protocolFilter.toLowerCase());

            // Build nodes and links for D3
            const nodeMap = new Map();
            const links = [];
            let totalBytes = 0;
            const protocolCounts = {};

            filteredFlows.forEach((flow, idx) => {
                const {
                    source,
                    target,
                    bytesToServer,
                    bytesToClient,
                    protocol,
                    packetCount,
                    srcPort,
                    destPort,
                    srcPorts,
                    destPorts,
                    latestTimestamp,
                    earliestTimestamp,
                    duration
                } = flow;

                // Add nodes
                if (!nodeMap.has(source)) {
                    nodeMap.set(source, { id: source, label: source, connections: 0 });
                }
                if (!nodeMap.has(target)) {
                    nodeMap.set(target, { id: target, label: target, connections: 0 });
                }

                // Increment connection count
                nodeMap.get(source).connections++;
                nodeMap.get(target).connections++;

                const totalFlowBytes = bytesToServer + bytesToClient;
                totalBytes += totalFlowBytes;

                // Track protocol stats
                const proto = getProtocolName(protocol);
                protocolCounts[proto] = (protocolCounts[proto] || 0) + 1;

                // Create link (edge) with enhanced data
                if (totalFlowBytes > 0) {
                    links.push({
                        id: `link-${idx}`,
                        source,
                        target,
                        bytesToServer,
                        bytesToClient,
                        totalBytes: totalFlowBytes,
                        protocol,
                        color: getProtocolColor(protocol),
                        packetCount: packetCount || 0,
                        srcPort,
                        destPort,
                        srcPorts: srcPorts || [],
                        destPorts: destPorts || [],
                        latestTimestamp,
                        earliestTimestamp,
                        duration: duration || 0
                    });
                }
            });

            const nodes = Array.from(nodeMap.values());

            setNetworkData({ nodes, links });
            setNetworkStats({
                totalFlows: filteredFlows.length,
                totalBytes,
                uniqueIPs: nodes.length,
                protocols: protocolCounts
            });

            // Reset selected endpoint when time range changes
            setSelectedEndpoint('');
            setEndpointData(null);

        } catch (error) {
            console.error('Error fetching analytics data:', error);
            setError('Failed to load analytics data. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [timeRange, protocolFilter]); // ✅ Runs when timeRange or protocolFilter changes



    // Initialize component
    useEffect(() => {
        setPageTitle('Advance Security Analytics');
        fetchAnalyticsData();
    }, [timeRange, fetchAnalyticsData, setPageTitle]);


    // Fetch endpoint specific analytics
    const fetchEndpointData = async (endpoint) => {
        if (!endpoint) return;

        try {
            setEndpointLoading(true);
            const data = await getEndpointAnalytics(endpoint, timeRange);
            setEndpointData(data);
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

    // Handle endpoint change
    const handleEndpointChange = (event) => {
        const endpointName = event.target.value;
        setSelectedEndpoint(endpointName);
        fetchEndpointData(endpointName);
    };

    // Handle tab change
    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    // Handle refresh
    const handleRefresh = () => {
        fetchAnalyticsData();
        if (selectedEndpoint) {
            fetchEndpointData(selectedEndpoint);
        }
    };

    // ================================================
    // REUSABLE D3 SIMULATION BUILDER
    // ================================================
    const buildD3Simulation = useCallback((svgElement, simulationRefToUse, isFullscreen = false) => {
        if (!networkData.nodes.length || !svgElement) return null;

        const svg = d3.select(svgElement);
        const svgNode = svg.node();
        if (!svgNode) return null;

        // Get actual container dimensions
        const containerRect = svgNode.getBoundingClientRect();
        const width = containerRect.width;
        const height = containerRect.height;

        svg.selectAll('*').remove(); // Clear previous render

        // Create container groups
        const container = svg.append('g').attr('class', 'container');

        // Define arrow markers for each protocol
        const defs = svg.append('defs');

        ['tcp', 'udp', 'icmp', 'other'].forEach(proto => {
            defs.append('marker')
                .attr('id', `arrow-${proto}`)
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 20)
                .attr('refY', 0)
                .attr('markerWidth', 6)
                .attr('markerHeight', 6)
                .attr('orient', 'auto')
                .append('path')
                .attr('d', 'M0,-5L10,0L0,5')
                .attr('fill', getProtocolColor(proto));
        });

        // Create zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                container.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Click on background to deselect
        svg.on('click', () => {
            setSelectedEdge(null);
            setSelectedNode(null);
        });

        // Initial transform to center
        svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));

        // Create force simulation
        const simulation = d3.forceSimulation(networkData.nodes)
            .force('link', d3.forceLink(networkData.links)
                .id(d => d.id)
                .distance(150)
                .strength(0.5))
            .force('charge', d3.forceManyBody()
                .strength(-800)
                .distanceMax(400))
            .force('center', d3.forceCenter(0, 0))
            .force('collision', d3.forceCollide().radius(50));

        if (simulationRefToUse) {
            simulationRefToUse.current = simulation;
        }

        // Draw links (edges)
        const link = container.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(networkData.links)
            .enter()
            .append('line')
            .attr('stroke', d => d.color)
            .attr('stroke-width', d => Math.min(10, Math.max(2, d.totalBytes / 50000)))
            .attr('stroke-opacity', 0.6)
            .attr('marker-end', d => {
                const proto = d.protocol.toLowerCase();
                if (proto === 'tcp') return 'url(#arrow-tcp)';
                if (proto === 'udp') return 'url(#arrow-udp)';
                if (proto === 'icmp' || proto === 'icmpv6') return 'url(#arrow-icmp)';
                return 'url(#arrow-other)';
            })
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('stroke-opacity', 1)
                    .attr('stroke-width', Math.min(12, Math.max(4, d.totalBytes / 40000)));
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .attr('stroke-opacity', 0.6)
                    .attr('stroke-width', Math.min(10, Math.max(2, d.totalBytes / 50000)));
            })
            .on('click', function(event, d) {
                event.stopPropagation();
                setSelectedEdge(d);
                setSelectedNode(null);
            });

        // =============================================
        // ANIMATED PARTICLES
        // =============================================
        const particleContainer = container.append('g').attr('class', 'particles');

        if (showParticles) {
            networkData.links.forEach((linkData, linkIdx) => {
                const particleCount = Math.min(5, Math.max(1, Math.floor(linkData.totalBytes / 100000)));

                for (let i = 0; i < particleCount; i++) {
                    const particle = particleContainer.append('circle')
                        .attr('r', 3)
                        .attr('fill', linkData.color)
                        .attr('opacity', 0.8)
                        .datum({ link: linkData, index: i, count: particleCount });

                    // Animate particle along the path
                    const animateParticle = () => {
                        particle
                            .transition()
                            .duration(2000 + Math.random() * 1000)
                            .delay(i * (2000 / particleCount))
                            .ease(d3.easeLinear)
                            .attrTween('transform', () => {
                                return (t) => {
                                    const source = linkData.source;
                                    const target = linkData.target;
                                    const x = source.x + (target.x - source.x) * t;
                                    const y = source.y + (target.y - source.y) * t;
                                    return `translate(${x}, ${y})`;
                                };
                            })
                            .on('end', animateParticle); // Loop animation
                    };

                    animateParticle();
                }
            });
        }

        // Draw link labels (byte counts)
        const linkLabel = container.append('g')
            .attr('class', 'link-labels')
            .selectAll('g')
            .data(networkData.links)
            .enter()
            .append('g');

        linkLabel.append('rect')
            .attr('fill', theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)')
            .attr('stroke', d => d.color)
            .attr('stroke-width', 1.5)
            .attr('rx', 5)
            .attr('ry', 5);

        linkLabel.append('text')
            .attr('class', 'link-label-text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', theme.palette.mode === 'dark' ? '#00ffc3' : '#1976d2')
            .attr('font-size', 11)
            .attr('font-weight', 'bold')
            .text(d => formatBytes(d.totalBytes));

        // Draw nodes
        const node = container.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(networkData.nodes)
            .enter()
            .append('g')
            .call(d3.drag()
                .on('start', dragStarted)
                .on('drag', dragged)
                .on('end', dragEnded));

        // Node circles
        node.append('circle')
            .attr('r', d => Math.min(25, Math.max(12, 8 + d.connections * 2)))
            .attr('fill', theme.palette.mode === 'dark' ? '#1a1f3a' : '#fff')
            .attr('stroke', theme.palette.mode === 'dark' ? '#00ffc3' : '#2196f3')
            .attr('stroke-width', 2.5)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('stroke-width', 4)
                    .attr('r', Math.min(28, Math.max(15, 10 + d.connections * 2)));
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .attr('stroke-width', 2.5)
                    .attr('r', Math.min(25, Math.max(12, 8 + d.connections * 2)));
            })
            .on('click', function(event, d) {
                event.stopPropagation();
                setSelectedNode(d);
                setSelectedEdge(null);
            });

        // Node labels
        node.append('text')
            .attr('dx', 0)
            .attr('dy', d => Math.min(25, Math.max(12, 8 + d.connections * 2)) + 14)
            .attr('text-anchor', 'middle')
            .attr('fill', theme.palette.mode === 'dark' ? '#00ffc3' : '#000')
            .attr('font-size', 11)
            .attr('font-weight', 'bold')
            .text(d => d.label);

        // Update positions on each tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            linkLabel.attr('transform', d => {
                const x = (d.source.x + d.target.x) / 2;
                const y = (d.source.y + d.target.y) / 2;
                return `translate(${x}, ${y})`;
            });

            linkLabel.select('text').each(function(d) {
                const bbox = this.getBBox();
                d3.select(this.parentNode).select('rect')
                    .attr('x', bbox.x - 5)
                    .attr('y', bbox.y - 3)
                    .attr('width', bbox.width + 10)
                    .attr('height', bbox.height + 6);
            });

            node.attr('transform', d => `translate(${d.x}, ${d.y})`);
        });

        // Drag functions
        function dragStarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragEnded(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        // Return simulation for cleanup
        return simulation;
    }, [networkData, theme.palette.mode, showParticles]);

    // ================================================
    // D3.js FORCE SIMULATION - NORMAL VIEW
    // ================================================
    useEffect(() => {
        if (!networkData.nodes.length || loading || !svgRef.current) return;

        const simulation = buildD3Simulation(svgRef.current, simulationRef, false);

        return () => {
            if (simulation) simulation.stop();
        };
    }, [networkData, loading, theme.palette.mode, showParticles, buildD3Simulation]);

    // ================================================
    // D3.js FORCE SIMULATION - FULLSCREEN VIEW
    // ================================================
    useEffect(() => {
        if (!networkData.nodes.length || !isNetworkFullscreen) return;

        // Small delay to ensure SVG is rendered
        const timer = setTimeout(() => {
            if (fullscreenSvgRef.current) {
                const simulation = buildD3Simulation(fullscreenSvgRef.current, fullscreenSimulationRef, true);

                return () => {
                    if (simulation) simulation.stop();
                };
            }
        }, 100);

        return () => {
            clearTimeout(timer);
            if (fullscreenSimulationRef.current) {
                fullscreenSimulationRef.current.stop();
            }
        };
    }, [networkData, isNetworkFullscreen, theme.palette.mode, showParticles, buildD3Simulation]);

    // ================================================
    // D3 ZOOM CONTROLS
    // ================================================
    const handleZoomIn = () => {
        const svg = d3.select(svgRef.current);
        svg.transition().duration(300).call(
            d3.zoom().scaleBy, 1.3
        );
    };

    const handleZoomOut = () => {
        const svg = d3.select(svgRef.current);
        svg.transition().duration(300).call(
            d3.zoom().scaleBy, 0.7
        );
    };

    const handleResetZoom = () => {
        const svg = d3.select(svgRef.current);
        const svgNode = svg.node();
        if (!svgNode) return;

        const containerRect = svgNode.getBoundingClientRect();
        const width = containerRect.width;
        const height = containerRect.height;

        svg.transition().duration(500).call(
            d3.zoom().transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
        );
    };

    // Handle export
    const handleExport = () => {
        const exportRef = tabValue === 0 ? analyticsRef : endpointAnalyticsRef;

        if (exportRef.current) {
            exportReportToPdf(
                exportRef.current,
                timeRange,
                new Date(),
                tabValue === 0 ? 'Advance Security Analytics' : `Endpoint Analysis: ${selectedEndpoint}`
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

    // Fullscreen chart handling
    const openFullscreen = (chartOption, title) => {
        setFullscreenChart(chartOption);
        setFullscreenTitle(title);
    };

    const closeFullscreen = () => {
        setFullscreenChart(null);
        setFullscreenTitle('');
    };

    // Chart color and style configuration
    const chartColors = useMemo(() => ({
        // Primary colors for gradients
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
        // Severity specific colors
        severity: {
            normal: theme.palette.info.main,
            warning: theme.palette.warning.main,
            critical: theme.palette.error.main
        },
        // Text colors
        text: {
            primary: theme.palette.text.primary,
            secondary: theme.palette.text.secondary,
        },
        // Background colors
        background: {
            paper: theme.palette.background.paper,
            default: theme.palette.background.default,
        },
        // Chart color sequences
        categorical: [
            '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
            '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#5470c6'
        ],
        // Rainbow palette for treemap and sunburst
        rainbow: [
            '#d94e2a', '#ebc844', '#da621e', '#e9a448', '#ad36cc',
            '#4cb04c', '#4474d3', '#d63a69', '#339795', '#ca45be'
        ],
        // Gradient for multi-level charts
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
            // legend: showLegend ? {
            //     type: 'scroll',
            //     orient: 'horizontal',
            //     bottom: 10,
            //     textStyle: {
            //         color: theme.palette.text.secondary,
            //         fontFamily: theme.typography.fontFamily
            //     },
            //     pageIconColor: theme.palette.text.secondary,
            //     pageTextStyle: {
            //         color: theme.palette.text.secondary
            //     }
            // } : undefined,
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

    // Summary bar chart
    const getSummaryChartOption = () => {
        const summaryData = [
            { name: 'Normal Events', value: analytics.summary.normal, itemStyle: { color: chartColors.severity.normal } },
            { name: 'Warning Events', value: analytics.summary.warnings, itemStyle: { color: chartColors.severity.warning } },
            { name: 'Critical Events', value: analytics.summary.critical, itemStyle: { color: chartColors.severity.critical } }
        ];

        return {
            ...getChartBaseOptions(),
            title: {
                text: 'Event Severity Summary',
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
                    type: 'shadow'
                }
            },
            xAxis: {
                type: 'category',
                data: summaryData.map(item => item.name),
                axisTick: {
                    show: false
                }
            },
            yAxis: {
                type: 'value',
                name: 'Event Count',
                nameTextStyle: {
                    fontWeight: 'bold'
                }
            },
            series: [
                {
                    type: 'bar',
                    data: summaryData,
                    barWidth: '60%',
                    label: {
                        show: true,
                        position: 'top',
                        color: theme.palette.text.primary,
                        formatter: '{c}'
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.3)'
                        }
                    }
                }
            ],
            animationEasing: 'elasticOut',
            animationDelay: function (idx) {
                return idx * 200;
            }
        };
    };

    // Timeline chart option
    const getTimelineChartOption = () => {
        if (!analytics.timeline || analytics.timeline.length === 0) {
            return {
                ...getChartBaseOptions(),
                title: {
                    text: 'No timeline data available',
                    left: 'center',
                    textStyle: {
                        fontFamily: theme.typography.fontFamily,
                        color: theme.palette.text.secondary
                    }
                }
            };
        }

        const timeData = analytics.timeline.map(item => ({
            date: new Date(item.timestamp).toLocaleDateString(),
            total: item.total,
            warning: item.warning,
            critical: item.critical
        }));

        return {
            ...getChartBaseOptions(),
            title: {
                text: 'Security Events Timeline',
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
                    type: 'cross',
                    crossStyle: {
                        color: theme.palette.divider
                    }
                }
            },
            legend: {
                data: ['Total Security', 'Warning Security', 'Critical Security'],
                bottom: 10
            },
            xAxis: {
                type: 'category',
                data: timeData.map(item => item.date),
                axisPointer: {
                    type: 'shadow'
                }
            },
            yAxis: {
                type: 'value',
                name: 'Event Count',
                min: 0,
                nameTextStyle: {
                    fontWeight: 'bold'
                }
            },
            series: [
                {
                    name: 'Total Security',
                    type: 'line',
                    smooth: true,
                    data: timeData.map(item => item.total),
                    symbol: 'circle',
                    symbolSize: 8,
                    lineStyle: {
                        width: 3,
                        color: chartColors.info.main
                    },
                    itemStyle: {
                        color: chartColors.info.main
                    },
                    areaStyle: {
                        color: chartColors.gradient(chartColors.info.main)
                    },
                    z: 1
                },
                {
                    name: 'Warning Security',
                    type: 'bar',
                    stack: 'events',
                    data: timeData.map(item => item.warning),
                    itemStyle: {
                        color: chartColors.severity.warning
                    },
                    emphasis: {
                        focus: 'series'
                    },
                    z: 2
                },
                {
                    name: 'Critical Security',
                    type: 'bar',
                    stack: 'events',
                    data: timeData.map(item => item.critical),
                    itemStyle: {
                        color: chartColors.severity.critical
                    },
                    emphasis: {
                        focus: 'series'
                    },
                    z: 3
                }
            ],
            animationEasing: 'cubicInOut',
            animationDuration: 2000
        };
    };

    // Rule level distribution chart
    const getRuleLevelChartOption = () => {
        if (!analytics.ruleLevels || analytics.ruleLevels.length === 0) {
            return {
                ...getChartBaseOptions(),
                title: {
                    text: 'No rule level data available',
                    left: 'center',
                    textStyle: {
                        fontFamily: theme.typography.fontFamily,
                        color: theme.palette.text.secondary
                    }
                }
            };
        }

        // Group rule levels (Based on standard SIEM/Wazuh levels)
        // 0-7: Low/Informational
        // 8-11: Medium
        // 12-14: High
        // 15+: Critical
        const grouped = {
            Low: 0,
            Medium: 0,
            High: 0,
            Critical: 0
        };

        // Debug: Log the actual rule levels we're receiving
        console.log('Rule Levels Data:', analytics.ruleLevels);

        analytics.ruleLevels.forEach(({ level, count }) => {
            const lvl = parseInt(level);
            if (lvl <= 7) grouped.Low += count;
            else if (lvl <= 11) grouped.Medium += count;
            else if (lvl <= 14) grouped.High += count;
            else grouped.Critical += count; // Level 15 and above
        });

        console.log('Grouped Levels:', grouped);

        // Filter out categories with 0 values for cleaner display
        const groupData = [
            { name: 'Low (0-7)', value: grouped.Low, color: chartColors.info.main },
            { name: 'Medium (8-11)', value: grouped.Medium, color: chartColors.success.main },
            { name: 'High (12-14)', value: grouped.High, color: chartColors.severity.warning },
            { name: 'Critical (15+)', value: grouped.Critical, color: chartColors.severity.critical }
        ].filter(item => item.value > 0); // Only show categories with data

        return {
            ...getChartBaseOptions(),
            title: {
                text: 'Alert Severity Distribution',
                subtext: 'Based on SIEM Rule Levels',
                left: 'center',
                textStyle: {
                    fontFamily: theme.typography.fontFamily,
                    fontSize: 16,
                    fontWeight: 'bold',
                    color: theme.palette.text.primary
                },
                subtextStyle: {
                    fontSize: 12,
                    color: theme.palette.text.secondary
                }
            },
            tooltip: {
                trigger: 'item',
                formatter: (params) => `
                <div style="font-weight:bold; color:${params.color}">${params.name}</div>
                <div>Count: ${params.value.toLocaleString()}</div>
                <div style="font-size:11px; color:#888; margin-top:4px;">
                    ${params.name === 'Low (0-7)' ? 'Informational events' :
                      params.name === 'Medium (8-11)' ? 'Medium severity events' :
                      params.name === 'High (12-14)' ? 'High priority alerts' :
                      'Critical security incidents'}
                </div>
            `
            },
            xAxis: { type: 'value' },
            yAxis: {
                type: 'category',
                data: groupData.map(g => g.name),
                inverse: true
            },
            series: [
                {
                    name: 'Rule Severity',
                    type: 'bar',
                    data: groupData.map(g => ({
                        value: g.value,
                        itemStyle: { color: g.color }
                    })),
                    label: {
                        show: true,
                        formatter: '{c}',
                        position: 'right',
                        color: theme.palette.text.primary
                    },
                    barWidth: '60%'
                }
            ],
            animationDelay: idx => idx * 150
        };
    };


    // Rule descriptions treemap/sunburst
    const getRuleDescriptionChartOption = () => {
        if (!analytics.ruleDescriptions || analytics.ruleDescriptions.length === 0) {
            return {
                ...getChartBaseOptions(false),
                title: {
                    text: 'No rule description data available',
                    left: 'center',
                    textStyle: {
                        fontFamily: theme.typography.fontFamily,
                        color: theme.palette.text.secondary
                    }
                }
            };
        }

        // Prepare data for treemap/sunburst transition
        // Group descriptions by category
        const descriptions = analytics.ruleDescriptions;
        const categories = {};

        descriptions.forEach(desc => {
            const parts = desc.description.split(':');
            let category = 'Other';

            if (parts.length > 1) {
                category = parts[0].trim();
            }

            if (!categories[category]) {
                categories[category] = {
                    name: category,
                    value: 0,
                    children: []
                };
            }

            categories[category].value += desc.count;
            categories[category].children.push({
                name: desc.description,
                value: desc.count
            });
        });

        // Convert to array and sort by value
        const treeData = Object.values(categories)
            .sort((a, b) => b.value - a.value)
            .map((category, index) => ({
                ...category,
                // Sort children by value
                children: category.children
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 20), // Limit to prevent overloading
                itemStyle: {
                    color: chartColors.rainbow[index % chartColors.rainbow.length]
                }
            }));

        return {
            ...getChartBaseOptions(false),
            title: {
                text: 'Alert Distribution Analysis',
                left: 'center',
                textStyle: {
                    fontFamily: theme.typography.fontFamily,
                    fontSize: 16,
                    fontWeight: 'bold',
                    color: theme.palette.text.primary
                }
            },
            tooltip: {
                formatter: function (params) {
                    const name = params.data.name;
                    const value = params.data.value;
                    return `<div style="font-weight:bold">${name}</div>
            <div>Count: ${value.toLocaleString()}</div>
            <div>Percentage: ${params.percent ? params.percent.toFixed(2) : '0.00'}%</div>`;
                }
            },
            series: [
                {
                    type: 'treemap',
                    id: 'treemap',
                    animationDurationUpdate: 1000,
                    roam: false,
                    nodeClick: false,
                    breadcrumb: {
                        show: true,
                        itemStyle: {
                            color: theme.palette.background.paper,
                            borderColor: theme.palette.divider,
                            textStyle: {
                                color: theme.palette.text.primary
                            }
                        }
                    },
                    label: {
                        show: true,
                        formatter: '{b}: {c}',
                        ellipsis: true
                    },
                    upperLabel: {
                        show: true,
                        height: 30
                    },
                    itemStyle: {
                        borderColor: theme.palette.background.paper,
                        borderWidth: 2,
                        gapWidth: 2
                    },
                    levels: [
                        {
                            itemStyle: {
                                borderWidth: 3,
                                borderColor: theme.palette.background.paper,
                                gapWidth: 3
                            },
                            upperLabel: {
                                show: false
                            }
                        },
                        {
                            colorSaturation: [0.3, 0.6],
                            itemStyle: {
                                borderWidth: 2,
                                gapWidth: 2,
                                borderColorSaturation: 0.7
                            }
                        }
                    ],
                    data: treeData
                }
            ]
        };
    };

    // Top agents chart
    const getTopAgentsChartOption = () => {
        if (!analytics.topAgents || analytics.topAgents.length === 0) {
            return {
                ...getChartBaseOptions(),
                title: {
                    text: 'No agent data available',
                    left: 'center',
                    textStyle: {
                        fontFamily: theme.typography.fontFamily,
                        color: theme.palette.text.secondary
                    }
                }
            };
        }

        const agentData = analytics.topAgents
            .slice(0, 10) // Top 10
            .sort((a, b) => b.count - a.count);

        return {
            ...getChartBaseOptions(),
            title: {
                text: 'Top 10 Endpoints',
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
                    type: 'shadow'
                }
            },
            xAxis: {
                type: 'value'
            },
            yAxis: {
                type: 'category',
                data: agentData.map(agent => agent.name),
                inverse: true
            },
            series: [
                {
                    name: 'Event Count',
                    type: 'bar',
                    data: agentData.map((agent, index) => ({
                        value: agent.count,
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
                    },
                    barWidth: '60%'
                }
            ],
            animationEasing: 'elasticOut',
            animationDelay: function (idx) {
                return idx * 100;
            }
        };
    };

    // D3 Network Flow Visualization Component
    const renderD3NetworkFlow = () => {
        const isDark = theme.palette.mode === 'dark';

        return (
            <Paper
                elevation={2}
                sx={{
                    p: 2,
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: 700,
                    transition: 'box-shadow 0.3s ease',
                    '&:hover': {
                        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
                        '& .fullscreen-icon': {
                            opacity: 1
                        }
                    }
                }}
            >
                {/* Header with controls */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
                        <AccountTreeIcon color="primary" sx={{ mr: 1 }} />
                        Network Flow Graph      
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={showParticles}
                                    onChange={(e) => setShowParticles(e.target.checked)}
                                    color="primary"
                                    size="small"
                                />
                            }
                            label="Particles"
                        />
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>Protocol</InputLabel>
                            <Select value={protocolFilter} label="Protocol" onChange={e => setProtocolFilter(e.target.value)}>
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="tcp">TCP</MenuItem>
                                <MenuItem value="udp">UDP</MenuItem>
                                <MenuItem value="icmp">ICMP</MenuItem>
                            </Select>
                        </FormControl>
                        <Tooltip title="View Fullscreen">
                            <IconButton
                                size="small"
                                onClick={() => setIsNetworkFullscreen(true)}
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
                </Box>
                <Divider sx={{ mb: 2 }} />

                {/* Stats Cards */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent sx={{ py: 1.5 }}>
                                <Typography color="textSecondary" variant="caption">Total Flows</Typography>
                                <Typography variant="h6">{networkStats.totalFlows}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent sx={{ py: 1.5 }}>
                                <Typography color="textSecondary" variant="caption">Unique IPs</Typography>
                                <Typography variant="h6">{networkStats.uniqueIPs}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent sx={{ py: 1.5 }}>
                                <Typography color="textSecondary" variant="caption">Total Data</Typography>
                                <Typography variant="h6">{formatBytes(networkStats.totalBytes)}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent sx={{ py: 1.5 }}>
                                <Typography color="textSecondary" variant="caption">Protocols</Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                    {Object.entries(networkStats.protocols).map(([proto, count]) => (
                                        <Chip
                                            key={proto}
                                            label={`${proto}: ${count}`}
                                            size="small"
                                            sx={{
                                                bgcolor: getProtocolColor(proto.toLowerCase()),
                                                color: '#fff',
                                                fontWeight: 'bold',
                                                fontSize: '0.7rem'
                                            }}
                                        />
                                    ))}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Main Graph Area */}
                <Box sx={{ position: 'relative', flex: 1, minHeight: 500 }}>
                    {loading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 500 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {!loading && networkData.nodes.length === 0 && (
                        <Box sx={{ textAlign: 'center', py: 10 }}>
                            <Typography variant="h6" color="textSecondary">
                                No network flow data available for the selected time range
                            </Typography>
                        </Box>
                    )}

                    {!loading && networkData.nodes.length > 0 && (
                        <>
                            {/* Zoom Controls */}
                            <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Tooltip title="Zoom In">
                                    <IconButton onClick={handleZoomIn} sx={{ bgcolor: 'background.paper', boxShadow: 2 }}>
                                        <ZoomInIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Zoom Out">
                                    <IconButton onClick={handleZoomOut} sx={{ bgcolor: 'background.paper', boxShadow: 2 }}>
                                        <ZoomOutIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Reset View">
                                    <IconButton onClick={handleResetZoom} sx={{ bgcolor: 'background.paper', boxShadow: 2 }}>
                                        <CenterFocusStrongIcon />
                                    </IconButton>
                                </Tooltip>
                            </Box>

                            {/* SVG Canvas with Glassmorphic Style */}
                            <Box sx={{
                                width: '100%',
                                height: 500,
                                background: isDark
                                    ? 'rgba(10, 14, 39, 0.4)'
                                    : 'rgba(255, 255, 255, 0.4)',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                border: isDark
                                    ? '1px solid rgba(255, 255, 255, 0.1)'
                                    : '1px solid rgba(0, 0, 0, 0.1)',
                                borderRadius: 2,
                                overflow: 'hidden',
                                position: 'relative',
                                boxShadow: isDark
                                    ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
                                    : '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
                            }}>
                                <svg
                                    ref={svgRef}
                                    width="100%"
                                    height="100%"
                                    style={{ cursor: 'grab', display: 'block' }}
                                />
                            </Box>

                            {/* Details Card - Fixed Position with Glassmorphic Style */}
                            {(selectedEdge || selectedNode) && (
                                <Card sx={{
                                    position: 'absolute',
                                    top: 80,
                                    right: 16,
                                    width: 320,
                                    maxHeight: '60vh',
                                    overflow: 'auto',
                                    zIndex: 100,
                                    background: isDark
                                        ? 'rgba(26, 31, 58, 0.8)'
                                        : 'rgba(255, 255, 255, 0.8)',
                                    backdropFilter: 'blur(12px)',
                                    WebkitBackdropFilter: 'blur(12px)',
                                    boxShadow: isDark
                                        ? '0 8px 32px 0 rgba(0, 0, 0, 0.5)'
                                        : '0 8px 32px 0 rgba(31, 38, 135, 0.25)',
                                    border: selectedEdge
                                        ? `2px solid ${selectedEdge.color}`
                                        : `2px solid ${isDark ? '#00ffc3' : '#2196f3'}`
                                }}>
                                    <CardContent>
                                        {/* Close Button */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="h6" sx={{
                                                color: selectedEdge ? selectedEdge.color : 'primary.main',
                                                fontWeight: 'bold'
                                            }}>
                                                {selectedEdge ? `${getProtocolName(selectedEdge.protocol)} Flow` : 'IP Address'}
                                            </Typography>
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    setSelectedEdge(null);
                                                    setSelectedNode(null);
                                                }}
                                            >
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        </Box>

                                        {/* Edge Details */}
                                        {selectedEdge && (
                                            <Box sx={{ '& > *': { mb: 1.5 } }}>
                                                <Box>
                                                    <Typography variant="caption" color="textSecondary">Source IP</Typography>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {selectedEdge.source.id || selectedEdge.source}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="textSecondary">Destination IP</Typography>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {selectedEdge.target.id || selectedEdge.target}
                                                    </Typography>
                                                </Box>
                                                {selectedEdge.srcPort && (
                                                    <Box>
                                                        <Typography variant="caption" color="textSecondary">Source Port</Typography>
                                                        <Typography variant="body2" fontWeight="bold">{selectedEdge.srcPort}</Typography>
                                                    </Box>
                                                )}
                                                {selectedEdge.destPort && (
                                                    <Box>
                                                        <Typography variant="caption" color="textSecondary">Destination Port</Typography>
                                                        <Typography variant="body2" fontWeight="bold">{selectedEdge.destPort}</Typography>
                                                    </Box>
                                                )}
                                                <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5, mt: 1.5 }}>
                                                    <Typography variant="caption" color="textSecondary">Data to Server</Typography>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {formatBytes(selectedEdge.bytesToServer)}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="textSecondary">Data to Client</Typography>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {formatBytes(selectedEdge.bytesToClient)}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="textSecondary">Total Data</Typography>
                                                    <Typography variant="body1" fontWeight="bold" color={selectedEdge.color}>
                                                        {formatBytes(selectedEdge.totalBytes)}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="textSecondary">Packet Count</Typography>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {selectedEdge.packetCount?.toLocaleString() || 'N/A'}
                                                    </Typography>
                                                </Box>
                                                {selectedEdge.duration > 0 && (
                                                    <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5, mt: 1.5 }}>
                                                        <Typography variant="caption" color="textSecondary">Connection Duration</Typography>
                                                        <Typography variant="body2" fontWeight="bold">
                                                            {formatDuration(selectedEdge.duration)}
                                                        </Typography>
                                                    </Box>
                                                )}
                                                {selectedEdge.earliestTimestamp && (
                                                    <Box>
                                                        <Typography variant="caption" color="textSecondary">First Seen</Typography>
                                                        <Typography variant="body2">
                                                            {formatTimestamp(selectedEdge.earliestTimestamp)}
                                                        </Typography>
                                                    </Box>
                                                )}
                                                {selectedEdge.latestTimestamp && (
                                                    <Box>
                                                        <Typography variant="caption" color="textSecondary">Last Seen</Typography>
                                                        <Typography variant="body2">
                                                            {formatTimestamp(selectedEdge.latestTimestamp)}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Box>
                                        )}

                                        {/* Node Details */}
                                        {selectedNode && (
                                            <Box sx={{ '& > *': { mb: 1.5 } }}>
                                                <Box>
                                                    <Typography variant="caption" color="textSecondary">IP Address</Typography>
                                                    <Typography variant="body1" fontWeight="bold">
                                                        {selectedNode.id}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="textSecondary">Active Connections</Typography>
                                                    <Typography variant="h4" color="primary">
                                                        {selectedNode.connections}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </Box>
            </Paper>
        );
    };
    const getTopServicesChartOption = () => {
        if (!analytics.topServices || analytics.topServices.length === 0) {
            return {
                ...getChartBaseOptions(),
                title: {
                    text: 'No service data available',
                    left: 'center',
                    textStyle: {
                        fontFamily: theme.typography.fontFamily,
                        color: theme.palette.text.secondary
                    }
                }
            };
        }

        const serviceData = analytics.topServices
            .slice(0, 10)
            .sort((a, b) => b.count - a.count);

        return {
            ...getChartBaseOptions(),
            title: {
                text: 'Top 10 Services',
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
                    type: 'shadow'
                }
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
                data: serviceData.map(service => service.name),
                inverse: true   // So largest is on top
            },
            series: [
                {
                    name: 'Service',
                    type: 'bar',
                    data: serviceData.map((service, index) => ({
                        value: service.count,
                        itemStyle: {
                            color: chartColors.categorical[index % chartColors.categorical.length]
                        }
                    })),
                    label: {
                        show: true,
                        position: 'right',
                        formatter: '{c}',
                        color: theme.palette.text.primary
                    },
                    barWidth: '60%'
                }
            ],
            animationDelay: function (idx) {
                return idx * 100;
            }
        };
    };


    // Top protocols chart
    // const getTopProtocolsChartOption = () => {
    //     if (!analytics.topProtocols || analytics.topProtocols.length === 0) {
    //         return {
    //             ...getChartBaseOptions(),
    //             title: {
    //                 text: 'No protocol data available',
    //                 left: 'center',
    //                 textStyle: {
    //                     fontFamily: theme.typography.fontFamily,
    //                     color: theme.palette.text.secondary
    //                 }
    //             }
    //         };
    //     }

    //     const protocolData = analytics.topProtocols
    //         .slice(0, 10) // Top 10
    //         .sort((a, b) => b.count - a.count);

    //     return {
    //         ...getChartBaseOptions(),
    //         title: {
    //             text: 'Top 10 Network Protocols',
    //             left: 'center',
    //             textStyle: {
    //                 fontFamily: theme.typography.fontFamily,
    //                 fontSize: 16,
    //                 fontWeight: 'bold',
    //                 color: theme.palette.text.primary
    //             }
    //         },
    //         tooltip: {
    //             trigger: 'item',
    //             formatter: '{a} <br/>{b}: {c} ({d}%)'
    //         },
    //         series: [
    //             {
    //                 name: 'Protocol',
    //                 type: 'pie',
    //                 radius: ['40%', '75%'],
    //                 avoidLabelOverlap: false,
    //                 itemStyle: {
    //                     borderRadius: 10,
    //                     borderColor: theme.palette.background.paper,
    //                     borderWidth: 2
    //                 },
    //                 label: {
    //                     show: true,
    //                     formatter: '{b}: {c} ({d}%)',
    //                     color: theme.palette.text.primary,
    //                     fontWeight: 'bold'
    //                 },
    //                 emphasis: {
    //                     label: {
    //                         fontSize: 14,
    //                         fontWeight: 'bold'
    //                     },
    //                     itemStyle: {
    //                         shadowBlur: 10,
    //                         shadowOffsetX: 0,
    //                         shadowColor: 'rgba(0, 0, 0, 0.5)'
    //                     }
    //                 },
    //                 data: protocolData.map((protocol, index) => ({
    //                     name: protocol.name,
    //                     value: protocol.count,
    //                     itemStyle: {
    //                         color: chartColors.categorical[index % chartColors.categorical.length]
    //                     }
    //                 }))
    //             }
    //         ],
    //         animationDelay: function (idx) {
    //             return idx * 100;
    //         }
    //     };
    // };

    // ENDPOINT ANALYSIS CHARTS

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
            .slice(0, 10); // Top 10 rule groups

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
            .slice(0, 15); // Top 15 descriptions

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
                nameLocation: 'middle',
                nameGap: 30
            },
            yAxis: {
                type: 'category',
                data: descriptionsData.map(d => {
                    // Truncate long descriptions
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

    // Summary cards for dashboard metrics
    const renderSummaryCards = () => {
        return (
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card
                        elevation={2}
                        sx={{
                            borderRadius: 2,
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(66, 165, 245, 0.1)' : 'rgba(66, 165, 245, 0.1)',
                            height: '100%',
                            transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0 12px 20px -10px rgba(0, 0, 0, 0.2)'
                            }
                        }}
                    >
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box>
                                    <Typography color="textSecondary" gutterBottom variant="subtitle2">
                                        Total Security
                                    </Typography>
                                    <Typography variant="h4" color="textPrimary" sx={{ fontWeight: 'bold' }}>
                                        {analytics?.summary?.total?.toLocaleString() || 0}
                                    </Typography>
                                </Box>
                                <StorageIcon sx={{ color: theme.palette.info.main, fontSize: 40 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card
                        elevation={2}
                        sx={{
                            borderRadius: 2,
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.1)',
                            height: '100%',
                            transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0 12px 20px -10px rgba(0, 0, 0, 0.2)'
                            }
                        }}
                    >
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box>
                                    <Typography color="textSecondary" gutterBottom variant="subtitle2">
                                        Normal Security
                                    </Typography>
                                    <Typography variant="h4" color="textPrimary" sx={{ fontWeight: 'bold' }}>
                                        {analytics?.summary?.normal?.toLocaleString() || 0}
                                    </Typography>
                                </Box>
                                <InfoIcon sx={{ color: theme.palette.success.main, fontSize: 40 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card
                        elevation={2}
                        sx={{
                            borderRadius: 2,
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 152, 0, 0.1)',
                            height: '100%',
                            transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0 12px 20px -10px rgba(0, 0, 0, 0.2)'
                            }
                        }}
                    >
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box>
                                    <Typography color="textSecondary" gutterBottom variant="subtitle2">
                                        Warning Security
                                    </Typography>
                                    <Typography variant="h4" color="textPrimary" sx={{ fontWeight: 'bold' }}>
                                        {analytics?.summary?.warnings?.toLocaleString() || 0}
                                    </Typography>
                                </Box>
                                <WarningIcon sx={{ color: theme.palette.warning.main, fontSize: 40 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card
                        elevation={2}
                        sx={{
                            borderRadius: 2,
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                            height: '100%',
                            transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0 12px 20px -10px rgba(0, 0, 0, 0.2)'
                            }
                        }}
                    >
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box>
                                    <Typography color="textSecondary" gutterBottom variant="subtitle2">
                                        Critical Security
                                    </Typography>
                                    <Typography variant="h4" color="textPrimary" sx={{ fontWeight: 'bold' }}>
                                        {analytics?.summary?.critical?.toLocaleString() || 0}
                                    </Typography>
                                </Box>
                                <ErrorIcon sx={{ color: theme.palette.error.main, fontSize: 40 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        );
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                        <BarChartIcon sx={{ mr: 1.5, fontSize: 32 }} />
                        Advance Security Analytics
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 5.5, maxWidth: '600px' }}
                    >
                        Gain deep insights into your security environment with detailed visual analytics. Monitor event trends, alert levels, top endpoints, and network connections to understand system behavior and detect threats faster.
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
                    </Tooltip>

                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<DownloadIcon />}
                        onClick={handleExport}
                        disabled={loading || (tabValue === 1 && !selectedEndpoint)}
                    >
                        Export PDF
                    </Button>
                </Box>
            </Box>

            {/* <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    aria-label="analytics tabs"
                    indicatorColor="primary"
                    textColor="primary"
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab
                        icon={<BarChartIcon />}
                        iconPosition="start"
                        label="Security Overview"
                        id="tab-0"
                        aria-controls="tabpanel-0"
                    />
                    <Tab
                        icon={<LaptopIcon />}
                        iconPosition="start"
                        label="UEBA"
                        id="tab-1"
                        aria-controls="tabpanel-1"
                    />
                </Tabs>
            </Paper> */}

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

            {/* Security Overview Tab */}
            <Box
                role="tabpanel"
                hidden={tabValue !== 0}
                id="tabpanel-0"
                aria-labelledby="tab-0"
            >
                {!loading && !error && tabValue === 0 && (
                    <Box ref={analyticsRef}>
                        {/* Summary Cards */}
                        {renderSummaryCards()}

                        {/* Summary Chart & Timeline */}
                        <Grid container spacing={3} sx={{ mb: 3 }}>
                            <Grid item xs={12} md={5}>
                                {renderChart(
                                    'summaryChart',
                                    getSummaryChartOption(),
                                    'Event Severity Summary',
                                    <BarChartIcon color="primary" sx={{ mr: 1 }} />
                                )}
                            </Grid>
                            <Grid item xs={12} md={7}>
                                {renderChart(
                                    'timelineChart',
                                    getTimelineChartOption(),
                                    'Security Events Timeline',
                                    <TimelineIcon color="primary" sx={{ mr: 1 }} />
                                )}
                            </Grid>
                        </Grid>

                        {/* Rule Description Treemap */}
                        <Grid container spacing={3} sx={{ mb: 3 }}>
                            <Grid item xs={12}>
                                {renderChart(
                                    'ruleDescriptionsChart',
                                    getRuleDescriptionChartOption(),
                                    'Alert Distribution Analysis',
                                    <DonutLargeIcon color="primary" sx={{ mr: 1 }} />,
                                    500 // Taller height for this chart
                                )}
                            </Grid>
                        </Grid>

                        {/* Rule Level, Top Agents & Top Protocols */}
                        <Grid container spacing={3} sx={{ mb: 3 }}>
                            <Grid item xs={12} md={6}>
                                {renderChart(
                                    'ruleLevelChart',
                                    getRuleLevelChartOption(),
                                    'Alert Severity Distribution',
                                    <SecurityIcon color="primary" sx={{ mr: 1 }} />
                                )}
                            </Grid>
                            <Grid item xs={12} md={6}>
                                {renderChart(
                                    'topAgentsChart',
                                    getTopAgentsChartOption(),
                                    'Top 10 Endpoints',
                                    <DnsIcon color="primary" sx={{ mr: 1 }} />
                                )}
                            </Grid>
                        </Grid>

                        {/* Network Flow with D3 & Services */}
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                {renderD3NetworkFlow()}
                            </Grid>
                            <Grid item xs={12}>
                                {renderChart(
                                    'topServicesChart',
                                    getTopServicesChartOption(),
                                    'Top 10 Network Services',
                                    <DnsIcon color="primary" sx={{ mr: 1 }} />
                                )}
                            </Grid>
                        </Grid>



                    </Box>
                )}
            </Box>



            {/* changeby raman */}

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

            {/* D3 Network Graph Fullscreen Dialog */}
            <Dialog
                open={isNetworkFullscreen}
                onClose={() => setIsNetworkFullscreen(false)}
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
                        <Typography variant="h6" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                            <AccountTreeIcon sx={{ mr: 1 }} />
                            Network Flow Graph
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={showParticles}
                                        onChange={(e) => setShowParticles(e.target.checked)}
                                        color="primary"
                                        size="small"
                                    />
                                }
                                label="Particles"
                            />
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel>Protocol</InputLabel>
                                <Select value={protocolFilter} label="Protocol" onChange={e => setProtocolFilter(e.target.value)}>
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="tcp">TCP</MenuItem>
                                    <MenuItem value="udp">UDP</MenuItem>
                                    <MenuItem value="icmp">ICMP</MenuItem>
                                </Select>
                            </FormControl>
                            <IconButton edge="end" color="inherit" onClick={() => setIsNetworkFullscreen(false)}>
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ p: 2 }}>
                    <Box sx={{ height: 'calc(100vh - 180px)', width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Stats Cards in Fullscreen */}
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card>
                                    <CardContent sx={{ py: 1.5 }}>
                                        <Typography color="textSecondary" variant="caption">Total Flows</Typography>
                                        <Typography variant="h6">{networkStats.totalFlows}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card>
                                    <CardContent sx={{ py: 1.5 }}>
                                        <Typography color="textSecondary" variant="caption">Unique IPs</Typography>
                                        <Typography variant="h6">{networkStats.uniqueIPs}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card>
                                    <CardContent sx={{ py: 1.5 }}>
                                        <Typography color="textSecondary" variant="caption">Total Data</Typography>
                                        <Typography variant="h6">{formatBytes(networkStats.totalBytes)}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card>
                                    <CardContent sx={{ py: 1.5 }}>
                                        <Typography color="textSecondary" variant="caption">Protocols</Typography>
                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                            {Object.entries(networkStats.protocols).map(([proto, count]) => (
                                                <Chip
                                                    key={proto}
                                                    label={`${proto}: ${count}`}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: getProtocolColor(proto.toLowerCase()),
                                                        color: '#fff',
                                                        fontWeight: 'bold',
                                                        fontSize: '0.7rem'
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        {/* Fullscreen Graph */}
                        <Box sx={{ position: 'relative', flex: 1 }}>
                            {loading && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                    <CircularProgress />
                                </Box>
                            )}

                            {!loading && networkData.nodes.length === 0 && (
                                <Box sx={{ textAlign: 'center', py: 10 }}>
                                    <Typography variant="h6" color="textSecondary">
                                        No network flow data available for the selected time range
                                    </Typography>
                                </Box>
                            )}

                            {!loading && networkData.nodes.length > 0 && (
                                <>
                                    {/* Zoom Controls */}
                                    <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <Tooltip title="Zoom In">
                                            <IconButton
                                                onClick={() => {
                                                    const svg = d3.select(fullscreenSvgRef.current);
                                                    svg.transition().duration(300).call(d3.zoom().scaleBy, 1.3);
                                                }}
                                                sx={{ bgcolor: 'background.paper', boxShadow: 2 }}
                                            >
                                                <ZoomInIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Zoom Out">
                                            <IconButton
                                                onClick={() => {
                                                    const svg = d3.select(fullscreenSvgRef.current);
                                                    svg.transition().duration(300).call(d3.zoom().scaleBy, 0.7);
                                                }}
                                                sx={{ bgcolor: 'background.paper', boxShadow: 2 }}
                                            >
                                                <ZoomOutIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Reset View">
                                            <IconButton
                                                onClick={() => {
                                                    const svg = d3.select(fullscreenSvgRef.current);
                                                    const svgNode = svg.node();
                                                    if (!svgNode) return;
                                                    const containerRect = svgNode.getBoundingClientRect();
                                                    const width = containerRect.width;
                                                    const height = containerRect.height;
                                                    svg.transition().duration(500).call(
                                                        d3.zoom().transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
                                                    );
                                                }}
                                                sx={{ bgcolor: 'background.paper', boxShadow: 2 }}
                                            >
                                                <CenterFocusStrongIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>

                                    {/* SVG Canvas with Glassmorphic Style */}
                                    <Box sx={{
                                        width: '100%',
                                        height: '100%',
                                        background: theme.palette.mode === 'dark'
                                            ? 'rgba(10, 14, 39, 0.4)'
                                            : 'rgba(255, 255, 255, 0.4)',
                                        backdropFilter: 'blur(10px)',
                                        WebkitBackdropFilter: 'blur(10px)',
                                        border: theme.palette.mode === 'dark'
                                            ? '1px solid rgba(255, 255, 255, 0.1)'
                                            : '1px solid rgba(0, 0, 0, 0.1)',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        position: 'relative',
                                        boxShadow: theme.palette.mode === 'dark'
                                            ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
                                            : '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
                                    }}>
                                        <svg
                                            ref={fullscreenSvgRef}
                                            width="100%"
                                            height="100%"
                                            style={{ cursor: 'grab', display: 'block' }}
                                        />
                                    </Box>

                                    {/* Details Card in Fullscreen with Glassmorphic Style */}
                                    {(selectedEdge || selectedNode) && (
                                        <Card sx={{
                                            position: 'absolute',
                                            top: 80,
                                            right: 16,
                                            width: 320,
                                            maxHeight: '60vh',
                                            overflow: 'auto',
                                            zIndex: 100,
                                            background: theme.palette.mode === 'dark'
                                                ? 'rgba(26, 31, 58, 0.8)'
                                                : 'rgba(255, 255, 255, 0.8)',
                                            backdropFilter: 'blur(12px)',
                                            WebkitBackdropFilter: 'blur(12px)',
                                            boxShadow: theme.palette.mode === 'dark'
                                                ? '0 8px 32px 0 rgba(0, 0, 0, 0.5)'
                                                : '0 8px 32px 0 rgba(31, 38, 135, 0.25)',
                                            border: selectedEdge
                                                ? `2px solid ${selectedEdge.color}`
                                                : `2px solid ${theme.palette.mode === 'dark' ? '#00ffc3' : '#2196f3'}`
                                        }}>
                                            <CardContent>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                    <Typography variant="h6" sx={{
                                                        color: selectedEdge ? selectedEdge.color : 'primary.main',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {selectedEdge ? `${getProtocolName(selectedEdge.protocol)} Flow` : 'IP Address'}
                                                    </Typography>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            setSelectedEdge(null);
                                                            setSelectedNode(null);
                                                        }}
                                                    >
                                                        <CloseIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>

                                                {/* Edge Details */}
                                                {selectedEdge && (
                                                    <Box sx={{ '& > *': { mb: 1.5 } }}>
                                                        <Box>
                                                            <Typography variant="caption" color="textSecondary">Source IP</Typography>
                                                            <Typography variant="body2" fontWeight="bold">
                                                                {selectedEdge.source.id || selectedEdge.source}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="caption" color="textSecondary">Destination IP</Typography>
                                                            <Typography variant="body2" fontWeight="bold">
                                                                {selectedEdge.target.id || selectedEdge.target}
                                                            </Typography>
                                                        </Box>
                                                        {selectedEdge.srcPort && (
                                                            <Box>
                                                                <Typography variant="caption" color="textSecondary">Source Port</Typography>
                                                                <Typography variant="body2" fontWeight="bold">{selectedEdge.srcPort}</Typography>
                                                            </Box>
                                                        )}
                                                        {selectedEdge.destPort && (
                                                            <Box>
                                                                <Typography variant="caption" color="textSecondary">Destination Port</Typography>
                                                                <Typography variant="body2" fontWeight="bold">{selectedEdge.destPort}</Typography>
                                                            </Box>
                                                        )}
                                                        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5, mt: 1.5 }}>
                                                            <Typography variant="caption" color="textSecondary">Data to Server</Typography>
                                                            <Typography variant="body2" fontWeight="bold">
                                                                {formatBytes(selectedEdge.bytesToServer)}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="caption" color="textSecondary">Data to Client</Typography>
                                                            <Typography variant="body2" fontWeight="bold">
                                                                {formatBytes(selectedEdge.bytesToClient)}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="caption" color="textSecondary">Total Data</Typography>
                                                            <Typography variant="body1" fontWeight="bold" color={selectedEdge.color}>
                                                                {formatBytes(selectedEdge.totalBytes)}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="caption" color="textSecondary">Packet Count</Typography>
                                                            <Typography variant="body2" fontWeight="bold">
                                                                {selectedEdge.packetCount?.toLocaleString() || 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                        {selectedEdge.duration > 0 && (
                                                            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5, mt: 1.5 }}>
                                                                <Typography variant="caption" color="textSecondary">Connection Duration</Typography>
                                                                <Typography variant="body2" fontWeight="bold">
                                                                    {formatDuration(selectedEdge.duration)}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                        {selectedEdge.earliestTimestamp && (
                                                            <Box>
                                                                <Typography variant="caption" color="textSecondary">First Seen</Typography>
                                                                <Typography variant="body2">
                                                                    {formatTimestamp(selectedEdge.earliestTimestamp)}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                        {selectedEdge.latestTimestamp && (
                                                            <Box>
                                                                <Typography variant="caption" color="textSecondary">Last Seen</Typography>
                                                                <Typography variant="body2">
                                                                    {formatTimestamp(selectedEdge.latestTimestamp)}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                )}

                                                {/* Node Details */}
                                                {selectedNode && (
                                                    <Box sx={{ '& > *': { mb: 1.5 } }}>
                                                        <Box>
                                                            <Typography variant="caption" color="textSecondary">IP Address</Typography>
                                                            <Typography variant="body1" fontWeight="bold">
                                                                {selectedNode.id}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="caption" color="textSecondary">Active Connections</Typography>
                                                            <Typography variant="h4" color="primary">
                                                                {selectedNode.connections}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}
                                </>
                            )}
                        </Box>
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setIsNetworkFullscreen(false)} startIcon={<FullscreenExitIcon />}>
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

export default AdvancedAnalytics;
