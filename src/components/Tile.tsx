import React from 'react';
import { useGame } from '@/contexts/GameContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { Crown, Building2, Mountain } from 'lucide-react';

interface TileProps {
  x: number;
  y: number;
}

export const Tile: React.FC<TileProps> = ({ x, y }) => {
  const { state } = useGame();
  const { wsService } = useWebSocket();
  const tile = state.tiles.find(t => t.x === x && t.y === y);

  if (!tile) {
    console.error(`[Tile] No tile found at position:`, { x, y });
    return null;
  }

  const handleClick = () => {
    if (state.selectedTile) {
      // If a tile is already selected, try to move army
      wsService.moveArmy(
        { x: state.selectedTile.x, y: state.selectedTile.y },
        { x, y }
      );
    } else {
      // Otherwise select this tile
      wsService.selectTile(x, y);
    }
  };

  const isSelected = state.selectedTile?.x === x && state.selectedTile?.y === y;
  const isAdjacent = state.selectedTile && (
    Math.abs(state.selectedTile.x - x) <= 1 &&
    Math.abs(state.selectedTile.y - y) <= 1
  );

  const getTileClasses = () => {
    const baseClasses = "w-10 h-10 flex items-center justify-center relative cursor-pointer transition-all duration-200";
    const borderClasses = isSelected 
      ? "border-2 border-yellow-400" 
      : isAdjacent 
        ? "border-2 border-green-400" 
        : "border border-gray-700";
    
    let bgClasses = "";
    if (tile.isMountain) {
      bgClasses = "bg-mountain";
    } else if (tile.isLord) {
      if (tile.owner === 'player') {
        bgClasses = "bg-lord-player";
      } else if (tile.owner === 'ai') {
        bgClasses = "bg-lord-opponent";
      } else {
        bgClasses = "bg-lord-neutral";
      }
    } else if (tile.isCity) {
      if (tile.owner === 'player') {
        bgClasses = "bg-city-player";
      } else if (tile.owner === 'ai') {
        bgClasses = "bg-city-opponent";
      } else {
        bgClasses = "bg-city-neutral";
      }
    } else if (tile.territory !== null) {
      // Get territory color from the territories array
      const territory = state.territories[tile.territory];
      if (territory) {
        // Use the territory's color directly
        return `${baseClasses} ${borderClasses}`;
      }
    }

    return `${baseClasses} ${borderClasses} ${bgClasses}`;
  };

  const getTileStyle = () => {
    if (tile.territory !== null && !tile.isMountain && !tile.isLord && !tile.isCity) {
      const territory = state.territories[tile.territory];
      if (territory) {
        return {
          backgroundColor: territory.color
        };
      }
    }
    return {};
  };

  return (
    <div
      onClick={handleClick}
      className={getTileClasses()}
      style={getTileStyle()}
    >
      {tile.isLord && (
        <div className="absolute top-1 left-1">
          <Crown className="w-4 h-4 text-yellow-400" />
        </div>
      )}
      {tile.isCity && !tile.isLord && (
        <div className="absolute top-1 left-1">
          <Building2 className="w-4 h-4 text-gray-200" />
        </div>
      )}
      {tile.isMountain && (
        <div className="absolute top-1 left-1">
          <Mountain className="w-4 h-4 text-gray-400" />
        </div>
      )}
      {tile.army > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-bold text-sm drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
            {Math.floor(tile.army)}
          </span>
        </div>
      )}
    </div>
  );
};

export default Tile;

