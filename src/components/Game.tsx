import React, { useEffect, useState } from 'react';
import { GameState } from '../types/game';
import { fakeTransport } from '../client/net/fakeTransport';
import GameGrid from './GameGrid';
import GameControls from './GameControls';
import { useGame } from '../contexts/GameContext';
import { useSearchParams } from 'react-router-dom';

const Game: React.FC = () => {
  const { gameState: contextState, startGame } = useGame();
  const [authoritativeState, setAuthoritativeState] = useState<GameState>(contextState);
  const [progress, setProgress] = useState(0);
  const [searchParams] = useSearchParams();
  const playerName = searchParams.get('name') || 'Player';

  // Connect to fake transport and set up state listener
  useEffect(() => {
    // Connect to transport
    fakeTransport.connect();

    // Register state listener
    const cleanup = fakeTransport.onState((state, progress) => {
      setAuthoritativeState(state);
      setProgress(progress);
    });

    // Cleanup on unmount
    return () => {
      cleanup();
      fakeTransport.disconnect();
    };
  }, []);

  // Calculate interpolated positions for moving pieces
  const getInterpolatedPosition = (from: { x: number, y: number }, to: { x: number, y: number }) => {
    return {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress
    };
  };

  // Calculate countdown time remaining
  const getCountdownTime = () => {
    const remaining = Math.ceil((1 - progress) * 1000);
    return `${remaining}ms`;
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Game header with countdown */}
      <div className="flex items-center justify-between p-4 bg-gray-800">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-white">Grid Tactics Arena</h1>
          <span className="text-gray-300">Player: {playerName}</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-white">
            Turn in: {getCountdownTime()}
          </div>
          <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-100"
              style={{ 
                width: `${(1 - progress) * 100}%`,
                transition: 'width 100ms linear'
              }}
            />
          </div>
        </div>
      </div>

      {/* Main game area */}
      <div className="flex-1 relative">
        <GameGrid 
          state={authoritativeState} 
          getInterpolatedPosition={getInterpolatedPosition}
        />
      </div>

      {/* Game controls */}
      <div className="p-4 bg-gray-800">
        <GameControls />
      </div>
    </div>
  );
};

export default Game;
