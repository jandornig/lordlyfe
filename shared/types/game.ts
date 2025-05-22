export type Owner = "player1" | "player2" | null;

export interface Tile {
  x: number;
  y: number;
  owner: Owner | null;
  territory: number | null; // Territory ID
  army: number;
  isLord: boolean;
  isCity: boolean;
  isMountain: boolean;
  isVisible: boolean; // Whether the tile is visible to the player
}

export interface Territory {
  id: number;
  color: string;
  lordTile: { x: number, y: number } | null;
}

export interface Unit {
  id: string;
  controlledBy: string; // player1Id or player2Id
  position: { x: number; y: number };
  armySize: number;
  owner: Owner;
}

export interface GameState {
  matchId: string;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  player1Units: Unit[];
  player2Units: Unit[];
  width: number;
  height: number;
  tick: number;
  tickSpeed: number;
  tiles: Tile[];
  territories: Territory[];
  isPaused: boolean;
  isGameOver: boolean;
  winner: Owner | null;
  selectedTile: Tile | null;
  movementQueue: Movement[];
  minGarrison: number; // Minimum garrison size for owned tiles
}

export type Movement = {
  from: { x: number, y: number };
  to: { x: number, y: number };
  owner: Owner;
  army: number;
  finalDestination: { x: number, y: number };
  waypoints: { x: number, y: number }[];
  mustReachWaypoint?: boolean;
  isWaypoint?: boolean;
  playerId: string;
};

export interface Waypoint {
  x: number;
  y: number;
}

export type TickSpeed = 250 | 500 | 1000;

export interface PanPosition {
  x: number;
  y: number;
}

export interface ZoomLevel {
  scale: number;
}

export interface PathStep {
  x: number;
  y: number;
}

export type Path = PathStep[];
