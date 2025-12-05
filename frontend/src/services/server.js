// frontend/src/services/server.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';  // Changed default port to 5000 to match backend

// Create axios instance with auth token
const createAuthenticatedRequest = () => {
  const token = localStorage.getItem('token');
  return axios.create({
    baseURL: API_URL,
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    },
    timeout: 10000  // Added timeout to prevent hanging
  });
};

export const serverService = {
  // Get server statistics
  getServerStats: async () => {
    try {
      const api = createAuthenticatedRequest();
      const response = await api.get('/server/stats');  // Added /api prefix to match backend route
      return response.data;
    } catch (error) {
      console.error('Error fetching server stats:', error);
      throw error;
    }
  },

  // Get server health status
  getServerHealth: async () => {
    try {
      const api = createAuthenticatedRequest();
      const response = await api.get('/server/health');  // Added /api prefix to match backend route
      return response.data;
    } catch (error) {
      console.error('Error fetching server health:', error);
      throw error;
    }
  }
};