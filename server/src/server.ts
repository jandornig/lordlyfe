import { WebSocketServer } from 'ws';
import { GameStateManager } from './game/GameStateManager.js';

const wss = new WebSocketServer({ port: 8080 });
const gameStateManager = new GameStateManager();

console.log('[Server] WebSocket server started on port 8080');

wss.on('connection', (ws) => {
  console.log('[Server] New client connected');
  gameStateManager.addClient(ws);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('[Server] Received message:', message);
      gameStateManager.handleMessage(message);
    } catch (error) {
      console.error('[Server] Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('[Server] Client disconnected');
    gameStateManager.removeClient(ws);
  });

  ws.on('error', (error) => {
    console.error('[Server] WebSocket error:', error);
  });
});

// Cleanup on server shutdown
process.on('SIGINT', () => {
  console.log('[Server] Shutting down...');
  gameStateManager.cleanup();
  wss.close(() => {
    console.log('[Server] WebSocket server closed');
    process.exit(0);
  });
}); 