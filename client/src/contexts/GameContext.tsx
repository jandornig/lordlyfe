import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import { socket } from '@/services/socket';
import { GameState, Tile, Movement, TickSpeed, Owner } from '@/types/game';
// Removed client-side uuidv4 import as playerId is now server-assigned

// Define the initial state for the game
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
  movementQueue: [],
  playerId: '', // Will be set by the server
  playerName: '',
  // player2Id and player2Name are not part of initial client state
};

// Define actions for the reducer
type Action = 
  | { type: 'SET_GAME_STATE', payload: Partial<GameState> }
  | { type: 'SELECT_TILE', payload: { tile: Tile | null } }
  | { type: 'MOVE_ARMY', payload: { movements: Movement[] } }
  | { type: 'SET_TICK_SPEED', payload: { speed: TickSpeed } }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'SET_PLAYER_ID', payload: { playerId: string } } // New action for server-assigned playerId
  | { type: 'SET_PLAYER_NAME', payload: { playerName: string } };

// Create the game reducer
const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return { ...state, ...action.payload };
    case 'SELECT_TILE':
      return { ...state, selectedTile: action.payload.tile };
    case 'MOVE_ARMY': // This might be purely server-driven now
      return state; // Client doesn't optimistically update for moves
    case 'SET_TICK_SPEED':
      return { ...state, tickSpeed: action.payload.speed, isPaused: false };
    case 'TOGGLE_PAUSE':
      return { ...state, isPaused: !state.isPaused };
    case 'SET_PLAYER_ID': // Handle setting server-assigned playerId
      return { ...state, playerId: action.payload.playerId };
    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.payload.playerName };
    default:
      return state;
  }
};

// Define the context type
interface GameContextType {
  gameState: GameState;
  myPlayerId: string | null; // Store the server-assigned player ID for this client
  waypoints: { x: number, y: number }[];
  setWaypoints: React.Dispatch<React.SetStateAction<{ x: number, y: number }[]>>;
  startGame: (width?: number, height?: number, playerName?: string) => void;
  restartGame: () => void;
  selectTile: (tile: Tile | null) => void;
  moveArmy: (movements: Movement[]) => void;
  setTickSpeed: (speed: TickSpeed) => void;
  togglePause: () => void;
  setPlayerName: (name: string) => void; 
}

// Create the context
const GameContext = createContext<GameContextType | undefined>(undefined);

// Custom hook to use the context
export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

interface GameProviderProps {
  children: React.ReactNode;
}

// Create the provider component
export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  const [waypoints, setWaypoints] = React.useState<{ x: number, y: number }[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null); // State for server-assigned ID

  // Listen for player ID assignment from server
  useEffect(() => {
    const handlePlayerIdAssigned = (data: { playerId: string }) => {
      console.log('Player ID assigned by server:', data.playerId);
      setMyPlayerId(data.playerId);
      // Optionally, update gameState.playerId if it represents this client's ID in the game context
      // For now, myPlayerId is the primary store for the client's own server-assigned ID.
      // dispatch({ type: 'SET_PLAYER_ID', payload: { playerId: data.playerId } });
    };
    socket.on('player-id-assigned', handlePlayerIdAssigned);
    return () => {
      socket.off('player-id-assigned', handlePlayerIdAssigned);
    };
  }, []);

  // Effect for player-connect (now primarily for announcing playerName if ID is known)
  useEffect(() => {
    // Only emit player-connect if we have a server-assigned ID and a player name
    if (myPlayerId && gameState.playerName) {
      socket.emit('player-connect', { 
        // No need to send playerId, server maps it from socket.id
        playerName: gameState.playerName 
      });
      console.log('Emitted player-connect with playerName:', gameState.playerName);
    }
    // No explicit disconnect emission here; server handles socket.on('disconnect')
  }, [myPlayerId, gameState.playerName]);

  // Listen for game state updates from server
  React.useEffect(() => {
    const handleGameStateUpdate = (newState: GameState) => {
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
    socket.on('game-started', handleGameStateUpdate); // game-started often sends initial state
    
    return () => {
      socket.off('game-state-update', handleGameStateUpdate);
      socket.off('game-started', handleGameStateUpdate);
    };
  }, [gameState.selectedTile]);
  
  const setPlayerNameCB = useCallback((name: string) => {
    dispatch({ type: 'SET_PLAYER_NAME', payload: { playerName: name } });
  }, []);

  // Game actions
  const startGame = useCallback((width?: number, height?: number, playerNameInput?: string) => {
    if (!myPlayerId) {
      console.error("Cannot start game: Player ID not yet assigned by server.");
      // Optionally, inform the user they need to connect first or wait.
      return;
    }
    if (playerNameInput) {
      // Dispatch to update local state, which then triggers the player-connect effect if myPlayerId is also set
      dispatch({ type: 'SET_PLAYER_NAME', payload: { playerName: playerNameInput } });
    } else if (!gameState.playerName) {
      console.error("Cannot start game: Player name is not set.");
      // Optionally, prompt user for name if not already handled by UI
      return;
    }
    
    console.log(`Emitting start-game for player: ${myPlayerId} with name: ${playerNameInput || gameState.playerName}`);
    socket.emit('start-game', {
      width,
      height,
      // playerId is not sent; server uses the one mapped to socket.id
      playerName: playerNameInput || gameState.playerName // Ensure playerName is current
    });
  }, [myPlayerId, gameState.playerName]); // Added gameState.playerName dependency
  
  const restartGame = useCallback(() => {
    // For restart, we should use the current name, and server will use existing playerId
    startGame(gameState.width, gameState.height, gameState.playerName);
  }, [gameState.width, gameState.height, gameState.playerName, startGame]);
  
  const selectTile = useCallback((tile: Tile | null) => {
    dispatch({ 
      type: 'SELECT_TILE', 
      payload: { tile } 
    });
    if (!tile) {
      setWaypoints([]);
    }
  }, []);
  
  // moveArmy should primarily send intent to server
  const moveArmy = useCallback((movements: Movement[]) => {
    if (!myPlayerId) {
      console.error("Cannot move army: Player ID not known.");
      return;
    }
    console.log(`Client ${myPlayerId} sending move-army intent:`, movements);
    socket.emit('move-army', { movements }); // Server will associate with player via socket.id
    setWaypoints([]); // Clear waypoints optimistically, or server can confirm
  }, [myPlayerId]);
  
  const setTickSpeedCB = useCallback((speed: TickSpeed) => {
    socket.emit('set-tick-speed', { speed });
    // Optimistic update, or wait for server confirmation via game-state-update
    dispatch({
      type: 'SET_TICK_SPEED',
      payload: { speed }
    });
  }, []);
  
  const togglePauseCB = useCallback(() => {
    socket.emit('toggle-pause');
    // Optimistic update, or wait for server confirmation
    dispatch({ type: 'TOGGLE_PAUSE' });
  }, []);

  return (
    <GameContext.Provider value={{
       gameState, 
       myPlayerId, 
       waypoints, 
       setWaypoints, 
       startGame, 
       restartGame, 
       selectTile, 
       moveArmy, 
       setTickSpeed: setTickSpeedCB, 
       togglePause: togglePauseCB,
       setPlayerName: setPlayerNameCB 
      }}>
      {children}
    </GameContext.Provider>
  );
};
