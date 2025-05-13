import { GameState, Tile, Owner, Movement, TickSpeed, Path, PathStep, Territory } from "../types/game";

// Game version
export const GAME_VERSION = '0.1.1.28';

const DEFAULT_MAP_SIZE = 30;
const LORD_GROWTH_RATE = 2;
const CITY_GROWTH_RATE = 1;
const MIN_GARRISON = 1;
const DEFAULT_TERRITORY_COUNT = 8; // Number of territories to generate
const CITY_STARTING_ARMIES = 50; // Starting armies for cities
const CITY_GROWTH_TICK_INTERVAL = 5; // Grow city armies every X ticks
const PLAYER_TERRITORY_GROWTH_INTERVAL = 20; // Grow player territory armies every X ticks
const DEFAULT_TICK_SPEED: TickSpeed = 1000; // Default tick speed in milliseconds

// Territory colors (light pastel colors)
const TERRITORY_COLORS = [
  '#F2FCE2', // Light Green
  '#FEF7CD', // Light Yellow
  '#FEC6A1', // Light Orange
  '#E5DEFF', // Light Purple
  '#FFDEE2', // Light Pink
  '#FDE1D3', // Light Peach
  '#D3E4FD', // Light Blue
  '#F1F0FB', // Light Gray
  '#E6FCF5', // Light Mint
  '#FFF0CC', // Light Gold
  '#FFE8C4', // Light Apricot
  '#E6E6FA', // Light Lavender
];

export const createNewGame = (
  width: number = DEFAULT_MAP_SIZE, 
  height: number = DEFAULT_MAP_SIZE
): GameState => {
  const tiles: Tile[] = [];
  const territoryCount = Math.min(DEFAULT_TERRITORY_COUNT, TERRITORY_COLORS.length);
  
  // Initialize all tiles as neutral with no territory
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({
        x,
        y,
        owner: null,
        territory: null,
        army: 0,
        isLord: false,
        isCity: false,
        isMountain: false,
        isVisible: false // Initially all tiles are hidden
      });
    }
  }
  
  // Create territories using a Voronoi-like approach
  const territories = createTerritories(tiles, width, height, territoryCount);
  
  // Identify territory border tiles
  const borderTiles: number[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (tile.isMountain) continue;
    
    const neighbors = [
      tiles.find(t => t.x === tile.x - 1 && t.y === tile.y),
      tiles.find(t => t.x === tile.x + 1 && t.y === tile.y),
      tiles.find(t => t.x === tile.x && t.y === tile.y - 1),
      tiles.find(t => t.x === tile.x && t.y === tile.y + 1)
    ].filter(Boolean);
    
    if (neighbors.some(neighbor => neighbor?.territory !== tile.territory)) {
      borderTiles.push(i);
    }
  }
  
  // Add mountains (15% of tiles, with higher chance on borders)
  const mountainCount = Math.floor(width * height * 0.15);
  for (let i = 0; i < mountainCount; i++) {
    let randomIndex: number;
    // 55% chance to place mountain on border if there are border tiles available
    if (borderTiles.length > 0 && Math.random() < 0.55) {
      randomIndex = borderTiles[getRandomInt(0, borderTiles.length - 1)];
    } else {
      randomIndex = getRandomInt(0, tiles.length - 1);
    }
    
    // Ensure we don't already have a mountain here
    if (!tiles[randomIndex].isMountain) {
      tiles[randomIndex].isMountain = true;
      // Remove from border tiles if it was there
      const borderIndex = borderTiles.indexOf(randomIndex);
      if (borderIndex !== -1) {
        borderTiles.splice(borderIndex, 1);
      }
    } else {
      // Try again if this tile already has a mountain
      i--;
    }
  }
  
  // Add cities (5% of non-mountain tiles)
  const cityCount = Math.floor(width * height * 0.05);
  for (let i = 0; i < cityCount; i++) {
    const randomIndex = getRandomInt(0, tiles.length - 1);
    // Ensure we don't place cities on mountains
    if (!tiles[randomIndex].isMountain && !tiles[randomIndex].isCity) {
      tiles[randomIndex].isCity = true;
      tiles[randomIndex].army = CITY_STARTING_ARMIES; // Starting city army is now 50
    } else {
      // Try again if this tile already has a mountain or city
      i--;
    }
  }
  
  // Add player lord tile in bottom left quadrant
  let playerLordIndex;
  do {
    const playerLordX = getRandomInt(0, Math.floor(width / 3));
    const playerLordY = getRandomInt(Math.floor(height * 2/3), height - 1);
    playerLordIndex = playerLordY * width + playerLordX;
  } while (
    tiles[playerLordIndex].isMountain || 
    tiles[playerLordIndex].isCity || 
    tiles[playerLordIndex].isLord
  );
  
  tiles[playerLordIndex].owner = "player";
  tiles[playerLordIndex].isLord = true;
  tiles[playerLordIndex].army = 10;
  tiles[playerLordIndex].territory = null; // Player lord doesn't belong to a territory
  
  // Add AI lord tile in top right quadrant
  let aiLordIndex;
  do {
    const aiLordX = getRandomInt(Math.floor(width * 2/3), width - 1);
    const aiLordY = getRandomInt(0, Math.floor(height / 3));
    aiLordIndex = aiLordY * width + aiLordX;
  } while (
    tiles[aiLordIndex].isMountain || 
    tiles[aiLordIndex].isCity || 
    tiles[aiLordIndex].isLord
  );
  
  tiles[aiLordIndex].owner = "ai";
  tiles[aiLordIndex].isLord = true;
  tiles[aiLordIndex].army = 50;
  tiles[aiLordIndex].territory = null; // AI lord doesn't belong to a territory
  
  // Set initial visibility for player lord and adjacent tiles
  const playerLordTile = tiles[playerLordIndex];
  playerLordTile.isVisible = true;
  const adjacentTiles = getAdjacentTiles({ tiles, width, height } as GameState, playerLordTile);
  adjacentTiles.forEach(tile => tile.isVisible = true);
  
  return {
    width,
    height,
    tick: 0,
    tickSpeed: DEFAULT_TICK_SPEED,
    tiles,
    territories,
    isPaused: true,
    isGameOver: false,
    winner: null,
    selectedTile: null,
    movementQueue: [],
    minGarrison: MIN_GARRISON
  };
};

