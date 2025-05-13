import { GameState } from '../types/game';
import { createNewGame, processMovements, processTick } from './gameLogic';
import { io } from '../index';

class GameStateManager {
  private gameState: GameState;
  private tickInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.gameState = createNewGame();
    this.startTickLoop();
  }

  private startTickLoop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }

    console.log('Starting tick loop with speed:', this.gameState.tickSpeed);
    
    this.tickInterval = setInterval(() => {
      if (!this.gameState.isPaused) {
        // Process the tick
        this.gameState = processTick(this.gameState);
        
        // Emit the updated state to all clients
        io.emit('game-state-update', this.gameState);
      }
    }, this.gameState.tickSpeed);
  }

  initializeGame(
    width: number, 
    height: number, 
    playerId: string, 
    playerName: string,
    player2Id: string,
    player2Name: string
  ): GameState {
    console.log('Initializing new game...');
    
    // Create new game state using existing function
    this.gameState = {
      ...createNewGame(width, height),
      isPaused: false,
      playerId,
      playerName,
      player2Id,
      player2Name
    };
    
    console.log('Game state initialized:', {
      isPaused: this.gameState.isPaused,
      tick: this.gameState.tick,
      tickSpeed: this.gameState.tickSpeed,
      playerId: this.gameState.playerId,
      playerName: this.gameState.playerName,
      player2Id: this.gameState.player2Id,
      player2Name: this.gameState.player2Name
    });

    // Start the tick loop
    this.startTickLoop();
    
    // Emit initial state
    io.emit('game-state-update', this.gameState);

    return this.gameState;
  }

  getGameState(): GameState {
    return this.gameState;
  }

  updateGameState(newState: GameState) {
    this.gameState = newState;
    // Restart the tick loop when game state is updated
    this.startTickLoop();
  }

  setTickSpeed(speed: number) {
    console.log('Setting tick speed:', speed);
    this.gameState = {
      ...this.gameState,
      tickSpeed: speed
    };
    this.startTickLoop();
  }

  togglePause() {
    const newPauseState = !this.gameState.isPaused;
    console.log('Toggling pause state:', { 
      from: this.gameState.isPaused, 
      to: newPauseState,
      currentTick: this.gameState.tick,
      tickSpeed: this.gameState.tickSpeed
    });
    
    this.gameState = {
      ...this.gameState,
      isPaused: newPauseState
    };
    
    // Emit the updated state when pause is toggled
    io.emit('game-state-update', this.gameState);
  }

  clearMovementQueue() {
    this.gameState = {
      ...this.gameState,
      movementQueue: []
    };
  }
}

// Create a singleton instance
export const gameStateManager = new GameStateManager(); 