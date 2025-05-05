// supplyLine.ts
// -----------------------------------------------------------------------------
//  Supply‑line system: one army travels a fixed path (start → waypoints → end),
//  then a new army immediately restarts from the start tile. Import this file
//  in your main game loop and call `updateSupplyLines` every tick.
// -----------------------------------------------------------------------------

import type {
    GameState,
    Tile,
    Owner,
    Army,
    PathStep
} from '../types/game';
import { findPath } from './gameLogic';
import { enqueueMovement } from './movementQueue';
import { generateUniqueId, generateArmyId } from './utils/ids';

// Remove duplicate PathStep type since we're importing it
// export type PathStep = Tile;

export interface SupplyLine {
  id: string;
  owner: Owner;
  startPoint: Tile;
  endPoint: Tile;
  path: Tile[]; // Changed from PathStep[] to Tile[]
  isActive: boolean;
  currentArmyId: string | null;
  nextSpawnTick: number;     // when the next army should spawn
}

// If GameState does not yet expose `supplyLines`, augment it here.
declare module './gameTypes' {
  interface GameState {
    supplyLines: SupplyLine[];
    armyPool: Army[];
    pathCache: Map<string, PathStep[]>;
    maxSupplyChains: number; // Limit based on city/lord count
  }
}

// -----------------------------------------------------------------------------
//  Public API
// -----------------------------------------------------------------------------

/**
 * Call after the player clicks the "lock" bubble.
 * `fullPath` must already include startPoint, all waypoints, and endPoint.
 */
export function lockSupplyLine(
  gameState: GameState,
  owner: Owner,
  fullPath: Tile[],
): void {
  // Cache the full path if not already cached
  const pathKey = generatePathKey(fullPath);
  if (!gameState.pathCache.has(pathKey)) {
    gameState.pathCache.set(pathKey, fullPath);
  }

  // Check if the user has reached the max supply chains limit
  if (gameState.supplyLines.length >= gameState.maxSupplyChains) {
    promptToReplaceOldestSupplyLine(gameState);
  }

  const startPoint = fullPath[0];
  const endPoint   = fullPath[fullPath.length - 1];

  const newLine: SupplyLine = {
    id: generateUniqueId(),
    owner,
    startPoint,
    endPoint,
    path: fullPath,
    isActive: true,
    currentArmyId: null,
    nextSpawnTick: gameState.tick, // spawn immediately
  };

  if (!gameState.supplyLines) gameState.supplyLines = [];
  gameState.supplyLines.push(newLine);
}

/**
 * Run this once every game tick.
 * Spawns armies and restarts them when they reach the endPoint.
 */
export function updateSupplyLines(gameState: GameState): void {
  if (!gameState.supplyLines) return;

  gameState.supplyLines.forEach((line) => {
    if (!line.isActive) return;

    // 1. Spawn a new army if none exists and it is time
    if (line.currentArmyId === null && gameState.tick >= line.nextSpawnTick) {
      spawnArmyForLine(gameState, line);
      return;
    }

    // 2. If an army exists, check whether it has arrived at the endPoint
    const army = gameState.armies.find((a) => a.id === line.currentArmyId);
    if (!army) return;

    if (tilesEqual(army.position, line.endPoint)) {
      // Army arrived: mark line free and schedule next spawn this tick
      resetArmyForNewCycle(army, line.startPoint);  // Reset army attributes
      line.currentArmyId = null;
      line.nextSpawnTick = gameState.tick;
    }
  });
}

/**
 * Call this to cancel a supply line (for example if the path is no longer valid).
 */
export function removeSupplyLine(gameState: GameState, id: string): void {
  gameState.supplyLines = gameState.supplyLines.filter((sl) => sl.id !== id);
}

// -----------------------------------------------------------------------------
//  Internal helpers
// -----------------------------------------------------------------------------

/**
 * Resets the army's position and other attributes for a new cycle.
 */
function resetArmyForNewCycle(army: Army, startPoint: Tile): void {
  army.position = startPoint;  // Reset to the start position
  army.status = "moving";      // Reset any other necessary properties
  // Reset any other state necessary for a new cycle
}

/**
 * Spawn a new army for the given supply line.
 */
function spawnArmyForLine(gameState: GameState, line: SupplyLine): void {
  const armyId = generateArmyId();

  // Reuse an army from the pool
  let army = getReusableArmy(gameState);
  if (!army) {
    army = createNewArmy();
  }

  army.id = armyId;
  army.owner = line.owner;
  army.position = line.startPoint;

  gameState.armies.push(army);

  // Skip the first tile (start) because the army already stands on it
  enqueueMovement(gameState, armyId, line.path.slice(1));
  line.currentArmyId = armyId;
}

/**
 * Retrieve a reusable army from the pool, or create a new one if none exist.
 */
function getReusableArmy(gameState: GameState): Army | null {
  if (gameState.armyPool.length > 0) {
    return gameState.armyPool.pop() || null;
  }
  return null;
}

/**
 * Creates a new army if no reusable ones exist.
 */
function createNewArmy(): Army {
  return {
    id: generateArmyId(),
    position: {
      x: 0,
      y: 0,
      owner: null,
      territory: null,
      army: 0,
      isLord: false,
      isCity: false,
      isMountain: false,
      isVisible: false
    },
    owner: "player" as Owner,
    status: "idle"
  };
}

/**
 * Compares two tiles for equality (by x and y coordinates).
 */
function tilesEqual(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Generate a unique key for a given path (start → end → waypoints).
 */
function generatePathKey(path: PathStep[]): string {
  return path.map(tile => `${tile.x},${tile.y}`).join('-');
}

/**
 * Prompt the user to delete the oldest supply line when they exceed the limit.
 */
function promptToReplaceOldestSupplyLine(gameState: GameState) {
  // This is a placeholder for the UI interaction.
  // Replace the oldest supply line and remove it from the army pool.
  const oldestLine = gameState.supplyLines.shift();
  if (oldestLine && oldestLine.currentArmyId) {
    const army = gameState.armies.find(a => a.id === oldestLine.currentArmyId);
    if (army) {
      gameState.armyPool.push(army);  // Recycle the army back into the pool
    }
  }
  // Remove the supply line from the game state
  gameState.supplyLines = gameState.supplyLines.filter(sl => sl.id !== oldestLine?.id);
}

/**
 * Build a full path from start → waypoints → end, reusing a cached path if available.
 */
export function buildPathWithWaypoints(
  gameState: GameState,
  startTile: Tile,
  waypoints: Tile[],
  endTile: Tile,
): Tile[] {
  const full: Tile[] = [];
  let currentStart = startTile;

  [...waypoints, endTile].forEach((target) => {
    const pathKey = generatePathKey([currentStart, ...waypoints, target]);
    let segment = gameState.pathCache.get(pathKey);

    if (!segment) {
      segment = findPath(gameState, currentStart, target);
      gameState.pathCache.set(pathKey, segment);
    }
    full.push(...(full.length ? segment.slice(1) : segment)); // drop duplicates
    currentStart = target;
  });

  return full;
}
  