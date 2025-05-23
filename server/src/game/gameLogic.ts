import { GameState, Tile, Owner, Movement, TickSpeed, Path, PathStep, Territory } from "../../../shared/types/game";
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';

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
const DEFAULT_TICK_SPEED = 1000; // Default tick speed in milliseconds
const STARTING_ARMY_SIZE = 10;

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

// Debug flags
const DEBUG = {
  MOVEMENTS: false,
  PATHFINDING: false,
  GAME_STATE: false
};

export const createNewGame = (
  width: number = DEFAULT_MAP_SIZE, 
  height: number = DEFAULT_MAP_SIZE,
  player1Id: string = '',
  player2Id: string = ''
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
  
  tiles[playerLordIndex].owner = "player1";
  tiles[playerLordIndex].isLord = true;
  tiles[playerLordIndex].army = STARTING_ARMY_SIZE;
  tiles[playerLordIndex].territory = null;

  // Add player2 lord tile in top right quadrant (repurposed from old AI logic)
  let player2LordIndex;
  do {
    const player2LordX = getRandomInt(Math.floor(width * 2/3), width - 1);
    const player2LordY = getRandomInt(0, Math.floor(height / 3));
    player2LordIndex = player2LordY * width + player2LordX;
  } while (
    tiles[player2LordIndex].isMountain || 
    tiles[player2LordIndex].isCity || 
    tiles[player2LordIndex].isLord
  );
  tiles[player2LordIndex].owner = "player2";
  tiles[player2LordIndex].isLord = true;
  tiles[player2LordIndex].army = STARTING_ARMY_SIZE;
  tiles[player2LordIndex].territory = null;
  
  // Set initial visibility for player1 lord and adjacent tiles
  const playerLordTile = tiles[playerLordIndex];
  playerLordTile.isVisible = true;
  const adjacentTiles = getAdjacentTiles({ tiles, width, height } as GameState, playerLordTile);
  adjacentTiles.forEach(tile => tile.isVisible = true);

  // Set initial visibility for player2 lord and adjacent tiles
  const player2LordTile = tiles[player2LordIndex];
  player2LordTile.isVisible = true;
  const player2AdjacentTiles = getAdjacentTiles({ tiles, width, height } as GameState, player2LordTile);
  player2AdjacentTiles.forEach(tile => tile.isVisible = true);

  // Create initial units for both players (lord units)
  const player1Units = [{
    id: uuidv4(),
    controlledBy: player1Id,
    position: { x: playerLordTile.x, y: playerLordTile.y },
    armySize: playerLordTile.army,
    owner: 'player1' as Owner
  }];
  const player2Units = [{
    id: uuidv4(),
    controlledBy: player2Id,
    position: { x: tiles[player2LordIndex].x, y: tiles[player2LordIndex].y },
    armySize: tiles[player2LordIndex].army,
    owner: 'player2' as Owner
  }];
  
  return {
    matchId: "",
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
    minGarrison: MIN_GARRISON,
    player1Id: player1Id,
    player1Name: "",
    player2Id: player2Id,
    player2Name: "",
    player1Units,
    player2Units
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
    if (tile.owner && newGameState.tick % PLAYER_TERRITORY_GROWTH_INTERVAL === 0) {
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
  const player1Lord = gameState.tiles.find(tile => tile.isLord && tile.owner === "player1");
  const player2Lord = gameState.tiles.find(tile => tile.isLord && tile.owner === "player2");
  
  if (!player1Lord) {
    gameState.isGameOver = true;
    gameState.winner = "player2";
  } else if (!player2Lord) {
    gameState.isGameOver = true;
    gameState.winner = "player1";
  }
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
  
  // Process all movements in the queue
  const newMovementQueue: Movement[] = [];
  const processedMovements = new Set<number>();
  const movedTiles = new Set<string>();
  
  // First pass: process all movements and collect results
  const movementResults = movementQueue.map((movement, index) => {
    if (DEBUG.MOVEMENTS) {
      console.log(`Processing movement ${index}:`, movement);
    }
    
    if (processedMovements.has(index)) {
      if (DEBUG.MOVEMENTS) {
        console.log(`Movement ${index} already processed`);
      }
      return null;
    }
    
    // Check if the source tile has already been moved this tick
    const sourceKey = `${movement.from.x},${movement.from.y}`;
    if (movedTiles.has(sourceKey)) {
      if (DEBUG.MOVEMENTS) {
        console.log(`Source tile ${sourceKey} already moved this tick`);
      }
      return movement;
    }
    
    // Get the source and destination tiles
    const fromIndex = getTileIndex(movement.from.x, movement.from.y, width);
    const toIndex = getTileIndex(movement.to.x, movement.to.y, width);
    
    if (fromIndex === -1 || toIndex === -1) {
      if (DEBUG.MOVEMENTS) {
        console.log('Invalid tile indices:', { fromIndex, toIndex });
      }
      processedMovements.add(index);
      return null;
    }
    
    const fromTile = tiles[fromIndex];
    const toTile = tiles[toIndex];
    
    if (!fromTile || !toTile) {
      if (DEBUG.MOVEMENTS) {
        console.log('Tiles not found:', { fromTile, toTile });
      }
      processedMovements.add(index);
      return null;
    }

    // Verify tile ownership
    const isPlayer1 = movement.playerId === gameState.player1Id;
    const isPlayer2 = movement.playerId === gameState.player2Id;
    const expectedOwner = isPlayer1 ? 'player1' : isPlayer2 ? 'player2' : null;
    
    if (fromTile.owner !== expectedOwner) {
      if (DEBUG.MOVEMENTS) {
        console.log('Tile not owned by player:', {
          fromTileOwner: fromTile.owner,
          expectedOwner,
          isPlayer1,
          isPlayer2,
          playerId: movement.playerId
        });
      }
      processedMovements.add(index);
      return null;
    }

    if (DEBUG.MOVEMENTS) {
      console.log('Processing movement between tiles:', {
        from: { x: fromTile.x, y: fromTile.y, owner: fromTile.owner, army: fromTile.army },
        to: { x: toTile.x, y: toTile.y, owner: toTile.owner, army: toTile.army }
      });
    }

    // Can't move to mountains
    if (toTile.isMountain) {
      if (DEBUG.MOVEMENTS) {
        console.log('Cannot move to mountain');
      }
      processedMovements.add(index);
      return null;
    }
    
    // Resolve combat for this step
    const combatResult = resolveCombat(fromTile, toTile, movement.army, gameState);
    if (DEBUG.MOVEMENTS) {
      console.log('Combat result:', combatResult);
    }
    
    // If combat was unsuccessful or army was destroyed, don't continue the movement
    if (!combatResult.success || combatResult.remainingArmy === 0) {
      if (DEBUG.MOVEMENTS) {
        console.log('Combat unsuccessful or army destroyed');
      }
      processedMovements.add(index);
      return null;
    }
    
    // Mark the source tile as moved this tick
    movedTiles.add(sourceKey);
    
    // Update the movement's army size
    movement.army = combatResult.remainingArmy;
    
    // Check if we've reached the current destination
    if (movement.to.x === movement.finalDestination.x && movement.to.y === movement.finalDestination.y) {
      if (DEBUG.MOVEMENTS) {
        console.log('Reached Current Destination:', {
          position: { x: movement.to.x, y: movement.to.y },
          remainingWaypoints: movement.waypoints.length,
          mustReachWaypoint: movement.mustReachWaypoint,
          isWaypoint: movement.waypoints.length > 0,
          waypoints: movement.waypoints
        });
      }
      
      // If there are more waypoints, set the next waypoint as the destination
      if (movement.waypoints.length > 0) {
        const nextWaypoint = movement.waypoints[0];
        if (DEBUG.MOVEMENTS) {
          console.log('Setting Next Waypoint:', {
            current: movement.finalDestination,
            next: nextWaypoint,
            remainingWaypoints: movement.waypoints.length - 1,
            waypoints: movement.waypoints
          });
        }
        
        movement.finalDestination = getTile(gameState, nextWaypoint.x, nextWaypoint.y)!;
        movement.waypoints.shift();
        movement.mustReachWaypoint = true; // Next point is a waypoint
        
        // Find path to next waypoint
        const nextPath = findPath(gameState, toTile, gameState.tiles[getTileIndex(nextWaypoint.x, nextWaypoint.y, width)]);
        if (DEBUG.PATHFINDING) {
          console.log('Path to Next Waypoint:', nextPath);
        }
        
        if (nextPath && nextPath.length > 0) {
          // Update movement to next step
          movement.from = getTile(gameState, movement.to.x, movement.to.y)!;
          movement.to = getTile(gameState, nextPath[0].x, nextPath[0].y)!;
          if (DEBUG.MOVEMENTS) {
            console.log('Moving to Next Waypoint:', {
              from: movement.from,
              to: movement.to,
              pathLength: nextPath.length,
              mustReachWaypoint: movement.mustReachWaypoint,
              waypoints: movement.waypoints
            });
          }
          return movement;
        } else {
          if (DEBUG.MOVEMENTS) {
            console.log('No path found to next waypoint, removing movement');
          }
          processedMovements.add(index);
          return null;
        }
      } else {
        // No more waypoints, movement is complete
        if (DEBUG.MOVEMENTS) {
          console.log('No more waypoints, movement complete');
        }
        processedMovements.add(index);
        return null;
      }
    } else {
      // Find next step in path to current destination
      const nextPath = findPath(gameState, toTile, gameState.tiles[getTileIndex(movement.finalDestination.x, movement.finalDestination.y, width)]);
      if (DEBUG.PATHFINDING) {
        console.log('Next Path Step:', nextPath);
      }
      
      if (nextPath && nextPath.length > 0) {
        // Update movement to next step
        movement.from = getTile(gameState, movement.to.x, movement.to.y)!;
        movement.to = getTile(gameState, nextPath[0].x, nextPath[0].y)!;
        if (DEBUG.MOVEMENTS) {
          console.log('Moving to Next Step:', {
            from: movement.from,
            to: movement.to,
            pathLength: nextPath.length,
            mustReachWaypoint: movement.mustReachWaypoint,
            isWaypoint: movement.waypoints.length > 0,
            waypoints: movement.waypoints
          });
        }
        return movement;
      } else {
        if (DEBUG.MOVEMENTS) {
          console.log('No path found to current destination, removing movement');
        }
        processedMovements.add(index);
        return null;
      }
    }
  });
  
  // Second pass: update the movement queue with remaining movements
  gameState.movementQueue = movementResults.filter((result): result is Movement => result !== null);
  
  if (DEBUG.MOVEMENTS) {
    console.log('Updated movement queue:', gameState.movementQueue);
    console.log('=== End Movement Processing ===');
  }
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

export const isValidMove = (from: Tile, to: Tile, gameState: GameState, playerId: string, minGarrison: number = MIN_GARRISON): boolean => {
  if (DEBUG.GAME_STATE) {
    console.log('Validating move:', {
      from: { x: from.x, y: from.y, owner: from.owner, army: from.army },
      to: { x: to.x, y: to.y, owner: to.owner, army: to.army },
      playerId,
      gameStatePlayer1Id: gameState.player1Id,
      gameStatePlayer2Id: gameState.player2Id
    });
  }

  // Can't move to mountains
  if (to.isMountain) {
    if (DEBUG.GAME_STATE) {
      console.log('Invalid move: Target is mountain');
    }
    return false;
  }
  
  // Check if source has enough army to move (respecting min garrison)
  const availableArmy = from.owner ? from.army - minGarrison : from.army;
  if (availableArmy <= 0) {
    if (DEBUG.GAME_STATE) {
      console.log('Invalid move: Insufficient army');
    }
    return false;
  }

  // Check if the player owns the tile
  const isPlayer1 = playerId === gameState.player1Id;
  const isPlayer2 = playerId === gameState.player2Id;
  const expectedOwner = isPlayer1 ? 'player1' : isPlayer2 ? 'player2' : null;
  
  if (from.owner !== expectedOwner) {
    if (DEBUG.GAME_STATE) {
      console.log('Invalid move: Wrong owner', {
        fromOwner: from.owner,
        expectedOwner,
        isPlayer1,
        isPlayer2
      });
    }
    return false;
  }
  
  // For adjacent moves, return true
  if (isAdjacent(from, to)) {
    if (DEBUG.GAME_STATE) {
      console.log('Valid adjacent move');
    }
    return true;
  }
  
  // For non-adjacent moves, pathfinding will be used
  if (DEBUG.GAME_STATE) {
    console.log('Valid non-adjacent move (pathfinding will be used)');
  }
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
  queue.push({ tile: from, path: [] });
  visited[from.y][from.x] = true;
  
  while (queue.length > 0) {
    const { tile, path } = queue.shift()!;
    
    // If we've reached the destination, return the path
    if (tile.x === to.x && tile.y === to.y) {
      if (DEBUG.PATHFINDING) {
        console.log('Path found:', {
          from: { x: from.x, y: from.y },
          to: { x: to.x, y: to.y }
        });
      }
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
      const newSteps = [...path, { x: adjacentTile.x, y: adjacentTile.y }];
      queue.push({ tile: adjacentTile, path: newSteps });
    }
  }
  
  if (DEBUG.PATHFINDING) {
    console.log('No path found:', {
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y }
    });
  }
  return [];
};

export const createPathMovements = (
  gameState: GameState,
  fromTile: Tile, 
  toTile: Tile, 
  armyPercentage: number = 1,
  waypoints: { x: number, y: number }[] = [],
  playerId: string
): Movement[] => {
  if (DEBUG.GAME_STATE) {
    console.log('=== Creating Path Movements ===');
    console.log('Start Point:', { x: fromTile.x, y: fromTile.y });
    console.log('End Point:', { x: toTile.x, y: toTile.y });
    console.log('Waypoints:', waypoints);
    console.log('Army Percentage:', armyPercentage);
    console.log('Player ID:', playerId);
  }
  
  // Validate waypoints
  if (!Array.isArray(waypoints)) {
    if (DEBUG.GAME_STATE) {
      console.error('Waypoints must be an array');
    }
    waypoints = [];
  }
  
  // Get the current tile state from gameState
  const currentFromTile = gameState.tiles.find(t => t.x === fromTile.x && t.y === fromTile.y);
  if (!currentFromTile) {
    if (DEBUG.GAME_STATE) {
      console.log('Source tile not found in game state');
    }
    return [];
  }
  
  // Calculate army that can move based on current state
  let armyToMove = Math.floor(currentFromTile.army * armyPercentage);
  if (currentFromTile.owner) {
    armyToMove = Math.max(0, Math.min(armyToMove, currentFromTile.army - gameState.minGarrison));
  }
  
  if (armyToMove <= 0) {
    if (DEBUG.GAME_STATE) {
      console.log('No army to move, returning empty movements');
    }
    return [];
  }

  // If there are waypoints, we MUST go to the first waypoint first
  // Only after reaching all waypoints do we proceed to the final destination
  const initialDestination = waypoints.length > 0 ? waypoints[0] : { x: toTile.x, y: toTile.y };
  if (DEBUG.GAME_STATE) {
    console.log('Initial Destination:', initialDestination);
  }
  
  // The remaining waypoints (if any) plus the final destination
  const remainingWaypoints = waypoints.length > 0 
    ? [...waypoints.slice(1), { x: toTile.x, y: toTile.y }]
    : [];
  if (DEBUG.GAME_STATE) {
    console.log('Remaining Waypoints:', remainingWaypoints);
  }

  // Find initial path to first destination
  const initialPath = findPath(gameState, currentFromTile, gameState.tiles[getTileIndex(initialDestination.x, initialDestination.y, gameState.width)]);
  if (DEBUG.PATHFINDING) {
    console.log('Initial Path:', initialPath);
  }
  
  if (initialPath.length === 0) {
    if (DEBUG.GAME_STATE) {
      console.log('No path found to initial destination, returning empty movements');
    }
    return [];
  }

  // Create a single movement for the next tile only
  const movement: Movement = {
    from: currentFromTile,
    to: gameState.tiles[getTileIndex(initialPath[0].x, initialPath[0].y, gameState.width)],
    owner: currentFromTile.owner,
    army: armyToMove,
    finalDestination: gameState.tiles[getTileIndex(initialDestination.x, initialDestination.y, gameState.width)],
    waypoints: remainingWaypoints,
    mustReachWaypoint: waypoints.length > 0,
    playerId
  };

  if (DEBUG.GAME_STATE) {
    console.log('Created Movement:', {
      movement,
      totalArmy: movement.army,
      remainingWaypoints,
      initialPathLength: initialPath.length,
      mustReachWaypoint: waypoints.length > 0,
      waypoints: waypoints,
      sourceTileArmy: currentFromTile.army
    });
  }
  if (DEBUG.GAME_STATE) {
    console.log('=== End Path Creation ===');
  }

  return [movement];
};

export const createMovement = (
  fromTile: Tile, 
  toTile: Tile, 
  gameState: GameState,
  playerId: string,
  armiesToMove: number,
  minGarrison: number = MIN_GARRISON
): Movement | null => {
  if (!isValidMove(fromTile, toTile, gameState, playerId, minGarrison)) {
    return null;
  }
  
  // Validate that the requested number of armies is valid
  const maxArmiesToMove = fromTile.army - minGarrison;
  const actualArmiesToMove = Math.min(armiesToMove, maxArmiesToMove);
  
  return {
    from: fromTile,
    to: toTile,
    owner: fromTile.owner as Owner,
    army: actualArmiesToMove,
    finalDestination: toTile,
    waypoints: [],
    mustReachWaypoint: false,
    playerId
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
    if (tile.owner === 'player1') {
      tile.isVisible = true;
      const adjacentTiles = getAdjacentTiles(gameState, tile);
      adjacentTiles.forEach(adjacentTile => adjacentTile.isVisible = true);
    }
  });
};

// Game loop management
export class GameManager {
  private tickInterval: NodeJS.Timeout | null = null;
  private gameState: GameState;
  private tickSpeed: TickSpeed = 1000;

  constructor(
    private matchId: string,
    private player1Id: string,
    private player2Id: string,
    private player1Name: string,
    private player2Name: string,
    private io: Server
  ) {
    this.gameState = createNewGame(30, 30, player1Id, player2Id);
    this.startGameLoop();
  }

  private processMovements() {
    if (this.gameState.movementQueue.length > 0) {
      if (DEBUG.MOVEMENTS) {
        console.log('=== Processing Movements ===');
        console.log('Movement queue length:', this.gameState.movementQueue.length);
      }
      processMovements(this.gameState);
    }
  }

  private startGameLoop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    
    this.tickInterval = setInterval(() => {
      this.gameState = processTick(this.gameState);
      this.processMovements();
    }, this.tickSpeed);
  }

  public setSpeed(speed: TickSpeed) {
    this.tickSpeed = speed;
    this.gameState = setTickSpeed(this.gameState, speed);
    this.startGameLoop(); // Restart loop with new speed
  }

  public togglePause() {
    this.gameState = togglePause(this.gameState);
  }

  public enqueueMovement(movement: Movement) {
    this.gameState = enqueueMoves(this.gameState, [movement]);
  }

  public getGameState(): GameState {
    return this.gameState;
  }
}
