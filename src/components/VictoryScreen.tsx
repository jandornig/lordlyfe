import React from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';

const VictoryScreen: React.FC = () => {
  const { state, restartGame } = useGame();
  const { winner } = state;
  
  if (!state.isGameOver) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-md p-8 max-w-md w-full flex flex-col items-center">
        <Trophy className={`h-16 w-16 ${winner === 'player' ? 'text-yellow-400' : 'text-red-500'} mb-4 animate-bounce-soft`} />
        
        <h2 className="text-2xl font-bold mb-4">
          {winner === 'player' ? 'Victory!' : 'Defeat!'}
        </h2>
        
        <p className="text-center mb-6">
          {winner === 'player' 
            ? "Congratulations! You've captured the enemy lord and won the game." 
            : "Your lord has been captured. The enemy has won the game."
          }
        </p>
        
        <Button onClick={restartGame} className="w-32">
          Play Again
        </Button>
      </div>
    </div>
  );
};

export default VictoryScreen;
