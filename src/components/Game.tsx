
import React, { useState } from 'react';
import { GameProvider } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import GameGrid from './GameGrid';
import GameControls from './GameControls';
import GameStatus from './GameStatus';
import VictoryScreen from './VictoryScreen';
import StartScreen from './StartScreen';

const GameContent: React.FC = () => {
  const { gameState, startGame } = useGame();
  const [gameStarted, setGameStarted] = useState(false);
  
  const handleStartGame = () => {
    // Start the game with a larger grid size
    startGame(30, 30);
    setGameStarted(true);
  };
  
  if (!gameStarted) {
    return <StartScreen onStart={handleStartGame} />;
  }
  
  return (
    <div className="flex flex-col h-full">
      <GameStatus />
      
      <div className="flex-1 my-4 relative">
        <GameGrid />
        <VictoryScreen />
      </div>
      
      <GameControls />
    </div>
  );
};

const Game: React.FC = () => {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  );
};

export default Game;
