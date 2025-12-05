// frontend/src/services/wazuh.js
import api from './auth';

export const getWazuhAgents = async () => {
  const response = await api.get('/wazuh/agents');
  return response.data;
};

export const getManagerInfo = async () => {
  const response = await api.get('/wazuh/agents/summary');
  return response.data;
};
