// frontend/src/services/audits.js
import api from './auth';

export const getDeviceNames = async () => {
  try {
    const response = await api.get('/audits/devices');
    return response.data;
  } catch (error) {
    console.error('Error fetching device names:', error);
    return {
      devices: [],
      totalDevices: 0
    };
  }
};
