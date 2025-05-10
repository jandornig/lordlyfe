import { WebSocket } from 'ws';
import { GameStateManager } from '../game/GameStateManager.js';
import { ClientMessage } from '../types/game.js';

export const handleWebSocketConnection = (ws: WebSocket, gameStateManager: GameStateManager) => {
  console.log('[Server] New client connected');
  gameStateManager.addClient(ws);

  ws.on('message', (data) => {
    try {
      const rawMessage = data.toString();
      console.log('[Server] Raw message received:', rawMessage);
      
      const message = JSON.parse(rawMessage) as ClientMessage;
      console.log('[Server] Parsed message:', message);

      // Handle test connection message
      if (message.type === 'TEST_CONNECTION') {
        console.log('[Server] Test connection received:', message.payload);
        const response = {
          type: 'TEST_CONNECTION_RESPONSE',
          payload: {
            received: true,
            timestamp: message.payload.timestamp
          }
        };
        console.log('[Server] Sending test response:', response);
        ws.send(JSON.stringify(response));
        return;
      }

      // Log all other messages
      console.log('[Server] Processing message:', {
        type: message.type,
        payload: message.payload
      });

      gameStateManager.handleMessage(message);
    } catch (error: unknown) {
      console.error('[Server] Error processing message:', error);
      const errorResponse = {
        type: 'ERROR',
        payload: {
          error: 'Failed to process message',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
      console.log('[Server] Sending error response:', errorResponse);
      ws.send(JSON.stringify(errorResponse));
    }
  });

  ws.on('close', (code, reason) => {
    console.log('[Server] Client disconnected:', {
      code,
      reason: reason.toString(),
      wasClean: code === 1000
    });
    gameStateManager.removeClient(ws);
  });

  ws.on('error', (error) => {
    console.error('[Server] WebSocket error:', error);
  });
}; 