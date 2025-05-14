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

// Tick loop (placeholder, can be expanded)
let tickCount = 0;
const TICK_INTERVAL = 1000; // 1 second

setInterval(() => {
  tickCount++;
  // console.log('Tick:', tickCount);
  // Broadcast tick or game state updates here if needed globally
}, TICK_INTERVAL);

console.log('Starting tick loop with speed:', TICK_INTERVAL);

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

  // Handle disconnection
  socket.on('disconnect', () => {
    const disconnectedPlayerId = socketPlayerMap.get(socket.id);
    console.log(`Client disconnected: socket ${socket.id}, player ${disconnectedPlayerId || 'N/A'}`);
    matchmakingQueue.removePlayer(socket.id); // matchmakingQueue uses socketId for removal
    socketPlayerMap.delete(socket.id); // Clean up map
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
      const gameState = gameStateManager.getGameState();
      
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
      
      // Broadcast the updated state to all clients
      io.emit('game-state-update', gameStateManager.getGameState());
      console.log('=== End Click Event ===');
    } catch (error) {
      console.error('Error processing click:', error);
    }
  });

  // Handle tick speed changes
  socket.on('set-tick-speed', (data: { speed: number }) => {
    console.log('Setting tick speed:', data.speed);
    gameStateManager.setTickSpeed(data.speed);
    io.emit('game-state-update', gameStateManager.getGameState());
  });

  // Handle pause toggle
  socket.on('toggle-pause', () => {
    console.log('Toggling pause');
    gameStateManager.togglePause();
    const currentState = gameStateManager.getGameState();
    console.log('Game state after pause toggle:', {
      isPaused: currentState.isPaused,
      tick: currentState.tick,
      tickSpeed: currentState.tickSpeed
    });
    io.emit('game-state-update', currentState);
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