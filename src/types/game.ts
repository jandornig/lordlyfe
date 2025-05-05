export type Owner = "player" | "ai" | null;

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

export interface GameState {
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
  supplyLines: SupplyLine[]; // Array of active supply lines
  armies: Army[]; // Array of active armies
  armyPool: Army[]; // Pool of reusable armies
  pathCache: Map<string, Tile[]>; // Cache for calculated paths
  maxSupplyChains: number; // Maximum number of supply chains allowed
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

export interface Army {
  id: string;
  owner: Owner;
  position: Tile;
  status: 'moving' | 'idle';
}

export interface SupplyLine {
  id: string;
  owner: Owner;
  startPoint: Tile;
  endPoint: Tile;
  path: PathStep[];
  isActive: boolean;
  currentArmyId: string | null;
  nextSpawnTick: number;
}
