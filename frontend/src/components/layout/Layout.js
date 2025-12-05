import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, CssBaseline, Toolbar } from '@mui/material';
import Header from '../Common/Header';
import Sidebar from '../Common/Sidebar';
import NewsTicker from '../Common/NewsTicker';
import Footer from '../Common/Footer';
import AIChatSidebar from '../Common/AIChatSidebar';

// Set to match your actual sidebar widths
const drawerWidth = 280;
const collapsedWidth = 100;
const aiChatWidth = 420;


const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pageTitle, setPageTitle] = useState('Dashboard');
  const [aiChatOpen, setAIChatOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const toggleAIChat = () => setAIChatOpen(prev => !prev);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <CssBaseline />

      {/* Header and Sidebar */}
      <Box sx={{ display: 'flex', flex: 1, position: 'relative' }}>
        <Header
          open={sidebarOpen}
          toggleDrawer={toggleSidebar}
          title={pageTitle}
          onAIChatToggle={toggleAIChat}
          isAIChatOpen={aiChatOpen}
        />
        <Sidebar open={sidebarOpen} toggleDrawer={toggleSidebar} />

        {/* Main content area: shifts when AI chat opens */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 5,
            display: 'flex',
            flexDirection: 'column',
            pb: 12,
            overflow: 'auto',
            minHeight: '100vh',
            boxSizing: 'border-box',
            marginRight: aiChatOpen ? `${aiChatWidth}px` : 0,
            transition: 'all 0.3s ease-in-out',
          }}
        >
          <Toolbar />
          <Box sx={{ flex: 1 }}>
            <Outlet context={{ setPageTitle }} />
          </Box>
        </Box>

        {/* AI Chat Sidebar */}
        <AIChatSidebar open={aiChatOpen} onClose={toggleAIChat} />
      </Box>

      {/* NewsTicker fixed above footer, shifts based on sidebar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 48,
          left: sidebarOpen ? `${drawerWidth}px` : `${collapsedWidth}px`,
          right: aiChatOpen ? `${aiChatWidth}px` : 0,
          zIndex: 1100,
          bgcolor: 'background.paper',
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <NewsTicker />
      </Box>

      {/* Footer fixed at bottom, shifts based on sidebar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: sidebarOpen ? `${drawerWidth}px` : `${collapsedWidth}px`,
          right: aiChatOpen ? `${aiChatWidth}px` : 0,
          height: 48,
          bgcolor: 'cyberDark.main',
          zIndex: 1000,
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <Footer />
      </Box>
    </Box>
  );
};

export default Layout;
