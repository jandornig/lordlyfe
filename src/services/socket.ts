import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

// Configurable socket settings
const SOCKET_URL = process.env.VITE_SOCKET_URL || 'http://localhost:3000';
const RECONNECTION_ATTEMPTS = 5;
const RECONNECTION_DELAY = 1000;

// Create socket instance with robust settings
export const socket: Socket = io(SOCKET_URL, {
  auth: {
    clientId: uuidv4() // Use UUID as the client ID
  },
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: RECONNECTION_ATTEMPTS,
  reconnectionDelay: RECONNECTION_DELAY
});

// Socket event handlers for reliability and debugging
socket.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Socket connected, ID:', socket.id);
  }
});

socket.on('disconnect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Socket disconnected');
  }
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

// Development-only initial state logging
if (process.env.NODE_ENV === 'development') {
  console.log('Socket initialized with state:', {
    connected: socket.connected,
    id: socket.id,
    hasListeners: {
      connect: socket.hasListeners('connect'),
      disconnect: socket.hasListeners('disconnect'),
      error: socket.hasListeners('error'),
      connect_error: socket.hasListeners('connect_error')
    }
  });
} 