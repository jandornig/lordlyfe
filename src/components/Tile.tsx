import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Tile as TileType } from '@/types/game';
import { useGame } from '@/contexts/GameContext';
import { Crown, Building2, Mountain } from 'lucide-react';
import { createPathMovements } from '@/lib/gameLogic';
import { showSupplyLineButton, hideSupplyLineButton, getCurrentSupplyLineButton } from '@/lib/supplyLine';
import SupplyLineButton from './SupplyLineButton';
import { queue } from '@/client/net/commandQueue';
import { createMoveCommand } from '@/core/gameState';

interface TileProps {
  tile: TileType;
  disablePropagation?: boolean;
  style?: React.CSSProperties;
}

const Tile: React.FC<TileProps> = ({ tile, disablePropagation = false, style }) => {
  const { gameState, selectTile, moveArmy, waypoints, setWaypoints } = useGame();
  const { selectedTile, minGarrison, territories, tiles } = gameState;
  const [mouseStartPos, setMouseStartPos] = useState<{ x: number, y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [, forceUpdate] = useState({}); // Used to trigger re-renders
  
  // Determine if this tile is adjacent to selectedTile
  const isAdjacent = useMemo(() => {
    if (!selectedTile) return false;
    
    return (
      (Math.abs(selectedTile.x - tile.x) === 1 && selectedTile.y === tile.y) ||
      (Math.abs(selectedTile.y - tile.y) === 1 && selectedTile.x === tile.x)
    );
  }, [selectedTile, tile]);

  // Check if this tile is on a territory border
  const isTerritoryBorder = useMemo(() => {
    const territory = territories.find(t => t.tiles.some(tile => tile.x === tile.x && tile.y === tile.y));
    if (!territory) return false;
    
    const neighbors = [
      tiles.find(t => t.x === tile.x - 1 && t.y === tile.y),
      tiles.find(t => t.x === tile.x + 1 && t.y === tile.y),
      tiles.find(t => t.x === tile.x && t.y === tile.y - 1),
      tiles.find(t => t.x === tile.x && t.y === tile.y + 1)
    ].filter(Boolean);
    
    return neighbors.some(neighbor => {
      const neighborTerritory = territories.find(t => t.tiles.some(tile => tile.x === neighbor?.x && tile.y === neighbor?.y));
      return neighborTerritory?.id !== territory.id;
    });
  }, [tile, tiles, territories]);

  // Determine if this tile can be moved to 
  const isValidTarget = useMemo(() => {
    // Only highlight if this is the player's selected tile
    if (!selectedTile) return false;
    if (selectedTile.owner !== 'player') return false;
    
    // Check if source has enough armies to move
    const availableArmy = selectedTile.owner ? 
      Math.max(0, selectedTile.armyCount - minGarrison) : selectedTile.armyCount;
    
    if (availableArmy <= 0) return false;
    
    // Only highlight the selected tile
    return selectedTile.x === tile.x && selectedTile.y === tile.y;
  }, [selectedTile, tile, minGarrison]);
  
  // Determine background color based on owner or territory
  const bgColor = useMemo(() => {
    const territory = territories.find(t => t.tiles.some(tile => tile.x === tile.x && tile.y === tile.y));
    
    if (tile.owner === 'player') return 'bg-player';
    if (tile.owner === 'ai') return 'bg-opponent';
    
    // If neutral, show territory color
    if (territory) {
      return `bg-[${territory.color}]`;
    }
    
    return 'bg-neutral bg-opacity-20';
  }, [tile, territories]);
  
  // Handle right click for waypoints
  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedTile) return;
    
    // Don't allow waypoints on the source or destination tile
    if ((selectedTile.x === tile.x && selectedTile.y === tile.y) || 
        (waypoints.length > 0 && waypoints[waypoints.length - 1].x === tile.x && waypoints[waypoints.length - 1].y === tile.y)) {
      return;
    }
    
    // Add the waypoint
    const newWaypoints = [...waypoints, { x: tile.x, y: tile.y }];
    console.log('Adding waypoint:', {
      currentWaypoints: waypoints,
      newWaypoint: { x: tile.x, y: tile.y },
      newWaypoints,
      selectedTile: selectedTile ? { x: selectedTile.x, y: selectedTile.y } : null,
      currentTile: { x: tile.x, y: tile.y }
    });
    setWaypoints(newWaypoints);
  };

  // Handle tile click
  const handleClick = (e: React.MouseEvent) => {
    // Prevent click if panning
    if (disablePropagation) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // Stop propagation to prevent panning when clicking on tiles
    e.stopPropagation();
    
    // If no tile is selected and this is player's tile with armies > 1, select it
    if (!selectedTile && tile.owner === 'player' && tile.armyCount > 1) {
      selectTile(tile);
      return;
    }
    
    // If a tile is already selected
    if (selectedTile) {
      // If clicking on the same tile
      if (selectedTile.x === tile.x && selectedTile.y === tile.y) {
        // If no waypoints, deselect
        if (waypoints.length === 0) {
          selectTile(null);
          return;
        }
        // If waypoints exist, treat it as a movement target
      }
      
      // If clicking on another tile with a selected tile, initiate movement
      if (selectedTile.owner === 'player') {
        // Get the current state of the selected tile
        const currentSelectedTile = gameState.tiles.find(t => 
          t.x === selectedTile.x && t.y === selectedTile.y
        );
        
        if (!currentSelectedTile) {
          console.log('Selected tile not found in current game state');
          return;
        }

        console.log('Creating movement with waypoints:', {
          from: currentSelectedTile,
          to: tile,
          waypoints,
          waypointsLength: waypoints.length,
          waypointsArray: Array.from(waypoints),
          currentState: {
            selectedTile: currentSelectedTile,
            currentTile: tile,
            waypoints
          }
        });

        const pathMovements = createPathMovements(gameState, currentSelectedTile, tile, 1, waypoints);
        
        if (pathMovements.length > 0) {
          console.log('Movement created with waypoints:', {
            movements: pathMovements,
            waypoints
          });
          const command = createMoveCommand('player', pathMovements);
          queue(command);
          moveArmy(pathMovements);
          selectTile(null);
          
          // Show supply line button at the endpoint
          showSupplyLineButton(tile);
        } else {
          console.log('Failed to create movement with waypoints:', {
            from: currentSelectedTile,
            to: tile,
            waypoints
          });
        }
        return;
      }
      
      // Otherwise, try to select this tile if it's the player's and has more than 1 army
      if (tile.owner === 'player' && tile.armyCount > 1) {
        selectTile(tile);
      } else {
        selectTile(null);
      }
    }
    
    // Hide supply line button on any click
    hideSupplyLineButton();
  };

  // Track mouse down position
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!disablePropagation) {
      setMouseStartPos({ x: e.clientX, y: e.clientY });
      setIsDragging(false);
    }
  };

  // Track mouse movement
  const handleMouseMove = (e: React.MouseEvent) => {
    if (mouseStartPos) {
      const dx = Math.abs(e.clientX - mouseStartPos.x);
      const dy = Math.abs(e.clientY - mouseStartPos.y);
      if (dx > 5 || dy > 5) {
        setIsDragging(true);
      }
    }
  };

  // Clear mouse position on mouse up
  const handleMouseUp = () => {
    setMouseStartPos(null);
    setIsDragging(false);
  };
  
  // Get inline style for territory color
  const getTileStyle = () => {
    if (tile.isMountain) return {};
    
    // Handle lord tiles first
    if (tile.isLord) {
      if (tile.owner === 'player') {
        return { backgroundColor: '#3B82F6' }; // Blue for player lord
      } else if (tile.owner === 'ai') {
        return { backgroundColor: '#EF4444' }; // Red for AI lord
      }
    }
    
    // If tile has a territory and we have territory data
    if (tile.territory !== null && territories && territories[tile.territory]) {
      const territoryColor = territories[tile.territory].color;
      
      // Convert hex colors to RGB
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      };

      // Convert RGB to HSL
      const rgbToHsl = (r: number, g: number, b: number) => {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r:
              h = (g - b) / d + (g < b ? 6 : 0);
              break;
            case g:
              h = (b - r) / d + 2;
              break;
            case b:
              h = (r - g) / d + 4;
              break;
          }
          h /= 6;
        }

        return { h, s, l };
      };

      // Convert HSL to RGB
      const hslToRgb = (h: number, s: number, l: number) => {
        let r, g, b;

        if (s === 0) {
          r = g = b = l;
        } else {
          const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };

          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1/3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1/3);
        }

        return {
          r: Math.round(r * 255),
          g: Math.round(g * 255),
          b: Math.round(b * 255)
        };
      };

      // Get the RGB values
      const rgb = hexToRgb(territoryColor);
      if (!rgb) return {};

      // Convert to HSL
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

      // Adjust lightness for border
      const borderHsl = { ...hsl, l: Math.max(0, hsl.l - 0.1) };
      const borderRgb = hslToRgb(borderHsl.h, borderHsl.s, borderHsl.l);

      return {
        backgroundColor: territoryColor,
        borderColor: `rgb(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b})`
      };
    }

    return {};
  };

  // Get tile color based on state
  const getTileColor = () => {
    if (tile.isMountain) return 'bg-mountain';
    if (tile.isLord) return tile.owner === 'player' ? 'bg-player' : 'bg-opponent';
    if (tile.isCity) return 'bg-city bg-opacity-30';
    if (tile.owner === 'player') return 'bg-player';
    if (tile.owner === 'ai') return 'bg-opponent';
    return 'bg-neutral bg-opacity-20';
  };

  // Get tile opacity based on state
  const getTileOpacity = () => {
    if (tile.isSelected) return 'opacity-100';
    if (tile.isHighlighted) return 'opacity-80';
    if (tile.isPath) return 'opacity-60';
    if (tile.isSupplyLine) return 'opacity-40';
    return 'opacity-20';
  };

  return (
    <div
      className={`relative w-12 h-12 border border-gray-700 ${getTileColor()} ${getTileOpacity()} transition-all duration-200 ${isTerritoryBorder ? 'border-2' : ''}`}
      style={getTileStyle()}
      onClick={handleClick}
      onContextMenu={handleRightClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Tile content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {tile.isLord && <Crown className="w-6 h-6 text-yellow-400" />}
        {tile.isCity && <Building2 className="w-6 h-6 text-gray-400" />}
        {tile.isMountain && <Mountain className="w-6 h-6 text-gray-600" />}
        {!tile.isLord && !tile.isCity && !tile.isMountain && tile.armyCount > 0 && (
          <span className="text-sm font-bold text-white">{tile.armyCount}</span>
        )}
      </div>

      {/* Supply line button */}
      <div className="relative w-full h-full">
        {getCurrentSupplyLineButton()?.x === tile.x && getCurrentSupplyLineButton()?.y === tile.y && (
          <SupplyLineButton x={tile.x} y={tile.y} />
        )}
      </div>
    </div>
  );
};

export default Tile;

