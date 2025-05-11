export type TickSpeed = number;

export interface Tile {
  x: number;
  y: number;
  army: number;
  owner: 'player' | 'ai' | null;
  territory: number | null;
  isMountain: boolean;
  isCity: boolean;
  isLord: boolean;
  isVisible: boolean;
}

export interface Territory {
  id: number;
  name: string;
  color: string;
  lordTile: Tile;
}

export interface GameState {
  tiles: Tile[];
  territories: Territory[];
  selectedTile: Tile | null;
  minGarrison: number;
  tick: number;
  isPaused: boolean;
  tickSpeed: TickSpeed;
  width: number;
  height: number;
  isGameOver: boolean;
  movementQueue: Movement[];
}

export interface Movement {
  from: { x: number; y: number };
  to: { x: number; y: number };
  waypoints: { x: number; y: number }[];
} 