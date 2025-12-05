import api from './auth';

export const getShuffleConfig = async () => {
  try {
    const response = await api.get('/shuffle/config');
    return response.data;
  } catch (error) {
    console.error('Error fetching shuffle config:', error);
    throw error;
  }
};
