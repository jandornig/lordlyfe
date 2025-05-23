import { GameState, Tile, Movement, Path, PathStep, Owner, Player } from '../../../shared/types/game';
import { getTileIndex, getTile, resolveCombat } from './gameLogic'; // Assuming resolveCombat is also exported from gameLogic for now

// Debug flags
const DEBUG = {
  MOVEMENTS: false,
  PATHFINDING: false,
  GAME_STATE: false // This might be more relevant in gameLogic or gameState
};

export const processMovements = (gameState: GameState): void => {
  if (DEBUG.MOVEMENTS) {
    console.log('=== Processing Movements ===');
    console.log('Movement queue length:', gameState.movementQueue.length);
  }
  
  const { movementQueue, tiles, width } = gameState;
  
  if (movementQueue.length === 0) {
    if (DEBUG.MOVEMENTS) {
      console.log('No movements to process');
    }
    return;
  }
  
  const processedMovements = new Set<number>();
  const movedTiles = new Set<string>(); // Tracks source tiles already involved in a move this tick
  
  const remainingMovements = movementQueue.filter((movement, index) => {
    if (DEBUG.MOVEMENTS) {
      console.log(`Processing movement ${index}:`, movement);
    }
    
    if (processedMovements.has(index)) {
      if (DEBUG.MOVEMENTS) console.log(`Movement ${index} already processed, skipping.`);
      return false; // Already processed (e.g. part of a consolidated move), remove
    }

    const sourceKey = `${movement.from.x},${movement.from.y}`;
    if (movedTiles.has(sourceKey) && movement.playerId === tiles[getTileIndex(movement.from.x, movement.from.y, width)]?.owner) {
        if (DEBUG.MOVEMENTS) console.log(`Source tile ${sourceKey} already moved this tick by owner, keeping movement for next tick.`);
        return true; // Keep in queue for next tick
    }
    
    const fromTile = getTile(gameState, movement.from.x, movement.from.y);
    const toTile = getTile(gameState, movement.to.x, movement.to.y);
    
    if (!fromTile || !toTile) {
      if (DEBUG.MOVEMENTS) console.log('Invalid from/to tile in movement, removing from queue:', { from: movement.from, to: movement.to });
      processedMovements.add(index);
      return false; // Invalid tile, remove
    }

    if (fromTile.owner !== movement.playerId) {
      if (DEBUG.MOVEMENTS) {
        console.log('Tile not owned by player initiating the move, removing from queue:', {
          fromTileOwner: fromTile.owner,
          expectedOwner: movement.playerId,
          playerId: movement.playerId
        });
      }
      processedMovements.add(index);
      return false; // Player doesn't own source, remove
    }

    if (toTile.isMountain) {
      if (DEBUG.MOVEMENTS) console.log('Cannot move to mountain, removing from queue');
      processedMovements.add(index);
      return false; // Cannot move to mountain, remove
    }
    
    const combatResult = resolveCombat(fromTile, toTile, movement.army, gameState);
    if (DEBUG.MOVEMENTS) console.log('Combat result:', combatResult);
    
    if (!combatResult.success || combatResult.remainingArmy === 0) {
      if (DEBUG.MOVEMENTS) console.log('Combat unsuccessful or army destroyed, movement ends.');
      processedMovements.add(index);
      movedTiles.add(sourceKey); // Source tile participated in a move
      return false; // Combat failed or army lost, remove
    }
    
    movedTiles.add(sourceKey); // Mark source tile as having made a move this tick
    movement.army = combatResult.remainingArmy; // Update army size
    
    // Check if current 'to' is the final destination of this step
    if (movement.to.x === movement.finalDestination.x && movement.to.y === movement.finalDestination.y) {
      if (movement.waypoints.length > 0) {
        const nextWaypoint = movement.waypoints.shift()!; // Get and remove next waypoint
        // Update finalDestination to this waypoint, and find path to it
        movement.finalDestination = {x: nextWaypoint.x, y: nextWaypoint.y};
        // The 'to' tile from this step is now the 'from' for the next path segment
        const path_to_next_waypoint = findPath(gameState, toTile, getTile(gameState, nextWaypoint.x, nextWaypoint.y)!);
        if (path_to_next_waypoint && path_to_next_waypoint.length > 0) {
          movement.from = {x: toTile.x, y: toTile.y};
          movement.to = {x: path_to_next_waypoint[0].x, y: path_to_next_waypoint[0].y};
          if (DEBUG.MOVEMENTS) console.log('Moving to next waypoint:', movement);
          return true; // Keep in queue, updated for next segment
        } else {
          if (DEBUG.MOVEMENTS) console.log('No path to next waypoint, ending movement.');
          processedMovements.add(index);
          return false; // No path to waypoint, remove
        }
      } else {
        // Reached final destination, no more waypoints
        if (DEBUG.MOVEMENTS) console.log('Movement reached final destination.');
        processedMovements.add(index);
        return false; // Movement complete, remove
      }
    } else {
      // Not yet at the final destination of this step, find next step in current path
      const currentPath = findPath(gameState, toTile, getTile(gameState, movement.finalDestination.x, movement.finalDestination.y)!);
      if (currentPath && currentPath.length > 0) {
        movement.from = {x: toTile.x, y: toTile.y};
        movement.to = {x: currentPath[0].x, y: currentPath[0].y};
        if (DEBUG.MOVEMENTS) console.log('Moving to next step in current path:', movement);
        return true; // Keep in queue, updated for next step
      } else {
        if (DEBUG.MOVEMENTS) console.log('No further path to current final destination, ending movement.');
        processedMovements.add(index);
        return false; // No path, remove
      }
    }
  });
  
  gameState.movementQueue = remainingMovements;
  
  if (DEBUG.MOVEMENTS) {
    console.log('Updated movement queue:', gameState.movementQueue);
    console.log('=== End Movement Processing ===');
  }
};


