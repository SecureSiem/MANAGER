import React from 'react';
import { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { ThemeProvider as CustomThemeProvider } from './context/ThemeContext';
import { ThemeContext } from './context/ThemeContext';


// Auth Context
import { AuthProvider } from './context/AuthContext';
import AccessControl from './components/Common/AccessControl';
import PatchManagement from './components/Logs/PatchManagement';
import TorBrowser from './components/Logs/TorBrowser';
import DlpMonitoring from './components/Logs/DlpMonitoring';
import StixTaxii from './components/Logs/StixTaxii';
import ExecutiveReport from './components/Reports/ExecutiveReport'
import ContentFilteringWaf from './components/Logs/ContentFilteringWaf';
import EndpointAnalytics from './components/Logs/EndpointAnalytics';

import Layout from './components/layout/Layout';
import Login from './components/Auth/Login';
import Dashboard from './components/Dashboard/Dashboard';
import LogDetails from './components/Logs/LogDetails';
import MajorLogs from './components/Logs/MajorLogs';
import UserDetails from './components/Auth/UserDetails';
import Settings from './components/Common/Settings';
import ProtectedRoute from './components/Common/ProtectedRoute';
import ManualRemediation from './components/Logs/manualRemediation';
import Tickets from './components/Tickets/Tickets';
import Reports from './components/Reports/Reports';
import MitreAttack from './components/ComplianceReports/MitreAttack';
import Hipaa from './components/ComplianceReports/Hipaa';
import Gdpr from './components/ComplianceReports/Gdpr';
import Nist from './components/ComplianceReports/Nist';
import Pcidss from './components/ComplianceReports/Pcidss';
import Tsc from './components/ComplianceReports/Tsc';
import Vulnerability from './components/ThreatIntelligence/Vulnerability';
import AboutUs from './components/StaticPages/AboutUs';
import PrivacyPolicy from './components/StaticPages/PrivacyPolicy';
import TermsOfService from './components/StaticPages/TermsOfService';
import ContactUs from './components/StaticPages/ContactUs';
import ThreatHunting from './components/ThreatIntelligence/ThreatHunting';
import FIM from './components/Logs/FIM';
import SentinelAI from './components/Logs/SentinelAI';
import AdvancedAnalytics from './components/Logs/AdvancedAnalytics';
import SCA from './components/Logs/SCA';
import Session from './components/Logs/Session';
import Malware from './components/Logs/Malware';
import ConnectionAnalysis from './components/Logs/ConnectionAnalysis';
import SOAR from './components/Logs/SOAR';
import FalsePositiveManagement from './components/Logs/FalsePositiveManagement';
import { getTheme } from './CustomTheme';

// Theme configuration
function App() {
  return (

    <CustomThemeProvider>
      <AppWithTheme />
    </CustomThemeProvider>
  );
}


function AppWithTheme() {
  const { themeMode } = useContext(ThemeContext);


  // === Shared Time Range State (move from pages to here!) ===
  const [timeRange, setTimeRange] = React.useState('7d');

  // On mount: read from localStorage (only once).
  React.useEffect(() => {
    const saved = localStorage.getItem('selectedTimeRange');
    if (saved) setTimeRange(saved);
  }, []);

  // On change: update localStorage.
  React.useEffect(() => {
    localStorage.setItem('selectedTimeRange', timeRange);
  }, [timeRange]);


  // Get dynamic theme based on current theme mode
  const theme = getTheme(themeMode);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="logs" element={<LogDetails timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="majorlogs" element={<MajorLogs timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="advanced-analytics" element={<AdvancedAnalytics timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="endpoint-analytics" element={<EndpointAnalytics timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="fim" element={<FIM timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="sessions" element={<Session timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="tor-browser" element={<TorBrowser timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="dlp-monitoring" element={<DlpMonitoring timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="content-filtering-waf" element={<ContentFilteringWaf timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="sca" element={<SCA timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="stix-taxii" element={<StixTaxii timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="malware" element={<Malware timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="connectionspage" element={<ConnectionAnalysis timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="sentinelai" element={<SentinelAI timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="remediation" element={<ManualRemediation timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="false-positives" element={<FalsePositiveManagement timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="soar" element={<SOAR timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="patch-management" element={<PatchManagement timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="tickets" element={<Tickets timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="reports" element={<Reports timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="executive-report" element={<ExecutiveReport timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="compliance/mitre" element={<MitreAttack timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="compliance/hipaa" element={<Hipaa timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="compliance/gdpr" element={<Gdpr timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="compliance/nist" element={<Nist timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="compliance/pcidss" element={<Pcidss timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="compliance/tsc" element={<Tsc timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="threatintelligence/vulnerability" element={<Vulnerability timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="threatintelligence/threathunting" element={<ThreatHunting timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="users" element={<Navigate to="/profile" replace />} />
              <Route path="profile" element={<UserDetails timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="settings" element={<Settings timeRange={timeRange} setTimeRange={setTimeRange} />} />
              <Route path="about" element={<AboutUs />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
              <Route path="terms" element={<TermsOfService />} />
              <Route path="contact" element={<ContactUs />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
