import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { gameStateManager } from './game/gameState';
// import { createPathMovements } from './game/gameLogic'; // Removed as it's no longer directly used
import { matchmakingQueue } from './game/matchmaking';
import { Tile, GameState } from '../../shared/types/game';
import { v4 as uuidv4 } from 'uuid';

// Debug flags to control logging
const DEBUG = {
  MOVEMENTS: false,
  CONNECTIONS: true,
  GAME_STATE: true,
  ERRORS: true
};

// Logging utilities
const logSeparator = '='.repeat(80);
const logSection = (title: string) => {
  console.log('\n' + logSeparator);
  console.log(` ${title}`);
  console.log(logSeparator);
};

const logEvent = (event: string, data: any) => {
  if (event === 'MOVEMENT_QUEUED' && !DEBUG.MOVEMENTS) return;
  if (event === 'CONNECT' && !DEBUG.CONNECTIONS) return;
  if (event === 'GAME_STATE_UPDATE' && !DEBUG.GAME_STATE) return;
  if (event === 'ERROR' && !DEBUG.ERRORS) return;
  
  console.log(`\n[${event}]`, data);
};

// Initialize Express and Socket.IO
logSection('Server Initialization');
const app = express();
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity in development
  }
});

app.use(cors()); // Enable CORS for all routes

const PORT = process.env.PORT || 3000;

// Simple in-memory mapping for socket.id to playerId
export const socketPlayerMap = new Map<string, string>();
// New: mapping for socket.id to matchId
export const socketMatchMap = new Map<string, string>();

