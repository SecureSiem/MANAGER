// frontend/src/services/taxii.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:5002';

class TaxiiService {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.listeners = new Map();
        this.isConnected = false;
        this.subscribedEndpoints = new Set();
    }

    /**
     * Connect to WebSocket
     */
    connect(onMessage, onError, onConnect) {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(`${WS_URL}/ws/taxii`);

                this.ws.onopen = () => {
                    console.log('[TAXII] WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;

                    if (onConnect) onConnect();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('[TAXII] Received:', data.type);

                        if (onMessage) onMessage(data);

                        // Call type-specific listeners
                        const listeners = this.listeners.get(data.type);
                        if (listeners) {
                            listeners.forEach(callback => callback(data));
                        }
                    } catch (error) {
                        console.error('[TAXII] Parse error:', error);
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('[TAXII] WebSocket error:', error);
                    this.isConnected = false;
                    if (onError) onError(error);
                };

                this.ws.onclose = () => {
                    console.log('[TAXII] WebSocket disconnected');
                    this.isConnected = false;
                    this.attemptReconnect(onMessage, onError, onConnect);
                };
            } catch (error) {
                console.error('[TAXII] Connection error:', error);
                reject(error);
            }
        });
    }

    /**
     * Attempt to reconnect
     */
    attemptReconnect(onMessage, onError, onConnect) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[TAXII] Reconnecting... attempt ${this.reconnectAttempts}`);

            setTimeout(() => {
                this.connect(onMessage, onError, onConnect);
            }, this.reconnectDelay);
        } else {
            console.error('[TAXII] Max reconnect attempts reached');
        }
    }

    /**
     * Disconnect WebSocket
     */
    disconnect() {
        if (this.ws) {
            this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
            this.subscribedEndpoints.clear();
            console.log('[TAXII] Disconnected');
        }
    }

    /**
     * Subscribe to an endpoint
     */
    subscribe(endpointId) {
        if (!this.isConnected) {
            console.error('[TAXII] Not connected to WebSocket');
            return false;
        }

        this.send({
            type: 'subscribe',
            payload: { endpointId }
        });

        this.subscribedEndpoints.add(endpointId);
        console.log(`[TAXII] Subscribed to ${endpointId}`);
        return true;
    }

    /**
     * Unsubscribe from an endpoint
     */
    unsubscribe(endpointId) {
        if (!this.isConnected) {
            return false;
        }

        this.send({
            type: 'unsubscribe',
            payload: { endpointId }
        });

        this.subscribedEndpoints.delete(endpointId);
        console.log(`[TAXII] Unsubscribed from ${endpointId}`);
        return true;
    }

    /**
     * Send message to WebSocket
     */
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('[TAXII] WebSocket not ready');
        }
    }

    /**
     * Add event listener
     */
    on(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(callback);
    }

    /**
     * Remove event listener
     */
    off(eventType, callback) {
        if (this.listeners.has(eventType)) {
            const listeners = this.listeners.get(eventType);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Ping server
     */
    ping() {
        this.send({ type: 'ping' });
    }

    // REST API methods

    /**
     * Add a new endpoint
     */
    async addEndpoint(endpointData) {
        try {
            const response = await axios.post(`${API_URL}/taxii/endpoints`, endpointData);
            return response.data;
        } catch (error) {
            console.error('[TAXII] Add endpoint error:', error);
            throw error;
        }
    }

    /**
     * Get all endpoints
     */
    async getEndpoints() {
        try {
            const response = await axios.get(`${API_URL}/taxii/endpoints`);
            return response.data;
        } catch (error) {
            console.error('[TAXII] Get endpoints error:', error);
            throw error;
        }
    }

    /**
     * Remove an endpoint
     */
    async removeEndpoint(endpointId) {
        try {
            const response = await axios.delete(`${API_URL}/taxii/endpoints/${endpointId}`);
            return response.data;
        } catch (error) {
            console.error('[TAXII] Remove endpoint error:', error);
            throw error;
        }
    }

    /**
     * Test connection to an endpoint
     */
    async testConnection(url) {
        try {
            const response = await axios.post(`${API_URL}/taxii/test-connection`, { url });
            return response.data;
        } catch (error) {
            console.error('[TAXII] Test connection error:', error);
            throw error;
        }
    }

    /**
     * Get service stats
     */
    async getStats() {
        try {
            const response = await axios.get(`${API_URL}/taxii/stats`);
            return response.data;
        } catch (error) {
            console.error('[TAXII] Get stats error:', error);
            throw error;
        }
    }
}

// Singleton instance
const taxiiService = new TaxiiService();

export default taxiiService;