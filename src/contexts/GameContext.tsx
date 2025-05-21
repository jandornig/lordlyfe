import React, { createContext, useContext, useReducer, useEffect, useCallback, useState, ReactNode, useMemo } from 'react';
import { socket } from '../services/socket';
import { GameState, Tile, Movement, TickSpeed } from '../../shared/types/game';

console.log("GameContext.tsx loaded");

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
  console.log('GameContext.tsx: Starting GameProvider component');
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  const [waypoints, setWaypoints] = useState<{ x: number, y: number }[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0 });
  
  // Compute playerRole from myPlayerId and gameState
  const playerRole = useMemo(() => {
    if (!myPlayerId || !gameState) return null;
    const role = myPlayerId === gameState.player1Id ? 'player1' :
                 myPlayerId === gameState.player2Id ? 'player2' : 'observer';
    console.log('GameContext.tsx: Computed player role:', {
      myPlayerId,
      player1Id: gameState.player1Id,
      player2Id: gameState.player2Id,
      role
    });
    return role;
  }, [myPlayerId, gameState]);

  // Focus camera on player's lord tile
  const focusOnPlayerLord = useCallback(() => {
    if (!gameState || !myPlayerId) {
      console.log('GameContext.tsx: Camera Focus Failed - Missing data:', {
        hasGameState: !!gameState,
        myPlayerId
      });
      return;
    }

    console.log('GameContext.tsx: Attempting to focus camera:', {
      myPlayerId,
      player1Id: gameState.player1Id,
      player2Id: gameState.player2Id,
      isPlayer1: myPlayerId === gameState.player1Id,
      isPlayer2: myPlayerId === gameState.player2Id
    });

    // Find all lord tiles
    const allLordTiles = gameState.tiles.filter(tile => tile.isLord);
    console.log('GameContext.tsx: All Lord Tiles:', allLordTiles.map(tile => ({
      x: tile.x,
      y: tile.y,
      owner: tile.owner,
      army: tile.army,
      isVisible: tile.isVisible
    })));

    // Find player's lord tile based on myPlayerId
    const lordTile = gameState.tiles.find(tile => {
      const isLord = tile.isLord;
      const isPlayer1Lord = myPlayerId === gameState.player1Id && tile.owner === 'player1';
      const isPlayer2Lord = myPlayerId === gameState.player2Id && tile.owner === 'player2';
      return isLord && (isPlayer1Lord || isPlayer2Lord);
    });

    if (lordTile) {
      console.log('GameContext.tsx: Found Lord Tile:', {
        x: lordTile.x,
        y: lordTile.y,
        owner: lordTile.owner,
        army: lordTile.army,
        isVisible: lordTile.isVisible,
        myPlayerId,
        player1Id: gameState.player1Id,
        player2Id: gameState.player2Id
      });
      console.log('GameContext.tsx: Setting camera to lord tile position');
      setCameraPosition({ x: lordTile.x, y: lordTile.y });
    } else {
      console.log('GameContext.tsx: No Lord Tile Found for:', {
        myPlayerId,
        player1Id: gameState.player1Id,
        player2Id: gameState.player2Id,
        allLordTiles: allLordTiles.map(t => ({
          x: t.x,
          y: t.y,
          owner: t.owner,
          isLord: t.isLord
        }))
      });
    }
  }, [gameState, myPlayerId]);

  // Debug socket connection
  useEffect(() => {
    console.log('GameContext.tsx: Socket status:', {
      connected: socket.connected,
      id: socket.id,
      hasListeners: {
        'player-id-assigned': socket.hasListeners('player-id-assigned'),
        'game-state-update': socket.hasListeners('game-state-update'),
        'game-started': socket.hasListeners('game-started')
      }
    });

    const handleConnect = () => {
      console.log('GameContext.tsx: Socket connected, ID:', socket.id);
    };

    const handleDisconnect = () => {
      console.log('GameContext.tsx: Socket disconnected');
    };

    const handleError = (error: Error) => {
      console.error('GameContext.tsx: Socket error:', error);
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
      console.log('GameContext.tsx: Player ID assigned by server:', data.playerId);
      setMyPlayerId(data.playerId);
    };
    socket.on('player-id-assigned', handlePlayerIdAssigned);
    return () => {
      socket.off('player-id-assigned', handlePlayerIdAssigned);
    };
  }, []);

  useEffect(() => {
    if (myPlayerId) {
      // Determine which player name to use based on myPlayerId
      const playerName = myPlayerId === gameState.player1Id ? gameState.player1Name : 
                        myPlayerId === gameState.player2Id ? gameState.player2Name : '';
      if (playerName) {
        socket.emit('player-connect', { playerName });
        console.log('Emitted player-connect with playerName:', playerName);
      }
    }
  }, [myPlayerId, gameState.player1Name, gameState.player2Name]);

  useEffect(() => {
    if (!socket) return;

    const handleGameStateUpdate = (newState: GameState) => {
      // Log the incoming state
      console.log('GameContext.tsx: Game state update received:', {
        myPlayerId,
        player1Id: newState.player1Id,
        player2Id: newState.player2Id,
        lordTiles: newState.tiles.filter(t => t.isLord).map(t => ({
          x: t.x,
          y: t.y,
          owner: t.owner,
          isLord: t.isLord,
          isVisible: t.isVisible
        }))
      });

      // Ensure tiles are properly initialized for the current player
      const updatedTiles = newState.tiles.map(tile => {
        // A tile is visible if:
        // 1. It's owned by the current player
        // 2. It's adjacent to a tile owned by the current player
        const isOwned = (myPlayerId === newState.player1Id && tile.owner === 'player1') ||
                       (myPlayerId === newState.player2Id && tile.owner === 'player2');
        
        // Check adjacent tiles
        const isAdjacent = newState.tiles.some(adjTile => {
          if (!adjTile.owner) return false;
          const isAdjTileOwned = (myPlayerId === newState.player1Id && adjTile.owner === 'player1') ||
                                (myPlayerId === newState.player2Id && adjTile.owner === 'player2');
          if (!isAdjTileOwned) return false;
          
          // Check if tiles are adjacent (including diagonals)
          const dx = Math.abs(tile.x - adjTile.x);
          const dy = Math.abs(tile.y - adjTile.y);
          return dx <= 1 && dy <= 1;
        });

        return {
          ...tile,
          isVisible: isOwned || isAdjacent
        };
      });

      // Update state with properly initialized tiles
      dispatch({ 
        type: 'SET_GAME_STATE', 
        payload: {
          ...newState,
          tiles: updatedTiles,
          selectedTile: gameState.selectedTile
        }
      });

      // Focus camera after state is updated
      if (newState.player1Id && newState.player2Id && newState.tiles.length > 0) {
        // Use the updated tiles for finding the lord tile
        const lordTile = updatedTiles.find(tile => {
          const isLord = tile.isLord;
          const isPlayer1Lord = myPlayerId === newState.player1Id && tile.owner === 'player1';
          const isPlayer2Lord = myPlayerId === newState.player2Id && tile.owner === 'player2';
          return isLord && (isPlayer1Lord || isPlayer2Lord);
        });

        if (lordTile) {
          console.log('GameContext.tsx: Setting camera to lord tile position:', {
            x: lordTile.x,
            y: lordTile.y,
            owner: lordTile.owner
          });
          setCameraPosition({ x: lordTile.x, y: lordTile.y });
        }
      }
    };

    socket.on('game-state-update', handleGameStateUpdate);
    socket.on('game-started', handleGameStateUpdate);
    return () => {
      socket.off('game-state-update', handleGameStateUpdate);
      socket.off('game-started', handleGameStateUpdate);
    };
  }, [socket, gameState.selectedTile, myPlayerId]);

  // Add effect to log camera position changes
  useEffect(() => {
    console.log('GameContext.tsx: Camera position updated:', {
      position: cameraPosition,
      myPlayerId,
      player1Id: gameState.player1Id,
      player2Id: gameState.player2Id
    });
  }, [cameraPosition, myPlayerId, gameState]);

  const setPlayerNameCB = useCallback((name: string) => {
    dispatch({ type: 'SET_PLAYER_NAME', payload: { player1Name: name } });
  }, []);

  const startGame = useCallback((width?: number, height?: number, playerNameInput?: string) => {
    if (!myPlayerId) {
      console.error("Cannot start game: Player ID not yet assigned by server.");
      return;
    }

    // Determine which player name to use
    const playerName = playerNameInput || 
                      (myPlayerId === gameState.player1Id ? gameState.player1Name : 
                       myPlayerId === gameState.player2Id ? gameState.player2Name : '');

    if (!playerName) {
      console.error("Cannot start game: Player name is not set.");
      return;
    }

    console.log(`[GameContext] Emitting start-game for player: ${myPlayerId} with name: ${playerName}`);
    socket.emit('start-game', {
      width,
      height,
      playerName
    });
  }, [myPlayerId, gameState.player1Name, gameState.player2Name]);
  
  const restartGame = useCallback(() => {
    startGame(gameState.width, gameState.height);
  }, [gameState.width, gameState.height, startGame]);
  
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
      setPlayerName: setPlayerNameCB,
      cameraPosition,
      setCameraPosition,
      focusOnPlayerLord
    }}>
      {children}
    </GameContext.Provider>
  );
};
