// backend/services/taxiiStreamService.js
// CREATE THIS FILE IN: backend/services/taxiiStreamService.js

const WebSocket = require('ws');
const axios = require('axios');
const crypto = require('crypto');

class TaxiiStreamService {
    constructor() {
        this.wss = null;
        this.endpoints = new Map(); // Store dynamic endpoints
        this.activePollers = new Map(); // Active polling intervals
        this.clientSubscriptions = new Map(); // Track which client is subscribed to which endpoint
        this.secureTokens = new Set(); // Valid connection tokens
    }

    /**
     * Initialize WebSocket Server
     */
    initialize(server) {
        this.wss = new WebSocket.Server({
            server,
            path: '/ws/taxii',
            verifyClient: (info, callback) => {
                // Basic security: verify origin
                const origin = info.origin || info.req.headers.origin;
                const allowedOrigins = [
                    'http://localhost:3000',
                    'http://127.0.0.1:3000',
                    'http://localhost:5000',
                    'http://127.0.0.1:5000',
                    'http://192.168.1.133:3000',
                    'http://192.168.1.133:5000',
                    process.env.FRONTEND_URL
                ];

                if (allowedOrigins.includes(origin)) {
                    callback(true);
                } else {
                    console.warn(`[TAXII-WS] Rejected connection from: ${origin}`);
                    callback(false, 403, 'Forbidden');
                }
            }
        });

        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            ws.clientId = clientId;
            ws.isAlive = true;

            console.log(`[TAXII-WS] Client connected: ${clientId}`);

            // Heartbeat
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleClientMessage(ws, data);
                } catch (error) {
                    console.error('[TAXII-WS] Message parse error:', error);
                    this.sendError(ws, 'Invalid message format');
                }
            });

            ws.on('close', () => {
                console.log(`[TAXII-WS] Client disconnected: ${clientId}`);
                this.handleClientDisconnect(ws);
            });

            ws.on('error', (error) => {
                console.error(`[TAXII-WS] WebSocket error for ${clientId}:`, error);
            });

            // Send welcome message
            this.send(ws, {
                type: 'connected',
                clientId: clientId,
                message: 'Connected to TAXII Stream Service'
            });
        });

        // Heartbeat interval
        const heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    console.log(`[TAXII-WS] Terminating inactive client: ${ws.clientId}`);
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000); // 30 seconds

        this.wss.on('close', () => {
            clearInterval(heartbeatInterval);
        });

        console.log('[TAXII-WS] WebSocket server initialized on /ws/taxii');
    }

    /**
     * Handle messages from clients
     */
    async handleClientMessage(ws, data) {
        const { type, payload } = data;

        switch (type) {
            case 'subscribe':
                await this.handleSubscribe(ws, payload);
                break;

            case 'unsubscribe':
                this.handleUnsubscribe(ws, payload);
                break;

            case 'add_endpoint':
                this.handleAddEndpoint(payload);
                break;

            case 'remove_endpoint':
                this.handleRemoveEndpoint(payload);
                break;

            case 'list_endpoints':
                this.handleListEndpoints(ws);
                break;

            case 'ping':
                this.send(ws, { type: 'pong', timestamp: Date.now() });
                break;

            default:
                this.sendError(ws, `Unknown message type: ${type}`);
        }
    }

    /**
     * Subscribe client to an endpoint
     */
    async handleSubscribe(ws, payload) {
        const { endpointId } = payload;

        if (!endpointId) {
            return this.sendError(ws, 'endpointId is required');
        }

        // Check if endpoint exists
        if (!this.endpoints.has(endpointId)) {
            return this.sendError(ws, `Endpoint ${endpointId} not found`);
        }

        // Add client subscription
        if (!this.clientSubscriptions.has(ws.clientId)) {
            this.clientSubscriptions.set(ws.clientId, new Set());
        }
        this.clientSubscriptions.get(ws.clientId).add(endpointId);

        // Start polling if not already active
        if (!this.activePollers.has(endpointId)) {
            await this.startPolling(endpointId);
        }

        this.send(ws, {
            type: 'subscribed',
            endpointId: endpointId,
            endpoint: this.endpoints.get(endpointId)
        });

        console.log(`[TAXII-WS] Client ${ws.clientId} subscribed to ${endpointId}`);
    }

    /**
     * Unsubscribe client from endpoint
     */
    handleUnsubscribe(ws, payload) {
        const { endpointId } = payload;

        if (this.clientSubscriptions.has(ws.clientId)) {
            this.clientSubscriptions.get(ws.clientId).delete(endpointId);

            // Stop polling if no clients are subscribed
            const hasSubscribers = Array.from(this.clientSubscriptions.values())
                .some(subs => subs.has(endpointId));

            if (!hasSubscribers) {
                this.stopPolling(endpointId);
            }
        }

        this.send(ws, {
            type: 'unsubscribed',
            endpointId: endpointId
        });

        console.log(`[TAXII-WS] Client ${ws.clientId} unsubscribed from ${endpointId}`);
    }

    /**
     * Handle client disconnect
     */
    handleClientDisconnect(ws) {
        if (this.clientSubscriptions.has(ws.clientId)) {
            const subscriptions = this.clientSubscriptions.get(ws.clientId);

            // Check if we need to stop any pollers
            subscriptions.forEach(endpointId => {
                const hasOtherSubscribers = Array.from(this.clientSubscriptions.values())
                    .filter(subs => subs !== subscriptions)
                    .some(subs => subs.has(endpointId));

                if (!hasOtherSubscribers) {
                    this.stopPolling(endpointId);
                }
            });

            this.clientSubscriptions.delete(ws.clientId);
        }
    }

    /**
     * Start polling an endpoint
     */
    async startPolling(endpointId) {
        const endpoint = this.endpoints.get(endpointId);
        if (!endpoint) return;

        let lastTimestamp = new Date().toISOString();

        console.log(`[TAXII-WS] Starting polling for ${endpointId} at ${endpoint.url}`);

        const pollFunc = async () => {
            try {
                const response = await axios.get(endpoint.url, {
                    params: {
                        since: lastTimestamp,
                        limit: 100
                    },
                    timeout: 5000
                });

                if (response.data && response.data.logs && response.data.logs.length > 0) {
                    const logs = response.data.logs;

                    // Update last timestamp
                    const latestLog = logs[logs.length - 1];
                    if (latestLog._received_at) {
                        lastTimestamp = latestLog._received_at;
                    }

                    // Broadcast to subscribed clients
                    this.broadcastLogs(endpointId, logs);
                }
            } catch (error) {
                console.error(`[TAXII-WS] Polling error for ${endpointId}:`, error.message);

                // Notify subscribers about error
                this.broadcastError(endpointId, {
                    message: 'Failed to fetch logs from endpoint',
                    error: error.message
                });
            }
        };

        // Initial poll
        await pollFunc();

        // Set up interval (poll every 2 seconds)
        const intervalId = setInterval(pollFunc, 2000);
        this.activePollers.set(endpointId, intervalId);
    }

    /**
     * Stop polling an endpoint
     */
    stopPolling(endpointId) {
        if (this.activePollers.has(endpointId)) {
            clearInterval(this.activePollers.get(endpointId));
            this.activePollers.delete(endpointId);
            console.log(`[TAXII-WS] Stopped polling for ${endpointId}`);
        }
    }

    /**
     * Broadcast logs to subscribed clients
     */
    broadcastLogs(endpointId, logs) {
        this.wss.clients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                const clientSubs = this.clientSubscriptions.get(ws.clientId);
                if (clientSubs && clientSubs.has(endpointId)) {
                    this.send(ws, {
                        type: 'logs',
                        endpointId: endpointId,
                        logs: logs,
                        count: logs.length,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    }

    /**
     * Broadcast error to subscribed clients
     */
    broadcastError(endpointId, errorData) {
        this.wss.clients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                const clientSubs = this.clientSubscriptions.get(ws.clientId);
                if (clientSubs && clientSubs.has(endpointId)) {
                    this.send(ws, {
                        type: 'error',
                        endpointId: endpointId,
                        error: errorData
                    });
                }
            }
        });
    }

    /**
     * Add a new endpoint dynamically
     */
    handleAddEndpoint(payload) {
        const { id, name, url, apiRoot, collection } = payload;

        if (!id || !url) {
            console.error('[TAXII-WS] Add endpoint failed: id and url required');
            return;
        }

        this.endpoints.set(id, {
            id,
            name: name || `Endpoint ${id}`,
            url,
            apiRoot: apiRoot || 'default',
            collection: collection || 'default',
            addedAt: new Date().toISOString()
        });

        console.log(`[TAXII-WS] Added endpoint: ${id} -> ${url}`);

        // Notify all clients about new endpoint
        this.broadcast({
            type: 'endpoint_added',
            endpoint: this.endpoints.get(id)
        });
    }

    /**
     * Remove an endpoint
     */
    handleRemoveEndpoint(payload) {
        const { endpointId } = payload;

        if (this.endpoints.has(endpointId)) {
            // Stop polling
            this.stopPolling(endpointId);

            // Remove from endpoints
            this.endpoints.delete(endpointId);

            // Remove from all client subscriptions
            this.clientSubscriptions.forEach(subs => subs.delete(endpointId));

            console.log(`[TAXII-WS] Removed endpoint: ${endpointId}`);

            // Notify clients
            this.broadcast({
                type: 'endpoint_removed',
                endpointId: endpointId
            });
        }
    }

    /**
     * List all endpoints
     */
    handleListEndpoints(ws) {
        const endpointsList = Array.from(this.endpoints.values());
        this.send(ws, {
            type: 'endpoints_list',
            endpoints: endpointsList,
            count: endpointsList.length
        });
    }

    /**
     * Broadcast message to all clients
     */
    broadcast(data) {
        this.wss.clients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                this.send(ws, data);
            }
        });
    }

    /**
     * Send message to specific client
     */
    send(ws, data) {
        try {
            ws.send(JSON.stringify(data));
        } catch (error) {
            console.error('[TAXII-WS] Send error:', error);
        }
    }

    /**
     * Send error to client
     */
    sendError(ws, message) {
        this.send(ws, {
            type: 'error',
            error: message,
            timestamp: Date.now()
        });
    }

    /**
     * Generate unique client ID
     */
    generateClientId() {
        return `client_${crypto.randomBytes(8).toString('hex')}`;
    }

    /**
     * Get service statistics
     */
    getStats() {
        return {
            connectedClients: this.wss ? this.wss.clients.size : 0,
            endpoints: this.endpoints.size,
            activePollers: this.activePollers.size,
            subscriptions: this.clientSubscriptions.size
        };
    }
}

// Singleton instance
const taxiiStreamService = new TaxiiStreamService();

module.exports = taxiiStreamService;