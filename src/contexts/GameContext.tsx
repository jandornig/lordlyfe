import React, { createContext, useContext, useReducer, useEffect, useCallback, useState, ReactNode } from 'react';
import { socket } from '../services/socket';
import { GameState, Tile, Movement, TickSpeed } from '../types/game';

console.log("GameContext.tsx loaded");

export type PlayerRole = 'player1' | 'player2' | 'observer' | null;

interface GameContextType {
  gameState: GameState;
  myPlayerId: string | null;
  playerRole: PlayerRole;
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

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

interface GameProviderProps {
  children: ReactNode;
}

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
  playerId: '',
    playerName: ''
  };
  
type Action =
  | { type: 'SET_GAME_STATE', payload: Partial<GameState> }
  | { type: 'SELECT_TILE', payload: { tile: Tile | null } }
  | { type: 'MOVE_ARMY', payload: { movements: Movement[] } }
  | { type: 'SET_TICK_SPEED', payload: { speed: TickSpeed } }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'SET_PLAYER_ID', payload: { playerId: string } }
  | { type: 'SET_PLAYER_NAME', payload: { playerName: string } };

const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return { ...state, ...action.payload };
    case 'SELECT_TILE':
      return { ...state, selectedTile: action.payload.tile };
    case 'MOVE_ARMY':
      return state;
    case 'SET_TICK_SPEED':
      return { ...state, tickSpeed: action.payload.speed, isPaused: false };
    case 'TOGGLE_PAUSE':
      return { ...state, isPaused: !state.isPaused };
    case 'SET_PLAYER_ID':
      return { ...state, playerId: action.payload.playerId };
    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.payload.playerName };
    default:
      return state;
  }
};

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  const [waypoints, setWaypoints] = useState<{ x: number, y: number }[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [playerRole, setPlayerRole] = useState<PlayerRole>(null);
  
  useEffect(() => {
    const handlePlayerIdAssigned = (data: { playerId: string }) => {
      console.log('Player ID assigned by server:', data.playerId);
      setMyPlayerId(data.playerId);
    };
    socket.on('player-id-assigned', handlePlayerIdAssigned);
    return () => {
      socket.off('player-id-assigned', handlePlayerIdAssigned);
    };
  }, []);

  useEffect(() => {
    if (myPlayerId && gameState.playerName) {
      socket.emit('player-connect', { playerName: gameState.playerName });
      console.log('Emitted player-connect with playerName:', gameState.playerName);
    }
  }, [myPlayerId, gameState.playerName]);

  useEffect(() => {
    const handleGameStateUpdate = (newState: GameState) => {
      const currentSelectedTile = gameState.selectedTile;
      dispatch({ 
        type: 'SET_GAME_STATE', 
        payload: {
          ...newState,
          selectedTile: currentSelectedTile
        }
      });
      if (myPlayerId) {
        let role: PlayerRole = 'observer';
        if (myPlayerId === newState.playerId) {
          role = 'player1';
        } else if (myPlayerId === (newState as any).player2Id) {
          role = 'player2';
        }
        setPlayerRole(role);
        console.log('[GameContext] Game state update received. myPlayerId:', myPlayerId, 'playerId:', newState.playerId, 'player2Id:', (newState as any).player2Id, '=> role:', role);
      } else {
        setPlayerRole(null);
        console.log('[GameContext] Game state update received, but myPlayerId is not set yet.');
      }
    };
    socket.on('game-state-update', handleGameStateUpdate);
    socket.on('game-started', handleGameStateUpdate);
    return () => {
      socket.off('game-state-update', handleGameStateUpdate);
      socket.off('game-started', handleGameStateUpdate);
    };
  }, [gameState.selectedTile, myPlayerId]);

  const setPlayerNameCB = useCallback((name: string) => {
    dispatch({ type: 'SET_PLAYER_NAME', payload: { playerName: name } });
  }, []);

  const startGame = useCallback((width?: number, height?: number, playerNameInput?: string) => {
    if (!myPlayerId) {
      console.error("Cannot start game: Player ID not yet assigned by server.");
      return;
    }
    if (playerNameInput) {
      dispatch({ type: 'SET_PLAYER_NAME', payload: { playerName: playerNameInput } });
    } else if (!gameState.playerName) {
      console.error("Cannot start game: Player name is not set.");
      return;
    }
    console.log(`[GameContext] Emitting start-game for player: ${myPlayerId} with name: ${playerNameInput || gameState.playerName}`);
    socket.emit('start-game', {
      width,
      height,
      playerName: playerNameInput || gameState.playerName
    });
  }, [myPlayerId, gameState.playerName]);
  
  const restartGame = useCallback(() => {
    startGame(gameState.width, gameState.height, gameState.playerName);
  }, [gameState.width, gameState.height, gameState.playerName, startGame]);
  
  const selectTile = useCallback((tile: Tile | null) => {
    dispatch({ type: 'SELECT_TILE', payload: { tile } });
    if (!tile) {
      setWaypoints([]);
    }
  }, []);
  
  const moveArmy = useCallback((movements: Movement[]) => {
    if (!myPlayerId) {
      console.error("Cannot move army: Player ID not known.");
      return;
    }
    console.log(`[GameContext] Client ${myPlayerId} sending move-army intent:`, movements);
    socket.emit('move-army', { movements });
    setWaypoints([]);
  }, [myPlayerId]);
  
  const setTickSpeedCB = useCallback((speed: TickSpeed) => {
    socket.emit('set-tick-speed', { speed });
    dispatch({ type: 'SET_TICK_SPEED', payload: { speed } });
  }, []);
  
  const togglePauseCB = useCallback(() => {
    socket.emit('toggle-pause');
    dispatch({ type: 'TOGGLE_PAUSE' });
  }, []);
  
  return (
    <GameContext.Provider value={{
        gameState,
      myPlayerId,
      playerRole,
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
