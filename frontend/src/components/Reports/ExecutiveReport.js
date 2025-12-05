// frontend/src/components/Reports/ExecutiveReport.js - PART 1
import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Grid,
    Card,
    CardContent,
    Divider,
    useTheme,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DescriptionIcon from '@mui/icons-material/Description';
import TimelineIcon from '@mui/icons-material/Timeline';
import ComputerIcon from '@mui/icons-material/Computer';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import api from '../../services/auth';
import { getLogStats } from '../../services/logs';
import { getWazuhAgents, getManagerInfo } from '../../services/wazuh';
import { getDeviceNames } from '../../services/audits';
import { getSessionLogs } from '../../services/logs';
import { getThreatHuntingLogs } from '../../services/logs';
import logo from '../../assets/vgil_logo.png';
import { getAdvancedAnalytics } from '../../services/logs';
import RouterIcon from '@mui/icons-material/Router';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import LaptopMacIcon from '@mui/icons-material/LaptopMac';

// Define color palette for charts
const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140', '#30cfd0'];

const ExecutiveReport = () => {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [reportData, setReportData] = useState(null);
    const [exporting, setExporting] = useState(false);

    // Generate month options for the last 12 months
    const getMonthOptions = () => {
        const months = [];
        const currentDate = new Date();

        for (let i = 0; i < 12; i++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            months.push({
                month: date.getMonth(),
                year: date.getFullYear(),
                label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            });
        }

        return months;
    };

    const monthOptions = getMonthOptions();

    useEffect(() => {
        fetchReportData();
    }, [selectedMonth, selectedYear]);

    const fetchReportData = async () => {
        try {
            setLoading(true);

            // Calculate time range for selected month
            const startDate = new Date(selectedYear, selectedMonth, 1);
            const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

            // Format the custom time range properly
            const timeRange = '30d';

            // Fetch log stats with proper API call
            let logsStats;
            try {
                // Use the API directly to get log stats for custom date range
                const logsResponse = await api.get('/logs/stats/overview', {
                    params: {
                        timeRange: timeRange,
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString()
                    }
                });
                logsStats = logsResponse.data;
            } catch (error) {
                console.error('Error fetching log stats:', error);
                // Fallback to empty stats if API fails
                logsStats = {
                    total: 0,
                    major: 0,
                    normal: 0,
                    ruleLevels: [],
                    dailyLogs: []
                };
            }

            // Fetch all other required data
            // In fetchReportData function, update the Promise.all section:
            // In fetchReportData function, update the Promise.all section:
            const [wazuhAgents, managerInfo, devices, tickets, sessionData, threatData] = await Promise.all([
                getWazuhAgents(),
                getManagerInfo(),
                getDeviceNames(),
                api.get('/tickets', { params: { page: 1, limit: 1000 } }),
                getSessionLogs({ page: 1, limit: 1, timeRange, search: '' }),
                getThreatHuntingLogs({ page: 1, limit: 1, timeRange, search: '', fullStats: true }) // Add this line
            ]);

            // Process Wazuh data
            const agents = wazuhAgents.data?.data?.affected_items || [];
            const wazuhData = {
                total: agents.length,
                active: agents.filter(a => a.status === 'active').length,
                disconnected: agents.filter(a => a.status === 'disconnected').length,
                neverConnected: agents.filter(a => a.status === 'never_connected').length,
                byOS: agents.reduce((acc, agent) => {
                    const os = agent.os?.name || 'Unknown';
                    acc[os] = (acc[os] || 0) + 1;
                    return acc;
                }, {})
            };

            // Process device data
            const deviceData = {
                total: devices.totalDevices || 0,
                devices: devices.devices || []
            };

            // Process ticket data
            const ticketData = tickets.data.tickets || [];
            const ticketStats = {
                total: ticketData.length,
                open: ticketData.filter(t => t.status === 'Open').length,
                inProgress: ticketData.filter(t => t.status === 'In Progress').length,
                resolved: ticketData.filter(t => t.status === 'Resolved').length,
                closed: ticketData.filter(t => t.status === 'Closed').length
            };
            const sessionStats = sessionData?.stats || null;
            const threatStats = threatData?.stats || null;
            const advancedAnalytics = await getAdvancedAnalytics(timeRange);

            // Ensure log stats have all required fields with defaults
            const processedLogsStats = {
                total: logsStats.total || 0,
                major: logsStats.major || 0,
                normal: logsStats.normal || logsStats.total - (logsStats.major || 0),
                ruleLevels: logsStats.ruleLevels || [],
                dailyLogs: logsStats.dailyLogs || []
            };

            console.log('Fetched Report Data:', {
                logs: processedLogsStats,
                wazuh: wazuhData,
                devices: deviceData,
                tickets: ticketStats
            });

            setReportData({
                logs: processedLogsStats,
                wazuh: wazuhData,
                devices: deviceData,
                tickets: ticketStats,
                manager: managerInfo.data,
                analytics: advancedAnalytics,
                session: sessionStats,
                threat: threatStats,
                period: {
                    month: new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                    startDate,
                    endDate
                }
            });

        } catch (error) {
            console.error('Error fetching report data:', error);
            alert('Failed to fetch report data. Please check console for details.');
        } finally {
            setLoading(false);
        }
    };

    // Chart options for OS Distribution (for PDF rendering)
    const getOSDistributionChartOption = () => {
        if (!reportData?.wazuh?.byOS) return {};

        const osData = Object.entries(reportData.wazuh.byOS).map(([os, count]) => ({
            name: os,
            value: count
        }));

        const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'];

        return {
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)'
            },
            series: [
                {
                    type: 'pie',
                    radius: ['40%', '70%'],
                    avoidLabelOverlap: false,
                    itemStyle: {
                        borderRadius: 8,
                        borderColor: '#fff',
                        borderWidth: 2
                    },
                    label: {
                        show: true,
                        position: 'outside',
                        formatter: '{b}\n{d}%',
                        fontSize: 12,
                        fontWeight: 'bold'
                    },
                    emphasis: {
                        label: {
                            show: true,
                            fontSize: 14,
                            fontWeight: 'bold'
                        }
                    },
                    data: osData.map((item, index) => ({
                        ...item,
                        itemStyle: {
                            color: colors[index % colors.length]
                        }
                    }))
                }
            ],
            backgroundColor: 'transparent'
        };
    };

    // Chart options for Daily Log Trends (for PDF rendering)
    const getDailyLogsChartOption = () => {
        if (!reportData?.logs?.dailyLogs || reportData.logs.dailyLogs.length === 0) return {};

        const timelineData = reportData.logs.dailyLogs;
        const dates = timelineData.map(log => new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const counts = timelineData.map(log => log.count || 0);

        return {
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    const param = params[0];
                    return `<strong>${param.name}</strong><br />Count: <span style="color:${param.color};font-weight:bold">${param.value}</span>`;
                }
            },
            grid: {
                left: '10%',
                right: '5%',
                bottom: '15%',
                top: '10%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: dates,
                axisLabel: {
                    rotate: 45,
                    interval: Math.floor(dates.length / 10) || 0,
                    fontSize: 10
                }
            },
            yAxis: {
                type: 'value',
                name: 'Events',
                nameLocation: 'middle',
                nameGap: 40,
                axisLabel: {
                    fontSize: 10
                }
            },
            series: [{
                name: 'Log Events',
                data: counts,
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                itemStyle: {
                    color: '#2196F3'
                },
                lineStyle: {
                    width: 2,
                    color: '#2196F3'
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(33, 150, 243, 0.5)' },
                        { offset: 1, color: 'rgba(33, 150, 243, 0.1)' }
                    ])
                }
            }],
            backgroundColor: 'transparent'
        };
    };

    const getTopEndpointsChartOption = () => {
        if (!reportData?.analytics?.topAgents) return {};

        const topAgents = reportData.analytics.topAgents.slice(0, 10).sort((a, b) => b.count - a.count);

        return {
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '20%', right: '10%', bottom: '15%', top: '10%' },
            xAxis: { type: 'value', name: 'Events' },
            yAxis: {
                type: 'category',
                data: topAgents.map(a => a.name),
                inverse: true
            },
            series: [{
                type: 'bar',
                data: topAgents.map((a, idx) => ({
                    value: a.count,
                    itemStyle: { color: colors[idx % colors.length] }
                })),
                barWidth: '60%',
                label: { show: true, position: 'right' }
            }],
            backgroundColor: 'transparent'
        };
    };

    const getNetworkFlowsChartOption = () => {
        if (!reportData?.analytics?.networkFlows) return {};

        // Filter top 15 flows for clarity in PDF
        const topFlows = reportData.analytics.networkFlows
            .sort((a, b) => b.value - a.value)
            .slice(0, 15);

        const nodes = new Map();
        const links = [];

        topFlows.forEach(flow => {
            if (!nodes.has(flow.source)) nodes.set(flow.source, { name: flow.source });
            if (!nodes.has(flow.target)) nodes.set(flow.target, { name: flow.target });

            if (flow.source !== flow.target) {
                links.push({ source: flow.source, target: flow.target, value: flow.value });
            }
        });

        return {
            series: [{
                type: 'sankey',
                data: Array.from(nodes.values()),
                links: links,
                label: { fontSize: 10 },
                lineStyle: { color: 'gradient', curveness: 0.5 }
            }],
            backgroundColor: 'transparent'
        };
    };

    const getAlertDistributionChartOption = () => {
        if (!reportData?.analytics?.ruleDescriptions) return {};

        const descriptions = reportData.analytics.ruleDescriptions.slice(0, 20);
        const categories = {};

        descriptions.forEach(desc => {
            const category = desc.description.split(':')[0]?.trim() || 'Other';
            if (!categories[category]) {
                categories[category] = { name: category, value: 0, children: [] };
            }
            categories[category].value += desc.count;
            categories[category].children.push({ name: desc.description, value: desc.count });
        });

        return {
            series: [{
                type: 'treemap',
                data: Object.values(categories).map((cat, idx) => ({
                    ...cat,
                    itemStyle: { color: colors[idx % colors.length] }
                })),
                label: { show: true, fontSize: 10 }
            }],
            backgroundColor: 'transparent'
        };
    };

    // Source Countries Chart Option (for PDF rendering)
    const getSourceCountriesChartOption = () => {
        if (!reportData?.threat?.bySrcCountry) return {};

        const sourceCountryData = reportData.threat.bySrcCountry
            .filter(item => item.country !== 'Unknown')
            .slice(0, 15)
            .sort((a, b) => b.count - a.count);

        if (sourceCountryData.length === 0) return {};

        return {
            title: {
                text: 'Top Source Countries',
                left: 'center',
                textStyle: {
                    color: '#333',
                    fontSize: 16,
                    fontWeight: 500
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function (params) {
                    const param = params[0];
                    return `<strong>${param.name}</strong><br />Events: <span style="color:#91c8ff;font-weight:bold">${param.value}</span>`;
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'value',
                axisLabel: { color: '#666' },
                axisLine: { lineStyle: { color: '#ddd' } },
                splitLine: { lineStyle: { color: '#f0f0f0' } }
            },
            yAxis: {
                type: 'category',
                data: sourceCountryData.map(item => item.country).reverse(),
                axisLabel: { color: '#666' },
                axisLine: { lineStyle: { color: '#ddd' } }
            },
            series: [{
                name: 'Events',
                type: 'bar',
                data: sourceCountryData.map(item => item.count).reverse(),
                itemStyle: { color: '#91c8ff' },
                label: {
                    show: true,
                    position: 'right',
                    formatter: '{c}',
                    color: '#333'
                }
            }],
            backgroundColor: 'transparent'
        };
    };

    // Destination Countries Chart Option (for PDF rendering)
    const getDestinationCountriesChartOption = () => {
        if (!reportData?.threat?.byDstCountry) return {};

        const destCountryData = reportData.threat.byDstCountry
            .filter(item => item.country !== 'Unknown')
            .slice(0, 15)
            .sort((a, b) => b.count - a.count);

        if (destCountryData.length === 0) return {};

        return {
            title: {
                text: 'Top Destination Countries',
                left: 'center',
                textStyle: {
                    color: '#333',
                    fontSize: 16,
                    fontWeight: 500
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function (params) {
                    const param = params[0];
                    return `<strong>${param.name}</strong><br />Events: <span style="color:#ffbb91;font-weight:bold">${param.value}</span>`;
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'value',
                axisLabel: { color: '#666' },
                axisLine: { lineStyle: { color: '#ddd' } },
                splitLine: { lineStyle: { color: '#f0f0f0' } }
            },
            yAxis: {
                type: 'category',
                data: destCountryData.map(item => item.country).reverse(),
                axisLabel: { color: '#666' },
                axisLine: { lineStyle: { color: '#ddd' } }
            },
            series: [{
                name: 'Events',
                type: 'bar',
                data: destCountryData.map(item => item.count).reverse(),
                itemStyle: { color: '#ffbb91' },
                label: {
                    show: true,
                    position: 'right',
                    formatter: '{c}',
                    color: '#333'
                }
            }],
            backgroundColor: 'transparent'
        };
    };

    const generateExecutivePDF = async () => {
        if (!reportData) return;

        try {
            setExporting(true);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            let currentPage = 1;

            // CAPTURE ALL CARDS
            let cardsImage = null;
            const cardsElement = document.getElementById('pdf-cards-container');
            if (cardsElement) {
                const canvas = await html2canvas(cardsElement, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#fff'
                });
                cardsImage = canvas.toDataURL('image/png');
            }

            // CAPTURE OS CHART
            let osChartImage = null;
            const osChartElement = document.getElementById('pdf-os-chart');
            if (osChartElement) {
                const canvas = await html2canvas(osChartElement, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#fff'
                });
                osChartImage = canvas.toDataURL('image/png');
            }

            // CAPTURE DAILY LOG CHART
            let dailyLogChartImage = null;
            const dailyLogChartElement = document.getElementById('pdf-dailylog-chart');
            if (dailyLogChartElement) {
                const canvas = await html2canvas(dailyLogChartElement, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#fff'
                });
                dailyLogChartImage = canvas.toDataURL('image/png');
            }

            let analyticsCardsImage = null;
            const analyticsCardsElement = document.getElementById('pdf-analytics-cards');
            if (analyticsCardsElement) {
                const canvas = await html2canvas(analyticsCardsElement, {
                    scale: 2, useCORS: true, backgroundColor: '#fff'
                });
                analyticsCardsImage = canvas.toDataURL('image/png');
            }

            let topEndpointsImage = null;
            const topEndpointsElement = document.getElementById('pdf-top-endpoints');
            if (topEndpointsElement) {
                const canvas = await html2canvas(topEndpointsElement, { scale: 2, useCORS: true, backgroundColor: '#fff' });
                topEndpointsImage = canvas.toDataURL('image/png');
            }

            let networkFlowsImage = null;
            const networkFlowsElement = document.getElementById('pdf-network-flows');
            if (networkFlowsElement) {
                const canvas = await html2canvas(networkFlowsElement, { scale: 2, useCORS: true, backgroundColor: '#fff' });
                networkFlowsImage = canvas.toDataURL('image/png');  // ✅ Assign to networkFlowsImage
            }

            let alertDistImage = null;
            const alertDistElement = document.getElementById('pdf-alert-distribution');  // ✅ Fixed variable name
            if (alertDistElement) {
                const canvas = await html2canvas(alertDistElement, { scale: 2, useCORS: true, backgroundColor: '#fff' });
                alertDistImage = canvas.toDataURL('image/png');  // ✅ Assign to alertDistImage
            }

            // Add after capturing alertDistImage
            let sessionStatsImage = null;
            const sessionStatsElement = document.getElementById('pdf-session-stats');
            if (sessionStatsElement) {
                const canvas = await html2canvas(sessionStatsElement, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#fff'
                });
                sessionStatsImage = canvas.toDataURL('image/png');
            }

            let sourceCountriesImage = null;
            const sourceCountriesElement = document.getElementById('pdf-source-countries');
            if (sourceCountriesElement) {
                const canvas = await html2canvas(sourceCountriesElement, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#fff'
                });
                sourceCountriesImage = canvas.toDataURL('image/png');
            }

            let destCountriesImage = null;
            const destCountriesElement = document.getElementById('pdf-destination-countries');
            if (destCountriesElement) {
                const canvas = await html2canvas(destCountriesElement, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#fff'
                });
                destCountriesImage = canvas.toDataURL('image/png');
            }

            // Add pages
            addCoverPage(pdf, pageWidth, pageHeight, reportData.period);
            pdf.addPage(); currentPage++;
            addExecutiveSummary(pdf, pageWidth, reportData, currentPage, cardsImage);
            pdf.addPage(); currentPage++;
            await addSecurityMetrics(pdf, pageWidth, reportData, currentPage);
            pdf.addPage(); currentPage++;
            await addInfrastructureStatus(pdf, pageWidth, reportData, currentPage, osChartImage, dailyLogChartImage);
            pdf.addPage(); currentPage++;
            addRecommendations(pdf, pageWidth, reportData, currentPage);
            pdf.addPage(); currentPage++;
            addAdvancedAnalyticsSection(pdf, pageWidth, reportData, currentPage, {
                analyticsCards: analyticsCardsImage,
                topEndpoints: topEndpointsImage,
                networkFlows: networkFlowsImage,
                alertDist: alertDistImage
            });
            pdf.addPage();
            currentPage++;
            addSessionStatisticsSection(pdf, pageWidth, reportData, currentPage, sessionStatsImage);
            pdf.addPage();
            currentPage++;
            addThreatIntelligenceSection(pdf, pageWidth, reportData, currentPage, {
                sourceCountries: sourceCountriesImage,
                destCountries: destCountriesImage
            });

            const fileName = `Executive_Report_${reportData.period.month.replace(' ', '_')}.pdf`;
            pdf.save(fileName);
            alert('Executive report generated successfully!');
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating report.');
        } finally {
            setExporting(false);
        }
    };

    const addCoverPage = (pdf, pageWidth, pageHeight, period) => {
        const centerX = pageWidth / 2;

        // Logo
        const img = new Image();
        img.src = logo;
        pdf.addImage(img, 'PNG', centerX - 30, 40, 60, 30);

        // Title
        pdf.setFontSize(32);
        pdf.setTextColor(40, 40, 40);
        pdf.text('Executive Security Report', centerX, 100, { align: 'center' });

        pdf.setDrawColor(70, 130, 180);
        pdf.setLineWidth(1.5);
        pdf.line(30, 110, pageWidth - 30, 110);

        // Period
        pdf.setFontSize(18);
        pdf.setTextColor(80, 80, 80);
        pdf.text(period.month, centerX, 130, { align: 'center' });

        // Metadata
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        let yPos = 160;

        const metadata = [
            { label: 'Report Period:', value: period.month },
            { label: 'Generated On:', value: new Date().toLocaleDateString() },
            { label: 'Generated At:', value: new Date().toLocaleTimeString() },
            { label: 'Report Type:', value: 'Monthly Executive Summary' }
        ];

        metadata.forEach(item => {
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${item.label}`, 40, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`${item.value}`, 110, yPos);
            yPos += 10;
        });

        // Description
        yPos += 15;
        pdf.setFontSize(11);
        pdf.text('This comprehensive report provides an executive overview of security', 40, yPos);
        yPos += 7;
        pdf.text('operations, infrastructure status, threat landscape, and key performance', 40, yPos);
        yPos += 7;
        pdf.text('indicators for the specified reporting period.', 40, yPos);

        // Footer
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text('CONFIDENTIAL - EXECUTIVE USE ONLY', centerX, pageHeight - 20, { align: 'center' });
        pdf.text(`Report ID: EXE-${generateReportId()}`, centerX, pageHeight - 15, { align: 'center' });
        pdf.text('Page 1', centerX, pageHeight - 10, { align: 'center' });
    };

    // Continue to Part 2 for remaining functions...
    const generateReportId = () => {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    };

    // frontend/src/components/Reports/ExecutiveReport.js - PART 2
    // This continues from Part 1

    const addExecutiveSummary = (pdf, pageWidth, data, pageNum, cardsImage) => {
        const centerX = pageWidth / 2;
        let yPos = 30;

        // Header
        pdf.setFontSize(20);
        pdf.setTextColor(40, 40, 40);
        pdf.text('Executive Summary', centerX, yPos, { align: 'center' });

        yPos += 5;
        pdf.setDrawColor(70, 130, 180);
        pdf.setLineWidth(0.5);
        pdf.line(40, yPos, pageWidth - 40, yPos);
        yPos += 15;

        // Key Highlights Section
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Key Highlights', 40, yPos);
        yPos += 10;

        // Add cards image
        if (cardsImage) {
            const imgWidth = pageWidth - 60;
            const imgHeight = (imgWidth * 300) / 1100;
            pdf.addImage(cardsImage, 'PNG', 30, yPos, imgWidth, imgHeight);
            yPos += imgHeight + 20;
        }

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        const highlights = [
            `Total Security Events: ${data.logs.total?.toLocaleString() || 0}`,
            `Major Security Events: ${data.logs.major?.toLocaleString() || 0}`,
            `Active Endpoints: ${data.wazuh.active} of ${data.wazuh.total}`,
            `Network Devices Monitored: ${data.devices.total}`,
            `Tickets Generated: ${data.tickets.total}`,
            `Tickets Resolved: ${data.tickets.resolved}`
        ];

        highlights.forEach(highlight => {
            pdf.text(`• ${highlight}`, 45, yPos);
            yPos += 8;
        });

        yPos += 10;

        // Security Posture
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Security Posture', 40, yPos);
        yPos += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        const majorEventRate = ((data.logs.major / data.logs.total) * 100).toFixed(1);
        const endpointHealth = ((data.wazuh.active / data.wazuh.total) * 100).toFixed(1);
        const ticketResolutionRate = ((data.tickets.resolved / data.tickets.total) * 100).toFixed(1);

        const posture = [
            `Critical Event Rate: ${majorEventRate}% of total events`,
            `Endpoint Health: ${endpointHealth}% endpoints active`,
            `Ticket Resolution Rate: ${ticketResolutionRate}%`,
            `Infrastructure Coverage: ${data.devices.total} devices monitored`
        ];

        posture.forEach(item => {
            pdf.text(`• ${item}`, 45, yPos);
            yPos += 8;
        });

        yPos += 10;

        // Risk Assessment
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Risk Assessment', 40, yPos);
        yPos += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        let riskLevel = 'LOW';
        let riskColor = [76, 175, 80];

        if (majorEventRate > 5 || endpointHealth < 90) {
            riskLevel = 'MEDIUM';
            riskColor = [255, 152, 0];
        }
        if (majorEventRate > 10 || endpointHealth < 80) {
            riskLevel = 'HIGH';
            riskColor = [244, 67, 54];
        }

        pdf.setTextColor(...riskColor);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Overall Risk Level: ${riskLevel}`, 45, yPos);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(80, 80, 80);
        yPos += 10;

        const risks = [];
        if (majorEventRate > 5) risks.push('Elevated critical event rate requires attention');
        if (data.wazuh.disconnected > 0) risks.push(`${data.wazuh.disconnected} endpoints disconnected`);
        if (data.tickets.open > data.tickets.total * 0.3) risks.push('High volume of open tickets');
        if (risks.length === 0) risks.push('No significant risks identified');

        risks.forEach(risk => {
            pdf.text(`• ${risk}`, 45, yPos);
            yPos += 8;
        });

        // Footer
        addPageFooter(pdf, pageWidth, pdf.internal.pageSize.getHeight(), pageNum);
    };

    const addSecurityMetrics = async (pdf, pageWidth, data, pageNum) => {
        const centerX = pageWidth / 2;
        let yPos = 30;

        // Header
        pdf.setFontSize(20);
        pdf.setTextColor(40, 40, 40);
        pdf.text('Security Metrics', centerX, yPos, { align: 'center' });

        yPos += 5;
        pdf.setDrawColor(70, 130, 180);
        pdf.setLineWidth(0.5);
        pdf.line(40, yPos, pageWidth - 40, yPos);
        yPos += 15;

        // Log Statistics
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Security Event Statistics', 40, yPos);
        yPos += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        const logMetrics = [
            { label: 'Total Events:', value: data.logs.total?.toLocaleString() || '0' },
            { label: 'Major Events:', value: data.logs.major?.toLocaleString() || '0' },
            { label: 'Normal Events:', value: data.logs.normal?.toLocaleString() || '0' },
            { label: 'Average Daily Events:', value: Math.round(data.logs.total / 30).toLocaleString() }
        ];

        logMetrics.forEach(metric => {
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${metric.label}`, 45, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(metric.value, 120, yPos);
            yPos += 8;
        });

        yPos += 15;

        // Incident Management
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Incident Management', 40, yPos);
        yPos += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        const ticketMetrics = [
            { label: 'Total Tickets:', value: data.tickets.total.toString() },
            { label: 'Open:', value: data.tickets.open.toString() },
            { label: 'In Progress:', value: data.tickets.inProgress.toString() },
            { label: 'Resolved:', value: data.tickets.resolved.toString() },
            { label: 'Closed:', value: data.tickets.closed.toString() }
        ];

        ticketMetrics.forEach(metric => {
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${metric.label}`, 45, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(metric.value, 120, yPos);
            yPos += 8;
        });

        yPos += 15;

        // Threat Analysis
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Threat Analysis', 40, yPos);
        yPos += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        if (data.logs.ruleLevels && data.logs.ruleLevels.length > 0) {
            const topThreats = data.logs.ruleLevels
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            topThreats.forEach(threat => {
                pdf.text(`• Level ${threat.level}: ${threat.count.toLocaleString()} events`, 45, yPos);
                yPos += 8;
            });
        } else {
            pdf.text('• No threat data available for this period', 45, yPos);
            yPos += 8;
        }

        // Footer
        addPageFooter(pdf, pageWidth, pdf.internal.pageSize.getHeight(), pageNum);
    };

    const addInfrastructureStatus = async (pdf, pageWidth, data, pageNum, osChartImage, dailyLogChartImage) => {
        const centerX = pageWidth / 2;
        let yPos = 30;

        // Header
        pdf.setFontSize(20);
        pdf.setTextColor(40, 40, 40);
        pdf.text('Infrastructure Status', centerX, yPos, { align: 'center' });

        yPos += 5;
        pdf.setDrawColor(70, 130, 180);
        pdf.setLineWidth(0.5);
        pdf.line(40, yPos, pageWidth - 40, yPos);
        yPos += 15;

        // Endpoint Status
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Cybersentinel Endpoint Status', 40, yPos);
        yPos += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        const endpointMetrics = [
            { label: 'Total Endpoints:', value: data.wazuh.total.toString() },
            { label: 'Active:', value: data.wazuh.active.toString(), color: [76, 175, 80] },
            { label: 'Disconnected:', value: data.wazuh.disconnected.toString(), color: [255, 152, 0] },
            { label: 'Never Connected:', value: data.wazuh.neverConnected.toString(), color: [244, 67, 54] }
        ];

        endpointMetrics.forEach(metric => {
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(80, 80, 80);
            pdf.text(`${metric.label}`, 45, yPos);
            pdf.setFont('helvetica', 'normal');
            if (metric.color) pdf.setTextColor(...metric.color);
            pdf.text(metric.value, 120, yPos);
            pdf.setTextColor(80, 80, 80);
            yPos += 8;
        });

        yPos += 10;

        // Add OS Distribution Chart
        if (osChartImage) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Operating System Distribution', 40, yPos);
            yPos += 10;

            const chartWidth = pageWidth - 80;
            const chartHeight = 70;
            pdf.addImage(osChartImage, 'PNG', 40, yPos, chartWidth, chartHeight);
            yPos += chartHeight + 15;
        } else {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Operating System Distribution', 40, yPos);
            yPos += 10;

            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');

            Object.entries(data.wazuh.byOS).forEach(([os, count]) => {
                pdf.text(`• ${os}: ${count} endpoint(s)`, 45, yPos);
                yPos += 8;
            });

            yPos += 10;
        }

        // Add Daily Log Trends Chart
        if (dailyLogChartImage) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Daily Log Trends', 40, yPos);
            yPos += 10;

            const chartWidth = pageWidth - 80;
            const chartHeight = 70;
            pdf.addImage(dailyLogChartImage, 'PNG', 40, yPos, chartWidth, chartHeight);
            yPos += chartHeight + 10;
        }

        // Network Devices
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Network Infrastructure', 40, yPos);
        yPos += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        pdf.text(`• Total Monitored Devices: ${data.devices.total}`, 45, yPos);
        yPos += 8;
        pdf.text(`• All devices operational and reporting`, 45, yPos);

        // Footer
        addPageFooter(pdf, pageWidth, pdf.internal.pageSize.getHeight(), pageNum);
    };

    const addRecommendations = (pdf, pageWidth, data, pageNum) => {
        const centerX = pageWidth / 2;
        let yPos = 30;

        // Header
        pdf.setFontSize(20);
        pdf.setTextColor(40, 40, 40);
        pdf.text('Recommendations', centerX, yPos, { align: 'center' });

        yPos += 5;
        pdf.setDrawColor(70, 130, 180);
        pdf.setLineWidth(0.5);
        pdf.line(40, yPos, pageWidth - 40, yPos);
        yPos += 15;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        const recommendations = [];

        // Generate recommendations based on data
        if (data.wazuh.disconnected > 0) {
            recommendations.push({
                priority: 'HIGH',
                text: `Reconnect ${data.wazuh.disconnected} disconnected endpoint(s) to ensure complete coverage`
            });
        }

        if (data.wazuh.neverConnected > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                text: `Configure ${data.wazuh.neverConnected} endpoint(s) that have never connected`
            });
        }

        const majorEventRate = ((data.logs.major / data.logs.total) * 100).toFixed(1);
        if (majorEventRate > 5) {
            recommendations.push({
                priority: 'HIGH',
                text: 'Investigate elevated critical event rate and implement additional controls'
            });
        }

        if (data.tickets.open > data.tickets.total * 0.3) {
            recommendations.push({
                priority: 'MEDIUM',
                text: 'Prioritize open ticket resolution to maintain operational efficiency'
            });
        }

        // Always add these
        recommendations.push({
            priority: 'LOW',
            text: 'Continue regular security awareness training for all personnel'
        });

        recommendations.push({
            priority: 'LOW',
            text: 'Review and update incident response procedures quarterly'
        });

        recommendations.forEach(rec => {
            const priorityColors = {
                'HIGH': [244, 67, 54],
                'MEDIUM': [255, 152, 0],
                'LOW': [76, 175, 80]
            };

            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...priorityColors[rec.priority]);
            pdf.text(`[${rec.priority}]`, 45, yPos);

            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80, 80, 80);

            const lines = pdf.splitTextToSize(rec.text, pageWidth - 90);
            pdf.text(lines, 70, yPos);
            yPos += 8 * lines.length + 5;
        });

        yPos += 15;

        // Conclusion
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Conclusion', 40, yPos);
        yPos += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        const conclusion = `The security posture for ${data.period.month} shows ` +
            `${majorEventRate > 5 ? 'areas requiring attention' : 'stable operations'} with ` +
            `${data.logs.total.toLocaleString()} total events processed and ` +
            `${((data.wazuh.active / data.wazuh.total) * 100).toFixed(1)}% endpoint availability. ` +
            `Continue monitoring and implementing recommended improvements.`;

        const conclusionLines = pdf.splitTextToSize(conclusion, pageWidth - 80);
        pdf.text(conclusionLines, 40, yPos);

        // Footer
        addPageFooter(pdf, pageWidth, pdf.internal.pageSize.getHeight(), pageNum);
    };

    const addAdvancedAnalyticsSection = (pdf, pageWidth, data, pageNum, images) => {

        if (!data.analytics || !data.analytics.summary) {
            console.warn('Analytics data not available');
            return;
        }
        const centerX = pageWidth / 2;
        let yPos = 30;

        // Header
        pdf.setFontSize(20);
        pdf.setTextColor(40, 40, 40);
        pdf.text('Advanced Security Analytics Overview', centerX, yPos, { align: 'center' });

        yPos += 5;
        pdf.setDrawColor(70, 130, 180);
        pdf.setLineWidth(0.5);
        pdf.line(40, yPos, pageWidth - 40, yPos);
        yPos += 15;

        // Security Summary Cards
        if (images.analyticsCards) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Security Event Summary', 40, yPos);
            yPos += 10;

            const imgWidth = pageWidth - 60;
            const imgHeight = (imgWidth * 300) / 1100;
            pdf.addImage(images.analyticsCards, 'PNG', 30, yPos, imgWidth, imgHeight);
            yPos += imgHeight + 15;
        }

        // Key Metrics Text
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        const metrics = [
            `Total Security Events: ${data.analytics.summary.total.toLocaleString()}`,
            `Normal Events: ${data.analytics.summary.normal.toLocaleString()}`,
            `Warning Events: ${data.analytics.summary.warnings.toLocaleString()}`,
            `Critical Events: ${data.analytics.summary.critical.toLocaleString()}`
        ];

        metrics.forEach(metric => {
            pdf.text(`• ${metric}`, 45, yPos);
            yPos += 8;
        });

        yPos += 10;

        // Top 10 Endpoints
        if (images.topEndpoints) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Top 10 Active Endpoints', 40, yPos);
            yPos += 10;

            const chartWidth = pageWidth - 80;
            const chartHeight = 70;
            pdf.addImage(images.topEndpoints, 'PNG', 40, yPos, chartWidth, chartHeight);
            yPos += chartHeight + 15;
        }

        // Network Connection Flows
        if (images.networkFlows && yPos < 200) { // Check if space available on page
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Network Connection Flows', 40, yPos);
            yPos += 10;

            const chartWidth = pageWidth - 80;
            const chartHeight = 60;
            pdf.addImage(images.networkFlows, 'PNG', 40, yPos, chartWidth, chartHeight);
            yPos += chartHeight + 10;
        } else if (images.networkFlows) {
            // Add on new page if needed
            pdf.addPage();
            yPos = 30;
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Network Connection Flows', 40, yPos);
            yPos += 10;

            const chartWidth = pageWidth - 80;
            const chartHeight = 80;
            pdf.addImage(images.networkFlows, 'PNG', 40, yPos, chartWidth, chartHeight);
            yPos += chartHeight + 15;
        }

        // Top 10 Network Services (Text List)
        if (data.analytics.topServices && data.analytics.topServices.length > 0) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Top 10 Network Services', 40, yPos);
            yPos += 10;

            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');

            const topServices = data.analytics.topServices.slice(0, 10);
            topServices.forEach((service, idx) => {
                pdf.text(`${idx + 1}. ${service.name}: ${service.count.toLocaleString()} events`, 45, yPos);
                yPos += 7;
            });
        }

        // Footer
        addPageFooter(pdf, pageWidth, pdf.internal.pageSize.getHeight(), pageNum);
    };

    const addPageFooter = (pdf, pageWidth, pageHeight, pageNum) => {
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text('CONFIDENTIAL - EXECUTIVE USE ONLY', pageWidth / 2, pageHeight - 15, { align: 'center' });
        pdf.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    const addSessionStatisticsSection = (pdf, pageWidth, data, pageNum, sessionStatsImage) => {
        if (!data.session) {
            console.warn('Session data not available');
            return;
        }

        const centerX = pageWidth / 2;
        let yPos = 30;

        // Header
        pdf.setFontSize(20);
        pdf.setTextColor(40, 40, 40);
        pdf.text('Authentication Statistics', centerX, yPos, { align: 'center' });

        yPos += 5;
        pdf.setDrawColor(70, 130, 180);
        pdf.setLineWidth(0.5);
        pdf.line(40, yPos, pageWidth - 40, yPos);
        yPos += 15;

        // Section Description
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(80, 80, 80);
        const description = 'Overview of authentication events across different device types and platforms during the reporting period.';
        const descLines = pdf.splitTextToSize(description, pageWidth - 80);
        pdf.text(descLines, 40, yPos);
        yPos += descLines.length * 7 + 10;

        // Add Session Stats Cards Image
        if (sessionStatsImage) {
            const imgWidth = pageWidth - 60;
            const imgHeight = (imgWidth * 600) / 1200; // Maintain aspect ratio
            pdf.addImage(sessionStatsImage, 'PNG', 30, yPos, imgWidth, imgHeight);
            yPos += imgHeight + 15;
        }

        // Summary Statistics
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Summary', 40, yPos);
        yPos += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        const sessionData = data.session.byAuthAndDevice || {};

        // Calculate totals
        const totalAuth = (sessionData.firewall?.success || 0) + (sessionData.firewall?.failed || 0) +
            (sessionData.windows?.success || 0) + (sessionData.windows?.failed || 0) +
            (sessionData.linux?.success || 0) + (sessionData.linux?.failed || 0) +
            (sessionData.mac?.success || 0) + (sessionData.mac?.failed || 0);

        const totalSuccess = (sessionData.firewall?.success || 0) + (sessionData.windows?.success || 0) +
            (sessionData.linux?.success || 0) + (sessionData.mac?.success || 0);

        const totalFailed = (sessionData.firewall?.failed || 0) + (sessionData.windows?.failed || 0) +
            (sessionData.linux?.failed || 0) + (sessionData.mac?.failed || 0);

        const successRate = totalAuth > 0 ? ((totalSuccess / totalAuth) * 100).toFixed(1) : 0;

        const summaryStats = [
            `Total Authentication Events: ${totalAuth.toLocaleString()}`,
            `Successful Authentications: ${totalSuccess.toLocaleString()} (${successRate}%)`,
            `Failed Authentications: ${totalFailed.toLocaleString()} (${(100 - successRate).toFixed(1)}%)`,
            '',
            `Windows Events: ${((sessionData.windows?.success || 0) + (sessionData.windows?.failed || 0)).toLocaleString()}`,
            `Linux Events: ${((sessionData.linux?.success || 0) + (sessionData.linux?.failed || 0)).toLocaleString()}`,
            `Firewall Events: ${((sessionData.firewall?.success || 0) + (sessionData.firewall?.failed || 0)).toLocaleString()}`,
            `Mac Events: ${((sessionData.mac?.success || 0) + (sessionData.mac?.failed || 0)).toLocaleString()}`
        ];

        summaryStats.forEach(stat => {
            if (stat === '') {
                yPos += 5;
            } else {
                pdf.text(`• ${stat}`, 45, yPos);
                yPos += 7;
            }
        });

        yPos += 10;

        // Key Observations
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Key Observations', 40, yPos);
        yPos += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        const observations = [];

        // Generate dynamic observations
        if (successRate >= 95) {
            observations.push('Excellent authentication success rate indicates robust security controls');
        } else if (successRate >= 85) {
            observations.push('Good authentication success rate with some failed attempts requiring review');
        } else {
            observations.push('Elevated authentication failure rate requires immediate attention');
        }

        // Check for anomalies
        const linuxTotal = (sessionData.linux?.success || 0) + (sessionData.linux?.failed || 0);
        const linuxFailRate = linuxTotal > 0 ? ((sessionData.linux?.failed || 0) / linuxTotal * 100) : 0;

        if (linuxFailRate > 20) {
            observations.push(`Linux systems showing ${linuxFailRate.toFixed(1)}% authentication failure rate`);
        }

        if (totalAuth > 100000) {
            observations.push('High volume of authentication events indicates active user base');
        }

        observations.forEach(obs => {
            const lines = pdf.splitTextToSize(`• ${obs}`, pageWidth - 90);
            pdf.text(lines, 45, yPos);
            yPos += lines.length * 7 + 3;
        });

        // Footer
        addPageFooter(pdf, pageWidth, pdf.internal.pageSize.getHeight(), pageNum);
    };

    const addThreatIntelligenceSection = (pdf, pageWidth, data, pageNum, images) => {
        if (!data.threat) {
            console.warn('Threat hunting data not available');
            return;
        }

        const centerX = pageWidth / 2;
        let yPos = 30;

        // Header
        pdf.setFontSize(20);
        pdf.setTextColor(40, 40, 40);
        pdf.text('Threat Intelligence Overview', centerX, yPos, { align: 'center' });

        yPos += 5;
        pdf.setDrawColor(70, 130, 180);
        pdf.setLineWidth(0.5);
        pdf.line(40, yPos, pageWidth - 40, yPos);
        yPos += 15;

        // Section Description
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(80, 80, 80);
        const description = 'Analysis of threat hunting events and geographic distribution of security threats during the reporting period.';
        const descLines = pdf.splitTextToSize(description, pageWidth - 80);
        pdf.text(descLines, 40, yPos);
        yPos += descLines.length * 7 + 15;

        // Threat Summary Statistics
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Threat Event Summary', 40, yPos);
        yPos += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        const threatData = data.threat;

        // Calculate summary stats
        const totalEvents = threatData.total || 0;
        const passActions = threatData.byAction?.find(a => a.action?.toLowerCase() === 'pass')?.count || 0;
        const blockActions = threatData.byAction?.find(a => a.action?.toLowerCase() === 'block')?.count || 0;
        const sourceCountries = threatData.bySrcCountry?.filter(c => c.country !== 'Unknown').length || 0;
        const destCountries = threatData.byDstCountry?.filter(c => c.country !== 'Unknown').length || 0;

        const summaryStats = [
            `Total Threat Events: ${totalEvents.toLocaleString()}`,
            `Pass Actions: ${passActions.toLocaleString()}`,
            `Block Actions: ${blockActions.toLocaleString()}`,
            `Unique Source Countries: ${sourceCountries}`,
            `Unique Destination Countries: ${destCountries}`
        ];

        summaryStats.forEach(stat => {
            pdf.text(`• ${stat}`, 45, yPos);
            yPos += 7;
        });

        yPos += 15;

        // Add Source Countries Chart
        if (images.sourceCountries) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Top 15 Source Countries', 40, yPos);
            yPos += 10;

            const chartWidth = pageWidth - 80;
            const chartHeight = 70;
            pdf.addImage(images.sourceCountries, 'PNG', 40, yPos, chartWidth, chartHeight);
            yPos += chartHeight + 15;
        }

        // Add Destination Countries Chart
        if (images.destCountries && yPos < 200) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Top 15 Destination Countries', 40, yPos);
            yPos += 10;

            const chartWidth = pageWidth - 80;
            const chartHeight = 70;
            pdf.addImage(images.destCountries, 'PNG', 40, yPos, chartWidth, chartHeight);
            yPos += chartHeight + 10;
        } else if (images.destCountries) {
            // Add on new page if needed
            pdf.addPage();
            pageNum++;
            yPos = 30;

            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Top 15 Destination Countries', 40, yPos);
            yPos += 10;

            const chartWidth = pageWidth - 80;
            const chartHeight = 80;
            pdf.addImage(images.destCountries, 'PNG', 40, yPos, chartWidth, chartHeight);
            yPos += chartHeight + 15;
        }

        // Top Source Countries List (Text)
        if (threatData.bySrcCountry && threatData.bySrcCountry.length > 0) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Top 10 Source Countries (Detailed)', 40, yPos);
            yPos += 10;

            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');

            const topSources = threatData.bySrcCountry
                .filter(c => c.country !== 'Unknown')
                .slice(0, 10);

            topSources.forEach((country, idx) => {
                const formattedCountry = country.country === 'Reserved' ? 'Server' : country.country;
                pdf.text(`${idx + 1}. ${formattedCountry}: ${country.count.toLocaleString()} events`, 45, yPos);
                yPos += 7;
            });

            yPos += 10;
        }

        // Top Destination Countries List (Text)
        if (threatData.byDstCountry && threatData.byDstCountry.length > 0 && yPos < 220) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Top 10 Destination Countries (Detailed)', 40, yPos);
            yPos += 10;

            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');

            const topDests = threatData.byDstCountry
                .filter(c => c.country !== 'Unknown')
                .slice(0, 10);

            topDests.forEach((country, idx) => {
                const formattedCountry = country.country === 'Reserved' ? 'Server' : country.country;
                pdf.text(`${idx + 1}. ${formattedCountry}: ${country.count.toLocaleString()} events`, 45, yPos);
                yPos += 7;
            });
        }

        // Key Observations
        yPos += 10;
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Key Observations', 40, yPos);
        yPos += 10;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        const observations = [];

        // Generate dynamic observations
        const blockRate = totalEvents > 0 ? ((blockActions / totalEvents) * 100).toFixed(1) : 0;

        if (blockRate > 10) {
            observations.push(`High threat blocking rate of ${blockRate}% indicates active threat prevention`);
        } else if (blockRate > 5) {
            observations.push(`Moderate threat blocking rate of ${blockRate}% detected`);
        } else {
            observations.push(`Low threat blocking rate of ${blockRate}% suggests minimal active threats`);
        }

        if (sourceCountries > 50) {
            observations.push(`Wide geographic distribution with ${sourceCountries} source countries`);
        }

        if (totalEvents > 10000) {
            observations.push('High volume of threat events requires continuous monitoring');
        }

        observations.forEach(obs => {
            const lines = pdf.splitTextToSize(`• ${obs}`, pageWidth - 90);
            pdf.text(lines, 45, yPos);
            yPos += lines.length * 7 + 3;
        });

        // Footer
        addPageFooter(pdf, pageWidth, pdf.internal.pageSize.getHeight(), pageNum);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <DescriptionIcon sx={{ fontSize: 40, mr: 2, color: theme.palette.primary.main }} />
                    <Box>
                        <Typography variant="h4" fontWeight="600">
                            Executive Monthly Report
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            Comprehensive security and infrastructure overview
                        </Typography>
                    </Box>
                </Box>

                <Divider sx={{ mb: 4 }} />

                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                            <InputLabel>Select Month</InputLabel>
                            <Select
                                value={`${selectedMonth}-${selectedYear}`}
                                onChange={(e) => {
                                    const [month, year] = e.target.value.split('-');
                                    setSelectedMonth(parseInt(month));
                                    setSelectedYear(parseInt(year));
                                }}
                                disabled={loading || exporting}
                            >
                                {monthOptions.map((option) => (
                                    <MenuItem
                                        key={`${option.month}-${option.year}`}
                                        value={`${option.month}-${option.year}`}
                                    >
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            fullWidth
                            startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <FileDownloadIcon />}
                            onClick={generateExecutivePDF}
                            disabled={loading || exporting || !reportData}
                            sx={{ height: '56px' }}
                        >
                            {exporting ? 'Generating Report...' : 'Generate Executive Report'}
                        </Button>
                    </Grid>
                </Grid>

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 4, minHeight: 200 }}>
                        <CircularProgress />
                        <Typography sx={{ ml: 2 }}>Loading report data...</Typography>
                    </Box>
                )}

                {reportData && !loading && (
                    <Box sx={{ mt: 4 }}>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <Typography variant="body2">
                                <strong>Report Period:</strong> {reportData.period.month}
                            </Typography>
                            <Typography variant="body2">
                                Data collected from {reportData.period.startDate.toLocaleDateString()} to{' '}
                                {reportData.period.endDate.toLocaleDateString()}
                            </Typography>
                        </Alert>

                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card>
                                    <CardContent>
                                        <Typography color="textSecondary" gutterBottom>
                                            Total Events
                                        </Typography>
                                        <Typography variant="h4" fontWeight="bold">
                                            {reportData.logs.total?.toLocaleString() || 0}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid item xs={12} sm={6} md={3}>
                                <Card>
                                    <CardContent>
                                        <Typography color="textSecondary" gutterBottom>
                                            Major Events
                                        </Typography>
                                        <Typography variant="h4" fontWeight="bold" color="error">
                                            {reportData.logs.major?.toLocaleString() || 0}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid item xs={12} sm={6} md={3}>
                                <Card>
                                    <CardContent>
                                        <Typography color="textSecondary" gutterBottom>
                                            Active Endpoints
                                        </Typography>
                                        <Typography variant="h4" fontWeight="bold" color="success.main">
                                            {reportData.wazuh.active} / {reportData.wazuh.total}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid item xs={12} sm={6} md={3}>
                                <Card>
                                    <CardContent>
                                        <Typography color="textSecondary" gutterBottom>
                                            Tickets Resolved
                                        </Typography>
                                        <Typography variant="h4" fontWeight="bold">
                                            {reportData.tickets.resolved} / {reportData.tickets.total}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        {/* Hidden containers for PDF rendering */}
                        <Box
                            id="pdf-cards-container"
                            sx={{
                                position: 'absolute',
                                left: -9999,
                                top: -9999,
                                width: 1200,
                                p: 3,
                                background: 'white',
                                display: reportData ? 'block' : 'none'
                            }}
                        >
                            <Grid container spacing={3}>
                                <Grid item xs={4}>
                                    <Card raised sx={{
                                        height: '100%',
                                        borderRadius: '1rem',
                                        padding: '1rem',
                                        color: '#ffffff',
                                        background: 'linear-gradient(135deg, rgba(114, 81, 214, 0.67), rgba(17, 113, 239, 0.78))',
                                        boxShadow: '0 10px 35px rgba(139, 92, 246, 0.25)'
                                    }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <StorageIcon sx={{ fontSize: 40, mb: 1 }} />
                                            <Typography variant="h6" gutterBottom fontWeight="500">
                                                Total Logs
                                            </Typography>
                                            <Typography variant="h3" fontWeight="bold">
                                                {reportData.logs.total?.toLocaleString() || 0}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                <Grid item xs={4}>
                                    <Card raised sx={{
                                        height: '100%',
                                        borderRadius: '1rem',
                                        padding: '1rem',
                                        color: 'white',
                                        backgroundColor: 'hsla(15, 88%, 49%, 1.00)',
                                        backgroundImage: `
                                            radial-gradient(at 88% 40%, hsla(15, 90%, 35%, 1.00) 0px, transparent 85%),
                                            radial-gradient(at 49% 30%, hsla(0, 100%, 60%, 0.85) 0px, transparent 85%),
                                            radial-gradient(at 14% 26%, hsla(18, 98%, 55%, 1.00) 0px, transparent 85%)
                                        `,
                                        boxShadow: '0px -16px 24px 0px rgba(255, 115, 0, 0.2) inset'
                                    }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <WarningIcon sx={{ fontSize: 40, mb: 1 }} />
                                            <Typography variant="h6" gutterBottom fontWeight="500">
                                                Major Events
                                            </Typography>
                                            <Typography variant="h3" fontWeight="bold">
                                                {reportData.logs.major?.toLocaleString() || 0}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                <Grid item xs={4}>
                                    <Card raised sx={{
                                        height: '100%',
                                        borderRadius: '1rem',
                                        padding: '1rem',
                                        color: 'white',
                                        backgroundColor: 'hsl(140, 15%, 10%)',
                                        backgroundImage: `
                                            radial-gradient(at 88% 40%, hsla(140, 70%, 30%, 1.00) 0px, transparent 85%),
                                            radial-gradient(at 49% 30%, hsla(146, 100%, 45%, 0.85) 0px, transparent 85%),
                                            radial-gradient(at 14% 26%, hsla(152, 98%, 45%, 1.00) 0px, transparent 85%)
                                        `,
                                        boxShadow: '0px -16px 24px 0px rgba(100, 255, 100, 0.2) inset'
                                    }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <SecurityIcon sx={{ fontSize: 40, mb: 1 }} />
                                            <Typography variant="h6" gutterBottom fontWeight="500">
                                                Normal Events
                                            </Typography>
                                            <Typography variant="h3" fontWeight="bold">
                                                {reportData.logs.normal?.toLocaleString() || 0}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>

                        {/* Hidden OS Distribution Chart */}
                        <Box
                            id="pdf-os-chart"
                            sx={{
                                position: 'absolute',
                                left: -9999,
                                top: -9999,
                                width: 800,
                                height: 400,
                                background: 'white',
                                p: 2,
                                display: reportData ? 'block' : 'none'
                            }}
                        >
                            <ReactECharts
                                option={getOSDistributionChartOption()}
                                style={{ height: '100%', width: '100%' }}
                                opts={{ renderer: 'canvas' }}
                            />
                        </Box>



                        {/* Hidden Session Statistics Cards for PDF */}
                        <Box
                            id="pdf-session-stats"
                            sx={{
                                position: 'absolute',
                                left: -9999,
                                top: -9999,
                                width: 1200,
                                p: 3,
                                background: 'white',
                                display: reportData ? 'block' : 'none'
                            }}
                        >
                            <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: '#333' }}>
                                Authentication Statistics by Device Type
                            </Typography>
                            <Grid container spacing={3}>
                                {/* Firewall Card */}
                                <Grid item xs={6}>
                                    <Card sx={{ height: '100%', borderRadius: 2, border: '2px solid #2196F3' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                <RouterIcon sx={{ fontSize: 32, color: '#2196F3', mr: 1.5 }} />
                                                <Box>
                                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#2196F3' }}>
                                                        Firewall
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#666' }}>
                                                        Total: {(reportData?.session?.byAuthAndDevice?.firewall?.success || 0) +
                                                            (reportData?.session?.byAuthAndDevice?.firewall?.failed || 0)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Box sx={{ bgcolor: '#4CAF5020', p: 2, borderRadius: 2, border: '1px solid #4CAF5030' }}>
                                                        <Typography variant="subtitle2" sx={{ color: '#4CAF50', fontWeight: 600, mb: 1 }}>
                                                            Success
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#4CAF50' }}>
                                                            {(reportData?.session?.byAuthAndDevice?.firewall?.success || 0).toLocaleString()}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#4CAF50CC', mt: 0.5, display: 'block' }}>
                                                            {(() => {
                                                                const total = (reportData?.session?.byAuthAndDevice?.firewall?.success || 0) +
                                                                    (reportData?.session?.byAuthAndDevice?.firewall?.failed || 0);
                                                                return total > 0
                                                                    ? `${Math.round((reportData?.session?.byAuthAndDevice?.firewall?.success || 0) / total * 100)}% of total`
                                                                    : '0% of total';
                                                            })()}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Box sx={{ bgcolor: '#F4433620', p: 2, borderRadius: 2, border: '1px solid #F4433630' }}>
                                                        <Typography variant="subtitle2" sx={{ color: '#F44336', fontWeight: 600, mb: 1 }}>
                                                            Failed
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#F44336' }}>
                                                            {(reportData?.session?.byAuthAndDevice?.firewall?.failed || 0).toLocaleString()}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#F44336CC', mt: 0.5, display: 'block' }}>
                                                            {(() => {
                                                                const total = (reportData?.session?.byAuthAndDevice?.firewall?.success || 0) +
                                                                    (reportData?.session?.byAuthAndDevice?.firewall?.failed || 0);
                                                                return total > 0
                                                                    ? `${Math.round((reportData?.session?.byAuthAndDevice?.firewall?.failed || 0) / total * 100)}% of total`
                                                                    : '0% of total';
                                                            })()}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Windows Card */}
                                <Grid item xs={6}>
                                    <Card sx={{ height: '100%', borderRadius: 2, border: '2px solid #FFA726' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                <DesktopWindowsIcon sx={{ fontSize: 32, color: '#FFA726', mr: 1.5 }} />
                                                <Box>
                                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#FFA726' }}>
                                                        Windows
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#666' }}>
                                                        Total: {(reportData?.session?.byAuthAndDevice?.windows?.success || 0) +
                                                            (reportData?.session?.byAuthAndDevice?.windows?.failed || 0)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Box sx={{ bgcolor: '#4CAF5020', p: 2, borderRadius: 2, border: '1px solid #4CAF5030' }}>
                                                        <Typography variant="subtitle2" sx={{ color: '#4CAF50', fontWeight: 600, mb: 1 }}>
                                                            Success
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#4CAF50' }}>
                                                            {(reportData?.session?.byAuthAndDevice?.windows?.success || 0).toLocaleString()}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#4CAF50CC', mt: 0.5, display: 'block' }}>
                                                            {(() => {
                                                                const total = (reportData?.session?.byAuthAndDevice?.windows?.success || 0) +
                                                                    (reportData?.session?.byAuthAndDevice?.windows?.failed || 0);
                                                                return total > 0
                                                                    ? `${Math.round((reportData?.session?.byAuthAndDevice?.windows?.success || 0) / total * 100)}% of total`
                                                                    : '0% of total';
                                                            })()}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Box sx={{ bgcolor: '#F4433620', p: 2, borderRadius: 2, border: '1px solid #F4433630' }}>
                                                        <Typography variant="subtitle2" sx={{ color: '#F44336', fontWeight: 600, mb: 1 }}>
                                                            Failed
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#F44336' }}>
                                                            {(reportData?.session?.byAuthAndDevice?.windows?.failed || 0).toLocaleString()}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#F44336CC', mt: 0.5, display: 'block' }}>
                                                            {(() => {
                                                                const total = (reportData?.session?.byAuthAndDevice?.windows?.success || 0) +
                                                                    (reportData?.session?.byAuthAndDevice?.windows?.failed || 0);
                                                                return total > 0
                                                                    ? `${Math.round((reportData?.session?.byAuthAndDevice?.windows?.failed || 0) / total * 100)}% of total`
                                                                    : '0% of total';
                                                            })()}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Linux Card */}
                                <Grid item xs={6}>
                                    <Card sx={{ height: '100%', borderRadius: 2, border: '2px solid #9C27B0' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                <ComputerIcon sx={{ fontSize: 32, color: '#9C27B0', mr: 1.5 }} />
                                                <Box>
                                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#9C27B0' }}>
                                                        Linux
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#666' }}>
                                                        Total: {(reportData?.session?.byAuthAndDevice?.linux?.success || 0) +
                                                            (reportData?.session?.byAuthAndDevice?.linux?.failed || 0)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Box sx={{ bgcolor: '#4CAF5020', p: 2, borderRadius: 2, border: '1px solid #4CAF5030' }}>
                                                        <Typography variant="subtitle2" sx={{ color: '#4CAF50', fontWeight: 600, mb: 1 }}>
                                                            Success
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#4CAF50' }}>
                                                            {(reportData?.session?.byAuthAndDevice?.linux?.success || 0).toLocaleString()}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#4CAF50CC', mt: 0.5, display: 'block' }}>
                                                            {(() => {
                                                                const total = (reportData?.session?.byAuthAndDevice?.linux?.success || 0) +
                                                                    (reportData?.session?.byAuthAndDevice?.linux?.failed || 0);
                                                                return total > 0
                                                                    ? `${Math.round((reportData?.session?.byAuthAndDevice?.linux?.success || 0) / total * 100)}% of total`
                                                                    : '0% of total';
                                                            })()}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Box sx={{ bgcolor: '#F4433620', p: 2, borderRadius: 2, border: '1px solid #F4433630' }}>
                                                        <Typography variant="subtitle2" sx={{ color: '#F44336', fontWeight: 600, mb: 1 }}>
                                                            Failed
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#F44336' }}>
                                                            {(reportData?.session?.byAuthAndDevice?.linux?.failed || 0).toLocaleString()}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#F44336CC', mt: 0.5, display: 'block' }}>
                                                            {(() => {
                                                                const total = (reportData?.session?.byAuthAndDevice?.linux?.success || 0) +
                                                                    (reportData?.session?.byAuthAndDevice?.linux?.failed || 0);
                                                                return total > 0
                                                                    ? `${Math.round((reportData?.session?.byAuthAndDevice?.linux?.failed || 0) / total * 100)}% of total`
                                                                    : '0% of total';
                                                            })()}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Mac Card */}
                                <Grid item xs={6}>
                                    <Card sx={{ height: '100%', borderRadius: 2, border: '2px solid #607D8B' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                                <LaptopMacIcon sx={{ fontSize: 32, color: '#607D8B', mr: 1.5 }} />
                                                <Box>
                                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#607D8B' }}>
                                                        Mac
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: '#666' }}>
                                                        Total: {(reportData?.session?.byAuthAndDevice?.mac?.success || 0) +
                                                            (reportData?.session?.byAuthAndDevice?.mac?.failed || 0)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Box sx={{ bgcolor: '#4CAF5020', p: 2, borderRadius: 2, border: '1px solid #4CAF5030' }}>
                                                        <Typography variant="subtitle2" sx={{ color: '#4CAF50', fontWeight: 600, mb: 1 }}>
                                                            Success
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#4CAF50' }}>
                                                            {(reportData?.session?.byAuthAndDevice?.mac?.success || 0).toLocaleString()}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#4CAF50CC', mt: 0.5, display: 'block' }}>
                                                            {(() => {
                                                                const total = (reportData?.session?.byAuthAndDevice?.mac?.success || 0) +
                                                                    (reportData?.session?.byAuthAndDevice?.mac?.failed || 0);
                                                                return total > 0
                                                                    ? `${Math.round((reportData?.session?.byAuthAndDevice?.mac?.success || 0) / total * 100)}% of total`
                                                                    : '0% of total';
                                                            })()}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Box sx={{ bgcolor: '#F4433620', p: 2, borderRadius: 2, border: '1px solid #F4433630' }}>
                                                        <Typography variant="subtitle2" sx={{ color: '#F44336', fontWeight: 600, mb: 1 }}>
                                                            Failed
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#F44336' }}>
                                                            {(reportData?.session?.byAuthAndDevice?.mac?.failed || 0).toLocaleString()}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#F44336CC', mt: 0.5, display: 'block' }}>
                                                            {(() => {
                                                                const total = (reportData?.session?.byAuthAndDevice?.mac?.success || 0) +
                                                                    (reportData?.session?.byAuthAndDevice?.mac?.failed || 0);
                                                                return total > 0
                                                                    ? `${Math.round((reportData?.session?.byAuthAndDevice?.mac?.failed || 0) / total * 100)}% of total`
                                                                    : '0% of total';
                                                            })()}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>



                        {/* Hidden Daily Log Trends Chart */}
                        <Box
                            id="pdf-dailylog-chart"
                            sx={{
                                position: 'absolute',
                                left: -9999,
                                top: -9999,
                                width: 800,
                                height: 400,
                                background: 'white',
                                p: 2,
                                display: reportData ? 'block' : 'none'
                            }}
                        >
                            <ReactECharts
                                option={getDailyLogsChartOption()}
                                style={{ height: '100%', width: '100%' }}
                                opts={{ renderer: 'canvas' }}
                            />
                        </Box>
                        <Box
                            id="pdf-analytics-cards"
                            sx={{
                                position: 'absolute',
                                left: -9999,
                                top: -9999,
                                width: 1200,
                                p: 3,
                                background: 'white',
                                display: reportData ? 'block' : 'none'
                            }}
                        >
                            <Grid container spacing={3}>
                                {/* Total Security */}
                                <Grid item xs={3}>
                                    <Card raised sx={{
                                        height: '100%',
                                        borderRadius: '1rem',
                                        padding: '1rem',
                                        color: '#ffffff',
                                        background: 'linear-gradient(135deg, rgba(114, 81, 214, 0.67), rgba(17, 113, 239, 0.78))',
                                        boxShadow: '0 10px 35px rgba(139, 92, 246, 0.25)'
                                    }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <StorageIcon sx={{ fontSize: 40, mb: 1 }} />
                                            <Typography variant="h6" gutterBottom fontWeight="500">
                                                Total Security
                                            </Typography>
                                            <Typography variant="h3" fontWeight="bold">
                                                {reportData.analytics?.summary?.total?.toLocaleString() || 0}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Normal Security */}
                                <Grid item xs={3}>
                                    <Card raised sx={{
                                        height: '100%',
                                        borderRadius: '1rem',
                                        padding: '1rem',
                                        color: 'white',
                                        backgroundColor: 'hsl(140, 15%, 10%)',
                                        backgroundImage: `
                    radial-gradient(at 88% 40%, hsla(140, 70%, 30%, 1.00) 0px, transparent 85%),
                    radial-gradient(at 49% 30%, hsla(146, 100%, 45%, 0.85) 0px, transparent 85%),
                    radial-gradient(at 14% 26%, hsla(152, 98%, 45%, 1.00) 0px, transparent 85%)
                `,
                                        boxShadow: '0px -16px 24px 0px rgba(100, 255, 100, 0.2) inset'
                                    }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <SecurityIcon sx={{ fontSize: 40, mb: 1 }} />
                                            <Typography variant="h6" gutterBottom fontWeight="500">
                                                Normal Security
                                            </Typography>
                                            <Typography variant="h3" fontWeight="bold">
                                                {reportData.analytics?.summary?.normal?.toLocaleString() || 0}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Warning Security */}
                                <Grid item xs={3}>
                                    <Card raised sx={{
                                        height: '100%',
                                        borderRadius: '1rem',
                                        padding: '1rem',
                                        color: 'white',
                                        backgroundColor: 'hsla(39, 88%, 49%, 1.00)',
                                        backgroundImage: `
                    radial-gradient(at 88% 40%, hsla(39, 90%, 35%, 1.00) 0px, transparent 85%),
                    radial-gradient(at 49% 30%, hsla(45, 100%, 60%, 0.85) 0px, transparent 85%),
                    radial-gradient(at 14% 26%, hsla(42, 98%, 55%, 1.00) 0px, transparent 85%)
                `,
                                        boxShadow: '0px -16px 24px 0px rgba(255, 193, 7, 0.2) inset'
                                    }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <WarningIcon sx={{ fontSize: 40, mb: 1 }} />
                                            <Typography variant="h6" gutterBottom fontWeight="500">
                                                Warning Security
                                            </Typography>
                                            <Typography variant="h3" fontWeight="bold">
                                                {reportData.analytics?.summary?.warnings?.toLocaleString() || 0}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Critical Security */}
                                <Grid item xs={3}>
                                    <Card raised sx={{
                                        height: '100%',
                                        borderRadius: '1rem',
                                        padding: '1rem',
                                        color: 'white',
                                        backgroundColor: 'hsla(15, 88%, 49%, 1.00)',
                                        backgroundImage: `
                    radial-gradient(at 88% 40%, hsla(15, 90%, 35%, 1.00) 0px, transparent 85%),
                    radial-gradient(at 49% 30%, hsla(0, 100%, 60%, 0.85) 0px, transparent 85%),
                    radial-gradient(at 14% 26%, hsla(18, 98%, 55%, 1.00) 0px, transparent 85%)
                `,
                                        boxShadow: '0px -16px 24px 0px rgba(255, 115, 0, 0.2) inset'
                                    }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <SecurityIcon sx={{ fontSize: 40, mb: 1 }} />
                                            <Typography variant="h6" gutterBottom fontWeight="500">
                                                Critical Security
                                            </Typography>
                                            <Typography variant="h3" fontWeight="bold">
                                                {reportData.analytics?.summary?.critical?.toLocaleString() || 0}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Box>

                        <Box
                            id="pdf-top-endpoints"
                            sx={{
                                position: 'absolute',
                                left: -9999,
                                top: -9999,
                                width: 800,
                                height: 400,
                                background: 'white',
                                p: 2,
                                display: reportData ? 'block' : 'none'
                            }}
                        >
                            <ReactECharts
                                option={getTopEndpointsChartOption()}
                                style={{ height: '100%', width: '100%' }}
                                opts={{ renderer: 'canvas' }}
                            />
                        </Box>

                        <Box
                            id="pdf-network-flows"
                            sx={{
                                position: 'absolute',
                                left: -9999,
                                top: -9999,
                                width: 800,
                                height: 400,
                                background: 'white',
                                p: 2,
                                display: reportData ? 'block' : 'none'
                            }}
                        >
                            <ReactECharts
                                option={getNetworkFlowsChartOption()}
                                style={{ height: '100%', width: '100%' }}
                                opts={{ renderer: 'canvas' }}
                            />
                        </Box>

                        <Box
                            id="pdf-alert-distribution"
                            sx={{
                                position: 'absolute',
                                left: -9999,
                                top: -9999,
                                width: 800,
                                height: 400,
                                background: 'white',
                                p: 2,
                                display: reportData ? 'block' : 'none'
                            }}
                        >
                            <ReactECharts
                                option={getAlertDistributionChartOption()}
                                style={{ height: '100%', width: '100%' }}
                                opts={{ renderer: 'canvas' }}
                            />
                        </Box>

                        {/* Hidden Source Countries Chart for PDF */}
                        <Box
                            id="pdf-source-countries"
                            sx={{
                                position: 'absolute',
                                left: -9999,
                                top: -9999,
                                width: 800,
                                height: 400,
                                background: 'white',
                                p: 2,
                                display: reportData ? 'block' : 'none'
                            }}
                        >
                            <ReactECharts
                                option={getSourceCountriesChartOption()}
                                style={{ height: '100%', width: '100%' }}
                                opts={{ renderer: 'canvas' }}
                            />
                        </Box>

                        {/* Hidden Destination Countries Chart for PDF */}
                        <Box
                            id="pdf-destination-countries"
                            sx={{
                                position: 'absolute',
                                left: -9999,
                                top: -9999,
                                width: 800,
                                height: 400,
                                background: 'white',
                                p: 2,
                                display: reportData ? 'block' : 'none'
                            }}
                        >
                            <ReactECharts
                                option={getDestinationCountriesChartOption()}
                                style={{ height: '100%', width: '100%' }}
                                opts={{ renderer: 'canvas' }}
                            />
                        </Box>

                    </Box>
                )}
            </Paper>
        </Box>
    );
};

export default ExecutiveReport;
