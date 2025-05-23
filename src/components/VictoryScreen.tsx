import React from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import io from 'socket.io-client';

const socket = io();

const VictoryScreen: React.FC = () => {
  const { gameState, restartGame, playerRole } = useGame();
  const { winner } = gameState;
  
  if (!gameState.isGameOver) {
    return null;
  }
  
  // Determine if the current player won
  const isWinner = winner === playerRole;
  
  const handlePlayAgain = () => {
    // First emit game-ended to clean up the current game
    socket.emit('game-ended');
    
    // Then restart the game after a short delay
    setTimeout(() => {
      // Get the player name for restart
      const playerName = playerRole === 'player1' ? gameState.player1Name : 
                        playerRole === 'player2' ? gameState.player2Name : '';
      
      if (playerName) {
        restartGame();
      }
    }, 100);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-md p-8 max-w-md w-full flex flex-col items-center">
        <Trophy className={`h-16 w-16 ${isWinner ? 'text-yellow-400' : 'text-red-500'} mb-4 animate-bounce-soft`} />
        
        <h2 className="text-2xl font-bold mb-4">
          {isWinner ? 'Victory!' : 'Defeat!'}
        </h2>
        
        <p className="text-center mb-6">
          {isWinner 
            ? "Congratulations! You've captured the enemy lord and won the game." 
            : "Your lord has been captured. The enemy has won the game."
          }
        </p>
        
        <Button onClick={handlePlayAgain} className="w-32">
          Play Again
        </Button>
      </div>
    </div>
  );
};

export default VictoryScreen;
