import { GameState, Owner, StateUpdate } from '../../../shared/types/game';
import { createNewGame, processMovements, processTick } from './gameLogic';
import { io } from '../index';
import { versionManager } from './versionManager';
import { serverStateReconciliation } from './serverStateReconciliation';

class GameStateManager {
  private gameState: GameState;
  private tickInterval: NodeJS.Timeout | null = null;
  private currentMatchId: string | null = null;

  constructor() {
    this.gameState = createNewGame();
  }

  private emitStateUpdate() {
    if (!this.currentMatchId) return;
    
    // Create and validate state update
    const stateUpdate = serverStateReconciliation.createValidatedStateUpdate(this.gameState);
    if (!stateUpdate) {
      console.error('Failed to create validated state update');
      return;
    }

    io.to(this.currentMatchId).emit('game-state-update', stateUpdate);
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

    const matchIdForTick = this.currentMatchId;
    
    this.tickInterval = setInterval(() => {
      if (!this.gameState.isPaused) {
        const newState = processTick(this.gameState);
        
        // Validate the new state before applying it
        const validation = serverStateReconciliation.validateState(newState);
        if (!validation.isValid) {
          console.error('Tick produced invalid state:', validation.errors);
          return;
        }

        this.gameState = newState;
        this.emitStateUpdate();
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

    // Validate initial state
    const validation = serverStateReconciliation.validateState(this.gameState);
    if (!validation.isValid) {
      console.error('Initial game state validation failed:', validation.errors);
      throw new Error('Failed to initialize game: Invalid initial state');
    }

    this.startTickLoop();
    
    // Send initial state with version
    const stateUpdate = serverStateReconciliation.createValidatedStateUpdate(this.gameState);
    if (!stateUpdate) {
      throw new Error('Failed to create initial state update');
    }

    io.to(this.currentMatchId).emit('game-state-update', stateUpdate);
    io.to(this.currentMatchId).emit('game-started', stateUpdate);

    return this.gameState;
  }

  getGameState(): GameState {
    return this.gameState;
  }

  updateGameState(newState: GameState) {
    // Validate new state before applying
    const validation = serverStateReconciliation.validateState(newState);
    if (!validation.isValid) {
      console.error('State update validation failed:', validation.errors);
      return;
    }

    this.gameState = newState;
    this.emitStateUpdate();
  }

  setTickSpeed(speed: number) {
    if (!this.currentMatchId) {
      console.warn("Cannot set tick speed: no active game room.");
      return;
    }
    this.gameState.tickSpeed = speed;
    this.gameState.isPaused = false;
    this.startTickLoop();
    this.emitStateUpdate();
  }

  togglePause() {
    if (!this.currentMatchId) {
      console.warn("Cannot toggle pause: no active game room.");
      return;
    }
    this.gameState.isPaused = !this.gameState.isPaused;
    if (!this.gameState.isPaused) {
      this.startTickLoop(); 
    }
    this.emitStateUpdate();
  }

  clearMovementQueue(playerId: string) {
    if (!this.currentMatchId) {
      console.warn("Cannot clear movement queue: no active game room.");
      return;
    }
    if (this.gameState && this.gameState.movementQueue) {
      this.gameState.movementQueue = this.gameState.movementQueue.filter(
        movement => movement.playerId !== playerId
      );
    }
    this.emitStateUpdate();
  }
  
  cleanupGameRoom() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.currentMatchId) {
      // Notify players that game is over
      io.to(this.currentMatchId).emit('game-ended');
      // Clean up the room
      io.socketsLeave(this.currentMatchId);
      this.currentMatchId = null;
    }
    // Reset game state
    this.gameState = createNewGame();
  }

  cleanupMatch(matchId: string) {
    if (this.currentMatchId === matchId) {
      // Clear the game state by initializing an empty one
      this.gameState = createNewGame();
      this.currentMatchId = null;
      
      // Clear any active intervals
      if (this.tickInterval) {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
      }
    }
  }
}

export const gameStateManager = new GameStateManager(); 