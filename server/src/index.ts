import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { gameStateManager } from './game/gameState';
import { createPathMovements } from './game/gameLogic';

const app = express();
const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Vite's default port
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Allow requests from Vite dev server
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Basic route for testing
app.get('/', (req, res) => {
  res.send('Lordlyfe Game Server is running');
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Handle game start
  socket.on('start-game', (data: { width?: number, height?: number }) => {
    console.log('Starting new game with dimensions:', data);
    const gameState = gameStateManager.initializeGame(data.width, data.height);
    console.log('Game state after initialization:', {
      isPaused: gameState.isPaused,
      tick: gameState.tick,
      tickSpeed: gameState.tickSpeed
    });
    socket.emit('game-started', gameState);
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
        const fromTile = gameState.tiles.find(t => t.x === movement.from.x && t.y === movement.from.y);
        const toTile = gameState.tiles.find(t => t.x === movement.to.x && t.y === movement.to.y);
        
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

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 