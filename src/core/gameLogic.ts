import { GameState, Tile, Territory, Movement } from '../types/game';

// Game constants
export const ARMY_GROWTH_RATE = 1;
export const MIN_GARRISON = 1;
export const VISIBILITY_RANGE = 2;

// Process a single game tick
export function processTick(state: GameState): GameState {
  if (state.isPaused || state.isGameOver) {
    return state;
  }

  let newState = { ...state };

  // Process army growth
  newState = processArmyGrowth(newState);

  // Process movements
  newState = processMovements(newState);

  // Update visibility
  newState = updateVisibility(newState);

  // Check win condition
  newState = checkWinCondition(newState);

  // Increment tick
  newState.tick += 1;

  return newState;
}

// Process army growth for each territory
function processArmyGrowth(state: GameState): GameState {
  const newState = { ...state };
  const newTerritories = [...state.territories];

  for (const territory of newTerritories) {
    // Only grow armies for territories with a lord
    if (territory.lordTile) {
      territory.armyCount += ARMY_GROWTH_RATE;
    }
  }

  newState.territories = newTerritories;
  return newState;
}

// Process army movements
function processMovements(state: GameState): GameState {
  const newState = { ...state };
  const newTiles = [...state.tiles];
  const movements = [...state.movementQueue];

  for (const movement of movements) {
    const fromTile = newTiles.find(t => t.x === movement.from.x && t.y === movement.from.y);
    const toTile = newTiles.find(t => t.x === movement.to.x && t.y === movement.to.y);

    if (!fromTile || !toTile) continue;

    // Update army counts
    fromTile.armyCount -= movement.count;
    toTile.armyCount += movement.count;

    // Update ownership if necessary
    if (toTile.armyCount > 0 && toTile.owner !== fromTile.owner) {
      toTile.owner = fromTile.owner;
    }
  }

  newState.tiles = newTiles;
  newState.movementQueue = [];
  return newState;
}

// Resolve combat between armies
function resolveCombat(state: GameState, tile: Tile): GameState {
  const newState = { ...state };
  const newTiles = [...state.tiles];
  const newTile = newTiles.find(t => t.x === tile.x && t.y === tile.y);

  if (!newTile) return newState;

  // If there are armies from different owners, resolve combat
  const armies = new Map<string, number>();
  for (const movement of state.movementQueue) {
    if (movement.to.x === tile.x && movement.to.y === tile.y) {
      const fromTile = state.tiles.find(t => t.x === movement.from.x && t.y === movement.from.y);
      if (!fromTile) continue;

      const owner = fromTile.owner;
      if (!owner) continue;

      armies.set(owner, (armies.get(owner) || 0) + movement.count);
    }
  }

  // If there are multiple armies, they fight
  if (armies.size > 1) {
    let maxArmy = 0;
    let winner = null;

    for (const [owner, count] of armies.entries()) {
      if (count > maxArmy) {
        maxArmy = count;
        winner = owner;
      }
    }

    if (winner) {
      newTile.owner = winner;
      newTile.armyCount = maxArmy;
    }
  }

  newState.tiles = newTiles;
  return newState;
}

// Capture territory tiles
function captureTerritoryTiles(state: GameState): GameState {
  const newState = { ...state };
  const newTerritories = [...state.territories];

  for (const territory of newTerritories) {
    territory.tiles = state.tiles.filter(tile => tile.owner === territory.owner);
    territory.armyCount = territory.tiles.reduce((sum, tile) => sum + tile.armyCount, 0);
  }

  newState.territories = newTerritories;
  return newState;
}

// Update visibility around player's lord
function updateVisibility(state: GameState): GameState {
  const newState = { ...state };
  const newTiles = [...state.tiles];

  // Reset visibility
  for (const tile of newTiles) {
    tile.isVisible = false;
  }

  // Find player's lord tile
  const playerLordTile = newTiles.find(tile => tile.owner === 'player' && tile.isLord);
  if (!playerLordTile) return newState;

  // Set visibility around lord
  for (const tile of newTiles) {
    const distance = Math.abs(tile.x - playerLordTile.x) + Math.abs(tile.y - playerLordTile.y);
    if (distance <= VISIBILITY_RANGE) {
      tile.isVisible = true;
    }
  }

  newState.tiles = newTiles;
  return newState;
}

// Check win condition
function checkWinCondition(state: GameState): GameState {
  const newState = { ...state };

  // Check if any player has lost their lord
  const playerLordExists = state.tiles.some(tile => tile.owner === 'player' && tile.isLord);
  const aiLordExists = state.tiles.some(tile => tile.owner === 'ai' && tile.isLord);

  if (!playerLordExists) {
    newState.isGameOver = true;
    newState.winner = 'ai';
  } else if (!aiLordExists) {
    newState.isGameOver = true;
    newState.winner = 'player';
  }

  return newState;
} 