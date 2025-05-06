import { GameState, Tile, TickSpeed, Waypoint, Movement } from '../types/game';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createGameState, applyCommand, createStartGameCommand, createSelectTileCommand, createSetTickSpeedCommand, createTogglePauseCommand, createMoveCommand } from '../core/gameState';
import { processTick } from '../core/gameLogic';
import { queue, drainForTurn } from '../client/net/commandQueue';

// Game context interface
interface GameContextType {
  gameState: GameState;
  startGame: (width: number, height: number) => void;
  handleTileClick: (tile: Tile) => void;
  setTickSpeed: (speed: TickSpeed) => void;
  togglePause: () => void;
  selectTile: (tile: Tile | null) => void;
  moveArmy: (movements: Movement[]) => void;
  waypoints: Waypoint[];
  setWaypoints: (waypoints: Waypoint[]) => void;
}

// Create game context
const GameContext = createContext<GameContextType | null>(null);

// Game provider component
export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  // Start a new game
  const startGame = useCallback((width: number, height: number) => {
    const command = createStartGameCommand('player', width, height);
    queue(command);
    const newState = applyCommand(createGameState(width, height), command);
    setGameState(newState);
  }, []);

  // Handle tile click
  const handleTileClick = useCallback((tile: Tile) => {
    if (!gameState) return;

    const command = createSelectTileCommand('player', tile);
    queue(command);
    const newState = applyCommand(gameState, command);
    setGameState(newState);
  }, [gameState]);

  // Set tick speed
  const setTickSpeed = useCallback((speed: TickSpeed) => {
    if (!gameState) return;

    const command = createSetTickSpeedCommand('player', speed);
    queue(command);
    const newState = applyCommand(gameState, command);
    setGameState(newState);
  }, [gameState]);

  // Toggle pause
  const togglePause = useCallback(() => {
    if (!gameState) return;

    const command = createTogglePauseCommand('player');
    queue(command);
    const newState = applyCommand(gameState, command);
    setGameState(newState);
  }, [gameState]);

  // Select tile
  const selectTile = useCallback((tile: Tile | null) => {
    if (!gameState) return;

    const command = createSelectTileCommand('player', tile);
    queue(command);
    const newState = applyCommand(gameState, command);
    setGameState(newState);
  }, [gameState]);

  // Move army
  const moveArmy = useCallback((movements: Movement[]) => {
    if (!gameState) return;

    const command = createMoveCommand('player', movements);
    queue(command);
    const newState = applyCommand(gameState, command);
    setGameState(newState);
  }, [gameState]);

  // Process game ticks
  useEffect(() => {
    if (!gameState || gameState.isPaused || gameState.isGameOver) return;

    const interval = setInterval(() => {
      // Process any queued commands
      const commands = drainForTurn();
      let newState = gameState;
      for (const command of commands) {
        newState = applyCommand(newState, command);
      }
      // Process the tick
      newState = processTick(newState);
      setGameState(newState);
    }, gameState.tickSpeed);

    return () => clearInterval(interval);
  }, [gameState]);

  // Provide context value
  const value = {
    gameState: gameState || createGameState(20, 20),
    startGame,
    handleTileClick,
    setTickSpeed,
    togglePause,
    selectTile,
    moveArmy,
    waypoints,
    setWaypoints
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

// Custom hook to use game context
export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
