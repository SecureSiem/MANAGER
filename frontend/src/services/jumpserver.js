// frontend/src/services/jumpserver.js
import api from './auth';

export const getJumpServerAssets = async () => {
  try {
    const response = await api.get('/jumpserver/assets');
    return response.data;
  } catch (error) {
    console.error('Error fetching jumpserver assets:', error);
    throw error;
  }
};

export const getJumpServerConfig = async () => {
  try {
    const response = await api.get('/jumpserver/config');
    return response.data;
  } catch (error) {
    console.error('Error fetching jumpserver config:', error);
    throw error;
  }
};