export interface Player {
  id: string;
  name: string;
  color: string;
  isAI: boolean;
}

export interface Tile {
  x: number;
  y: number;
  armyCount: number;
  owner: string | null;
  isLord: boolean;
  isVisible: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isPath: boolean;
  isSupplyLine: boolean;
  isMountain: boolean;
  isCity: boolean;
  territory: string | null;
}

export interface Territory {
  id: string;
  owner: string | null;
  tiles: Tile[];
  armyCount: number;
  color: string;
  lordTile: { x: number, y: number } | null;
}

export interface GameState {
  width: number;
  height: number;
  tick: number;
  tickSpeed: number;
  tiles: Tile[];
  territories: Territory[];
  isPaused: boolean;
  isGameOver: boolean;
  winner: string | null;
  selectedTile: Tile | null;
  movementQueue: Movement[];
  minGarrison: number;
  players: {
    player: Player;
    ai: Player;
  };
}

export type TickSpeed = 100 | 250 | 500 | 1000 | 2000;

export interface Movement {
  from: Tile;
  to: Tile;
  count: number;
}

export type Owner = "player" | "ai" | null;

export interface Command {
  playerId: string;
  type: 'START_GAME' | 'SELECT_TILE' | 'MOVE_ARMY' | 'SET_TICK_SPEED' | 'TOGGLE_PAUSE' | 'END_GAME';
  payload: {
    width?: number;
    height?: number;
    tile?: Tile;
    movements?: Movement[];
    speed?: number;
    winner?: string;
  };
}

export interface Waypoint {
  x: number;
  y: number;
}

export type PanPosition = {
  x: number;
  y: number;
};

export type ZoomLevel = {
  scale: number;
};

export type PathStep = {
  x: number;
  y: number;
};

export type Path = PathStep[];
