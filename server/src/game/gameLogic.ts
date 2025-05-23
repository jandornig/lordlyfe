import { GameState, Tile, Owner, Movement, TickSpeed, Territory, Player, Unit } from "../../../shared/types/game"; // Path, PathStep removed
import { v4 as uuidv4 } from 'uuid';
// import { Server } from 'socket.io'; // Removed as GameManager is deleted
// import {
//   generateInitialTiles, // This and others below are now part of gameSetup.ts
//   createTerritories,
//   placeMountains,
//   placeCities,
//   placePlayerLords, // This specific function is effectively replaced by initializePlayers in gameSetup.ts
//   setupInitialVisibility // This specific function is also in gameSetup.ts
// } from './mapGenerator'; // This file is deleted
import { setupNewGame } from './gameSetup';
import { processMovements } from './movementLogic'; // Import processMovements

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

// Debug flags
const DEBUG = {
  MOVEMENTS: false,
  PATHFINDING: false,
  GAME_STATE: false
};

export const createNewGame = (
  width: number = DEFAULT_MAP_SIZE, 
  height: number = DEFAULT_MAP_SIZE,
  playersInfo: { id: string; name: string }[], // New parameter
  matchIdToSet: string = "" // Optional: to set matchId directly
): GameState => {
  const gameSetupConstants = {
    defaultTerritoryCount: DEFAULT_TERRITORY_COUNT,
    cityStartingArmies: CITY_STARTING_ARMIES,
    playerLordStartingArmy: 10, // Default starting army for player lords
    territoryColors: TERRITORY_COLORS, // TERRITORY_COLORS is defined in this file
    getRandomIntFunc: getRandomInt,
    getAdjacentTilesFunc: getAdjacentTiles,
    getTileFunc: getTile
  };

  const initialGameParts = setupNewGame(width, height, playersInfo, gameSetupConstants); // Corrected typo
  
  return {
    matchId: matchIdToSet,
    width,
    height,
    players: initialGameParts.players!, 
    units: initialGameParts.units!,     
    tiles: initialGameParts.tiles!,     
    territories: initialGameParts.territories!, 
    tick: 0,
    tickSpeed: DEFAULT_TICK_SPEED,
    isPaused: true,
    isGameOver: false,
    winner: null,
    selectedTile: null,
    movementQueue: [],
    minGarrison: MIN_GARRISON,
    // Old player1Id, player1Name, etc. are removed as players array handles this.
  };
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

    // Player territory grows 1 army every PLAYER_TERRITORY_GROWTH_INTERVAL ticks
    // This check needs to ensure it doesn't double-count for lords or cities if they have their own growth.
    if (tile.owner && newGameState.players.some(p => p.id === tile.owner) && 
        newGameState.tick % PLAYER_TERRITORY_GROWTH_INTERVAL === 0) {
      // Ensure it's not a lord or city tile if they have separate growth rates defined above
      if (!tile.isLord && !tile.isCity) {
           newArmy += 1; // Standard territory growth
      }
    }
    
    return {
      ...tile,
      army: newArmy
    };
  });
  
  // Process movements
  processMovements(newGameState); // Call imported processMovements
  
  // Check win condition
  checkWinCondition(newGameState);
  
  return newGameState;
};

export const checkWinCondition = (gameState: GameState): void => {
  // Generalized win condition: if only one player has lord tiles left.
  const activePlayersWithLords = new Set<string>();
  gameState.tiles.forEach(tile => {
    if (tile.isLord && tile.owner) {
      activePlayersWithLords.add(tile.owner);
    }
  });

  if (activePlayersWithLords.size === 1) {
    gameState.isGameOver = true;
    gameState.winner = Array.from(activePlayersWithLords)[0];
  } else if (activePlayersWithLords.size === 0 && gameState.players.length > 0) {
    // All lords destroyed, but could be a draw or based on other conditions if desired.
    // For now, if no lords left and there were players, it's a draw (winner remains null).
    gameState.isGameOver = true; 
    // Winner remains null for a draw or if specific rules for all lords lost are not defined.
  }
};

// processMovements was moved to movementLogic.ts
// isValidMove, isAdjacent, findPath, createPathMovements, createMovement were also moved.

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

// isValidMove was moved to movementLogic.ts

// isAdjacent was moved to movementLogic.ts

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

// findPath was moved to movementLogic.ts
// Path and PathStep types are also implicitly removed by not being used here.

// createPathMovements was moved to movementLogic.ts

// createMovement was moved to movementLogic.ts

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
  // This needs to be generalized for N players.
  // For now, let's assume visibility is handled for the player making a request,
  // or a specific player's view. If this is a general server-side update,
  // it might not change or might reveal all player-owned tiles.
  // The current logic only reveals for 'player1'.
  // For N-player, this should iterate through all players if we want server to track all visibility,
  // or be handled client-side based on what a specific player should see.
  // Let's simplify: reveal all tiles owned by ANY player for now for server state.
  // A more sophisticated approach would be needed for per-player visibility updates.
  tiles.forEach(tile => {
    if (tile.owner && gameState.players.some(p => p.id === tile.owner)) { // If any player owns it
      tile.isVisible = true; // Make the tile itself visible
      const adjacentTiles = getAdjacentTiles(gameState, tile);
      adjacentTiles.forEach(adjacentTile => {
        if (adjacentTile) adjacentTile.isVisible = true; // Make adjacent tiles visible
      });
    }
  });
};

// Game loop management
// export class GameManager {
//   private tickInterval: NodeJS.Timeout | null = null;
//   private gameState: GameState;
//   private tickSpeed: TickSpeed = 1000;
//
//   constructor(
//     private matchId: string,
//     private player1Id: string,
//     private player2Id: string,
//     private player1Name: string,
//     private player2Name: string,
//     private io: Server // Server from socket.io was used here
//   ) {
//     this.gameState = createNewGame(30, 30, player1Id, player2Id);
//     this.startGameLoop();
//   }
//
//   private processMovements() {
//     if (this.gameState.movementQueue.length > 0) {
//       if (DEBUG.MOVEMENTS) {
//         console.log('=== Processing Movements ===');
//         console.log('Movement queue length:', this.gameState.movementQueue.length);
//       }
//       processMovements(this.gameState);
//     }
//   }
//
//   private startGameLoop() {
//     if (this.tickInterval) {
//       clearInterval(this.tickInterval);
//     }
//    
//     this.tickInterval = setInterval(() => {
//       this.gameState = processTick(this.gameState);
//       this.processMovements();
//     }, this.tickSpeed);
//   }
//
//   public setSpeed(speed: TickSpeed) {
//     this.tickSpeed = speed;
//     this.gameState = setTickSpeed(this.gameState, speed);
//     this.startGameLoop(); // Restart loop with new speed
//   }
//
//   public togglePause() {
//     this.gameState = togglePause(this.gameState);
//   }
//
//   public enqueueMovement(movement: Movement) {
//     this.gameState = enqueueMoves(this.gameState, [movement]);
//   }
//
//   public getGameState(): GameState {
//     return this.gameState;
//   }
// }