export const isValidMove = (from: Tile, to: Tile, gameState: GameState, playerId: string, minGarrison: number): boolean => {
  if (DEBUG.GAME_STATE) {
    console.log('Validating move:', {
      from: { x: from.x, y: from.y, owner: from.owner, army: from.army },
      to: { x: to.x, y: to.y, owner: to.owner, army: to.army },
      playerId,
    });
  }

  if (to.isMountain) {
    if (DEBUG.GAME_STATE) console.log('Invalid move: Target is mountain');
    return false;
  }
  
  const availableArmy = from.owner ? from.army - minGarrison : from.army;
  if (availableArmy <= 0) {
    if (DEBUG.GAME_STATE) console.log('Invalid move: Insufficient army');
    return false;
  }

  if (from.owner !== playerId) {
    if (DEBUG.GAME_STATE) {
      console.log('Invalid move: Tile not owned by player', {
        fromOwner: from.owner,
        expectedOwner: playerId,
      });
    }
    return false;
  }
  
  if (isAdjacent(from, to)) {
    if (DEBUG.GAME_STATE) console.log('Valid adjacent move');
    return true;
  }
  
  if (DEBUG.GAME_STATE) console.log('Valid non-adjacent move (pathfinding will be used)');
  return true; // Pathfinding will determine actual reachability
};

export const isAdjacent = (tile1: Tile, tile2: Tile): boolean => {
  return (
    (Math.abs(tile1.x - tile2.x) === 1 && tile1.y === tile2.y) ||
    (Math.abs(tile1.y - tile2.y) === 1 && tile1.x === tile2.x)
  );
};

export const findPath = (gameState: GameState, from: Tile, to: Tile): Path => {
  const { width, height, tiles } = gameState;
  const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
  const queue: { tile: Tile, path: Path }[] = [];
  
  queue.push({ tile: from, path: [] });
  visited[from.y][from.x] = true;
  
  while (queue.length > 0) {
    const { tile: currentTile, path: currentPath } = queue.shift()!;
    
    if (currentTile.x === to.x && currentTile.y === to.y) {
      if (DEBUG.PATHFINDING) console.log('Path found:', { from: {x:from.x, y:from.y}, to: {x:to.x, y:to.y}, pathLength: currentPath.length });
      return currentPath;
    }
    
    const adjacentPositions = [
      { x: currentTile.x, y: currentTile.y - 1 }, { x: currentTile.x, y: currentTile.y + 1 },
      { x: currentTile.x - 1, y: currentTile.y }, { x: currentTile.x + 1, y: currentTile.y }
    ].filter(pos => pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height);
    
    for (const pos of adjacentPositions) {
      const adjacentTile = getTile(gameState, pos.x, pos.y);
      if (adjacentTile && !adjacentTile.isMountain && !visited[pos.y][pos.x]) {
        visited[pos.y][pos.x] = true;
        const newPath = [...currentPath, { x: pos.x, y: pos.y }];
        queue.push({ tile: adjacentTile, path: newPath });
      }
    }
  }
  
  if (DEBUG.PATHFINDING) console.log('No path found:', { from: {x:from.x, y:from.y}, to: {x:to.x, y:to.y} });
  return []; // No path found
};

