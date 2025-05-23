import React, { createContext, useContext, useReducer, useEffect, useCallback, useState, ReactNode, useMemo } from 'react';
import { socket } from '../services/socket';
import { GameState, Tile, Movement, TickSpeed, StateUpdate } from '../../shared/types/game';
import { clientStateReconciliation } from '../services/clientStateReconciliation';

export type PlayerRole = 'player1' | 'player2' | 'observer' | null;

interface GameContextType {
  gameState: GameState;
  myPlayerId: string | null;
  playerRole: PlayerRole;  // Keep for backward compatibility
  waypoints: { x: number, y: number }[];
  setWaypoints: React.Dispatch<React.SetStateAction<{ x: number, y: number }[]>>;
  startGame: (width?: number, height?: number, playerName?: string) => void;
  restartGame: () => void;
  selectTile: (tile: Tile | null) => void;
  moveArmy: (movements: Movement[]) => void;
  setTickSpeed: (speed: TickSpeed) => void;
  togglePause: () => void;
  setPlayerName: (name: string) => void;
  cameraPosition: { x: number; y: number };
  setCameraPosition: (pos: { x: number; y: number }) => void;
  focusOnPlayerLord: () => void;
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
  matchId: '',
  player1Id: '',
  player1Name: '',
  player2Id: '',
  player2Name: '',
  player1Units: [],
  player2Units: [],
  width: 20,
  height: 20,
  tick: 0,
  tickSpeed: 1000,
  tiles: [],
  territories: [],
  isPaused: true,
  isGameOver: false,
  winner: null,
  selectedTile: null,
  movementQueue: [],
  minGarrison: 1
};

