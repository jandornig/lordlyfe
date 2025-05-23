import { GameState, VersionedGameState, StateUpdate } from '../../../shared/types/game';

class VersionManager {
  private currentVersion: number = 0;
  private lastUpdateTimestamp: number = Date.now();

  createVersionedState(state: GameState): VersionedGameState {
    this.currentVersion++;
    this.lastUpdateTimestamp = Date.now();
    return {
      ...state,
      version: this.currentVersion
    };
  }

  createStateUpdate(state: GameState): StateUpdate {
    this.currentVersion++;
    this.lastUpdateTimestamp = Date.now();
    
    return {
      state,
      version: this.currentVersion,
      timestamp: this.lastUpdateTimestamp
    };
  }

  getCurrentVersion(): number {
    return this.currentVersion;
  }

  getLastUpdateTimestamp(): number {
    return this.lastUpdateTimestamp;
  }
}

export const versionManager = new VersionManager(); 