// Socket.io connection handling
io.on('connection', (socket) => {
  logSection('New Client Connection');
  logEvent('CONNECT', { socketId: socket.id });

  // Generate and assign playerId
  const playerId = uuidv4();
  socketPlayerMap.set(socket.id, playerId);
  socket.emit('player-id-assigned', { playerId });
  logEvent('PLAYER_ID_ASSIGNED', { socketId: socket.id, playerId });

  // Handle player connection
  socket.on('player-connect', (data: { playerName: string }) => {
    const currentSocketId = socket.id;
    const assignedPlayerId = socketPlayerMap.get(currentSocketId);

    if (!assignedPlayerId) {
      logEvent('ERROR', {
        type: 'PLAYER_ID_NOT_FOUND',
        socketId: currentSocketId,
        message: 'Player ID not found for socket. This should not happen.'
      });
      return;
    }
    
    if (!socket.data.hasConnectedWithName) {
      logEvent('PLAYER_CONNECTED', {
        playerId: assignedPlayerId,
        playerName: data.playerName,
        socketId: currentSocketId
      });
      socket.data.hasConnectedWithName = true;
    }
  });

  // Listen for joining a match room
  socket.on('join-match-room', (data: { matchId: string }) => {
    socketMatchMap.set(socket.id, data.matchId);
    logEvent('JOIN_MATCH_ROOM', {
      socketId: socket.id,
      matchId: data.matchId,
      playerId: socketPlayerMap.get(socket.id)
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const disconnectedPlayerId = socketPlayerMap.get(socket.id);
    const matchId = socketMatchMap.get(socket.id);
    logEvent('DISCONNECT', {
      socketId: socket.id,
      playerId: disconnectedPlayerId || 'N/A',
      matchId: matchId || 'N/A'
    });
    matchmakingQueue.removePlayer(socket.id);
    socketPlayerMap.delete(socket.id);
    socketMatchMap.delete(socket.id);
  });

  // Handle game start
  socket.on('start-game', (data: { width?: number, height?: number, playerName: string }) => {
    const currentSocketId = socket.id;
    const assignedPlayerId = socketPlayerMap.get(currentSocketId);

    if (!assignedPlayerId) {
      logEvent('ERROR', {
        type: 'START_GAME_PLAYER_ID_NOT_FOUND',
        socketId: currentSocketId,
        message: 'Player ID not found during start-game. This should not happen.'
      });
      return;
    }

    logEvent('GAME_START_REQUEST', {
      playerId: assignedPlayerId,
      playerName: data.playerName,
      socketId: currentSocketId,
      width: data.width,
      height: data.height
    });

    matchmakingQueue.addPlayer({
      playerId: assignedPlayerId,
      playerName: data.playerName,
      socketId: currentSocketId
    });
  });

  // Handle movement requests
  socket.on('move-army', (data: { movements: any[] }) => {
    const matchId = socketMatchMap.get(socket.id);
    const actingPlayerId = socketPlayerMap.get(socket.id);
    
    if (!matchId || !actingPlayerId) {
      logEvent('ERROR', {
        type: 'MOVE_ARMY_MAPPING_NOT_FOUND',
        socketId: socket.id,
        matchId: matchId || 'N/A',
        playerId: actingPlayerId || 'N/A'
      });
      return;
    }

    // The validation for player being in the match is now inside handlePlayerMovementRequest
    // gameStateManager.getGameState() is no longer needed here directly for that check.

    if (DEBUG.MOVEMENTS) { // DEBUG is defined in index.ts
      logEvent('MOVE_ARMY_REQUEST', {
        socketId: socket.id,
        playerId: actingPlayerId,
        matchId: matchId,
        movements: data.movements.map(m => ({
          from: m.from,
          to: m.to,
          armiesToMove: m.armiesToMove,
          waypoints: m.waypoints
        }))
      });
    }

    try {
      gameStateManager.handlePlayerMovementRequest(actingPlayerId, data.movements);
      // The logging of MOVEMENT_QUEUED is now inside handlePlayerMovementRequest
    } catch (error) {
      let errorMsg = '';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMsg = (error as any).message;
      } else {
        errorMsg = String(error);
      }
      logEvent('ERROR', {
        type: 'MOVE_ARMY_PROCESSING_ERROR',
        error: errorMsg,
        socketId: socket.id,
        playerId: actingPlayerId
      });
    }
  });

  // Handle pause toggle
  socket.on('toggle-pause', () => {
    const matchId = socketMatchMap.get(socket.id);
    const actingPlayerId = socketPlayerMap.get(socket.id);
    if (!matchId || !actingPlayerId) {
      logEvent('ERROR', {
        type: 'TOGGLE_PAUSE_MAPPING_NOT_FOUND',
        socketId: socket.id,
        matchId: matchId || 'N/A',
        playerId: actingPlayerId || 'N/A'
      });
      return;
    }
    const gameState = gameStateManager.getGameState();
    // Updated player validation for N players
    if (!gameState.players.some(p => p.id === actingPlayerId)) {
      logEvent('ERROR', {
        type: 'TOGGLE_PAUSE_PLAYER_NOT_IN_MATCH',
        socketId: socket.id,
        playerId: actingPlayerId,
        matchId: matchId
      });
      return;
    }
    gameStateManager.togglePause();
    io.to(matchId).emit('game-state-update', gameStateManager.getGameState());
    logEvent('GAME_PAUSED', {
      matchId,
      playerId: actingPlayerId,
      isPaused: gameStateManager.getGameState().isPaused
    });
  });

  // Handle clear movement queue
  socket.on('clear-movement-queue', () => {
    const matchId = socketMatchMap.get(socket.id);
    if (!matchId) {
      logEvent('ERROR', {
        type: 'CLEAR_QUEUE_NO_MATCH',
        socketId: socket.id
      });
      return;
    }

    // Get the player ID based on the socket
    const actingPlayerId = socketPlayerMap.get(socket.id);
    if (!actingPlayerId) {
      logEvent('ERROR', { type: 'CLEAR_QUEUE_PLAYER_ID_NOT_FOUND', socketId: socket.id });
      return;
    }
    
    const gameState = gameStateManager.getGameState();
    // Further validation if needed:
    if (!gameState.players.some(p => p.id === actingPlayerId)) {
        logEvent('ERROR', { 
            type: 'CLEAR_QUEUE_PLAYER_NOT_IN_MATCH',
            socketId: socket.id,
            playerId: actingPlayerId,
            matchId: matchId 
        });
        return;
    }

    gameStateManager.clearMovementQueue(actingPlayerId);
  });
});

// Start the server
server.listen(PORT, () => {
  logSection('Server Started');
  console.log(`Server running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('CORS enabled for all origins');
  console.log('Socket.IO server initialized');
  console.log(logSeparator);
}); 