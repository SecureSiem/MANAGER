const axios = require('axios');
const https = require('https');

let wazuhToken = null;
let tokenExpiry = null;

const fetchToken = async () => {
  const { WAZUH_HOST, WAZUH_PORT, WAZUH_USERNAME, WAZUH_PASSWORD } = process.env;
  const url = `https://${WAZUH_HOST}:${WAZUH_PORT}/security/user/authenticate?raw=true`;

  console.log('--- Fetching token from Wazuh ---');
  console.log('Host:', WAZUH_HOST);
  console.log('User:', WAZUH_USERNAME);

  try {
    const response = await axios.get(url, {
      auth: {
        username: WAZUH_USERNAME,
        password: WAZUH_PASSWORD
      },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      timeout: 5000
    });

    wazuhToken = response.data;
    tokenExpiry = Date.now() + 15 * 60 * 1000;
    console.log('✅ Token fetched successfully.');
  } catch (err) {
    console.error('❌ Token fetch failed:', err?.response?.data || err.message);
    console.log('Auth being sent =>', WAZUH_USERNAME, WAZUH_PASSWORD);
    throw new Error('Wazuh token request failed');
  }
};



const getToken = async () => {
  if (!wazuhToken || Date.now() >= tokenExpiry) {
    await fetchToken();
  }
  return wazuhToken;
};

const getWazuhAgents = async () => {
  try {
    const token = await getToken();
    const { WAZUH_HOST, WAZUH_PORT } = process.env;
    const url = `https://${WAZUH_HOST}:${WAZUH_PORT}/agents?pretty=true`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 5000
    });

    return response.data;
  } catch (err) {
    console.error('Agent fetch failed:', err?.response?.data || err.message);
    throw new Error('Wazuh agent data fetch failed');
  }
};

const getStatusSummary = async () => {
  const token = await getToken();
  const { WAZUH_HOST, WAZUH_PORT } = process.env;

  const response = await axios.get(`https://${WAZUH_HOST}:${WAZUH_PORT}/agents/summary/status`, {
    headers: { Authorization: `Bearer ${token}` },
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    timeout: 5000
  });

  return response.data;
};


module.exports = {
  getWazuhAgents,
   getStatusSummary
};
