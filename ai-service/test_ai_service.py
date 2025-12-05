"""
Test script for the AI service to verify functionality
"""
import asyncio
import os
from main import call_websocket_llm, fetch_recent_logs, SYSTEM_PROMPT


async def test_websocket_connection():
    """Test the WebSocket connection"""
    print("Testing WebSocket connection...")
    try:
        # Test with a simple prompt
        response = await call_websocket_llm("Hello, are you connected?", timeout=30)
        print(f"✓ WebSocket connection successful. Response: {response[:100]}...")
        return True
    except Exception as e:
        print(f"✗ WebSocket connection failed: {str(e)}")
        return False


async def test_fetch_logs():
    """Test fetching recent logs"""
    print("\nTesting log fetching...")
    try:
        logs = await fetch_recent_logs(limit=3)
        if logs:
            print(f"✓ Successfully fetched {len(logs)} recent log entries")
            for i, log in enumerate(logs):
                print(f"  Log {i+1}: {log['timestamp']} | Level: {log['level']} | Agent: {log['agent']}")
        else:
            print("✓ Log fetching completed (no recent logs found)")
        return True
    except Exception as e:
        print(f"✗ Log fetching failed: {str(e)}")
        return False


async def test_full_chat():
    """Test a full chat request"""
    print("\nTesting full chat request...")
    try:
        # Test with a prompt that includes system context
        context_str = "Recent Security Context:\n- Event 1: [2023-07-30T10:00:00Z] | Level: 12 | Agent: server01 | Description: Suspicious network activity... | Network: 192.168.1.100 → 10.0.0.50 (TCP)\n\n"
        full_prompt = f"{SYSTEM_PROMPT}\n\n{context_str}User: What does this suspicious network activity mean?\n\nSentinel-AI:"
        
        response = await call_websocket_llm(full_prompt, timeout=45)
        print(f"✓ Full chat test successful. Response: {response[:150]}...")
        return True
    except Exception as e:
        print(f"✗ Full chat test failed: {str(e)}")
        return False


async def main():
    """Run all tests"""
    print("Starting AI service tests...\n")
    
    # Run tests
    test1_passed = await test_websocket_connection()
    test2_passed = await test_fetch_logs()
    test3_passed = await test_full_chat()
    
    print(f"\nTest Results:")
    print(f"- WebSocket connection: {'PASS' if test1_passed else 'FAIL'}")
    print(f"- Log fetching: {'PASS' if test2_passed else 'FAIL'}")
    print(f"- Full chat: {'PASS' if test3_passed else 'FAIL'}")
    
    if all([test1_passed, test2_passed, test3_passed]):
        print("\n✓ All tests passed! The AI service is properly configured.")
    else:
        print("\n✗ Some tests failed. Please check the configuration.")
    
    print(f"\nNote: For the WebSocket to work properly, ensure that:")
    print(f"- Your WebSocket LLM server is running at: {os.getenv('LLM_WEBSOCKET_URL', 'ws://164.52.194.98:8766')}")
    print(f"- The backend API is accessible at: {os.getenv('BACKEND_API_URL', 'http://localhost:5000')}")


if __name__ == "__main__":
    asyncio.run(main())