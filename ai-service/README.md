# Sentinel-AI Service

Intelligent AI assistant backend for the CyberSentinel SIEM platform with adaptive response formatting.

## Features

- **Intelligent Question Detection**: Automatically detects whether questions require log analysis or general conversation
- **Adaptive Response Formatting**:
  - **Log-related queries**: Structured SOC-grade analysis with Summary, Key Details, Risk Assessment, and Recommended Actions
  - **General questions**: Natural conversational responses
- **Context-Aware Log Analysis**: Fetches recent security logs when needed for threat analysis
- **Environment-Based Configuration**: Easy deployment across different environments (localhost, office, production)
- **WebSocket LLM Integration**: Fast, real-time AI responses via WebSocket connection
- **Error handling for network and connection issues**

## Configuration

The service can be configured using environment variables:

- `LLM_WS_URL`: WebSocket URL for the LLM server (default: `ws://164.52.194.98:8766`)
- `BACKEND_API_URL`: URL to the backend API for log context (default: `http://localhost:5000`)
- `ENABLE_LOG_CONTEXT`: Enable/disable fetching logs for AI context (default: `true`)
- `LOG_FETCH_LIMIT`: Number of recent logs to fetch for context (default: `10`)

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv ai-venv
   ```

2. Activate the virtual environment:
   - On Windows: `ai-venv\Scripts\activate`
   - On macOS/Linux: `source ai-venv/bin/activate`

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   ```bash
   # Copy the example file
   cp .env.example .env

   # Edit .env with your settings
   # For localhost development - no changes needed
   # For production deployment - update BACKEND_API_URL with your server IP
   ```

5. Run the service:
   ```bash
   python main.py
   ```

The service will start on `http://0.0.0.0:8001`

## Testing

To test the service functionality:

```bash
python test_ai_service.py
```

This will verify:
- WebSocket connection to the LLM server
- Ability to fetch security log context from the backend
- Full chat request processing

## API Endpoints

- `POST /api/chat`: Process chat messages and return AI responses
- `GET /health`: Health check endpoint

## Deployment Guide

### Local Development
The default configuration works for local development:
```bash
# .env file
BACKEND_API_URL=http://localhost:5000
LLM_WS_URL=ws://164.52.194.98:8766
ENABLE_LOG_CONTEXT=true
LOG_FETCH_LIMIT=10
```

### Office/Production Deployment
Update the `.env` file with your server IPs:
```bash
# .env file for production
BACKEND_API_URL=http://192.168.1.192:5000  # Your backend server IP
LLM_WS_URL=ws://164.52.194.98:8766         # Your LLM server
ENABLE_LOG_CONTEXT=true
LOG_FETCH_LIMIT=10
```

**Important for deployment:**
1. Update `BACKEND_API_URL` to your backend server's IP address
2. Ensure the backend API is accessible from the AI service machine
3. Verify the LLM WebSocket URL is reachable
4. Configure firewall rules to allow port 8001
5. Update `backend/.env` with `AI_SERVICE_URL` pointing to this service

**Backend Configuration** (`backend/.env`):
```bash
# For local development
AI_SERVICE_URL=http://localhost:8001

# For production (update with AI service machine IP)
AI_SERVICE_URL=http://192.168.1.XXX:8001
```

## How It Works

### Intelligent Question Detection

The AI automatically adapts its response style based on the question:

**Log Analysis Questions** → Structured SOC Format:
- "Show me recent security alerts"
- "Analyze the latest threats"
- "What suspicious activity occurred?"
- "Find failed login attempts"
- "Check for unauthorized access"
- "Investigate network anomalies"

**Response Format:**
```
1. Summary
   [Brief overview of findings]

2. Key Details
   [Specific log information]

3. Risk Assessment
   [Threat level and impact]

4. Recommended Action
   [What to do next]
```

**General Questions** → Conversational Format:
- "Who are you?"
- "What can you help me with?"
- "How does a SIEM work?"
- "Explain incident response"
- "What is a firewall?"

**Response Format:**
```
[Direct, natural language answer]
```

## Environment Variables Reference

Create a `.env` file in the ai-service directory:

```bash
# LLM WebSocket URL
LLM_WS_URL=ws://164.52.194.98:8766

# Backend API URL (CHANGE FOR DEPLOYMENT!)
BACKEND_API_URL=http://localhost:5000

# Enable log context fetching
ENABLE_LOG_CONTEXT=true

# Number of logs to fetch
LOG_FETCH_LIMIT=10
```

See `.env.example` for a complete template with deployment notes.