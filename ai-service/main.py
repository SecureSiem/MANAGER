"""
Sentinel-AI Chat Service
FastAPI backend for WebSocket LLM integration (ChatML compatible)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
import os
import asyncio
import websockets
import json
import httpx
import re
from typing import Dict, Any

# Configuration - Environment-based for deployment flexibility
LLM_WEBSOCKET_URL = os.getenv("LLM_WS_URL", "ws://164.52.194.98:8766")
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")
ENABLE_LOG_CONTEXT = os.getenv("ENABLE_LOG_CONTEXT", "true").lower() == "true"
LOG_FETCH_LIMIT = int(os.getenv("LOG_FETCH_LIMIT", "10"))

# System prompts - Different prompts for different query types
STRUCTURED_SYSTEM_PROMPT = """
You are Sentinel-AI, the cybersecurity assistant for the CyberSentinel SIEM platform.

# Behavioral Guidelines
- Act as a Senior SOC Analyst.
- Use professional, precise language.
- No emojis, stars, or decorative text.
- Always provide structured output:
  1. Summary
  2. Key Details
  3. Risk Assessment
  4. Recommended Action
- Never invent missing information.

# Identity Responses
- "Who are you?" → "I am Sentinel-AI, the cybersecurity assistant integrated into CyberSentinel."
- "What is my name?" → "I do not store personal identity."

# Objective
Provide SOC-grade, accurate, structured cybersecurity insights based on the provided log data.
"""

CONVERSATIONAL_SYSTEM_PROMPT = """
You are Sentinel-AI, an intelligent cybersecurity assistant for the CyberSentinel SIEM platform.

# Behavioral Guidelines
- Provide clear, professional, and conversational responses.
- Answer questions directly and concisely.
- Use technical terms when appropriate, but remain accessible.
- No emojis or decorative text.
- Be helpful and informative.

# Identity
- You are Sentinel-AI, integrated into the CyberSentinel platform.
- You assist with cybersecurity questions, system guidance, and general inquiries.

