import { Tile, Territory, Owner, Player, Unit, GameState } from '../../../shared/types/game';
import { getRandomInt, getAdjacentTiles, getTile } from './gameLogic'; // Assuming these are available and exported
import { v4 as uuidv4 } from 'uuid';

// Define standard player colors, ensure enough for a reasonable max number of players
export const PLAYER_COLORS = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080']; // Red, Blue, Green, Yellow, Magenta, Cyan, Orange, Purple

// Territory colors (light pastel colors) - Moved from mapGenerator
export const TERRITORY_COLORS = [
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

// --- Functions moved from mapGenerator.ts ---
export const generateInitialTiles = (width: number, height: number): Tile[] => {
  const tiles: Tile[] = [];
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
        isVisible: false, // All tiles initially hidden
      });
    }
  }
  return tiles;
};

export const createTerritories = (
  tiles: Tile[],
  width: number,
  height: number,
  territoryCount: number,
  territoryColors: string[], // Passed as arg
  getRandomIntFunc: (min: number, max: number) => number
): { updatedTiles: Tile[]; territories: Territory[] } => {
  const territories: Territory[] = [];
  const seeds: { x: number; y: number; id: number }[] = [];

  for (let i = 0; i < territoryCount; i++) {
    let x: number, y: number, tooClose: boolean;
    do {
      x = getRandomIntFunc(Math.floor(width * 0.1), Math.floor(width * 0.9));
      y = getRandomIntFunc(Math.floor(height * 0.1), Math.floor(height * 0.9));
      tooClose = seeds.some(
        (seed) =>
          Math.sqrt(Math.pow(seed.x - x, 2) + Math.pow(seed.y - y, 2)) <
          (Math.min(width, height) / Math.sqrt(territoryCount)) * 0.6
      );
    } while (tooClose);
    seeds.push({ x, y, id: i });
  }

  for (let i = 0; i < territoryCount; i++) {
    territories.push({
      id: i,
      color: territoryColors[i % territoryColors.length],
      lordTile: null,
    });
  }

  for (const tile of tiles) {
    if (tile.isMountain) continue;
    let minDistance = Infinity;
    let closestTerritory: number | null = null; // Ensure type matches tile.territory
    for (const seed of seeds) {
      const noise = (Math.sin(tile.x * 0.3) + Math.cos(tile.y * 0.3)) * 2;
      const distance = Math.sqrt(Math.pow(seed.x - tile.x, 2) + Math.pow(seed.y - tile.y, 2)) + noise;
      if (distance < minDistance) {
        minDistance = distance;
        closestTerritory = seed.id;
      }
    }
    tile.territory = closestTerritory;
  }

  for (let i = 0; i < territoryCount; i++) {
    const territoryTiles = tiles.filter(
      (t) => t.territory === i && !t.isMountain && !t.isCity && !t.isLord && t.owner === null
    );
    if (territoryTiles.length === 0) {
      const fallbackTiles = tiles.filter((t) => t.territory === i && !t.isMountain && !t.isLord && t.owner === null);
      if (fallbackTiles.length === 0) continue;
      const fallbackTile = fallbackTiles[0];
      fallbackTile.isLord = true;
      fallbackTile.army = 50; // Default army for neutral lords
      territories[i].lordTile = { x: fallbackTile.x, y: fallbackTile.y };
      continue;
    }
    const centerX = territoryTiles.reduce((sum, t) => sum + t.x, 0) / territoryTiles.length;
    const centerY = territoryTiles.reduce((sum, t) => sum + t.y, 0) / territoryTiles.length;
    let closestTile = territoryTiles[0];
    let minDistance = Infinity;
    for (const tile of territoryTiles) {
      const distance = Math.sqrt(Math.pow(tile.x - centerX, 2) + Math.pow(tile.y - centerY, 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestTile = tile;
      }
    }
    closestTile.isLord = true;
    closestTile.army = 50; // Default army for neutral lords
    territories[i].lordTile = { x: closestTile.x, y: closestTile.y };
  }
  return { updatedTiles: tiles, territories };
};

export const placeMountains = (
  tiles: Tile[],
  width: number,
  height: number,
  borderTilesIndexes: number[],
  getRandomIntFunc: (min: number, max: number) => number
): Tile[] => {
  const mountainCount = Math.floor(width * height * 0.15);
  for (let i = 0; i < mountainCount; i++) {
    let randomIndex: number;
    if (borderTilesIndexes.length > 0 && Math.random() < 0.55) {
      randomIndex = borderTilesIndexes[getRandomIntFunc(0, borderTilesIndexes.length - 1)];
    } else {
      randomIndex = getRandomIntFunc(0, tiles.length - 1);
    }
    if (tiles[randomIndex] && !tiles[randomIndex].isMountain) {
      tiles[randomIndex].isMountain = true;
      const borderIndex = borderTilesIndexes.indexOf(randomIndex);
      if (borderIndex !== -1) {
        borderTilesIndexes.splice(borderIndex, 1);
      }
    } else {
      i--; // Try again
    }
  }
  return tiles;
};

export const placeCities = (
  tiles: Tile[],
  width: number,
  height: number,
  cityStartingArmies: number,
  getRandomIntFunc: (min: number, max: number) => number
): Tile[] => {
  const cityCount = Math.floor(width * height * 0.05);
  for (let i = 0; i < cityCount; i++) {
    const randomIndex = getRandomIntFunc(0, tiles.length - 1);
    if (tiles[randomIndex] && !tiles[randomIndex].isMountain && !tiles[randomIndex].isCity) {
      tiles[randomIndex].isCity = true;
      tiles[randomIndex].army = cityStartingArmies;
    } else {
      i--; // Try again
    }
  }
  return tiles;
};

// --- New functions for N-player setup ---
export function initializePlayers(
  tiles: Tile[],
  width: number,
  height: number,
  playersInfo: { id: string; name: string }[],
  startingArmySize: number
): { players: Player[]; lordTiles: Tile[] } {
  const gamePlayers: Player[] = [];
  const lordTilesPlaced: Tile[] = [];
  const numPlayers = playersInfo.length;

  const potentialStartingPositions = [
    { x: Math.floor(width * 0.1), y: Math.floor(height * 0.1) },
    { x: Math.floor(width * 0.9) - 1, y: Math.floor(height * 0.9) - 1 },
    { x: Math.floor(width * 0.1), y: Math.floor(height * 0.9) - 1 },
    { x: Math.floor(width * 0.9) - 1, y: Math.floor(height * 0.1) },
    { x: Math.floor(width * 0.5), y: Math.floor(height * 0.1) },
    { x: Math.floor(width * 0.5), y: Math.floor(height * 0.9) - 1 },
    { x: Math.floor(width * 0.1), y: Math.floor(height * 0.5) },
    { x: Math.floor(width * 0.9) - 1, y: Math.floor(height * 0.5) },
  ];

  let attempts = 0;
  const maxAttempts = tiles.length; 

  for (let i = 0; i < numPlayers; i++) {
    const playerInfo = playersInfo[i];
    let lordTile: Tile | null = null;
    let posIndex = i; 
    let currentAttemptInLoop = 0; // Renamed to avoid conflict with outer scope 'attempts'

    // Ensure we don't exceed potentialStartingPositions length if numPlayers is larger
    if (i >= potentialStartingPositions.length && numPlayers > potentialStartingPositions.length) {
        console.warn(`Player ${playerInfo.name} (index ${i}) does not have a predefined starting spot. Trying random placement or skipping.`);
        // Fallback: try to find *any* valid spot if preferred spots are exhausted or too many players
        // This simple loop just takes the next available preferred spot, which will wrap around.
        // A more robust solution would be needed for many players / sparse maps.
    }


    while (!lordTile && currentAttemptInLoop < potentialStartingPositions.length && attempts < maxAttempts) {
      const candidatePos = potentialStartingPositions[posIndex % potentialStartingPositions.length];
      const tileIndex = candidatePos.y * width + candidatePos.x;
      
      if (tileIndex >= 0 && tileIndex < tiles.length && tiles[tileIndex] && !tiles[tileIndex].isMountain && !tiles[tileIndex].isCity && !tiles[tileIndex].isLord) {
        lordTile = tiles[tileIndex];
        lordTile.owner = playerInfo.id;
        lordTile.isLord = true;
        lordTile.army = startingArmySize;
        lordTile.territory = null; 
      }
      posIndex++;
      currentAttemptInLoop++;
      attempts++;
    }

    if (lordTile) {
      gamePlayers.push({
        id: playerInfo.id,
        name: playerInfo.name,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      });
      lordTilesPlaced.push(lordTile);
    } else {
      console.warn(`Could not place lord for player ${playerInfo.name}. Trying random available tile.`);
      // Fallback: try to find ANY available non-mountain, non-city, non-lord tile
      let randomAttempts = 0;
      while(!lordTile && randomAttempts < maxAttempts) {
        const randomIdx = getRandomInt(0, tiles.length -1); // Needs getRandomInt
        if (tiles[randomIdx] && !tiles[randomIdx].isMountain && !tiles[randomIdx].isCity && !tiles[randomIdx].isLord) {
          lordTile = tiles[randomIdx];
          lordTile.owner = playerInfo.id;
          lordTile.isLord = true;
          lordTile.army = startingArmySize;
          lordTile.territory = null;

          gamePlayers.push({
            id: playerInfo.id,
            name: playerInfo.name,
            color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          });
          lordTilesPlaced.push(lordTile);
          break; 
        }
        randomAttempts++;
      }
      if (!lordTile) {
         console.error(`CRITICAL: Failed to place lord for player ${playerInfo.name} even with random fallback.`);
      }
    }
  }
  return { players: gamePlayers, lordTiles: lordTilesPlaced };
}

export function setupInitialVisibility(
  // gameState: { tiles: Tile[], width: number, height: number }, // Original
  tiles: Tile[], // Changed to pass tiles directly
  width: number,   // Changed to pass width directly
  height: number,  // Changed to pass height directly
  lordTiles: Tile[],
  getAdjacentTilesFunc: (gs: { tiles: Tile[], width: number, height: number }, tile: Tile) => Tile[],
  getTileFunc: (gs: { tiles: Tile[], width: number, height: number }, x: number, y: number) => Tile | null
): void {
  // The minimal GameState-like object for the helper functions.
  const miniGameState = { tiles, width, height };

  for (const lordTile of lordTiles) {
    if (lordTile) {
      const tileToMakeVisible = getTileFunc(miniGameState, lordTile.x, lordTile.y); // Use getTileFunc
      if (tileToMakeVisible) tileToMakeVisible.isVisible = true;

      const adjacent = getAdjacentTilesFunc(miniGameState, lordTile);
      adjacent.forEach((adjTile) => {
        if (adjTile) { // Ensure adjTile is not null
             const tile = getTileFunc(miniGameState, adjTile.x, adjTile.y); // Use getTileFunc
             if (tile) tile.isVisible = true;
        }
      });
    }
  }
}


export function setupNewGame(
  width: number,
  height: number,
  playersInfo: { id: string; name: string }[],
  gameConstants: {
    defaultTerritoryCount: number;
    cityStartingArmies: number;
    playerLordStartingArmy: number;
    territoryColors: string[]; // Expecting TERRITORY_COLORS from this file to be passed here
    getRandomIntFunc: (min: number, max: number) => number;
    getAdjacentTilesFunc: (gs: { tiles: Tile[], width: number, height: number }, tile: Tile) => Tile[];
    getTileFunc: (gs: { tiles: Tile[], width: number, height: number }, x: number, y: number) => Tile | null;
  }
): Partial<GameState> { // Return Partial<GameState> as it doesn't build the full GameState
  let tiles = generateInitialTiles(width, height);

  const { updatedTiles: tilesAfterTerritories, territories } = createTerritories(
    tiles, width, height,
    gameConstants.defaultTerritoryCount,
    gameConstants.territoryColors, // Using the passed territoryColors
    gameConstants.getRandomIntFunc
  );
  tiles = tilesAfterTerritories;

  const borderTilesIndexes: number[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (tile.isMountain) continue;
    // Need a minimal GameState-like object or pass tiles, width, height to getTileFunc for neighbors
    const miniGameStateForBorder = { tiles, width, height };
    const neighbors = [
      gameConstants.getTileFunc(miniGameStateForBorder, tile.x - 1, tile.y),
      gameConstants.getTileFunc(miniGameStateForBorder, tile.x + 1, tile.y),
      gameConstants.getTileFunc(miniGameStateForBorder, tile.x, tile.y - 1),
      gameConstants.getTileFunc(miniGameStateForBorder, tile.x, tile.y + 1)
    ].filter((t): t is Tile => t !== null); // Type guard
    if (neighbors.some(neighbor => neighbor.territory !== tile.territory)) {
      borderTilesIndexes.push(i);
    }
  }

  tiles = placeMountains(tiles, width, height, borderTilesIndexes, gameConstants.getRandomIntFunc);
  tiles = placeCities(tiles, width, height, gameConstants.cityStartingArmies, gameConstants.getRandomIntFunc);

  const { players, lordTiles } = initializePlayers(
    tiles, width, height, playersInfo, gameConstants.playerLordStartingArmy
  );
  
  const units: Unit[] = [];
  for (const player of players) {
    const pLordTile = lordTiles.find(lt => lt.owner === player.id);
    if (pLordTile) {
      units.push({
        id: uuidv4(),
        controlledBy: player.id,
        position: { x: pLordTile.x, y: pLordTile.y },
        armySize: pLordTile.army,
        owner: player.id,
      });
    }
  }
  
  // Pass tiles, width, height directly to setupInitialVisibility
  setupInitialVisibility(tiles, width, height, lordTiles, gameConstants.getAdjacentTilesFunc, gameConstants.getTileFunc);

  return {
    tiles,
    territories,
    players,
    units,
    // Other GameState fields like width, height, tick, etc., will be set by createNewGame in gameLogic.ts
  };
}
