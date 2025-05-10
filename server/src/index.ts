import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { GameStateManager } from './game/GameStateManager.js';
import { handleWebSocketConnection } from './websocket/handlers.js';

const app = express();
const port = process.env.PORT || 8080;
const wsPort = process.env.WS_PORT || 8081;

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ port: Number(wsPort) });

// Create game state manager
const gameStateManager = new GameStateManager();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  handleWebSocketConnection(ws, gameStateManager);
});

// Start HTTP server
server.listen(port, () => {
  console.log(`[Server] HTTP server started on port ${port}`);
  console.log(`[Server] WebSocket server started on port ${wsPort}`);
});

// Handle process termination
const cleanup = () => {
  console.log('\n[Server] Shutting down...');
  
  // Clean up game state
  gameStateManager.cleanup();
  
  // Close WebSocket server
  wss.close(() => {
    console.log('[Server] WebSocket server closed');
  });
  
  // Close HTTP server
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after 5 seconds if cleanup takes too long
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
};

// Handle different termination signals
process.on('SIGINT', cleanup);  // Ctrl+C
process.on('SIGTERM', cleanup); // kill command
process.on('SIGHUP', cleanup);  // Terminal closed

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught exception:', error);
  cleanup();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled promise rejection:', reason);
  cleanup();
}); 