# Objective
Provide accurate, professional answers in a natural conversational style.
"""


# FastAPI App
app = FastAPI(
    title="Sentinel-AI Chat Backend",
    description="Backend AI service for CyberSentinel SIEM",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------- MODELS --------------------
class ChatRequest(BaseModel):
    user_id: str
    message: str


class ChatResponse(BaseModel):
    status: str
    response_text: str
    model_name: str
    latency_ms: int


# -------------------- QUESTION TYPE DETECTION --------------------
def detect_question_type(message: str) -> str:
    """
    Detect if the question requires log analysis or is a general query.
    Returns: 'log_analysis' or 'conversational'
    """
    message_lower = message.lower()

    # Keywords that indicate log analysis or security analysis
    log_keywords = [
        'log', 'logs', 'alert', 'alerts', 'threat', 'threats',
        'attack', 'attacks', 'intrusion', 'security event', 'events',
        'incident', 'incidents', 'anomaly', 'anomalies',
        'vulnerability', 'vulnerabilities', 'breach', 'breaches',
        'suspicious', 'malicious', 'investigation', 'analyze',
        'forensic', 'detect', 'detection', 'show me', 'find',
        'recent activity', 'failed login', 'unauthorized', 'blocked',
        'firewall', 'ids', 'ips', 'siem', 'soc',
        'endpoint', 'network', 'traffic', 'connection'
    ]

    # Check if message contains log-related keywords
    for keyword in log_keywords:
        if keyword in message_lower:
            return 'log_analysis'

    # Question patterns that typically need log data
    log_patterns = [
        r'what.*happen',
        r'show.*activity',
        r'any.*alert',
        r'recent.*event',
        r'list.*log',
        r'find.*attack',
        r'detect.*threat'
    ]

    for pattern in log_patterns:
        if re.search(pattern, message_lower):
            return 'log_analysis'

    return 'conversational'


# -------------------- LOG FETCH --------------------
async def fetch_recent_logs(limit: int = 10) -> Dict[str, Any]:
    """
    Fetch recent security logs from the backend API.
    Returns a dictionary with logs and metadata.
    """
    if not ENABLE_LOG_CONTEXT:
        return {"logs": [], "count": 0, "message": "Log context disabled"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Fetch recent logs from backend
            response = await client.get(
                f"{BACKEND_API_URL}/api/logs",
                params={
                    "limit": limit,
                    "timeRange": "1h"  # Last hour
                }
            )

            if response.status_code == 200:
                data = response.json()
                logs = data.get('logs', [])

                return {
                    "logs": logs,
                    "count": len(logs),
                    "message": f"Retrieved {len(logs)} recent logs"
                }
            else:
                return {
                    "logs": [],
                    "count": 0,
                    "message": f"Failed to fetch logs: {response.status_code}"
                }

    except Exception as e:
        return {
            "logs": [],
            "count": 0,
            "message": f"Error fetching logs: {str(e)}"
        }


def format_logs_for_context(log_data: Dict[str, Any]) -> str:
    """
    Format logs into a readable context string for the LLM.
    """
    if not log_data.get('logs') or log_data['count'] == 0:
        return ""

    logs = log_data['logs']
    context_parts = [f"\n--- SECURITY LOG CONTEXT ({log_data['count']} recent events) ---"]

    for idx, log in enumerate(logs[:LOG_FETCH_LIMIT], 1):
        log_entry = f"\nLog {idx}:"

        # Extract key fields
        if 'timestamp' in log:
            log_entry += f"\n  Time: {log['timestamp']}"
        if 'event_type' in log:
            log_entry += f"\n  Type: {log['event_type']}"
        if 'severity' in log:
            log_entry += f"\n  Severity: {log['severity']}"
        if 'source_ip' in log:
            log_entry += f"\n  Source IP: {log['source_ip']}"
        if 'destination_ip' in log:
            log_entry += f"\n  Dest IP: {log['destination_ip']}"
        if 'message' in log:
            log_entry += f"\n  Message: {log['message']}"
        if 'rule_name' in log:
            log_entry += f"\n  Rule: {log['rule_name']}"

        context_parts.append(log_entry)

    context_parts.append("\n--- END LOG CONTEXT ---\n")
    return "\n".join(context_parts)


# -------------------- LLM CALL --------------------
async def call_websocket_llm(messages, timeout: int = 60) -> str:
    try:
        ws = await asyncio.wait_for(websockets.connect(LLM_WEBSOCKET_URL), timeout=timeout)

        async with ws:
            # Send the ChatML payload
            await ws.send(json.dumps({"messages": messages}))

            # Receive response
            raw = await ws.recv()
            data = json.loads(raw)

            return data.get("response", "Error: No response returned")

    except Exception as e:
        raise Exception(f"LLM WebSocket Error: {str(e)}")


# -------------------- CHAT ENDPOINT --------------------
@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    start = time.time()

    try:
        # Detect question type
        question_type = detect_question_type(request.message)

        # Select appropriate system prompt based on question type
        if question_type == 'log_analysis':
            system_prompt = STRUCTURED_SYSTEM_PROMPT
            # Fetch logs for analysis
            log_data = await fetch_recent_logs(limit=LOG_FETCH_LIMIT)
            logs_context = format_logs_for_context(log_data)
        else:
            system_prompt = CONVERSATIONAL_SYSTEM_PROMPT
            logs_context = ""

        # Build ChatML messages
        user_content = f"{logs_context}\n{request.message}".strip() if logs_context else request.message

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        # Call model
        reply = await call_websocket_llm(messages)

        latency = int((time.time() - start) * 1000)

        return ChatResponse(
            status="success",
            response_text=reply,
            model_name="Sentinel-AI",
            latency_ms=latency
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------- HEALTH CHECK --------------------
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "sentinel-ai"}


# -------------------- MAIN RUNNER --------------------
if __name__ == "__main__":
    import uvicorn
    print("Starting Sentinel-AI backend on http://0.0.0.0:8001 ...")
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
