import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { GameState, Tile, TickSpeed, Movement, Territory } from '../types/game';
import {
  createNewGame,
  processTick,
  isValidMove,
  createMovement,
  enqueueMoves,
  setTickSpeed as setSpeed,
  togglePause as toggleGamePause,
  createPathMovements
} from '../lib/gameLogic';

// Define the shape of the context
interface GameContextType {
  gameState: GameState;
  startGame: (width?: number, height?: number) => void;
  restartGame: () => void;
  selectTile: (tile: Tile | null) => void;
  moveArmy: (movements: Movement[]) => void;
  setTickSpeed: (speed: TickSpeed) => void;
  togglePause: () => void;
  waypoints: { x: number, y: number }[];
  setWaypoints: (waypoints: { x: number, y: number }[]) => void;
}

// Create the context
const GameContext = createContext<GameContextType | undefined>(undefined);

// Define action types for the reducer
type GameAction =
  | { type: 'INITIALIZE_GAME'; payload: { width?: number; height?: number } }
  | { type: 'TICK' }
  | { type: 'SELECT_TILE'; payload: { tile: Tile | null } }
  | { type: 'MOVE_ARMY'; payload: { movements: Movement[] } }
  | { type: 'SET_TICK_SPEED'; payload: { speed: TickSpeed } }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'PROCESS_TICK' };

// Define the reducer function
const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'INITIALIZE_GAME':
      return createNewGame(action.payload.width, action.payload.height);

    case 'TICK':
      return processTick(state);

    case 'SELECT_TILE':
      return {
        ...state,
        selectedTile: action.payload.tile,
      };

    case 'MOVE_ARMY': {
      const { movements } = action.payload;
      if (movements.length === 0) {
        return state;
      }
      return enqueueMoves(state, movements);
    }

    case 'SET_TICK_SPEED':
      return setSpeed(state, action.payload.speed);

    case 'TOGGLE_PAUSE':
      return toggleGamePause(state);

    case 'PROCESS_TICK':
      return processTick(state);

    default:
      return state;
  }
};

interface GameProviderProps {
  children: ReactNode;
}

// Create the provider component
export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  // Initialize with a default empty game state that includes territories
  const initialState = createNewGame();
  
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  
  const [waypoints, setWaypoints] = React.useState<{ x: number, y: number }[]>([]);
  
  // Handle game ticks
  useEffect(() => {
    if (gameState.isPaused || gameState.isGameOver) {
      return;
    }
    
    const tickInterval = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, gameState.tickSpeed);
    
    return () => clearInterval(tickInterval);
  }, [gameState.isPaused, gameState.isGameOver, gameState.tickSpeed]);
  
  // Game actions
  const startGame = useCallback((width?: number, height?: number) => {
    dispatch({ 
      type: 'INITIALIZE_GAME', 
      payload: { width, height } 
    });
    
    // Start game immediately
    dispatch({ type: 'TOGGLE_PAUSE' });
  }, []);
  
  const restartGame = useCallback(() => {
    startGame(gameState.width, gameState.height);
  }, [gameState.width, gameState.height, startGame]);
  
  const selectTile = useCallback((tile: Tile | null) => {
    dispatch({ 
      type: 'SELECT_TILE', 
      payload: { tile } 
    });
    if (!tile) {
      setWaypoints([]);
    }
  }, []);
  
  const moveArmy = useCallback((movements: Movement[]) => {
    dispatch({
      type: 'MOVE_ARMY',
      payload: { movements }
    });
    setWaypoints([]);
  }, []);
  
  const setTickSpeed = useCallback((speed: TickSpeed) => {
    dispatch({
      type: 'SET_TICK_SPEED',
      payload: { speed }
    });
  }, []);
  
  const togglePause = useCallback(() => {
    dispatch({ type: 'TOGGLE_PAUSE' });
  }, []);
  
  return (
    <GameContext.Provider
      value={{
        gameState,
        startGame,
        restartGame,
        selectTile,
        moveArmy,
        setTickSpeed,
        togglePause,
        waypoints,
        setWaypoints
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

// Custom hook for using the game context
export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
