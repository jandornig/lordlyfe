import { GameState, Tile, StateUpdate } from '../../../shared/types/game';
import { versionManager } from './versionManager';

interface StateValidationResult {
  isValid: boolean;
  errors: string[];
  mismatches?: {
    tiles?: { x: number; y: number; expected: any; actual: any }[];
    units?: { id: string; expected: any; actual: any }[];
  };
}

class ServerStateReconciliation {
  private stateHistory: Map<number, GameState> = new Map();
  private readonly MAX_HISTORY_SIZE = 10; // Keep last 10 states for rollback

  /**
   * Validates lord tiles in the game state
   */
  private validateLordTiles(state: GameState): string[] {
    const errors: string[] = [];
    const lordTiles = state.tiles.filter(tile => tile.isLord);

    // Only validate lord ownership during initial game state (tick 0)
    if (state.tick === 0) {
      // Check that each player has exactly one lord
      const player1Lords = lordTiles.filter(tile => tile.owner === 'player1');
      const player2Lords = lordTiles.filter(tile => tile.owner === 'player2');

      if (player1Lords.length !== 1) {
        errors.push(`Player 1 has ${player1Lords.length} lord tiles. Expected exactly 1.`);
      }
      if (player2Lords.length !== 1) {
        errors.push(`Player 2 has ${player2Lords.length} lord tiles. Expected exactly 1.`);
      }

      // Check initial lord placement
      lordTiles.forEach(tile => {
        // Lords should be within game boundaries
        if (tile.x < 0 || tile.x >= state.width || tile.y < 0 || tile.y >= state.height) {
          errors.push(`Lord tile at (${tile.x}, ${tile.y}) is outside game boundaries`);
        }

        // Initial lords should have an army
        if (tile.army <= 0) {
          errors.push(`Lord tile at (${tile.x}, ${tile.y}) has invalid army value: ${tile.army}`);
        }
      });
    }

    return errors;
  }

  /**
   * Validates a game state for consistency
   */
  validateState(state: GameState): StateValidationResult {
    const errors: string[] = [];
    const mismatches = {
      tiles: [] as { x: number; y: number; expected: any; actual: any }[],
      units: [] as { id: string; expected: any; actual: any }[]
    };

    // Basic structure validation
    if (!state.tiles || !Array.isArray(state.tiles)) {
      errors.push('Invalid tiles array in state');
      return { isValid: false, errors };
    }

    // Validate tile coordinates and ownership
    const tileCoordinates = new Set<string>();
    state.tiles.forEach(tile => {
      const coordKey = `${tile.x},${tile.y}`;
      if (tileCoordinates.has(coordKey)) {
        errors.push(`Duplicate tile coordinates at (${tile.x}, ${tile.y})`);
      }
      tileCoordinates.add(coordKey);

      // Validate tile ownership
      if (tile.owner && !['player1', 'player2', null].includes(tile.owner)) {
        errors.push(`Invalid tile owner at (${tile.x}, ${tile.y}): ${tile.owner}`);
      }

      // Validate army values
      if (tile.army < 0) {
        errors.push(`Invalid army value at (${tile.x}, ${tile.y}): ${tile.army}`);
      }
    });

    // Validate player units
    if (!Array.isArray(state.player1Units) || !Array.isArray(state.player2Units)) {
      errors.push('Invalid player units arrays');
    }

    // Validate game boundaries
    if (state.width <= 0 || state.height <= 0) {
      errors.push(`Invalid game dimensions: ${state.width}x${state.height}`);
    }

    // Validate tick values
    if (state.tick < 0) {
      errors.push(`Invalid tick value: ${state.tick}`);
    }

    // Validate tick speed
    if (state.tickSpeed <= 0) {
      errors.push(`Invalid tick speed: ${state.tickSpeed}`);
    }

    // Validate lord tiles
    const lordErrors = this.validateLordTiles(state);
    errors.push(...lordErrors);

    return {
      isValid: errors.length === 0,
      errors,
      mismatches: errors.length === 0 ? undefined : mismatches
    };
  }

  /**
   * Stores a state in history for potential rollback
   */
  storeState(version: number, state: GameState) {
    this.stateHistory.set(version, { ...state });
    
    // Maintain history size limit
    if (this.stateHistory.size > this.MAX_HISTORY_SIZE) {
      const oldestVersion = Math.min(...this.stateHistory.keys());
      this.stateHistory.delete(oldestVersion);
    }
  }

  /**
   * Attempts to recover a previous state
   */
  recoverState(targetVersion: number): GameState | null {
    return this.stateHistory.get(targetVersion) || null;
  }

  /**
   * Creates a state update with validation
   */
  createValidatedStateUpdate(state: GameState): StateUpdate | null {
    const validation = this.validateState(state);
    
    if (!validation.isValid) {
      console.error('State validation failed:', validation.errors);
      return null;
    }

    const stateUpdate = versionManager.createStateUpdate(state);
    this.storeState(stateUpdate.version, state);
    
    return stateUpdate;
  }

  /**
   * Compares two states and returns differences
   */
  compareStates(oldState: GameState, newState: GameState): StateValidationResult {
    const errors: string[] = [];
    const mismatches = {
      tiles: [] as { x: number; y: number; expected: any; actual: any }[],
      units: [] as { id: string; expected: any; actual: any }[]
    };

    // Compare tiles
    oldState.tiles.forEach(oldTile => {
      const newTile = newState.tiles.find(t => t.x === oldTile.x && t.y === oldTile.y);
      if (!newTile) {
        errors.push(`Tile at (${oldTile.x}, ${oldTile.y}) missing in new state`);
        return;
      }

      if (oldTile.owner !== newTile.owner) {
        mismatches.tiles.push({
          x: oldTile.x,
          y: oldTile.y,
          expected: oldTile.owner,
          actual: newTile.owner
        });
      }

      if (oldTile.army !== newTile.army) {
        mismatches.tiles.push({
          x: oldTile.x,
          y: oldTile.y,
          expected: oldTile.army,
          actual: newTile.army
        });
      }
    });

    // Compare player units
    ['player1Units', 'player2Units'].forEach(unitKey => {
      const oldUnits = oldState[unitKey as keyof GameState] as any[];
      const newUnits = newState[unitKey as keyof GameState] as any[];
      
      if (oldUnits.length !== newUnits.length) {
        errors.push(`${unitKey} count mismatch: ${oldUnits.length} vs ${newUnits.length}`);
      }
    });

    return {
      isValid: errors.length === 0 && mismatches.tiles.length === 0 && mismatches.units.length === 0,
      errors,
      mismatches
    };
  }
}

export const serverStateReconciliation = new ServerStateReconciliation(); 