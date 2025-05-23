export type Owner = string | null; // Can store player ID

export interface Player {
  id: string;    // Unique player identifier (e.g., from socket or a game-specific ID)
  name: string;
  color: string; // Hex color string for UI representation
  // Potentially add:
  // startingPosition: { x: number, y: number } | null; // Set during game setup
  // isEliminated: boolean;
}

export interface Tile {
  x: number;
  y: number;
  owner: Owner; // Updated to string | null
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
  controlledBy: string; // player1Id or player2Id (already string, suitable for playerId)
  position: { x: number; y: number };
  armySize: number;
  owner: string; // Player ID of the unit's owner
}

export interface GameState {
  matchId: string;
  players: Player[]; // New field
  units: Unit[]; // New field: A single list for all units in the game
  width: number;
  height: number;
  tick: number;
  tickSpeed: number;
  tiles: Tile[];
  territories: Territory[];
  isPaused: boolean;
  isGameOver: boolean;
  winner: string | null; // Player ID of the winner
  selectedTile: Tile | null;
  movementQueue: Movement[];
  minGarrison: number; // Minimum garrison size for owned tiles
}

export type Movement = {
  from: { x: number, y: number };
  to: { x: number, y: number };
  owner: Owner; // Updated to string | null
  army: number;
  finalDestination: { x: number, y: number };
  waypoints: { x: number, y: number }[];
  mustReachWaypoint?: boolean;
  isWaypoint?: boolean;
  playerId: string; // This remains the ID of the player initiating the move
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
