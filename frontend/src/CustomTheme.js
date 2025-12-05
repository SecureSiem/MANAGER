// frontend/src/CustomTheme.js
import { createTheme } from '@mui/material/styles';

// Dark Cyber Theme - Original theme with purple/cyan cyber aesthetic
const createDarkCyberTheme = () => createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#b299ebff', // cyber-purple
    },
    secondary: {
      main: '#06b6d4', // cyber-blue/cyan
    },
    success: {
      main: '#22c55e',
    },
    warning: {
      main: '#f97316',
    },
    error: {
      main: '#ef4444',
    },
    background: {
      default: '#0f172a', // bg-cyber-dark
      paper: '#1e293b',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#ffffffb3',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 600,
      fontSize: '3.75rem',
      color: '#ffffff',
      letterSpacing: '-0.02em',
      lineHeight: 1.2,
      textShadow: '0 2px 12px rgba(139, 92, 246, 0.5)', // Purple glow
    },
    h2: {
      fontWeight: 600,
      fontSize: '3rem',
      color: '#ffffff',
      letterSpacing: '-0.02em',
      lineHeight: 1.3,
      textShadow: '0 2px 10px rgba(139, 92, 246, 0.4)', // Purple glow
    },
    h3: {
      fontWeight: 600,
      fontSize: '2.25rem',
    },
    h4: {
      fontWeight: 500,
      fontSize: '2rem',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.5rem',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1.25rem',
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(16px)',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(6, 182, 212, 0.12))',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          boxShadow: '0 0 30px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ ownerState }) => {
          const getColor = () => {
            switch (ownerState.color) {
              case 'error':
                return '#EF4444';
              case 'success':
                return '#22C55E';
              case 'info':
                return '#0EA5E9';
              case 'warning':
                return '#F59E0B';
              case 'primary':
                return '#8B5CF6';
              case 'secondary':
                return '#06B6D4';
              default:
                return '#1BFD9C';
            }
          };

          const color = getColor();

          return {
            fontSize: '0.75rem',
            padding: '0.3rem 0.8rem',
            borderRadius: '0.6em',
            color: color,
            border: `1.5px solid ${color}`,
            borderColor: color,
            background: `rgba(255, 255, 255, 0.05)`,
            fontWeight: 500,
            textTransform: 'capitalize',
            backdropFilter: 'blur(6px)',
            boxShadow: `0 0 8px ${color}33`, // Neon glow effect
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: `0 0 12px ${color}`,
              transform: 'scale(1.05)',
            }
          };
        },
        label: {
          padding: '0 4px',
        },
        icon: {
          marginLeft: '4px',
          color: 'inherit',
        },
        deleteIcon: {
          color: 'inherit',
          '&:hover': {
            color: 'inherit',
          },
        },
      },
    }
  }
});

// Sky Blue Modern Theme - Light theme with bright blue/cyan aesthetic
const createSkyBlueTheme = () => createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1d377deb', // bright blue (blue-500)
    },
    secondary: {
      main: '#06b6d4', // cyan (same as dark theme for consistency)
    },
    success: {
      main: '#10b981', // emerald-500
    },
    warning: {
      main: '#f59e0b', // amber-500
    },
    error: {
      main: '#ef4444', // red-500
    },
    background: {
      default: '#f8fafce7', // slate-50
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a', // slate-900
      secondary: '#3b4555ff', // slate-600
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 600,
      fontSize: '3.75rem',
      color: '#0f172a',
      letterSpacing: '-0.02em',
      lineHeight: 1.2,
      textShadow: 'none', // No glow in light theme
    },
    h2: {
      fontWeight: 600,
      fontSize: '3rem',
      color: '#0f172a',
      letterSpacing: '-0.02em',
      lineHeight: 1.3,
      textShadow: 'none',
    },
    h3: {
      fontWeight: 600,
      fontSize: '2.25rem',
      color: '#1e293b',
    },
    h4: {
      fontWeight: 500,
      fontSize: '2rem',
      color: '#1e293b',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.5rem',
      color: '#334155',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1.25rem',
      color: '#334155',
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(16px)',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(6, 182, 212, 0.08))', // Subtle blue gradient
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)', // Soft blue shadow
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          // Solid background for dialogs to ensure text visibility in light theme
          background: '#c1cff0e6',
          backdropFilter: 'none',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ ownerState }) => {
          const getColor = () => {
            switch (ownerState.color) {
              case 'error':
                return '#EF4444';
              case 'success':
                return '#10B981';
              case 'info':
                return '#0EA5E9';
              case 'warning':
                return '#F59E0B';
              case 'primary':
                return '#3B82F6';
              case 'secondary':
                return '#06B6D4';
              default:
                return '#10B981';
            }
          };

          const color = getColor();

          return {
            fontSize: '0.75rem',
            padding: '0.3rem 0.8rem',
            borderRadius: '0.6em',
            color: color,
            border: `1.5px solid ${color}`,
            borderColor: color,
            background: `rgba(59, 130, 246, 0.08)`, // Light blue tint
            fontWeight: 500,
            textTransform: 'capitalize',
            backdropFilter: 'blur(6px)',
            boxShadow: `0 2px 8px ${color}22`, // Subtle shadow instead of glow
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: `0 4px 12px ${color}44`,
              transform: 'scale(1.05)',
              background: `rgba(59, 130, 246, 0.12)`,
            }
          };
        },
        label: {
          padding: '0 4px',
        },
        icon: {
          marginLeft: '4px',
          color: 'inherit',
        },
        deleteIcon: {
          color: 'inherit',
          '&:hover': {
            color: 'inherit',
          },
        },
      },
    }
  }
});

// Get theme based on mode
export const getTheme = (mode) => {
  return mode === 'light' ? createSkyBlueTheme() : createDarkCyberTheme();
};

// Export dark theme as default for backward compatibility
export default createDarkCyberTheme();
