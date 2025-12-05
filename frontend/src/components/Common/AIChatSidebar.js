import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  useTheme,
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import api from '../../services/auth';

// Typing dot animation
const bounce = keyframes`
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
`;

// Styled components with theme support
const SidebarContainer = styled(Box)(({ theme, open }) => ({
  width: open ? 420 : 0,
  minWidth: open ? 420 : 0,
  height: 'calc(100vh - 64px)',
  backgroundColor: theme.palette.background.default,
  borderLeft: open ? `1px solid ${theme.palette.divider}` : 'none',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.3s ease-in-out',
  overflow: 'hidden',
  position: 'fixed',
  top: 64,
  right: 0,
  bottom: 0,
  zIndex: 1200,
}));

const ChatHeader = styled(Box)(({ theme }) => ({
  height: 56,
  padding: '0 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: `${theme.palette.background.default}cc`,
  backdropFilter: 'blur(8px)',
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const ChatArea = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    background: theme.palette.background.paper,
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.text.secondary,
    borderRadius: 3,
  },
}));

const MessageBubble = styled(Paper)(({ theme, isUser }) => ({
  maxWidth: '85%',
  padding: '10px 14px',
  backgroundColor: isUser ? `${theme.palette.primary.main}22` : theme.palette.background.paper,
  border: isUser ? `1px solid ${theme.palette.primary.main}66` : `1px solid ${theme.palette.divider}`,
  borderRadius: isUser ? '4px 4px 0 4px' : '4px 4px 4px 0',
  alignSelf: isUser ? 'flex-end' : 'flex-start',
  color: isUser ? theme.palette.primary.light : theme.palette.text.primary,
  boxShadow: 'none',
  background: isUser ? `${theme.palette.primary.main}22` : theme.palette.background.paper,
}));

const InputArea = styled(Box)(({ theme }) => ({
  padding: 16,
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
}));

const TypingDot = styled('span')(({ theme, delay }) => ({
  width: 6,
  height: 6,
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  display: 'inline-block',
  margin: '0 2px',
  animation: `${bounce} 1.4s ease-in-out infinite`,
  animationDelay: delay,
}));

const AIChatSidebar = ({ open, onClose }) => {
  const theme = useTheme();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      text: 'Hello! I am Sentinel-AI, your intelligent assistant for CyberSentinel SIEM. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState({ model: 'Sentinel-AI', latency: 0 });
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to calculate new height
      textareaRef.current.style.height = 'auto';
      // Calculate needed height based on scroll height, with max limit
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 150; // Max height in pixels
      const minHeight = 40; // Min height to match input area
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [input]);

  // Clear chat when sidebar opens
  useEffect(() => {
    if (open) {
      setMessages([
        {
          id: 1,
          type: 'ai',
          text: 'Hello! I am Sentinel-AI, your intelligent assistant for CyberSentinel SIEM. How can I help you today?',
          timestamp: new Date(),
        },
      ]);
      setInput('');
      setMetadata({ model: 'Sentinel-AI', latency: 0 });
      // Reset textarea height when clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
      }
    }
  }, [open]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/ai/chat', {
        message: userMessage.text,
      });

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        text: response.data.response_text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setMetadata({
        model: 'Sentinel-AI',
        latency: response.data.latency_ms || 0,
      });
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        text: error.response?.data?.response_text || 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <SidebarContainer open={open}>
      {/* Chat Header */}
      <ChatHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Online indicator */}
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: theme.palette.primary.main,
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
          <Typography
            sx={{
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '14px',
              color: theme.palette.text.primary,
              letterSpacing: '1px',
            }}
          >
            SENTINEL<span style={{ color: theme.palette.primary.main }}>_AI</span>
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': { color: theme.palette.text.primary, backgroundColor: `${theme.palette.primary.main}22` },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </ChatHeader>

      {/* Chat Messages */}
      <ChatArea>
        {messages.map((msg) => (
          <Box
            key={msg.id}
            sx={{
              display: 'flex',
              flexDirection: msg.type === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 1,
            }}
          >
            {/* Avatar */}
            {msg.type === 'ai' ? (
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '4px',
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <SmartToyIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
              </Box>
            ) : (
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '4px',
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: theme.palette.primary.main,
                  fontFamily: 'monospace',
                  flexShrink: 0,
                }}
              >
                U
              </Box>
            )}

            <MessageBubble isUser={msg.type === 'user'} elevation={0}>
              <Typography
                sx={{
                  fontSize: '13px',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.text}
              </Typography>
            </MessageBubble>
          </Box>
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '4px',
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SmartToyIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
            </Box>
            <MessageBubble elevation={0}>
              <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
                <TypingDot delay="0s" />
                <TypingDot delay="0.2s" />
                <TypingDot delay="0.4s" />
              </Box>
            </MessageBubble>
          </Box>
        )}

        <div ref={chatEndRef} />
      </ChatArea>

      {/* Input Area */}
      <InputArea>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'flex-end',
              backgroundColor: theme.palette.background.default,
              borderRadius: '4px',
              border: `1px solid ${theme.palette.divider}`,
              '&:hover': {
                borderColor: theme.palette.text.secondary,
              },
              '&.Mui-focused': {
                borderColor: theme.palette.primary.main,
              },
              '&.Mui-disabled': {
                backgroundColor: theme.palette.action.disabledBackground,
              },
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Ask Sentinel-AI..."
              disabled={isLoading}
              style={{
                flex: 1,
                minHeight: '40px',
                maxHeight: '150px',
                padding: '10px 14px',
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                color: theme.palette.text.primary,
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'none',
                overflow: 'auto',
                fontWeight: 400,
                lineHeight: 1.4,
              }}
            />
          </Box>
          <IconButton
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            sx={{
              backgroundColor: theme.palette.primary.main,
              borderRadius: '4px',
              '&:hover': { backgroundColor: theme.palette.primary.dark },
              '&.Mui-disabled': { backgroundColor: theme.palette.background.paper },
              flexShrink: 0, // Prevent button from resizing
            }}
          >
            <SendIcon sx={{ fontSize: 18, color: '#fff' }} />
          </IconButton>
        </Box>

        {/* Metadata */}
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Typography
            sx={{
              fontSize: '10px',
              fontFamily: 'monospace',
              color: theme.palette.text.secondary,
              letterSpacing: '0.5px',
            }}
          >
            MODEL: {metadata.model.toUpperCase()}
          </Typography>
          <Typography
            sx={{
              fontSize: '10px',
              fontFamily: 'monospace',
              color: theme.palette.text.secondary,
              letterSpacing: '0.5px',
            }}
          >
            LATENCY: {metadata.latency}ms
          </Typography>
        </Box>
      </InputArea>
    </SidebarContainer>
  );
};

export default AIChatSidebar;
