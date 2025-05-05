import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGame } from '@/contexts/GameContext';
import { Tile as TileType } from '@/types/game';
import TileComponent from '@/components/Tile';

const GameGrid: React.FC = () => {
  const { gameState, selectTile, setWaypoints } = useGame();
  const { width, height, tiles } = gameState;
  
  // State for panning
  const [isPanning, setIsPanning] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [startPanPos, setStartPanPos] = useState({ x: 0, y: 0 });
  const [hasPanned, setHasPanned] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  
  // State for zooming
  const [zoomLevel, setZoomLevel] = useState({ scale: 1 });
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectTile(null);
        setWaypoints([]);
      } else if (e.key.toLowerCase() === 'q') {
        // Clear movement queue and stop all armies
        gameState.movementQueue = [];
        // Force a re-render
        setWaypoints([]);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectTile, setWaypoints, gameState]);
  
  // Calculate tile size based on available viewport size
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${width}, 1fr)`,
    gridTemplateRows: `repeat(${height}, 1fr)`,
    gap: '2px',
    width: '100%',
    height: '100%',
    transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel.scale})`,
    transformOrigin: 'center',
    cursor: isPanning ? 'grabbing' : 'grab',
    transition: isPanning ? 'none' : 'transform 0.1s ease-out',
  };
  
  // Center view on player's lord tile when game starts
  useEffect(() => {
    if (gameState.tick === 0) {
      const playerLord = tiles.find(tile => tile.isLord && tile.owner === 'player');
      if (playerLord && gridRef.current) {
        const gridRect = gridRef.current.getBoundingClientRect();
        const tileSize = gridRect.width / width;
        const centerX = (gridRect.width / 2) - ((playerLord.x + 0.5) * tileSize);
        const centerY = (gridRect.height / 2) - ((playerLord.y + 0.5) * tileSize) - (gridRect.height * 0.1); // Adjust vertical offset
        setPanPosition({ x: centerX, y: centerY });
      }
    }
  }, [gameState.tick, tiles, width]);
  
  // Handle mouse events for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      setHasPanned(false);
      setStartPanPos({
        x: e.clientX - panPosition.x,
        y: e.clientY - panPosition.y,
      });
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    
    const newX = e.clientX - startPanPos.x;
    const newY = e.clientY - startPanPos.y;
    
    // Check if we've actually moved the grid
    if (Math.abs(newX - panPosition.x) > 1 || Math.abs(newY - panPosition.y) > 1) {
      setHasPanned(true);
    }
    
    setPanPosition({ x: newX, y: newY });
  };
  
  const handleMouseUp = () => {
    setIsPanning(false);
  };
  
  // Handle wheel events for zooming
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    // Determine zoom direction and calculate new scale
    const zoomDirection = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = 0.1; // 10% zoom per wheel tick
    const newScale = Math.max(0.5, Math.min(3, zoomLevel.scale + (zoomDirection * zoomFactor)));
    
    // Update zoom level
    setZoomLevel({ scale: newScale });
  }, [zoomLevel.scale]);
  
  // Add global event listeners
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsPanning(false);
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    
    // Add wheel event listener for zooming
    const currentGridRef = gridRef.current;
    if (currentGridRef) {
      currentGridRef.addEventListener('wheel', handleWheel, { passive: false });
    }
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      if (currentGridRef) {
        currentGridRef.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel]);
  
  return (
    <div 
      className="w-full h-full overflow-hidden bg-gray-900 p-2 rounded-md"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      ref={gridRef}
    >
      <div style={gridStyle}>
        {tiles.map((tile) => (
          <TileComponent
            key={`${tile.x},${tile.y}`}
            tile={tile}
            disablePropagation={isPanning || hasPanned}
          />
        ))}
      </div>
    </div>
  );
};

export default GameGrid;
