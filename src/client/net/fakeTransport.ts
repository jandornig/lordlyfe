import { GameState } from '../../types/game';
import { advance } from '../../core/game';
import { drainForTurn } from './commandQueue';
import { createGameState } from '../../core/gameState';

// Constants for timing
const UPDATE_MS = 16; // ~60fps for smooth progress updates
const TURN_MS = 1000; // 1 second per turn

// Type for state update listeners
type StateListener = (state: GameState, progress: number) => void;

class FakeTransport {
  private state: GameState;
  private lastTurn: number;
  private listeners: StateListener[];
  private updateInterval: NodeJS.Timeout | null;
  private turnInterval: NodeJS.Timeout | null;

  constructor() {
    this.state = createGameState(20, 20); // Default 20x20 grid
    this.lastTurn = Date.now();
    this.listeners = [];
    this.updateInterval = null;
    this.turnInterval = null;
  }

  // Connect and start the update loops
  connect() {
    // Start update loop for smooth progress updates
    this.updateInterval = setInterval(() => {
      const now = Date.now();
      const progress = Math.min(1, Math.max(0, (now - this.lastTurn) / TURN_MS));
      
      // Notify all listeners with current state and progress
      this.listeners.forEach(listener => listener(this.state, progress));
    }, UPDATE_MS);

    // Start turn loop for state updates
    this.turnInterval = setInterval(() => {
      // Process any queued commands and advance the state
      const commands = drainForTurn();
      this.state = advance(this.state, commands);
      this.lastTurn = Date.now();
    }, TURN_MS);
  }

  // Disconnect and clean up intervals
  disconnect() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.turnInterval) {
      clearInterval(this.turnInterval);
      this.turnInterval = null;
    }
  }

  // Register a new state listener
  onState(callback: StateListener) {
    this.listeners.push(callback);
    
    // Return cleanup function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Get current state
  getState(): GameState {
    return this.state;
  }
}

// Export singleton instance
export const fakeTransport = new FakeTransport(); 