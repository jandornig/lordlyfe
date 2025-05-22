import React from 'react';
import { useGame } from '@/contexts/GameContext';
import { GAME_VERSION } from '@/lib/constants';

const GameStatus: React.FC = () => {
  const { gameState, playerRole } = useGame();
  
  // Count army totals for each player
  const armyTotals = gameState.tiles.reduce(
    (acc, tile) => {
      if (tile.owner === 'player1') {
        acc.player1 += tile.army;
      } else if (tile.owner === 'player2') {
        acc.player2 += tile.army;
      }
      return acc;
    },
    { player1: 0, player2: 0 }
  );
  
  // Count territory tiles for each player
  const territoryCount = gameState.tiles.reduce(
    (acc, tile) => {
      if (tile.owner === 'player1') {
        acc.player1 += 1;
      } else if (tile.owner === 'player2') {
        acc.player2 += 1;
      }
      return acc;
    },
    { player1: 0, player2: 0 }
  );
  
  // Determine which stats to show based on player role
  const isPlayer1 = playerRole === 'player1';
  const myArmy = isPlayer1 ? armyTotals.player1 : armyTotals.player2;
  const myTerritory = isPlayer1 ? territoryCount.player1 : territoryCount.player2;
  const opponentArmy = isPlayer1 ? armyTotals.player2 : armyTotals.player1;
  const opponentTerritory = isPlayer1 ? territoryCount.player2 : territoryCount.player1;
  
  return (
    <div className="flex justify-between items-center bg-gray-800 rounded-md p-4 text-sm gap-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <div className="text-player font-semibold">Your Army:</div>
        <div className="text-right">{myArmy}</div>
        
        <div className="text-player font-semibold">Your Territory:</div>
        <div className="text-right">{myTerritory}</div>
      </div>
      
      <div className="text-center">
        <div className="text-gray-400 mb-1">Tick</div>
        <div className="text-xl font-bold text-white">{gameState.tick}</div>
        <div className="text-sm font-medium text-gray-300 mt-1">v{GAME_VERSION}</div>
      </div>
      
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <div className="text-opponent font-semibold">Player 2:</div>
        <div className="text-right">{opponentArmy}</div>
        
        <div className="text-opponent font-semibold">Player 2 Territory:</div>
        <div className="text-right">{opponentTerritory}</div>
      </div>
    </div>
  );
};

export default GameStatus;
