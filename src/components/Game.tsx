import React, { useState, useEffect } from 'react';
import { GameProvider } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import GameGrid from './GameGrid';
import GameControls from './GameControls';
import GameStatus from './GameStatus';
import VictoryScreen from './VictoryScreen';
import StartScreen from './StartScreen';
import LoadingScreen from './LoadingScreen';
import { socket } from '@/services/socket';

type GameState = 'start' | 'matchmaking' | 'playing';

const GameContent: React.FC = () => {
  const { gameState, startGame } = useGame();
  const [gameStarted, setGameStarted] = useState(false);
  const [currentState, setCurrentState] = useState<GameState>('start');
  const [loadingMessage, setLoadingMessage] = useState('Waiting for opponent...');
  
  useEffect(() => {
    // Listen for queue status updates
    socket.on('queue-status', (data) => {
      setLoadingMessage(data.message);
    });

    // Listen for match found
    socket.on('match-found', (data) => {
      setLoadingMessage(data.message);
    });

    // Listen for game started
    socket.on('game-started', () => {
      setCurrentState('playing');
      setGameStarted(true);
    });

    // Listen for game ended
    socket.on('game-ended', () => {
      setCurrentState('matchmaking');
      setGameStarted(false);
      setLoadingMessage('Waiting for opponent...');
    });

    return () => {
      socket.off('queue-status');
      socket.off('match-found');
      socket.off('game-started');
      socket.off('game-ended');
    };
  }, []);
  
  const handleStartGame = (playerName: string) => {
    setCurrentState('matchmaking');
    startGame(30, 30, playerName);
  };
  
  if (!gameStarted) {
    if (currentState === 'matchmaking') {
      return <LoadingScreen message={loadingMessage} />;
    }
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
