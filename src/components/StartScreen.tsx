import React, { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface StartScreenProps {
  onStart: (playerName: string) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');

  const validateName = (name: string): boolean => {
    if (!name) {
      setError('Name is required');
      return false;
    }
    if (name.length > 10) {
      setError('Name must be 10 characters or less');
      return false;
    }
    if (!/^[a-zA-Z0-9]+$/.test(name)) {
      setError('Name can only contain letters and numbers');
      return false;
    }
    setError('');
    return true;
  };

  const handleStartGame = () => {
    if (validateName(playerName)) {
      onStart(playerName);
    }
  };

  return (
    <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center z-10">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Grid Tactics</h1>
        <p className="text-gray-400">A strategic conquest game</p>
      </div>
      
      <div className="bg-gray-800 rounded-md p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-center">How to Play</h2>
        
        <ul className="space-y-3 mb-6 text-sm text-gray-300">
          <li className="flex gap-2">
            <span className="text-player">◆</span>
            <span>Click on your tiles to select them, then click on adjacent tiles to move armies.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-player">◆</span>
            <span>Lord tiles (with crown icon) gain +2 armies each tick.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-player">◆</span>
            <span>Cities (with building icon) gain +1 army each tick.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-player">◆</span>
            <span>Capture the enemy lord to win the game.</span>
          </li>
        </ul>
        
        <div className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Enter your name (max 10 characters)"
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                if (error) validateName(e.target.value);
              }}
              maxLength={10}
              className="w-full text-gray-800"
            />
            {error && (
              <p className="text-red-500 text-sm mt-1">{error}</p>
            )}
          </div>
          
          <Button 
            onClick={handleStartGame} 
            className="w-full"
            disabled={!!error}
          >
          Start Game
        </Button>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;
