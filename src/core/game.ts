import { GameState, Command, Tile, Territory, Movement, TickSpeed, Owner } from '../types/game';
import { processTick as processGameTick } from './gameLogic';
import {
  processTick,
  resolveCombat,
  captureTerritoryTiles,
  updateVisibility
} from '../lib/gameLogic';

// Process a single command and return a new game state
export function advance(state: GameState, commands: Command[]): GameState {
  let newState = { ...state };

  // Process all commands
  for (const command of commands) {
    switch (command.type) {
      case 'START_GAME':
        newState = createNewGame(command.payload.width || 20, command.payload.height || 20);
        break;

      case 'SELECT_TILE':
        newState = {
          ...newState,
          selectedTile: command.payload.tile
        };
        break;

      case 'MOVE_ARMY':
        newState = processMovements(newState, command.payload.movements || []);
        break;

      case 'SET_TICK_SPEED':
        newState = {
          ...newState,
          tickSpeed: command.payload.speed || 500
        };
        break;

      case 'TOGGLE_PAUSE':
        newState = {
          ...newState,
          isPaused: !newState.isPaused
        };
        break;

      case 'END_GAME':
        newState = {
          ...newState,
          isGameOver: true,
          winner: command.payload.winner || null
        };
        break;
    }
  }

  // Increment tick counter
  newState = {
    ...newState,
    tick: newState.tick + 1
  };

  return newState;
}

// Create a new game state
function createNewGame(width: number, height: number): GameState {
  const tiles: Tile[] = [];
  const territories: Territory[] = [];

  // Initialize empty grid
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({
        x,
        y,
        armyCount: 0,
        owner: null,
        isLord: false,
        isVisible: false,
        isSelected: false,
        isHighlighted: false,
        isPath: false,
        isSupplyLine: false,
        isMountain: false,
        isCity: false,
        territory: null
      });
    }
  }

  // Place player lord
  const playerLordTile = tiles[Math.floor(height / 2) * width + Math.floor(width / 4)];
  playerLordTile.owner = 'player';
  playerLordTile.armyCount = 10;
  playerLordTile.isLord = true;
  playerLordTile.isVisible = true;

  // Place AI lord
  const aiLordTile = tiles[Math.floor(height / 2) * width + Math.floor(3 * width / 4)];
  aiLordTile.owner = 'ai';
  aiLordTile.armyCount = 10;
  aiLordTile.isLord = true;
  aiLordTile.isVisible = true;

  // Create initial territories
  territories.push({
    id: 'player',
    owner: 'player',
    tiles: [playerLordTile],
    armyCount: 10,
    color: '#3B82F6',
    lordTile: { x: playerLordTile.x, y: playerLordTile.y }
  });

  territories.push({
    id: 'ai',
    owner: 'ai',
    tiles: [aiLordTile],
    armyCount: 10,
    color: '#EF4444',
    lordTile: { x: aiLordTile.x, y: aiLordTile.y }
  });

  return {
    width,
    height,
    tick: 0,
    tickSpeed: 500,
    tiles,
    territories,
    isPaused: false,
    isGameOver: false,
    winner: null,
    selectedTile: null,
    movementQueue: [],
    minGarrison: 1,
    players: {
      player: {
        id: 'player',
        name: 'Player',
        color: '#3B82F6',
        isAI: false
      },
      ai: {
        id: 'ai',
        name: 'AI',
        color: '#EF4444',
        isAI: true
      }
    }
  };
}

// Process army movements
function processMovements(state: GameState, movements: Movement[]): GameState {
  const newState = { ...state };
  const newTiles = [...state.tiles];

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
  return newState;
} 