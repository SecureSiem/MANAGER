import React, { useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Link,
  Fade,
  Slide,
  Chip,
  Divider
} from '@mui/material';
import {
  Security,
  Login as LoginIcon,
  Visibility,
  VisibilityOff,
  Shield,
  Speed,
  Analytics
} from '@mui/icons-material';
import loginBackground from '../../assets/login_background.jpg';
import vgilLogo from '../../assets/vgil_logo.png';
import cyberSentinelLogo from '../../assets/cybersentinel.png';

// Enhanced Footer Component for Login Page
const LoginFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(41, 20, 80, 0.23)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        py: 2,
        px: 3,
        zIndex: 1000,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <img
          src={vgilLogo}
          alt="VGIL Logo"
          style={{
            height: 24,
            width: 'auto',
            objectFit: 'contain'
          }}
        />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          © {currentYear} Security Log Manager. All rights reserved.
        </Typography>
      </Box>
      
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <Link
          component={RouterLink}
          to="/about"
          color="inherit"
          variant="body2"
          underline="hover"
          sx={{
            transition: 'color 0.3s ease',
            '&:hover': { color: 'primary.main' }
          }}
        >
          About Us
        </Link>
        <Link
          component={RouterLink}
          to="/privacy"
          color="inherit"
          variant="body2"
          underline="hover"
          sx={{
            transition: 'color 0.3s ease',
            '&:hover': { color: 'primary.main' }
          }}
        >
          Privacy Policy
        </Link>
        <Link
          component={RouterLink}
          to="/terms"
          color="inherit"
          variant="body2"
          underline="hover"
          sx={{
            transition: 'color 0.3s ease',
            '&:hover': { color: 'primary.main' }
          }}
        >
          Terms of Service
        </Link>
        <Link
          component={RouterLink}
          to="/contact"
          color="inherit"
          variant="body2"
          underline="hover"
          sx={{
            transition: 'color 0.3s ease',
            '&:hover': { color: 'primary.main' }
          }}
        >
          Contact
        </Link>
      </Box>
    </Box>
  );
};

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get return URL from location state or default to dashboard
  const from = location.state?.from || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!username) return setError('Username is required');
    if (!password) return setError('Password is required');
    
    try {
      setError('');
      setLoading(true);
      
      // Login
      await login(username, password);
      
      // Navigate to return URL
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: <Security />, title: 'Advanced Security', desc: 'Multi-layered protection' },
    { icon: <Speed />, title: 'Real-time Monitoring', desc: 'Instant threat detection' },
    { icon: <Analytics />, title: 'Smart Analytics', desc: 'AI-powered insights' }
  ];

  return (
    <>
      <Box
        sx={{
          minHeight: '100vh',
          backgroundImage: `url(${loginBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          pb: 8, // Add padding for footer
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%)',
            zIndex: 1
          }
        }}
      >
        {/* Animated background elements */}
        <Box
          sx={{
            position: 'absolute',
            top: '10%',
            left: '10%',
            width: '300px',
            height: '300px',
            background: 'linear-gradient(45deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
            borderRadius: '50%',
            animation: 'float 6s ease-in-out infinite',
            zIndex: 1,
            '@keyframes float': {
              '0%, 100%': { transform: 'translateY(0px)' },
              '50%': { transform: 'translateY(-20px)' }
            }
          }}
        />
        
        <Box
          sx={{
            position: 'absolute',
            bottom: '15%',
            right: '15%',
            width: '200px',
            height: '200px',
            background: 'linear-gradient(45deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))',
            borderRadius: '50%',
            animation: 'float 8s ease-in-out infinite reverse',
            zIndex: 1
          }}
        />

        <Container component="main" maxWidth="lg" sx={{ position: 'relative', zIndex: 2 }}>
          <Box sx={{ 
            display: 'flex', 
            gap: 4, 
            alignItems: 'center',
            flexDirection: { xs: 'column', lg: 'row' }
          }}>
            
            {/* Left side - Features */}
            <Fade in timeout={1000}>
              <Box sx={{ 
                flex: 1, 
                display: { xs: 'none', lg: 'block' },
                maxWidth: '500px'
              }}>
                {/* Large CyberSentinel Logo */}
                <Box 
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 4,
                    animation: 'logoFloat 4s ease-in-out infinite',
                    '@keyframes logoFloat': {
                      '0%, 100%': { transform: 'translateY(0px) scale(1)' },
                      '50%': { transform: 'translateY(-10px) scale(1.02)' }
                    }
                  }}
                >
                  <img 
                    src={cyberSentinelLogo} 
                    alt="CyberSentinel" 
                    style={{
                      width: '350px',
                      height: 'auto',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.84))',
                      transition: 'all 0.3s ease'
                    }}
                  />
                </Box>
                
                <Typography 
                  variant="h5" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.9)',
                    mb: 4,
                    textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
                    textAlign: 'center',
                    fontWeight: 600
                  }}
                >
                  Next-Generation SIEM Solution
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {features.map((feature, index) => (
                    <Slide 
                      key={index}
                      direction="right" 
                      in timeout={1000 + (index * 200)}
                    >
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 2,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        p: 2,
                        borderRadius: 2,
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.15)',
                          transform: 'translateX(10px)'
                        }
                      }}>
                        <Box sx={{ 
                          color: 'white', 
                          display: 'flex',
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          borderRadius: '50%',
                          p: 1
                        }}>
                          {feature.icon}
                        </Box>
                        <Box>
                          <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                            {feature.title}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                            {feature.desc}
                          </Typography>
                        </Box>
                      </Box>
                    </Slide>
                  ))}
                </Box>
              </Box>
            </Fade>

            {/* Right side - Login Form */}
            <Slide direction="left" in timeout={800}>
              <Paper
                elevation={24}
                sx={{
                  p: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.76)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: 4,
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.3s ease-in-out',
                  maxWidth: '450px',
                  width: '100%',
                  '&:hover': {
                    // backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    transform: 'translateY(-5px)',
                    boxShadow: '0 25px 70px rgba(0, 0, 0, 0.4)'
                  }
                }}
              >

                
                {/* Title Section */}
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Typography 
                    component="h1" 
                    variant="h4" 
                    sx={{ 
                      mb: 1,
                      fontWeight: 'bold',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1
                    }}
                  >
                    <Shield sx={{ color: '#667eea', fontSize: '2rem' }} />
                    CyberSentinel 
                  </Typography>
                  
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: 'text.secondary',
                      fontWeight: 500,
                      mb: 2
                    }}
                  >
                    Secure Access Portal
                  </Typography>
  
                </Box>
                
                {error && (
                  <Fade in>
                    <Alert 
                      severity="error" 
                      sx={{ 
                        width: '100%', 
                        mb: 2,
                        borderRadius: 2,
                        backgroundColor: 'rgba(211, 47, 47, 0.1)',
                        border: '1px solid rgba(211, 47, 47, 0.3)',
                        animation: 'shake 0.5s ease-in-out',
                        '@keyframes shake': {
                          '0%, 100%': { transform: 'translateX(0)' },
                          '25%': { transform: 'translateX(-5px)' },
                          '75%': { transform: 'translateX(5px)' }
                        }
                      }}
                    >
                      {error}
                    </Alert>
                  </Fade>
                )}
                
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="username"
                    label="Username"
                    name="username"
                    autoComplete="username"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 3,
                        backgroundColor: 'rgba(255, 255, 255, 0.29)',
                        transition: 'all 0.3s ease-in-out',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)'
                        },
                        '&.Mui-focused': {
                          backgroundColor: 'rgba(255, 255, 255, 0)',
                          boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.2)',
                          transform: 'translateY(-2px)'
                        }
                      }
                    }}
                  />
                  
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    InputProps={{
                      endAdornment: (
                        <Button
                          onClick={() => setShowPassword(!showPassword)}
                          sx={{ minWidth: 'auto', p: 1 }}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </Button>
                      )
                    }}
                    sx={{
                      mb: 3,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 3,
                        backgroundColor: 'rgba(248, 248, 248, 0.08)',
                        transition: 'all 0.3s ease-in-out',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.09)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)'
                        },
                        '&.Mui-focused': {
                          backgroundColor: 'rgba(255, 255, 255, 0)',
                          boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.2)',
                          transform: 'translateY(-2px)'
                        }
                      }
                    }}
                  />
                  
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disabled={loading}
                    startIcon={loading ? null : <LoginIcon />}
                    sx={{ 
                      py: 1.8,
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      boxShadow: '0 8px 30px rgba(102, 126, 234, 0.4)',
                      transition: 'all 0.3s ease-in-out',
                      textTransform: 'none',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                        transform: 'translateY(-3px)',
                        boxShadow: '0 12px 35px rgba(102, 126, 234, 0.6)'
                      },
                      '&:active': {
                        transform: 'translateY(-1px)'
                      },
                      '&.Mui-disabled': {
                        background: 'rgba(0, 0, 0, 0.12)',
                        color: 'rgba(0, 0, 0, 0.26)'
                      }
                    }}
                  >
                    {loading ? (
                      <CircularProgress 
                        size={24} 
                        sx={{ color: 'white' }}
                      />
                    ) : (
                      'Sign In Securely'
                    )}
                  </Button>

                  <Divider sx={{ my: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Powered by Advanced Security
                    </Typography>
                  </Divider>
                  
                  <Box 
                    sx={{ 
                      textAlign: 'center',
                      p: 2,
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
                      borderRadius: 3,
                      border: '1px solid rgba(102, 126, 234, 0.2)',
                      position: 'relative',
                      overflow: 'hidden',
                      mb: 3,
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                        animation: 'shimmer 3s infinite',
                        '@keyframes shimmer': {
                          '0%': { left: '-100%' },
                          '100%': { left: '100%' }
                        }
                      }
                    }}
                  >
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'primary.main',
                        fontWeight: 600,
                        position: 'relative',
                        zIndex: 1
                      }}
                    >
                      🛡️ Enterprise-Grade SIEM Solution
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: 'text.secondary',
                        fontStyle: 'italic',
                        position: 'relative',
                        zIndex: 1
                      }}
                    >
                      Protecting your digital infrastructure 24/7
                    </Typography>
                  </Box>

                  {/* VGIL Logo at Bottom */}
                  <Fade in timeout={1400}>
                    <Box 
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        p: 2,
                        backgroundColor: 'rgba(248, 250, 252, 1)',
                        borderRadius: 3,
                        border: '1px solid rgba(102, 126, 234, 0.1)',
                        transition: 'all 0.3s ease-in-out',
                        '&:hover': {
                          backgroundColor: 'rgba(248, 250, 252, 1)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }
                      }}
                    >
                
                      <img 
                        src={vgilLogo} 
                        alt="VGIL Logo" 
                        style={{
                          width: '170px',
                          height: '35px',
                          objectFit: 'contain'
                        }}
                      />
                    </Box>
                  </Fade>
                </Box>
              </Paper>
            </Slide>
          </Box>
        </Container>
      </Box>
      
      {/* Footer */}
      <LoginFooter />
    </>
  );
};

export default Login;
