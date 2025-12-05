// frontend/src/context/ThemeContext.js
import React, { createContext, useState } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Check if there's a stored preference in localStorage
  // Default to 'dark' for existing users, or check old 'darkMode' setting
  const [themeMode, setThemeMode] = useState(() => {
    const savedThemeMode = localStorage.getItem('themeMode');
    if (savedThemeMode) {
      return savedThemeMode;
    }

    // Migration: Check old darkMode setting
    const oldDarkMode = localStorage.getItem('darkMode');
    if (oldDarkMode === 'false') {
      return 'light';
    }

    // Default to dark theme (original theme)
    return 'dark';
  });

  // Toggle between dark and light themes
  const toggleTheme = () => {
    const newMode = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(newMode);
    localStorage.setItem('themeMode', newMode);
  };

  // Helper to check if dark mode is active
  const isDarkMode = themeMode === 'dark';

  // Provide the theme context to all children components
  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme, isDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