export const createTerritories = (tiles: Tile[], width: number, height: number, territoryCount: number): Territory[] => {
  const territories: Territory[] = [];
  
  // Create territory centers (seeds)
  const seeds: { x: number, y: number, id: number }[] = [];
  
  // Generate seeds that are not too close to each other
  for (let i = 0; i < territoryCount; i++) {
    let x: number, y: number, tooClose: boolean;
    
    // Try to find a position that's not too close to existing seeds
    do {
      x = getRandomInt(Math.floor(width * 0.1), Math.floor(width * 0.9)); 
      y = getRandomInt(Math.floor(height * 0.1), Math.floor(height * 0.9));
      
      tooClose = seeds.some(seed => 
        Math.sqrt(Math.pow(seed.x - x, 2) + Math.pow(seed.y - y, 2)) < Math.min(width, height) / Math.sqrt(territoryCount) * 0.6
      );
    } while (tooClose);
    
    seeds.push({ x, y, id: i });
  }
  
  // Create territory objects
  for (let i = 0; i < territoryCount; i++) {
    territories.push({
      id: i,
      color: TERRITORY_COLORS[i % TERRITORY_COLORS.length],
      lordTile: null
    });
  }
  
  // Assign tiles to territories based on closest seed
  // Add noise to make the borders more organic
  for (const tile of tiles) {
    if (tile.isMountain) continue; // Skip mountains
    
    let minDistance = Infinity;
    let closestTerritory = null;
    
    for (const seed of seeds) {
      // Calculate distance with some noise to make organic shapes
      const noise = (Math.sin(tile.x * 0.3) + Math.cos(tile.y * 0.3)) * 2; // Simple noise function
      const distance = Math.sqrt(Math.pow(seed.x - tile.x, 2) + Math.pow(seed.y - tile.y, 2)) + noise;
      
      if (distance < minDistance) {
        minDistance = distance;
        closestTerritory = seed.id;
      }
    }
    
    tile.territory = closestTerritory;
  }
  
  // Place a lord tile in each territory
  for (let i = 0; i < territoryCount; i++) {
    const territoryTiles = tiles.filter(t => 
      t.territory === i && 
      !t.isMountain && // Explicitly check for mountains
      !t.isCity && 
      !t.isLord && // Don't place on existing lord tiles
      t.owner === null // Don't place on player or AI tiles
    );
    
    if (territoryTiles.length === 0) {
      // If no valid tiles found, try to find any non-mountain tile in the territory
      const fallbackTiles = tiles.filter(t => 
        t.territory === i && 
        !t.isMountain && // Explicitly check for mountains
        !t.isLord && 
        t.owner === null
      );
      if (fallbackTiles.length === 0) continue;
      
      // Take the first available tile
      const fallbackTile = fallbackTiles[0];
      
      // Make this tile a lord tile
      fallbackTile.isLord = true;
      fallbackTile.army = 50;
      territories[i].lordTile = fallbackTile;
      continue;
    }
    
    // Find a tile near the center of the territory
    const centerX = territoryTiles.reduce((sum, t) => sum + t.x, 0) / territoryTiles.length;
    const centerY = territoryTiles.reduce((sum, t) => sum + t.y, 0) / territoryTiles.length;
    
    // Find tile closest to center
    let closestTile = territoryTiles[0];
    let minDistance = Infinity;
    
    for (const tile of territoryTiles) {
      const distance = Math.sqrt(Math.pow(tile.x - centerX, 2) + Math.pow(tile.y - centerY, 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestTile = tile;
      }
    }
    
    // Make this tile a lord tile
    closestTile.isLord = true;
    closestTile.army = 50;
    
    // Update territory with lord position
    territories[i].lordTile = closestTile;
  }
  
  return territories;
};

export const processTick = (gameState: GameState): GameState => {
  if (gameState.isPaused || gameState.isGameOver) {
    return gameState;
  }
  
  const newGameState = {
    ...gameState,
    tick: gameState.tick + 1,
    tiles: [...gameState.tiles],
    movementQueue: [...gameState.movementQueue]
  };
  
  // Update visibility
  updateVisibility(newGameState);
  
  // Process army growth on owned tiles
  newGameState.tiles = newGameState.tiles.map(tile => {
    if (tile.isMountain) return tile;
    
    let newArmy = tile.army;
    
    // Lords generate more armies
    if (tile.isLord && tile.owner) {
      newArmy += LORD_GROWTH_RATE;
    } 
    // Non-player lord tiles grow 1 army per tick
    else if (tile.isLord && !tile.owner) {
      newArmy += 1;
    }
    
    // Cities generate armies if owned
    if (tile.isCity && tile.owner) {
      newArmy += CITY_GROWTH_RATE;
    }
    // Non-player cities grow 1 army every 5 ticks
    else if (tile.isCity && !tile.owner && newGameState.tick % CITY_GROWTH_TICK_INTERVAL === 0) {
      newArmy += 1;
    }

    // Player territory grows 1 army every 20 ticks
    if (tile.owner === 'player' && newGameState.tick % PLAYER_TERRITORY_GROWTH_INTERVAL === 0) {
      newArmy += 1;
    }
    
    return {
      ...tile,
      army: newArmy
    };
  });
  
  // Process movements
  processMovements(newGameState);
  
  // Check win condition
  checkWinCondition(newGameState);
  
  return newGameState;
};

export const checkWinCondition = (gameState: GameState): void => {
  const playerLord = gameState.tiles.find(tile => tile.isLord && tile.owner === "player");
  const aiLord = gameState.tiles.find(tile => tile.isLord && tile.owner === "ai");
  
  if (!playerLord) {
    gameState.isGameOver = true;
    gameState.winner = "ai";
  } else if (!aiLord) {
    gameState.isGameOver = true;
    gameState.winner = "player";
  }
};

export const processMovements = (gameState: GameState): void => {
  const { movementQueue, tiles, width } = gameState;
  
  if (movementQueue.length === 0) return;
  
  // Process all movements in the queue
  const newMovementQueue: Movement[] = [];
  const processedMovements = new Set<number>();
  const movedTiles = new Set<string>();
  
  // First pass: process all movements and collect results
  const movementResults = movementQueue.map((movement, index) => {
    if (processedMovements.has(index)) return null;
    
    // Check if the source tile has already been moved this tick
    const sourceKey = `${movement.from.x},${movement.from.y}`;
    if (movedTiles.has(sourceKey)) {
      // Keep the movement for next tick
      return movement;
    }
    
    console.log('=== Processing Movement ===');
    console.log('Current Movement:', {
      from: movement.from,
      to: movement.to,
      finalDestination: movement.finalDestination,
      waypoints: movement.waypoints,
      mustReachWaypoint: movement.mustReachWaypoint,
      isWaypoint: movement.waypoints.length > 0,
      originalWaypoints: movement.waypoints
    });
    
    // Get the source and destination tiles
    const fromIndex = getTileIndex(movement.from.x, movement.from.y, width);
    const toIndex = getTileIndex(movement.to.x, movement.to.y, width);
    
    if (fromIndex === -1 || toIndex === -1) {
      console.log('Invalid tile indices, removing movement');
      processedMovements.add(index);
      return null;
    }
    
    const fromTile = tiles[fromIndex];
    const toTile = tiles[toIndex];
    
    if (!fromTile || !toTile) {
      console.log('Tiles not found, removing movement');
      processedMovements.add(index);
      return null;
    }

    // Can't move to mountains
    if (toTile.isMountain) {
      console.log('Cannot move to mountain, removing movement');
      processedMovements.add(index);
      return null;
    }
    
    // Resolve combat for this step
    const combatResult = resolveCombat(fromTile, toTile, movement.army, gameState);
    
    // If combat was unsuccessful or army was destroyed, don't continue the movement
    if (!combatResult.success || combatResult.remainingArmy === 0) {
      console.log('Combat unsuccessful or army destroyed, removing movement');
      processedMovements.add(index);
      return null;
    }
    
    // Mark the source tile as moved this tick
    movedTiles.add(sourceKey);
    
    // Update the movement's army size
    movement.army = combatResult.remainingArmy;
    
    // Check if we've reached the current destination
    if (movement.to.x === movement.finalDestination.x && movement.to.y === movement.finalDestination.y) {
      console.log('Reached Current Destination:', {
        position: { x: movement.to.x, y: movement.to.y },
        remainingWaypoints: movement.waypoints.length,
        mustReachWaypoint: movement.mustReachWaypoint,
        isWaypoint: movement.waypoints.length > 0,
        waypoints: movement.waypoints
      });
      
      // If there are more waypoints, set the next waypoint as the destination
      if (movement.waypoints.length > 0) {
        const nextWaypoint = movement.waypoints[0];
        console.log('Setting Next Waypoint:', {
          current: movement.finalDestination,
          next: nextWaypoint,
          remainingWaypoints: movement.waypoints.length - 1,
          waypoints: movement.waypoints
        });
        
        movement.finalDestination = getTile(gameState, nextWaypoint.x, nextWaypoint.y)!;
        movement.waypoints.shift();
        movement.mustReachWaypoint = true; // Next point is a waypoint
        
        // Find path to next waypoint
        const nextPath = findPath(gameState, toTile, gameState.tiles[getTileIndex(nextWaypoint.x, nextWaypoint.y, width)]);
        console.log('Path to Next Waypoint:', nextPath);
        
        if (nextPath && nextPath.steps.length > 0) {
          // Update movement to next step
          movement.from = getTile(gameState, movement.to.x, movement.to.y)!;
          movement.to = getTile(gameState, nextPath.steps[0].x, nextPath.steps[0].y)!;
          console.log('Moving to Next Waypoint:', {
            from: movement.from,
            to: movement.to,
            pathLength: nextPath.steps.length,
            mustReachWaypoint: movement.mustReachWaypoint,
            waypoints: movement.waypoints
          });
          return movement;
        } else {
          console.log('No path found to next waypoint, removing movement');
          processedMovements.add(index);
          return null;
        }
      } else {
        // No more waypoints, movement is complete
        console.log('No more waypoints, movement complete');
        processedMovements.add(index);
        return null;
      }
    } else {
      // Find next step in path to current destination
      const nextPath = findPath(gameState, toTile, gameState.tiles[getTileIndex(movement.finalDestination.x, movement.finalDestination.y, width)]);
      console.log('Next Path Step:', nextPath);
      
      if (nextPath && nextPath.steps.length > 0) {
        // Update movement to next step
        movement.from = getTile(gameState, movement.to.x, movement.to.y)!;
        movement.to = getTile(gameState, nextPath.steps[0].x, nextPath.steps[0].y)!;
        console.log('Moving to Next Step:', {
          from: movement.from,
          to: movement.to,
          pathLength: nextPath.steps.length,
          mustReachWaypoint: movement.mustReachWaypoint,
          isWaypoint: movement.waypoints.length > 0,
          waypoints: movement.waypoints
        });
        return movement;
      } else {
        console.log('No path found to current destination, removing movement');
        processedMovements.add(index);
        return null;
      }
    }
  });
  
  // Second pass: update the movement queue with remaining movements
  gameState.movementQueue = movementResults.filter((result): result is Movement => result !== null);
  
  console.log('=== End Movement Processing ===');
};

export const resolveCombat = (fromTile: Tile, toTile: Tile, movingArmy: number, gameState: GameState): { success: boolean, remainingArmy: number } => {
  const { minGarrison, tiles } = gameState;
  
  // Preserve minimum garrison for owned tiles
  const availableArmy = fromTile.owner ? Math.max(0, fromTile.army - minGarrison) : fromTile.army;
  
  // Prevent sending more armies than are available
  movingArmy = Math.min(movingArmy, availableArmy);
  fromTile.army -= movingArmy;
  
  // If destination tile has same owner, just add armies
  if (toTile.owner === fromTile.owner) {
    toTile.army += movingArmy;
    return { success: true, remainingArmy: toTile.army };
  }
  
  // Combat resolution: attacker - defender
  const combatResult = movingArmy - toTile.army;
  
  if (combatResult > 0) {
    // Attacker wins
    toTile.owner = fromTile.owner;
    // When capturing a neutral tile, leave min garrison
    toTile.army = toTile.owner ? combatResult : Math.max(minGarrison, combatResult);
    
    // Check if the captured tile is a lord tile
    if (toTile.isLord && toTile.territory !== null) {
      // Capture all tiles in the territory
      captureTerritoryTiles(gameState, toTile.territory, fromTile.owner);
    }
    return { success: true, remainingArmy: toTile.army };
  } else {
    // Defender wins or tie - the moving army is completely destroyed
    toTile.army = Math.abs(combatResult);
    return { success: false, remainingArmy: 0 };
  }
};

export const captureTerritoryTiles = (gameState: GameState, territoryId: number, newOwner: Owner): void => {
  const { tiles } = gameState;
  
  for (const tile of tiles) {
    if (tile.territory === territoryId && !tile.isMountain) {
      // Don't change owner if it's already owned by a player or AI
      if (tile.owner === null) {
        tile.owner = newOwner;
        // Ensure minimum garrison for newly captured tiles
        if (tile.army < gameState.minGarrison) {
          tile.army = gameState.minGarrison;
        }
      }
    }
  }
};

export const isValidMove = (from: Tile, to: Tile, minGarrison: number = MIN_GARRISON): boolean => {
  // Can't move to mountains
  if (to.isMountain) return false;
  
  // Check if source has enough army to move (respecting min garrison)
  const availableArmy = from.owner ? from.army - minGarrison : from.army;
  if (availableArmy <= 0) return false;
  
  // For adjacent moves, return true
  if (isAdjacent(from, to)) return true;
  
  // For non-adjacent moves, pathfinding will be used
  return true;
};

export const isAdjacent = (tile1: Tile, tile2: Tile): boolean => {
  // Only allow horizontal and vertical movement (no diagonals)
  return (
    (Math.abs(tile1.x - tile2.x) === 1 && tile1.y === tile2.y) || // Horizontal
    (Math.abs(tile1.y - tile2.y) === 1 && tile1.x === tile2.x)    // Vertical
  );
};

export const getTileIndex = (x: number, y: number, width: number): number => {
  if (x < 0 || y < 0) return -1;
  return y * width + x;
};

export const getTile = (gameState: GameState, x: number, y: number): Tile | null => {
  const index = getTileIndex(x, y, gameState.width);
  if (index >= 0 && index < gameState.tiles.length) {
    return gameState.tiles[index];
  }
  return null;
};

export const getAdjacentTiles = (gameState: GameState, tile: Tile): Tile[] => {
  const { x, y } = tile;
  const { width, height } = gameState;
  
  // Get all 8 surrounding positions (including diagonals)
  const adjacentPositions = [
    { x: x-1, y: y-1 }, // Top-left
    { x: x, y: y-1 },   // Top
    { x: x+1, y: y-1 }, // Top-right
    { x: x-1, y: y },   // Left
    { x: x+1, y: y },   // Right
    { x: x-1, y: y+1 }, // Bottom-left
    { x: x, y: y+1 },   // Bottom
    { x: x+1, y: y+1 }  // Bottom-right
  ].filter(pos => 
    pos.x >= 0 && pos.x < width && 
    pos.y >= 0 && pos.y < height
  );
  
  return adjacentPositions
    .map(pos => getTile(gameState, pos.x, pos.y))
    .filter((tile): tile is Tile => tile !== null);
};

export const findPath = (gameState: GameState, from: Tile, to: Tile): Path => {
  // Breadth-first search implementation for pathfinding
  const { width, height } = gameState;
  
  // Initialize visited array and queue
  const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
  const queue: { tile: Tile, path: Path }[] = [];
  
  // Add starting tile to queue
  queue.push({ tile: from, path: { steps: [], distance: 0, length: 0 } });
  visited[from.y][from.x] = true;
  
  while (queue.length > 0) {
    const { tile, path } = queue.shift()!;
    
    // If we've reached the destination, return the path
    if (tile.x === to.x && tile.y === to.y) {
      console.log('Path found:', {
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y }
      });
      return path;
    }
    
    // Get adjacent tiles (only horizontal and vertical)
    const adjacentPositions = [
      { x: tile.x, y: tile.y - 1 }, // Up
      { x: tile.x, y: tile.y + 1 }, // Down
      { x: tile.x - 1, y: tile.y }, // Left
      { x: tile.x + 1, y: tile.y }  // Right
    ].filter(pos => 
      pos.x >= 0 && pos.x < width && 
      pos.y >= 0 && pos.y < height
    );
    
    const adjacentTiles = adjacentPositions
      .map(pos => getTile(gameState, pos.x, pos.y))
      .filter((tile): tile is Tile => tile !== null);
    
    for (const adjacentTile of adjacentTiles) {
      // Skip mountains and already visited tiles
      if (adjacentTile.isMountain || visited[adjacentTile.y][adjacentTile.x]) {
        continue;
      }
      
      // Mark as visited
      visited[adjacentTile.y][adjacentTile.x] = true;
      
      // Add to queue with updated path
      const newSteps = [...path.steps, { x: adjacentTile.x, y: adjacentTile.y }];
      queue.push({ tile: adjacentTile, path: { steps: newSteps, distance: newSteps.length, length: newSteps.length } });
    }
  }
  
  console.log('No path found:', {
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y }
  });
  return { steps: [], distance: 0, length: 0 };
};

