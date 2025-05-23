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
    console.log('[Game] Initial state:', { gameStarted, currentState, loadingMessage });
    
    // Listen for queue status updates
    socket.on('queue-status', (data) => {
      console.log('[Game] Queue status update:', data);
      setLoadingMessage(data.message);
    });

    // Listen for match found
    socket.on('match-found', (data) => {
      console.log('[Game] Match found:', data);
      setLoadingMessage(data.message);
    });

    // Listen for game started
    socket.on('game-started', () => {
      console.log('[Game] Game started event received');
      setCurrentState('playing');
      setGameStarted(true);
    });

    // Listen for game ended
    socket.on('game-ended', () => {
      console.log('[Game] Game ended event received');
      // Transition to matchmaking when game ends
      setCurrentState('matchmaking');
      setGameStarted(false);
    });

    return () => {
      socket.off('queue-status');
      socket.off('match-found');
      socket.off('game-started');
      socket.off('game-ended');
    };
  }, []);

  // Add effect to handle game state changes
  useEffect(() => {
    console.log('[Game] Game state changed:', {
      isGameOver: gameState.isGameOver,
      matchId: gameState.matchId,
      currentState,
      gameStarted
    });
  }, [gameState.isGameOver, gameState.matchId, currentState, gameStarted]);
  
  const handleStartGame = (playerName: string) => {
    console.log('[Game] Starting game with player name:', playerName);
    setCurrentState('matchmaking');
    startGame(30, 30, playerName);
  };
  
  // First check if we're in matchmaking
  if (currentState === 'matchmaking') {
    return <LoadingScreen message={loadingMessage} />;
  }
  
  // Then check if game hasn't started
  if (!gameStarted) {
    return <StartScreen onStart={handleStartGame} />;
  }
  
  // Finally, show the game UI
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
