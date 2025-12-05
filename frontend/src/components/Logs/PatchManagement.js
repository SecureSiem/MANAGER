import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider
} from '@mui/material';
import {
  Security,
  Update,
  Schedule,
  Assessment,
  CheckCircle,
  Warning,
  TrendingUp,
  Shield
} from '@mui/icons-material';

const PatchManagement = () => {
  const benefits = [
    {
      title: 'Enhanced Security',
      description: 'Protect against known vulnerabilities and security threats',
      icon: <Security color="primary" />
    },
    {
      title: 'Compliance Adherence',
      description: 'Meet regulatory requirements and industry standards',
      icon: <Shield color="primary" />
    },
    {
      title: 'System Stability',
      description: 'Improve system performance and reduce downtime',
      icon: <TrendingUp color="primary" />
    },
    {
      title: 'Risk Mitigation',
      description: 'Reduce exposure to cyber attacks and data breaches',
      icon: <Warning color="primary" />
    }
  ];

  const processSteps = [
    'Asset Discovery & Inventory',
    'Vulnerability Assessment',
    'Patch Testing & Validation',
    'Deployment Planning',
    'Patch Installation',
    'Verification & Monitoring'
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
        Patch Management
      </Typography>
      
      <Grid container spacing={3}>
        {/* Overview Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Update color="primary" />
              Overview
            </Typography>
            <Typography variant="body1" paragraph>
              Patch Management is a critical cybersecurity practice that involves identifying, acquiring, 
              testing, and installing patches for software and systems within an organization. This systematic 
              approach ensures that security vulnerabilities are addressed promptly while maintaining system 
              stability and compliance.
            </Typography>
          </Paper>
        </Grid>

        {/* Benefits Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle color="primary" />
              Key Benefits
            </Typography>
            <Grid container spacing={2}>
              {benefits.map((benefit, index) => (
                <Grid item xs={12} key={index}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        {benefit.icon}
                        <Typography variant="h6">{benefit.title}</Typography>
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        {benefit.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Process Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule color="primary" />
              Patch Management Process
            </Typography>
            <List>
              {processSteps.map((step, index) => (
                <React.Fragment key={index}>
                  <ListItem>
                    <ListItemIcon>
                      <Chip 
                        label={index + 1} 
                        color="primary" 
                        size="small" 
                        sx={{ minWidth: 32, height: 24 }}
                      />
                    </ListItemIcon>
                    <ListItemText primary={step} />
                  </ListItem>
                  {index < processSteps.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Best Practices Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment color="primary" />
              Best Practices
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Regular Assessment</Typography>
                    <Typography variant="body2">
                      Conduct regular vulnerability assessments and maintain an updated inventory 
                      of all systems and applications.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Testing Environment</Typography>
                    <Typography variant="body2">
                      Test all patches in a controlled environment before deploying to 
                      production systems.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Documentation</Typography>
                    <Typography variant="body2">
                      Maintain detailed records of all patches applied, including dates, 
                      systems affected, and any issues encountered.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PatchManagement;