type Action =
  | { type: 'SET_GAME_STATE', payload: Partial<GameState> }
  | { type: 'SELECT_TILE', payload: { tile: Tile | null } }
  | { type: 'MOVE_ARMY', payload: { movements: Movement[] } }
  | { type: 'SET_TICK_SPEED', payload: { speed: TickSpeed } }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'SET_PLAYER_ID', payload: { player1Id: string } }
  | { type: 'SET_PLAYER_NAME', payload: { player1Name: string } };

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
      return { ...state, player1Id: action.payload.player1Id };
    case 'SET_PLAYER_NAME':
      return { ...state, player1Name: action.payload.player1Name };
    default:
      return state;
  }
};

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  const [waypoints, setWaypoints] = useState<{ x: number, y: number }[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0 });
  const [lastStateVersion, setLastStateVersion] = useState<number>(0);
  
  // Compute playerRole from myPlayerId and gameState
  const playerRole = useMemo(() => {
    if (!myPlayerId || !gameState) return null;
    return myPlayerId === gameState.player1Id ? 'player1' :
           myPlayerId === gameState.player2Id ? 'player2' : 'observer';
  }, [myPlayerId, gameState]);

  // Focus camera on player's lord tile
  const focusOnPlayerLord = useCallback(() => {
    if (!gameState || !myPlayerId) return;

    const lordTile = gameState.tiles.find(tile => {
      const isLord = tile.isLord;
      const isPlayer1Lord = myPlayerId === gameState.player1Id && tile.owner === 'player1';
      const isPlayer2Lord = myPlayerId === gameState.player2Id && tile.owner === 'player2';
      return isLord && (isPlayer1Lord || isPlayer2Lord);
    });

    if (lordTile) {
      setCameraPosition({ x: lordTile.x, y: lordTile.y });
    }
  }, [gameState, myPlayerId]);

  // Socket connection handling
  useEffect(() => {
    const handleConnect = () => {};
    const handleDisconnect = () => {};
    const handleError = (error: Error) => {
      console.error('Socket error:', error);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
    };
  }, []);

  useEffect(() => {
    const handlePlayerIdAssigned = (data: { playerId: string }) => {
      setMyPlayerId(data.playerId);
    };
    socket.on('player-id-assigned', handlePlayerIdAssigned);
    return () => {
      socket.off('player-id-assigned', handlePlayerIdAssigned);
    };
  }, []);

  useEffect(() => {
    if (myPlayerId) {
      const playerName = myPlayerId === gameState.player1Id ? gameState.player1Name : 
                        myPlayerId === gameState.player2Id ? gameState.player2Name : '';
      if (playerName) {
        socket.emit('player-connect', { playerName });
      }
    }
  }, [myPlayerId, gameState.player1Name, gameState.player2Name]);

  useEffect(() => {
    if (!socket) return;

    const handleGameStateUpdate = async (update: StateUpdate) => {
      // Use client reconciliation to handle the update
      const result = await clientStateReconciliation.handleStateUpdate(update, gameState);
      
      if (!result.success) {
        console.error('State update failed:', result.errors);
        return;
      }

      const newState = update.state;
      if (!newState || !newState.tiles) {
        console.error('[GameContext] Received invalid state update:', update);
        return;
      }

      const updatedTiles = newState.tiles.map(tile => {
        const isOwned = (myPlayerId === newState.player1Id && tile.owner === 'player1') ||
                       (myPlayerId === newState.player2Id && tile.owner === 'player2');
        
        const isAdjacent = newState.tiles.some(adjTile => {
          if (!adjTile.owner) return false;
          const isAdjTileOwned = (myPlayerId === newState.player1Id && adjTile.owner === 'player1') ||
                                (myPlayerId === newState.player2Id && adjTile.owner === 'player2');
          if (!isAdjTileOwned) return false;
          
          const dx = Math.abs(tile.x - adjTile.x);
          const dy = Math.abs(tile.y - adjTile.y);
          return dx <= 1 && dy <= 1;
        });

        return {
          ...tile,
          isVisible: isOwned || isAdjacent
        };
      });

      dispatch({ 
        type: 'SET_GAME_STATE', 
        payload: {
          ...newState,
          tiles: updatedTiles,
          selectedTile: gameState.selectedTile
        }
      });

      if (newState.player1Id && newState.player2Id && newState.tiles.length > 0) {
        const lordTile = updatedTiles.find(tile => {
          const isLord = tile.isLord;
          const isPlayer1Lord = myPlayerId === newState.player1Id && tile.owner === 'player1';
          const isPlayer2Lord = myPlayerId === newState.player2Id && tile.owner === 'player2';
          return isLord && (isPlayer1Lord || isPlayer2Lord);
        });

        if (lordTile) {
          setCameraPosition({ x: lordTile.x, y: lordTile.y });
        }
      }
    };

    socket.on('game-state-update', handleGameStateUpdate);
    socket.on('game-started', handleGameStateUpdate);
    socket.on('full-state-response', handleGameStateUpdate);

    return () => {
      socket.off('game-state-update', handleGameStateUpdate);
      socket.off('game-started', handleGameStateUpdate);
      socket.off('full-state-response', handleGameStateUpdate);
    };
  }, [socket, gameState.selectedTile, myPlayerId]);

  // Reset reconciliation state when game ends
  useEffect(() => {
    if (gameState.isGameOver) {
      clientStateReconciliation.reset();
    }
  }, [gameState.isGameOver]);

  const setPlayerNameCB = useCallback((name: string) => {
    dispatch({ type: 'SET_PLAYER_NAME', payload: { player1Name: name } });
  }, []);

  const startGame = useCallback((width?: number, height?: number, playerNameInput?: string) => {
    if (!myPlayerId) {
      console.error("[GameContext] Cannot start game: Player ID not yet assigned by server.");
      return;
    }

    const playerName = playerNameInput || 
                      (myPlayerId === gameState.player1Id ? gameState.player1Name : 
                       myPlayerId === gameState.player2Id ? gameState.player2Name : '');

    if (!playerName) {
      console.error("[GameContext] Cannot start game: Player name is not set.");
      return;
    }

    // First emit player-connect to ensure the server knows we're ready
    socket.emit('player-connect', { playerName });
    
    // Then start the game after a short delay to ensure connection is processed
    setTimeout(() => {
      socket.emit('start-game', {
        width,
        height,
        playerName
      });
    }, 100);
  }, [myPlayerId, gameState.player1Name, gameState.player2Name]);
  
  const restartGame = useCallback(() => {
    // Reset game state
    dispatch({ type: 'SET_GAME_STATE', payload: initialState });
    
    // Re-enter matchmaking with the same player name
    const playerName = myPlayerId === gameState.player1Id ? gameState.player1Name : 
                      myPlayerId === gameState.player2Id ? gameState.player2Name : '';
    
    if (playerName) {
      // Emit game-ended event to notify server
      socket.emit('game-ended');
      
      // Wait a short moment to ensure server processes the game end
      setTimeout(() => {
        // Re-enter matchmaking queue
        startGame(gameState.width, gameState.height, playerName);
      }, 100);
    } else {
      console.error('[GameContext] Could not determine player name for restart');
    }
  }, [gameState.width, gameState.height, gameState.player1Name, gameState.player2Name, myPlayerId, startGame]);
  
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
      setPlayerName: setPlayerNameCB,
      cameraPosition,
      setCameraPosition,
      focusOnPlayerLord
    }}>
      {children}
    </GameContext.Provider>
  );
};
