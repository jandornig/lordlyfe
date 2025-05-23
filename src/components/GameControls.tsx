
import React from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, RefreshCw } from 'lucide-react';
import { TickSpeed } from '@/types/game';

const GameControls: React.FC = () => {
  const { gameState, startGame, restartGame, togglePause, setTickSpeed } = useGame();
  
  const handleSpeedChange = (value: string) => {
    setTickSpeed(parseInt(value) as TickSpeed);
  };
  
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-gray-800 rounded-md">
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={restartGame}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Restart
        </Button>
        
        <Button
          variant="outline"
          onClick={togglePause}
          className="flex items-center gap-2"
        >
          {gameState.isPaused ? (
            <>
              <Play className="h-4 w-4" />
              Resume
            </>
          ) : (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          )}
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-300">Speed:</span>
        <Select 
          onValueChange={handleSpeedChange}
          defaultValue={gameState.tickSpeed.toString()}
          disabled={!gameState.isPaused}
        >
          <SelectTrigger className="w-24">
            <SelectValue placeholder="Speed" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="250">Fast</SelectItem>
            <SelectItem value="500">Normal</SelectItem>
            <SelectItem value="1000">Slow</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-player"></div>
          <span className="text-xs text-gray-300">You</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-opponent"></div>
          <span className="text-xs text-gray-300">AI</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-city bg-opacity-30"></div>
          <span className="text-xs text-gray-300">City</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-mountain"></div>
          <span className="text-xs text-gray-300">Mountain</span>
        </div>
      </div>
    </div>
  );
};

export default GameControls;
