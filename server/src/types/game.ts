export type Owner = "player" | "ai" | null;
export type TickSpeed = 100 | 250 | 500 | 1000;

export interface Tile {
  x: number;
  y: number;
  owner: Owner;
  territory: number | null;
  army: number;
  isLord: boolean;
  isCity: boolean;
  isMountain: boolean;
  isVisible: boolean;
}

export interface Territory {
  id: number;
  color: string;
  lordTile: Tile | null;
}

export interface Movement {
  from: Tile;
  to: Tile;
  armyPercentage: number;
  startTick: number;
  endTick: number;
  army: number;
  finalDestination: Tile;
  waypoints: { x: number, y: number }[];
  mustReachWaypoint: boolean;
}

export interface PathStep {
  x: number;
  y: number;
}

export interface Path {
  steps: PathStep[];
  distance: number;
  length: number;
  [index: number]: PathStep;
}

export interface GameState {
  tiles: Tile[];
  territories: Territory[];
  selectedTile: Tile | null;
  minGarrison: number;
  tick: number;
  isPaused: boolean;
  tickSpeed: number;
  width: number;
  height: number;
  isGameOver: boolean;
  movementQueue: Movement[];
  playerId: string;
  playerName: string;
  player2Id: string;
  player2Name: string;
  winner: Owner | null;
} 