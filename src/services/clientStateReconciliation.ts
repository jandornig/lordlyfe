import { GameState, StateUpdate } from '../../shared/types/game';
import { socket } from './socket';

interface ReconciliationResult {
  success: boolean;
  recovered: boolean;
  errors?: string[];
}

class ClientStateReconciliation {
  private lastValidState: GameState | null = null;
  private lastValidVersion: number = 0;
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private recoveryAttempts: number = 0;

  /**
   * Validates a received state update
   */
  validateStateUpdate(update: StateUpdate, currentState: GameState): ReconciliationResult {
    if (!update.state || !update.state.tiles) {
      return {
        success: false,
        recovered: false,
        errors: ['Invalid state update received']
      };
    }

    // Check if this is a newer version
    if (update.version <= this.lastValidVersion) {
      return {
        success: false,
        recovered: false,
        errors: [`Received outdated state update: version ${update.version} <= ${this.lastValidVersion}`]
      };
    }

    // Validate basic state structure
    const errors: string[] = [];
    if (!Array.isArray(update.state.tiles)) {
      errors.push('Invalid tiles array in state update');
    }

    if (update.state.width <= 0 || update.state.height <= 0) {
      errors.push(`Invalid game dimensions: ${update.state.width}x${update.state.height}`);
    }

    if (errors.length > 0) {
      return {
        success: false,
        recovered: false,
        errors
      };
    }

    // Store valid state
    this.lastValidState = { ...update.state };
    this.lastValidVersion = update.version;
    this.recoveryAttempts = 0;

    return {
      success: true,
      recovered: false
    };
  }

  /**
   * Attempts to recover from an invalid state
   */
  async recoverState(): Promise<ReconciliationResult> {
    if (this.recoveryAttempts >= this.MAX_RECOVERY_ATTEMPTS) {
      return {
        success: false,
        recovered: false,
        errors: ['Max recovery attempts reached']
      };
    }

    this.recoveryAttempts++;

    // Request full state from server
    return new Promise((resolve) => {
      socket.emit('request-full-state', { lastValidVersion: this.lastValidVersion });
      
      // Set up one-time listener for state response
      const handleStateResponse = (update: StateUpdate) => {
        socket.off('full-state-response', handleStateResponse);
        
        const result = this.validateStateUpdate(update, this.lastValidState || {} as GameState);
        if (result.success) {
          resolve({
            success: true,
            recovered: true
          });
        } else {
          resolve({
            success: false,
            recovered: false,
            errors: result.errors
          });
        }
      };

      socket.on('full-state-response', handleStateResponse);

      // Set timeout for recovery attempt
      setTimeout(() => {
        socket.off('full-state-response', handleStateResponse);
        resolve({
          success: false,
          recovered: false,
          errors: ['State recovery timeout']
        });
      }, 5000);
    });
  }

  /**
   * Handles state update with recovery mechanism
   */
  async handleStateUpdate(update: StateUpdate, currentState: GameState): Promise<ReconciliationResult> {
    const validation = this.validateStateUpdate(update, currentState);
    
    if (validation.success) {
      return validation;
    }

    // Attempt recovery if validation failed
    return this.recoverState();
  }

  /**
   * Resets the reconciliation state
   */
  reset() {
    this.lastValidState = null;
    this.lastValidVersion = 0;
    this.recoveryAttempts = 0;
  }
}

export const clientStateReconciliation = new ClientStateReconciliation(); 