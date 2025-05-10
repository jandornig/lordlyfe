import React from 'react';
import { useGame } from '@/contexts/GameContext';
import { GAME_VERSION } from '@/lib/gameLogic';

const GameStatus: React.FC = () => {
  const { state } = useGame();
  
  // Count army totals for each player
  const armyTotals = state.tiles.reduce(
    (acc, tile) => {
      if (tile.owner === 'player') {
        acc.player += tile.army;
      } else if (tile.owner === 'ai') {
        acc.ai += tile.army;
      }
      return acc;
    },
    { player: 0, ai: 0 }
  );
  
  // Count territory tiles for each player
  const territoryCount = state.tiles.reduce(
    (acc, tile) => {
      if (tile.owner === 'player') {
        acc.player += 1;
      } else if (tile.owner === 'ai') {
        acc.ai += 1;
      }
      return acc;
    },
    { player: 0, ai: 0 }
  );
  
  return (
    <div className="flex justify-between items-center bg-gray-800 rounded-md p-4 text-sm gap-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <div className="text-player font-semibold">Your Army:</div>
        <div className="text-right">{armyTotals.player}</div>
        
        <div className="text-player font-semibold">Your Territory:</div>
        <div className="text-right">{territoryCount.player}</div>
      </div>
      
      <div className="text-center">
        <div className="text-gray-400 mb-1">Tick</div>
        <div className="text-xl font-bold text-white">{state.tick}</div>
        <div className="text-sm font-medium text-gray-300 mt-1">v{GAME_VERSION}</div>
      </div>
      
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <div className="text-opponent font-semibold">AI Army:</div>
        <div className="text-right">{armyTotals.ai}</div>
        
        <div className="text-opponent font-semibold">AI Territory:</div>
        <div className="text-right">{territoryCount.ai}</div>
      </div>
    </div>
  );
};

export default GameStatus;
