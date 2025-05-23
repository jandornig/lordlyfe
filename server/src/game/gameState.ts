import { GameState, Owner, Tile, Movement, Player } from '../../../shared/types/game'; // Added Player
import { createNewGame, processMovements, processTick } from './gameLogic'; // Removed createPathMovements
import { createPathMovements } from './movementLogic'; // Added import from movementLogic
import { io } from '../index';

// Define DEBUG constant locally for now
const DEBUG = {
  MOVEMENTS: false, // Set to true to enable movement logging in this file
  GAME_STATE: false // Add other flags if needed
};

class GameStateManager {
  private gameState: GameState;
  private tickInterval: NodeJS.Timeout | null = null;
  private currentMatchId: string | null = null;

  constructor() {
    // createNewGame now expects playersInfo. Pass an empty array for default construction.
    this.gameState = createNewGame(undefined, undefined, [], undefined); 
  }

  private startTickLoop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    if (!this.currentMatchId) {
      console.error("Cannot start tick loop: currentMatchId is not set.");
      return;
    }
    if (!this.gameState || !this.gameState.tickSpeed) {
        console.error("Cannot start tick loop: gameState is not properly initialized.");
        return;
    }

    console.log(`Starting tick loop for match ${this.currentMatchId} with speed:`, this.gameState.tickSpeed);
    
    const matchIdForTick = this.currentMatchId;
    
    this.tickInterval = setInterval(() => {
      if (!this.gameState.isPaused) {
        this.gameState = processTick(this.gameState);
        io.to(matchIdForTick).emit('game-state-update', this.gameState);
      }
    }, this.gameState.tickSpeed);
  }

  initializeGame(
    matchId: string,
    width: number, 
    height: number, 
    playersInfo: { id: string; name: string }[] // New parameter for N players
  ): GameState {
    console.log(`Initializing new game for match ${matchId}...`);
    this.currentMatchId = matchId;
    
    // Call createNewGame with the new playersInfo array and matchId
    this.gameState = createNewGame(width, height, playersInfo, matchId);
    // isPaused is set by createNewGame, but can be overridden if needed:
    this.gameState.isPaused = false; // Explicitly set to false after creation as per typical game start

    if (typeof this.gameState.tickSpeed === 'undefined') {
        this.gameState.tickSpeed = 1000; // Default if not set by createNewGame
    }
    
    // Log detailed game state information
    console.log('=== Game State Initialization ===');
    console.log('Basic Info:', {
      matchId: this.currentMatchId,
      isPaused: this.gameState.isPaused,
      tick: this.gameState.tick,
      tickSpeed: this.gameState.tickSpeed,
      players: this.gameState.players.map(p => ({id: p.id, name: p.name, color: p.color})) // Log player details
    });

    // Log lord tiles information
    const lordTiles = this.gameState.tiles.filter(tile => tile.isLord);
    console.log('Lord Tiles:', lordTiles.map(tile => ({
      x: tile.x,
      y: tile.y,
      owner: tile.owner,
      army: tile.army,
      isVisible: tile.isVisible
    })));

    this.startTickLoop();
    
    // Log before sending game state
    console.log('=== Broadcasting Game State ===');
    console.log('Sending to room:', this.currentMatchId);
    console.log('Lord Tiles in broadcast:', lordTiles.map(tile => ({
      x: tile.x,
      y: tile.y,
      owner: tile.owner,
      army: tile.army,
      isVisible: tile.isVisible
    })));

    io.to(this.currentMatchId).emit('game-state-update', this.gameState);
    io.to(this.currentMatchId).emit('game-started', this.gameState);

    return this.gameState;
  }

  getGameState(): GameState {
    return this.gameState;
  }

  updateGameState(newState: GameState) {
    this.gameState = newState;
  }

  setTickSpeed(speed: number) {
    if (!this.currentMatchId) {
      console.warn("Cannot set tick speed: no active game room.");
      return;
    }
    console.log(`Setting tick speed for match ${this.currentMatchId} to:`, speed);
    this.gameState.tickSpeed = speed;
    this.gameState.isPaused = false;
    this.startTickLoop();
    io.to(this.currentMatchId).emit('game-state-update', this.gameState);
  }

  togglePause() {
    if (!this.currentMatchId) {
      console.warn("Cannot toggle pause: no active game room.");
      return;
    }
    console.log(`Toggling pause for match ${this.currentMatchId}`);
    this.gameState.isPaused = !this.gameState.isPaused;
    if (!this.gameState.isPaused) {
        this.startTickLoop(); 
    }
    console.log('Game state after pause toggle:', {
        matchId: this.currentMatchId,
        isPaused: this.gameState.isPaused,
        tick: this.gameState.tick
    });
    io.to(this.currentMatchId).emit('game-state-update', this.gameState);
  }

  clearMovementQueue(playerId: string) {
    if (!this.currentMatchId) {
      console.warn("Cannot clear movement queue: no active game room.");
      return;
    }
    console.log(`Clearing movement queue for player ${playerId} in match ${this.currentMatchId}`);
    if (this.gameState && this.gameState.movementQueue) {
      // Only clear movements for the requesting player
      this.gameState.movementQueue = this.gameState.movementQueue.filter(
        movement => movement.playerId !== playerId
      );
    }
    io.to(this.currentMatchId).emit('game-state-update', this.gameState);
  }
  
  cleanupGameRoom() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.currentMatchId) {
      console.log(`Cleaning up game room for match ${this.currentMatchId}`);
      // Notify players that game is over
      io.to(this.currentMatchId).emit('game-ended');
      // Clean up the room
      io.socketsLeave(this.currentMatchId);
      this.currentMatchId = null;
    }
    // Reset game state
    // createNewGame now expects playersInfo. Pass an empty array for default construction.
    this.gameState = createNewGame(undefined, undefined, [], undefined);
  }

  public handlePlayerMovementRequest(actingPlayerId: string, movementsData: any[]): void {
    if (!this.currentMatchId) {
      console.warn("Cannot handle movement request: no active game room.");
      return;
    }

    // Updated player validation for N players
    if (!this.gameState.players.some(player => player.id === actingPlayerId)) {
      console.error('Error: Player attempting to move is not in this match.', { actingPlayerId, matchId: this.currentMatchId });
      return;
    }

    const allPathMovements: Movement[] = [];

    for (const movement of movementsData) {
      const fromTile = this.gameState.tiles.find((t: Tile) => t.x === movement.from.x && t.y === movement.from.y);
      const toTile = this.gameState.tiles.find((t: Tile) => t.x === movement.to.x && t.y === movement.to.y);

      if (!fromTile || !toTile) {
        console.error('Error: Could not find fromTile or toTile for movement request.', { from: movement.from, to: movement.to });
        continue; // Skip this movement
      }
      
      const pathMovements = createPathMovements(
        this.gameState,
        fromTile,
        toTile,
        movement.armiesToMove, // This is armyPercentage
        movement.waypoints || [],
        actingPlayerId
      );

      if (pathMovements && pathMovements.length > 0) {
        allPathMovements.push(...pathMovements);
      }
    }

    if (allPathMovements.length > 0) {
      this.gameState.movementQueue.push(...allPathMovements);
      if (DEBUG.MOVEMENTS) { 
           console.log('[MOVEMENT_QUEUED_IN_MANAGER]', {
              matchId: this.currentMatchId,
              playerId: actingPlayerId,
              queueLength: this.gameState.movementQueue.length,
              addedMovements: allPathMovements.length
           });
      }
    }
  }
}

export const gameStateManager = new GameStateManager();