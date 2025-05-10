export interface Tile {
  x: number;
  y: number;
  owner: 'player1' | 'player2' | null;
  army: number;
  isLord: boolean;
  isCity: boolean;
  isMountain: boolean;
}

export interface GameState {
  width: number;
  height: number;
  tiles: Tile[];
  selectedTile: Tile | null;
  isPaused: boolean;
  tickCount: number;
  currentPlayer?: 'player1' | 'player2';
  territories: Map<string, Territory>;
}

export interface Territory {
  id: string;
  owner: 'player1' | 'player2' | null;
  tiles: Tile[];
  color: string;
}

// Message types for WebSocket communication
export type ClientMessage = {
  type: 'SELECT_TILE' | 'MOVE_ARMY' | 'TOGGLE_PAUSE' | 'SET_TICK_SPEED' | 'QUEUE_ACTION' | 'CREATE_ROOM' | 'START_GAME' | 'TEST_CONNECTION';
  payload: {
    playerId?: string;
    action?: {
      type: string;
      data: any;
      timestamp: number;
    };
    playerName?: string;
    addBot?: boolean;
    timestamp?: number;
  };
}

export type ServerMessage = {
  type: 'GAME_STATE' | 'ERROR' | 'ACTION_ACKNOWLEDGED' | 'TEST_CONNECTION_RESPONSE';
  payload: {
    state?: GameState;
    error?: string;
    actionId?: string;
    received?: boolean;
    timestamp?: number;
    details?: string;
  };
} 