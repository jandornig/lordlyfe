import { GameState, Command, Tile, Territory, Movement, TickSpeed } from '../types/game';
import { advance } from './game';

// Create a new game state
export function createGameState(width: number, height: number): GameState {
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
        isSupplyLine: false
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

// Apply a single command to the game state
export function applyCommand(state: GameState, command: Command): GameState {
  return advance(state, [command]);
}

// Apply multiple commands to the game state
export function applyCommands(state: GameState, commands: Command[]): GameState {
  return advance(state, commands);
}

// Create a command to move armies
export function createMoveCommand(playerId: string, movements: Movement[]): Command {
  return {
    playerId,
    type: 'MOVE_ARMY',
    payload: { movements }
  };
}

// Create a command to select a tile
export function createSelectTileCommand(playerId: string, tile: Tile): Command {
  return {
    playerId,
    type: 'SELECT_TILE',
    payload: { tile }
  };
}

// Create a command to set tick speed
export function createSetTickSpeedCommand(playerId: string, speed: TickSpeed): Command {
  return {
    playerId,
    type: 'SET_TICK_SPEED',
    payload: { speed }
  };
}

// Create a command to toggle pause
export function createTogglePauseCommand(playerId: string): Command {
  return {
    playerId,
    type: 'TOGGLE_PAUSE',
    payload: {}
  };
}

// Create a command to start a new game
export function createStartGameCommand(playerId: string, width: number, height: number): Command {
  return {
    playerId,
    type: 'START_GAME',
    payload: { width, height }
  };
}

// Create a command to end the game
export function createEndGameCommand(playerId: string, winner: string): Command {
  return {
    playerId,
    type: 'END_GAME',
    payload: { winner }
  };
} 