export const createPathMovements = (
  gameState: GameState,
  fromTile: Tile, 
  toTile: Tile, 
  armyPercentage: number = 1,
  waypoints: { x: number, y: number }[] = []
): Movement[] => {
  console.log('=== Creating Path Movements ===');
  console.log('Start Point:', { x: fromTile.x, y: fromTile.y });
  console.log('End Point:', { x: toTile.x, y: toTile.y });
  console.log('Waypoints:', waypoints);
  console.log('Army Percentage:', armyPercentage);
  
  // Validate waypoints
  if (!Array.isArray(waypoints)) {
    console.error('Waypoints must be an array');
    waypoints = [];
  }
  
  // Get the current tile state from gameState
  const currentFromTile = gameState.tiles.find(t => t.x === fromTile.x && t.y === fromTile.y);
  if (!currentFromTile) {
    console.log('Source tile not found in game state');
    return [];
  }
  
  // Calculate army that can move based on current state
  let armyToMove = Math.floor(currentFromTile.army * armyPercentage);
  if (currentFromTile.owner) {
    armyToMove = Math.max(0, Math.min(armyToMove, currentFromTile.army - gameState.minGarrison));
  }
  
  if (armyToMove <= 0) {
    console.log('No army to move, returning empty movements');
    return [];
  }

  // If there are waypoints, we MUST go to the first waypoint first
  // Only after reaching all waypoints do we proceed to the final destination
  const initialDestination = waypoints.length > 0 ? waypoints[0] : { x: toTile.x, y: toTile.y };
  console.log('Initial Destination:', initialDestination);
  
  // The remaining waypoints (if any) plus the final destination
  const remainingWaypoints = waypoints.length > 0 
    ? [...waypoints.slice(1), { x: toTile.x, y: toTile.y }]
    : [];
  console.log('Remaining Waypoints:', remainingWaypoints);

  // Find initial path to first destination
  const initialPath = findPath(gameState, currentFromTile, gameState.tiles[getTileIndex(initialDestination.x, initialDestination.y, gameState.width)]);
  console.log('Initial Path:', initialPath);
  
  if (initialPath.steps.length === 0) {
    console.log('No path found to initial destination, returning empty movements');
    return [];
  }

  // Create a single movement for the next tile only
  const movement: Movement = {
    from: currentFromTile,
    to: gameState.tiles[getTileIndex(initialPath.steps[0].x, initialPath.steps[0].y, gameState.width)],
    army: armyToMove,
    finalDestination: gameState.tiles[getTileIndex(initialDestination.x, initialDestination.y, gameState.width)],
    waypoints: remainingWaypoints,
    mustReachWaypoint: waypoints.length > 0,
    armyPercentage,
    startTick: 0,
    endTick: 0
  };

  console.log('Created Movement:', {
    movement,
    totalArmy: movement.army,
    remainingWaypoints,
    initialPathLength: initialPath.steps.length,
    mustReachWaypoint: waypoints.length > 0,
    waypoints: waypoints,
    sourceTileArmy: currentFromTile.army
  });
  console.log('=== End Path Creation ===');

  return [movement];
};

