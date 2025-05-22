import { io, Socket } from 'socket.io-client';

console.log('GameContext.tsx: Initializing socket connection');

// Create socket instance
export const socket: Socket = io('http://localhost:3001', {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

// Socket event handlers
socket.on('connect', () => {
  console.log('GameContext.tsx: Socket connected, ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('GameContext.tsx: Socket disconnected');
});

socket.on('error', (error) => {
  console.error('GameContext.tsx: Socket error:', error);
});

socket.on('connect_error', (error) => {
  console.error('GameContext.tsx: Socket connection error:', error);
});

// Log initial socket state
console.log('GameContext.tsx: Socket initialized with state:', {
  connected: socket.connected,
  id: socket.id,
  hasListeners: {
    connect: socket.hasListeners('connect'),
    disconnect: socket.hasListeners('disconnect'),
    error: socket.hasListeners('error'),
    connect_error: socket.hasListeners('connect_error')
  }
}); 