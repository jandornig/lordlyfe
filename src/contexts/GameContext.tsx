import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { GameState, Tile, TickSpeed, Movement } from '../types/game';
import { socket } from '../services/socket';

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
  | { type: 'SET_GAME_STATE'; payload: GameState }
  | { type: 'SELECT_TILE'; payload: { tile: Tile | null } }
  | { type: 'SET_TICK_SPEED'; payload: { speed: TickSpeed } }
  | { type: 'TOGGLE_PAUSE' };

// Define the reducer function
const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return action.payload;

    case 'SELECT_TILE':
      return {
        ...state,
        selectedTile: action.payload.tile,
      };

    case 'SET_TICK_SPEED':
      return {
        ...state,
        tickSpeed: action.payload.speed,
      };

    case 'TOGGLE_PAUSE':
      return {
        ...state,
        isPaused: !state.isPaused,
      };

    default:
      return state;
  }
};

interface GameProviderProps {
  children: ReactNode;
}

// Create the provider component
export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const initialState: GameState = {
    tiles: [],
    territories: [],
    selectedTile: null,
    minGarrison: 1,
    tick: 0,
    isPaused: true,
    tickSpeed: 1000,
    width: 20,
    height: 20,
    isGameOver: false,
    movementQueue: []
  };
  
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  const [waypoints, setWaypoints] = React.useState<{ x: number, y: number }[]>([]);
  
  // Listen for game state updates from server
  React.useEffect(() => {
    const handleGameStateUpdate = (newState: GameState) => {
      // Preserve the selected tile when updating state
      const currentSelectedTile = gameState.selectedTile;
      dispatch({ 
        type: 'SET_GAME_STATE', 
        payload: {
          ...newState,
          selectedTile: currentSelectedTile
        }
      });
    };

    socket.on('game-state-update', handleGameStateUpdate);
    socket.on('game-started', handleGameStateUpdate);
    
    return () => {
      socket.off('game-state-update', handleGameStateUpdate);
      socket.off('game-started', handleGameStateUpdate);
    };
  }, [gameState.selectedTile]); // Add selectedTile to dependencies
  
  // Game actions
  const startGame = useCallback((width?: number, height?: number) => {
    socket.emit('start-game', { width, height });
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
    socket.emit('move-army', { movements });
    setWaypoints([]);
  }, []);
  
  const setTickSpeed = useCallback((speed: TickSpeed) => {
    socket.emit('set-tick-speed', { speed });
    dispatch({
      type: 'SET_TICK_SPEED',
      payload: { speed }
    });
  }, []);
  
  const togglePause = useCallback(() => {
    console.log('Client: Toggling pause, current state:', {
      isPaused: gameState.isPaused,
      tick: gameState.tick,
      tickSpeed: gameState.tickSpeed
    });
    socket.emit('toggle-pause');
    dispatch({ type: 'TOGGLE_PAUSE' });
  }, [gameState.isPaused, gameState.tick, gameState.tickSpeed]);
  
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
