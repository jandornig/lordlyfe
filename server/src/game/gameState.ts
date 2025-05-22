import { GameState, Owner } from '../../../shared/types/game';
import { createNewGame, processMovements, processTick } from './gameLogic';
import { io } from '../index';

class GameStateManager {
  private gameState: GameState;
  private tickInterval: NodeJS.Timeout | null = null;
  private currentMatchId: string | null = null;

  constructor() {
    this.gameState = createNewGame();
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
    playerId: string, 
    playerName: string,
    player2Id: string,
    player2Name: string
  ): GameState {
    console.log(`Initializing new game for match ${matchId}...`);
    this.currentMatchId = matchId;
    
    this.gameState = {
      ...createNewGame(width, height),
      isPaused: false,
      player1Id: playerId,
      player1Name: playerName,
      player2Id,
      player2Name,
    };

    if (typeof this.gameState.tickSpeed === 'undefined') {
        this.gameState.tickSpeed = 1000;
    }
    
    // Log detailed game state information
    console.log('=== Game State Initialization ===');
    console.log('Basic Info:', {
      matchId: this.currentMatchId,
      isPaused: this.gameState.isPaused,
      tick: this.gameState.tick,
      tickSpeed: this.gameState.tickSpeed,
      player1Id: this.gameState.player1Id,
      player1Name: this.gameState.player1Name,
      player2Id: this.gameState.player2Id,
      player2Name: this.gameState.player2Name
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
    this.gameState = createNewGame();
  }
}

export const gameStateManager = new GameStateManager(); 