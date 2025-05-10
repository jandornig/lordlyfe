import React, { useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import GameGrid from '../components/GameGrid';
import GameControls from '../components/GameControls';
import GameStatus from '../components/GameStatus';
import VictoryScreen from '../components/VictoryScreen';

const Game: React.FC = () => {
  const { state } = useGame();

  // Log game state on mount and updates
  useEffect(() => {
    console.log('[Game] Game state updated:', {
      hasTiles: state.tiles.length > 0,
      tileCount: state.tiles.length,
      width: state.width,
      height: state.height,
      isPaused: state.isPaused,
      selectedTile: state.selectedTile
    });
  }, [state]);

  // Log initial render
  console.log('[Game] Initial render:', {
    hasTiles: state.tiles.length > 0,
    tileCount: state.tiles.length,
    width: state.width,
    height: state.height
  });

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="p-4">
        <GameStatus />
      </div>
      <div className="flex-1 overflow-hidden">
        <GameGrid />
      </div>
      <div className="p-4 border-t border-gray-700">
        <GameControls />
      </div>
      <VictoryScreen />
    </div>
  );
};

export default Game;