export const createMovement = (
  fromTile: Tile, 
  toTile: Tile, 
  armyPercentage: number = 1,
  minGarrison: number = MIN_GARRISON
): Movement | null => {
  if (!isValidMove(fromTile, toTile, minGarrison)) {
    return null;
  }
  
  // Calculate army that can move (respecting min garrison)
  let armyToMove = Math.floor(fromTile.army * armyPercentage);
  if (fromTile.owner) {
    armyToMove = Math.max(0, Math.min(armyToMove, fromTile.army - minGarrison));
  }
  
  if (armyToMove <= 0) {
    return null;
  }
  
  return {
    from: fromTile,
    to: toTile,
    army: armyToMove,
    finalDestination: toTile,
    waypoints: [],
    mustReachWaypoint: false,
    armyPercentage,
    startTick: 0,
    endTick: 0
  };
};

export const enqueueMoves = (gameState: GameState, movements: Movement[]): GameState => {
  return {
    ...gameState,
    movementQueue: [...gameState.movementQueue, ...movements]
  };
};

export const setTickSpeed = (gameState: GameState, speed: TickSpeed): GameState => {
  return {
    ...gameState,
    tickSpeed: speed
  };
};

export const togglePause = (gameState: GameState): GameState => {
  return {
    ...gameState,
    isPaused: !gameState.isPaused
  };
};

// Helper function to get a random integer between min and max (inclusive)
export const getRandomInt = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Add function to update visibility
export const updateVisibility = (gameState: GameState): void => {
  const { tiles, width, height } = gameState;
  
  // First, hide all tiles
  tiles.forEach(tile => tile.isVisible = false);
  
  // Then, make player-owned tiles and their adjacent tiles visible
  tiles.forEach(tile => {
    if (tile.owner === 'player') {
      tile.isVisible = true;
      const adjacentTiles = getAdjacentTiles(gameState, tile);
      adjacentTiles.forEach(adjacentTile => adjacentTile.isVisible = true);
    }
  });
};
