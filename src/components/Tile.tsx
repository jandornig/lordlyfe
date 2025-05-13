import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Tile as TileType } from '@/types/game';
import { useGame } from '@/contexts/GameContext';
import { Crown, Building2, Mountain } from 'lucide-react';
import { requestMovement } from '@/lib/movement';
import { showSupplyLineButton, hideSupplyLineButton, getCurrentSupplyLineButton } from '@/lib/supplyLine';
import SupplyLineButton from './SupplyLineButton';

interface TileProps {
  tile: TileType;
  disablePropagation?: boolean;
}

const Tile: React.FC<TileProps> = ({ tile, disablePropagation = false }) => {
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
    if (!tile.territory) return false;
    
    const neighbors = [
      tiles.find(t => t.x === tile.x - 1 && t.y === tile.y),
      tiles.find(t => t.x === tile.x + 1 && t.y === tile.y),
      tiles.find(t => t.x === tile.x && t.y === tile.y - 1),
      tiles.find(t => t.x === tile.x && t.y === tile.y + 1)
    ].filter(Boolean);
    
    return neighbors.some(neighbor => neighbor?.territory !== tile.territory);
  }, [tile, tiles]);

  // Determine if this tile can be selected
  const canSelect = useMemo(() => {
    return tile.owner === 'player' && tile.army > 1;
  }, [tile]);
  
  // Determine background color based on owner or territory
  const bgColor = useMemo(() => {
    if (tile.isMountain) return 'bg-mountain';
    if (tile.owner === 'player') return 'bg-player';
    if (tile.owner === 'ai') return 'bg-opponent';
    
    // If neutral, show territory color
    if (tile.territory !== null && territories && territories[tile.territory]) {
      return `bg-[${territories[tile.territory].color}]`;
    }
    
    if (tile.isCity) return 'bg-city bg-opacity-30';
    return 'bg-neutral bg-opacity-20';
  }, [tile, territories]);
  
  // Handle right click for waypoints
  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedTile || tile.isMountain) return;
    
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
  const handleClick = async (e: React.MouseEvent) => {
    // Log raw click event
    console.log('=== Raw Click Event ===', {
      target: e.target,
      currentTarget: e.currentTarget,
      clientX: e.clientX,
      clientY: e.clientY,
      timeStamp: e.timeStamp,
      type: e.type
    });

    // Prevent click if panning
    if (disablePropagation) {
      console.log('Click prevented due to panning');
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // Stop propagation to prevent panning when clicking on tiles
    e.stopPropagation();
    
    console.log('Click handler state:', {
      selectedTile: selectedTile ? {
        x: selectedTile.x,
        y: selectedTile.y,
        army: selectedTile.army,
        owner: selectedTile.owner
      } : null,
      clickedTile: {
        x: tile.x,
        y: tile.y,
        army: tile.army,
        owner: tile.owner,
        isMountain: tile.isMountain
      },
      canSelect,
      waypoints
    });
    
    // If no tile is selected and this is player's tile with armies > 1, select it
    if (!selectedTile && canSelect) {
      console.log('Selecting tile:', {
        x: tile.x,
        y: tile.y,
        army: tile.army,
        owner: tile.owner,
        type: tile.isLord ? 'lord' : tile.isCity ? 'city' : 'territory'
      });
      selectTile(tile);
      return;
    }
    
    // If a tile is already selected
    if (selectedTile) {
      console.log('Processing click with selected tile:', {
        selectedTile: {
          x: selectedTile.x,
          y: selectedTile.y,
          army: selectedTile.army,
          owner: selectedTile.owner
        },
        clickedTile: {
          x: tile.x,
          y: tile.y,
          army: tile.army,
          owner: tile.owner
        }
      });

      // If clicking on the same tile
      if (selectedTile.x === tile.x && selectedTile.y === tile.y) {
        console.log('Clicked on same tile, deselecting');
        // If no waypoints, deselect
        if (waypoints.length === 0) {
          selectTile(null);
          return;
        }
        // If waypoints exist, treat it as a movement target
      }
      
      // If clicking on another tile with a selected tile, initiate movement
      if (selectedTile.owner === 'player') {
        console.log('Attempting movement from player tile');
        // Get the current state of the selected tile
        const currentSelectedTile = gameState.tiles.find(t => 
          t.x === selectedTile.x && t.y === selectedTile.y
        );
        
        if (!currentSelectedTile) {
          console.log('Selected tile not found in current game state');
          return;
        }

        console.log('Initiating movement:', {
          from: {
            x: currentSelectedTile.x,
            y: currentSelectedTile.y,
            army: currentSelectedTile.army,
            owner: currentSelectedTile.owner
          },
          to: {
            x: tile.x,
            y: tile.y,
            army: tile.army,
            owner: tile.owner
          },
          waypoints,
          waypointsLength: waypoints.length
        });

        const success = await requestMovement(gameState, currentSelectedTile, tile, waypoints);
        
        if (success) {
          console.log('Movement request sent successfully');
          selectTile(null);
        } else {
          console.log('Movement request failed');
        }
        return;
      }
      
      // Otherwise, try to select this tile if it's the player's and has more than 1 army
      if (canSelect) {
        console.log('Selecting new tile:', {
          x: tile.x,
          y: tile.y,
          army: tile.army,
          owner: tile.owner
        });
        selectTile(tile);
      } else {
        console.log('Deselecting tile - clicked tile not selectable');
        selectTile(null);
      }
    }
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
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }

        return { h: h * 360, s: s * 100, l: l * 100 };
      };

      // Convert HSL to RGB
      const hslToRgb = (h: number, s: number, l: number) => {
        h /= 360;
        s /= 100;
        l /= 100;
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

      const territoryRgb = hexToRgb(territoryColor);
      const ownerColor = tile.owner === 'player' ? '#3B82F6' : '#EF4444'; // Blue for player, Red for AI
      const ownerRgb = hexToRgb(ownerColor);
      
      if (territoryRgb && ownerRgb) {
        // Convert territory color to HSL to get its base hue
        const territoryHsl = rgbToHsl(territoryRgb.r, territoryRgb.g, territoryRgb.b);
        
        // Convert owner color to HSL to get its hue for variation
        const ownerHsl = rgbToHsl(ownerRgb.r, ownerRgb.g, ownerRgb.b);
        
        // Calculate territory-specific hue variation
        const territoryIndex = tile.territory || 0;
        const totalTerritories = territories?.length || 1;
        const hueSpan = 30; // ±15 degrees variation
        const hueOffset = (territoryIndex / (totalTerritories - 1) - 0.5) * hueSpan;
        
        // Create the final color based on ownership
        const finalHsl = {
          h: tile.owner ? 
            (ownerHsl.h + hueOffset + 360) % 360 : // For captured territories, use owner's hue
            (territoryHsl.h + hueOffset + 360) % 360, // For neutral territories, use territory's base hue
          s: tile.owner ? 80 : 50, // High saturation for captured, medium for neutral
          l: tile.owner ? 30 : 80  // Dark for captured, light for neutral
        };
        
        // Add slight variation to captured territories' lightness
        if (tile.owner) {
          finalHsl.l += (territoryIndex % 3 - 1) * 5; // Add ±5 lightness variation
        }
        
        // Convert back to RGB
        const finalRgb = hslToRgb(finalHsl.h, finalHsl.s, finalHsl.l);
        
        return { backgroundColor: `rgb(${finalRgb.r}, ${finalRgb.g}, ${finalRgb.b})` };
      }
      
      // Handle non-territory owned tiles
      if (tile.owner === 'player') {
        return { backgroundColor: '#3B82F6' }; // Blue for player
      } else if (tile.owner === 'ai') {
        return { backgroundColor: '#EF4444' }; // Red for AI
      }
      
      return {};
    }
    
    return {};
  };
  
  // Determine if this tile is a waypoint
  const isWaypoint = useMemo(() => {
    return waypoints.some(wp => wp.x === tile.x && wp.y === tile.y);
  }, [waypoints, tile.x, tile.y]);

  // Get tile color based on visibility and other properties
  const getTileColor = () => {
    if (!tile.isVisible) {
      return '#808080'; // Grey for hidden tiles
    }
    
    // For visible tiles, use the original territory/owner colors
    if (tile.isMountain) {
      return '#4A4A4A';
    }
    
    if (tile.owner === 'player') {
      return '#3B82F6'; // Blue for player
    } else if (tile.owner === 'ai') {
      return '#EF4444'; // Red for AI
    }
    
    // For neutral tiles, use territory color if available
    if (tile.territory !== null && territories && territories[tile.territory]) {
      return territories[tile.territory].color;
    }
    
    return '#FFFFFF';
  };

  // Get tile opacity based on visibility
  const getTileOpacity = () => {
    if (!tile.isVisible) {
      return 0.5; // Semi-transparent for hidden tiles
    }
    return 1;
  };

  return (
    <div
      className={`
        relative aspect-square 
        ${!tile.owner && tile.isMountain ? 'bg-mountain' : ''}
        ${!tile.owner && tile.isCity && !tile.isMountain ? 'bg-city bg-opacity-30' : ''}
        ${!tile.owner && !tile.isCity && !tile.isMountain ? 'bg-neutral bg-opacity-20' : ''}
        ${canSelect ? 'ring-2 ring-highlight cursor-pointer' : ''} 
        ${selectedTile && selectedTile.x === tile.x && selectedTile.y === tile.y ? 'ring-2 ring-yellow-400' : ''}
        ${isTerritoryBorder ? 'border border-gray-500' : ''}
        ${isWaypoint ? 'ring-2 ring-yellow-400' : ''}
        transition-all duration-150 hover:opacity-90
        flex items-center justify-center
        ${tile.owner ? 'text-white' : 'text-gray-300'}
        ${(tile.owner === 'player' && tile.army > 0) ? 'cursor-pointer' : ''}
      `}
      style={{
        backgroundColor: getTileColor(),
        opacity: getTileOpacity(),
        cursor: tile.owner === 'player' && tile.army > 1 ? 'pointer' : 'default'
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleRightClick}
    >
      {/* Army count */}
      {tile.isVisible && !tile.isMountain && tile.army > 0 && (
        <span className={`text-sm font-bold z-10 ${
          tile.owner === 'player' ? 'text-white' : 
          tile.owner === 'ai' ? 'text-gray-900' : 
          'text-gray-800'
        }`}>{tile.army}</span>
      )}
      
      {/* Lord indicator */}
      {tile.isVisible && tile.isLord && (
        <div className="absolute top-0 left-0 p-0.5">
          <Crown 
            className={`h-3 w-3 ${
              tile.owner === 'player' ? 'text-yellow-300' : 
              tile.owner === 'ai' ? 'text-red-300' : 
              'text-black'
            }`} 
          />
        </div>
      )}
      
      {/* City indicator */}
      {tile.isVisible && tile.isCity && (
        <div className="absolute top-0 right-0 p-0.5">
          <Building2 className={`h-3 w-3 ${tile.owner ? 'text-gray-300' : 'text-black'}`} />
        </div>
      )}
      
      {/* Mountain indicator */}
      {tile.isMountain && (
        <Mountain className="w-4 h-4 text-gray-400" />
      )}
      
      {/* Waypoint indicator */}
      {tile.isVisible && isWaypoint && (
        <div className="absolute top-0 right-0 p-0.5">
          <div className="w-2 h-2 bg-yellow-400 rounded-full" />
        </div>
      )}
    </div>
  );
};

export default Tile;