export const createPathMovements = (
  gameState: GameState,
  fromTile: Tile, 
  toTile: Tile, 
  armyPercentage: number = 1, // Default to 100% of available army
  waypoints: { x: number, y: number }[] = [],
  playerId: string
): Movement[] => {
  if (DEBUG.GAME_STATE) {
    console.log('=== Creating Path Movements ===', { from: fromTile, to: toTile, armyPercentage, waypoints, playerId });
  }
  
  if (!Array.isArray(waypoints)) waypoints = [];
  
  const currentFromTile = getTile(gameState, fromTile.x, fromTile.y);
  if (!currentFromTile) {
    if (DEBUG.GAME_STATE) console.log('Source tile not found in game state for createPathMovements');
    return [];
  }
  
  let armyToMove = Math.floor(currentFromTile.army * armyPercentage);
  if (currentFromTile.owner) { // Only apply minGarrison if the tile is owned
    armyToMove = Math.max(0, Math.min(armyToMove, currentFromTile.army - gameState.minGarrison));
  }
  
  if (armyToMove <= 0) {
    if (DEBUG.GAME_STATE) console.log('No army to move or insufficient army after garrison');
    return [];
  }

  const initialTarget = waypoints.length > 0 ? waypoints[0] : { x: toTile.x, y: toTile.y };
  const initialTargetPathTile = getTile(gameState, initialTarget.x, initialTarget.y);

  if(!initialTargetPathTile){
      if(DEBUG.GAME_STATE) console.log("Initial target tile for path not found.");
      return [];
  }
  
  const initialPath = findPath(gameState, currentFromTile, initialTargetPathTile);
  
  if (initialPath.length === 0) {
    if (DEBUG.GAME_STATE) console.log('No path found to initial destination for createPathMovements');
    return [];
  }

  const movement: Movement = {
    from: {x: currentFromTile.x, y: currentFromTile.y},
    to: {x: initialPath[0].x, y: initialPath[0].y}, // Move to the first step in the path
    owner: currentFromTile.owner, // Owner of the tile is the owner of the movement for validation
    army: armyToMove,
    finalDestination: initialTarget, // The target for this segment of the movement
    waypoints: waypoints.length > 0 ? [...waypoints.slice(1), { x: toTile.x, y: toTile.y }] : [], // Remaining waypoints + final actual destination
    mustReachWaypoint: waypoints.length > 0,
    playerId
  };

  if (DEBUG.GAME_STATE) {
    console.log('Created Movement:', { movement });
  }
  return [movement];
};

export const createMovement = (
  fromTile: Tile, 
  toTile: Tile, 
  gameState: GameState,
  playerId: string,
  armiesToMove: number, // This is an absolute number of armies
  minGarrison: number
): Movement | null => {
  if (!isValidMove(fromTile, toTile, gameState, playerId, minGarrison)) {
    return null;
  }
  
  // Ensure armiesToMove respects minGarrison
  const availableArmy = fromTile.owner ? fromTile.army - minGarrison : fromTile.army;
  const actualArmiesToMove = Math.min(armiesToMove, Math.max(0, availableArmy));

  if (actualArmiesToMove <= 0) return null;
  
  return {
    from: {x: fromTile.x, y: fromTile.y},
    to: {x: toTile.x, y: toTile.y},
    owner: fromTile.owner,
    army: actualArmiesToMove,
    finalDestination: {x: toTile.x, y: toTile.y}, // For direct moves, 'to' is the final destination
    waypoints: [],
    mustReachWaypoint: false,
    playerId
  };
};
