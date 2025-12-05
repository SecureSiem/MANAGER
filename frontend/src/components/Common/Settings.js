// frontend/src/components/Common/Settings.js

//point tobe noted this section is not being used in any part of the code currently 

import React, { useState, useContext } from 'react';
import {
  Paper,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  Divider,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import { ThemeContext } from '../../context/ThemeContext';
// import LightModeIcon from '@mui/icons-material/LightMode';
// import DarkModeIcon from '@mui/icons-material/DarkMode';
// import PaletteIcon from '@mui/icons-material/Palette';
import SaveIcon from '@mui/icons-material/Save';
// import InfoIcon from '@mui/icons-material/Info';
// import ReactECharts from 'echarts-for-react';

const Settings = () => {
  const theme = useTheme();
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="600">
        Settings
      </Typography>

      <Grid container spacing={3}>
        {/* <Grid item xs={12} md={6}>
          <Card raised elevation={3}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PaletteIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
                <Typography variant="h6" gutterBottom>
                  Appearance
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={darkMode}
                      onChange={toggleDarkMode}
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body1" sx={{ mr: 1 }}>
                        {darkMode ? 'Dark Mode' : 'Light Mode'}
                      </Typography>
                      {darkMode ?
                        <DarkModeIcon fontSize="small" color="primary" /> :
                        <LightModeIcon fontSize="small" color="primary" />
                      }
                    </Box>
                  }
                />

                <Tooltip title="Toggle dark/light mode to better visualize charts and UI elements">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                p: 2,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                borderRadius: 1
              }}>
                <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                  Dark mode optimizes visibility for charts and reduces eye strain during night operations.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid> */}

    {/* chnaged by raman  */}



        <Grid item xs={12} md={6}>
          <Card raised elevation={3}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SaveIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
                <Typography variant="h6" gutterBottom>
                  Preferences
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Typography variant="body1" paragraph>
                Your theme preference is automatically saved and will be applied each time you log in.
              </Typography>

              <Box sx={{
                p: 2,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.1)' : 'rgba(33, 150, 243, 0.05)',
                borderRadius: 1,
                border: `1px solid ${theme.palette.primary.main}`,
              }}>
                <Typography variant="body2">
                  Currently using: <strong>{theme.palette.mode === 'dark' ? 'Cyber-Dark Theme' : 'Light Theme'}</strong>
                </Typography>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload Client Logo
                </Typography>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        localStorage.setItem('clientLogo', reader.result); // Store as base64
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                  Logo will be used in exported reports (stored locally).
                </Typography>
              </Box>

            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;
