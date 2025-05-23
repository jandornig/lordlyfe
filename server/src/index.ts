import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { gameStateManager } from './game/gameState';
import { createPathMovements } from './game/gameLogic';
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
    
    // Set the connection flag
    socket.data.hasConnectedWithName = true;
    
    logEvent('PLAYER_CONNECTED', {
      playerId: assignedPlayerId,
      playerName: data.playerName,
      socketId: currentSocketId
    });
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

    const gameState = gameStateManager.getGameState();
    if (gameState.player1Id !== actingPlayerId && gameState.player2Id !== actingPlayerId) {
      logEvent('ERROR', {
        type: 'MOVE_ARMY_PLAYER_NOT_IN_MATCH',
        socketId: socket.id,
        playerId: actingPlayerId,
        matchId: matchId
      });
      return;
    }

    if (DEBUG.MOVEMENTS) {
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
      // Process each movement
      for (const movement of data.movements) {
        const fromTile = gameState.tiles.find((t: Tile) => t.x === movement.from.x && t.y === movement.from.y);
        const toTile = gameState.tiles.find((t: Tile) => t.x === movement.to.x && t.y === movement.to.y);
        
        if (!fromTile || !toTile) {
          logEvent('ERROR', {
            type: 'MOVE_ARMY_TILES_NOT_FOUND',
            from: movement.from,
            to: movement.to
          });
          continue;
        }
        
        // Create path movements
        const pathMovements = createPathMovements(
          gameState,
          fromTile,
          toTile,
          movement.armiesToMove,
          movement.waypoints || [],
          actingPlayerId
        );
        
        if (pathMovements && pathMovements.length > 0) {
          gameState.movementQueue.push(...pathMovements);
          if (DEBUG.MOVEMENTS) {
            logEvent('MOVEMENT_QUEUED', {
              queueLength: gameState.movementQueue.length,
              pathMovements: pathMovements.map(m => ({
                from: { x: m.from.x, y: m.from.y },
                to: { x: m.to.x, y: m.to.y },
                army: m.army,
                playerId: m.playerId
              }))
            });
          }
        }
      }
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
    if (gameState.player1Id !== actingPlayerId && gameState.player2Id !== actingPlayerId) {
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
    const gameState = gameStateManager.getGameState();
    const actingPlayerId = socket.id === gameState.player1Id ? 
      gameState.player1Id : 
      gameState.player2Id;

    gameStateManager.clearMovementQueue(actingPlayerId);
  });

  // Handle game end
  socket.on('game-ended', () => {
    const matchId = socketMatchMap.get(socket.id);
    const playerId = socketPlayerMap.get(socket.id);
    
    if (matchId && playerId) {
      logEvent('GAME_ENDED', {
        socketId: socket.id,
        playerId,
        matchId
      });
      
      // Only clean up this player's state
      socket.leave(matchId);
      socketMatchMap.delete(socket.id);
      
      // Remove player from active matches in matchmaking queue
      matchmakingQueue.removeFromActiveMatch(playerId);
      
      // Only notify this player that their game has ended
      socket.emit('game-ended');
      
      // Don't clean up the match yet - other player might still be playing
      // Only clean up if both players have left
      const playersInMatch = Array.from(socketMatchMap.values()).filter(id => id === matchId);
      if (playersInMatch.length === 0) {
        gameStateManager.cleanupMatch(matchId);
      }
    }
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