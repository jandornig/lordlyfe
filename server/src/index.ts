import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { gameStateManager } from './game/gameState';
import { createPathMovements } from './game/gameLogic';
import { matchmakingQueue } from './game/matchmaking';
import { Tile } from './types/game';
import { v4 as uuidv4 } from 'uuid';

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
const socketPlayerMap = new Map<string, string>();
// New: mapping for socket.id to matchId
const socketMatchMap = new Map<string, string>();

// Socket.io connection handling
io.on('connection', (socket) => {
  // const clientId = socket.handshake.auth.clientId; // Keep for potential future use if needed
  console.log('Client connected with socket ID:', socket.id);

  // Generate and assign playerId
  const playerId = uuidv4();
  socketPlayerMap.set(socket.id, playerId);
  socket.emit('player-id-assigned', { playerId });
  console.log(`Assigned playerId ${playerId} to socket ${socket.id}`);

  // Handle player connection
  // Client will send playerName, server already knows playerId
  socket.on('player-connect', (data: { playerName: string }) => {
    const currentSocketId = socket.id;
    const assignedPlayerId = socketPlayerMap.get(currentSocketId);

    if (!assignedPlayerId) {
      console.error(`Player ID not found for socket ${currentSocketId}. This should not happen.`);
      // Potentially disconnect or send an error to the client
      return;
    }
    
    // Only log the first connection for each player (or if specific connect data changes)
    // The socket.data.hasConnected logic might need adjustment if we rely on this event for more than initial name.
    if (!socket.data.hasConnectedWithName) { // Changed condition to be more specific
      console.log('Player announced:', {
        playerId: assignedPlayerId,
        playerName: data.playerName,
        socketId: currentSocketId
      });
      socket.data.hasConnectedWithName = true;
    }
  });

  // Listen for joining a match room (set by matchmaking)
  socket.on('join-match-room', (data: { matchId: string }) => {
    socketMatchMap.set(socket.id, data.matchId);
    console.log(`Socket ${socket.id} joined match room ${data.matchId}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const disconnectedPlayerId = socketPlayerMap.get(socket.id);
    const matchId = socketMatchMap.get(socket.id);
    console.log(`Client disconnected: socket ${socket.id}, player ${disconnectedPlayerId || 'N/A'}, match ${matchId || 'N/A'}`);
    matchmakingQueue.removePlayer(socket.id);
    socketPlayerMap.delete(socket.id);
    socketMatchMap.delete(socket.id);
  });

  // Handle game start
  // Client sends playerName. Server uses its mapped playerId.
  socket.on('start-game', (data: { width?: number, height?: number, playerName: string }) => {
    const currentSocketId = socket.id;
    const assignedPlayerId = socketPlayerMap.get(currentSocketId);

    if (!assignedPlayerId) {
      console.error(`Player ID not found for socket ${currentSocketId} during start-game. This should not happen.`);
      // Potentially disconnect or send an error to the client
      return;
    }

    console.log('Player starting game:', {
      playerId: assignedPlayerId, // Use server-assigned playerId
      playerName: data.playerName,
      socketId: currentSocketId,
      width: data.width,
      height: data.height
    });
    // Add player to matchmaking queue
    matchmakingQueue.addPlayer({
      playerId: assignedPlayerId, // Use server-assigned playerId
      playerName: data.playerName,
      socketId: currentSocketId
    });
  });

  // Placeholder for other game-specific events
  socket.on('game-action', (data) => {
    const actionPlayerId = socketPlayerMap.get(socket.id);
    console.log(`Game action from player ${actionPlayerId}:`, data);
    // Handle game action
  });

  // Handle movement requests
  socket.on('move-army', (data: { movements: any[] }) => {
    const matchId = socketMatchMap.get(socket.id);
    const actingPlayerId = socketPlayerMap.get(socket.id);
    if (!matchId || !actingPlayerId) {
      console.warn(`move-army: Could not find match or player for socket ${socket.id}`);
      return;
    }
    // Validate that actingPlayerId is in the match (basic check)
    const gameState = gameStateManager.getGameState();
    if (gameState.playerId !== actingPlayerId && gameState.player2Id !== actingPlayerId) {
      console.warn(`move-army: Player ${actingPlayerId} is not in match ${matchId}`);
      return;
    }
    console.log('=== Click Event ===');
    console.log('Click data:', {
      movements: data.movements.map(m => ({
        from: m.from,
        to: m.to,
        armyPercentage: m.armyPercentage,
        waypoints: m.waypoints
      }))
    });

    try {
      // Process each movement
      for (const movement of data.movements) {
        const fromTile = gameState.tiles.find((t: Tile) => t.x === movement.from.x && t.y === movement.from.y);
        const toTile = gameState.tiles.find((t: Tile) => t.x === movement.to.x && t.y === movement.to.y);
        
        console.log('Processing click:', {
          from: fromTile ? { 
            x: fromTile.x, 
            y: fromTile.y, 
            army: fromTile.army, 
            owner: fromTile.owner,
            type: fromTile.isLord ? 'lord' : fromTile.isCity ? 'city' : 'territory'
          } : 'not found',
          to: toTile ? { 
            x: toTile.x, 
            y: toTile.y, 
            army: toTile.army, 
            owner: toTile.owner,
            type: toTile.isLord ? 'lord' : toTile.isCity ? 'city' : 'territory'
          } : 'not found',
          armyPercentage: movement.armyPercentage,
          waypoints: movement.waypoints
        });
        
        if (!fromTile || !toTile) {
          console.error('Source or target tile not found');
          continue;
        }
        
        // Create path movements
        const pathMovements = createPathMovements(
          gameState,
          fromTile,
          toTile,
          movement.armyPercentage || 1,
          movement.waypoints || []
        );
        
        if (pathMovements && pathMovements.length > 0) {
          gameState.movementQueue.push(...pathMovements);
          console.log('Movement queued:', {
            queueLength: gameState.movementQueue.length,
            pathMovements: pathMovements.map(m => ({
              from: { x: m.from.x, y: m.from.y },
              to: { x: m.to.x, y: m.to.y },
              army: m.army
            }))
          });
        } else {
          console.log('No valid path movements created');
        }
      }
      
      // Update game state
      gameStateManager.updateGameState(gameState);
      
      // Broadcast the updated state to the match room only
      io.to(matchId).emit('game-state-update', gameStateManager.getGameState());
      console.log(`[move-army] Updated and broadcasted game state for match ${matchId}`);
    } catch (error) {
      console.error('Error processing click:', error);
    }
  });

  // Handle tick speed changes
  socket.on('set-tick-speed', (data: { speed: number }) => {
    const matchId = socketMatchMap.get(socket.id);
    const actingPlayerId = socketPlayerMap.get(socket.id);
    if (!matchId || !actingPlayerId) {
      console.warn(`set-tick-speed: Could not find match or player for socket ${socket.id}`);
      return;
    }
    const gameState = gameStateManager.getGameState();
    if (gameState.playerId !== actingPlayerId && gameState.player2Id !== actingPlayerId) {
      console.warn(`set-tick-speed: Player ${actingPlayerId} is not in match ${matchId}`);
      return;
    }
    gameStateManager.setTickSpeed(data.speed);
    io.to(matchId).emit('game-state-update', gameStateManager.getGameState());
    console.log(`[set-tick-speed] Updated and broadcasted game state for match ${matchId}`);
  });

  // Handle pause toggle
  socket.on('toggle-pause', () => {
    const matchId = socketMatchMap.get(socket.id);
    const actingPlayerId = socketPlayerMap.get(socket.id);
    if (!matchId || !actingPlayerId) {
      console.warn(`toggle-pause: Could not find match or player for socket ${socket.id}`);
      return;
    }
    const gameState = gameStateManager.getGameState();
    if (gameState.playerId !== actingPlayerId && gameState.player2Id !== actingPlayerId) {
      console.warn(`toggle-pause: Player ${actingPlayerId} is not in match ${matchId}`);
      return;
    }
    gameStateManager.togglePause();
    io.to(matchId).emit('game-state-update', gameStateManager.getGameState());
    console.log(`[toggle-pause] Updated and broadcasted game state for match ${matchId}`);
  });

  // Handle clear movement queue
  socket.on('clear-movement-queue', () => {
    console.log('Clearing movement queue');
    gameStateManager.clearMovementQueue();
    io.emit('game-state-update', gameStateManager.getGameState());
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 