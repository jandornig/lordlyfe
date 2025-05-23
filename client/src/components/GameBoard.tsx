import React, { useRef, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { Tile } from '../../../shared/types/game';

const TILE_SIZE = 40; // Size of each tile in pixels
const VIEWPORT_WIDTH = 800; // Width of the viewport
const VIEWPORT_HEIGHT = 600; // Height of the viewport

export const GameBoard: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    gameState,
    handleTileClick,
    handleTileRightClick,
    cameraPosition,
    playerRole,
    playerUnits,
    opponentUnits
  } = useGame();

  // Draw the game board
  useEffect(() => {
    if (!gameState || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate visible area based on camera position
    const startX = Math.max(0, Math.floor(cameraPosition.x - VIEWPORT_WIDTH / (2 * TILE_SIZE)));
    const startY = Math.max(0, Math.floor(cameraPosition.y - VIEWPORT_HEIGHT / (2 * TILE_SIZE)));
    const endX = Math.min(gameState.width, Math.ceil(cameraPosition.x + VIEWPORT_WIDTH / (2 * TILE_SIZE)));
    const endY = Math.min(gameState.height, Math.ceil(cameraPosition.y + VIEWPORT_HEIGHT / (2 * TILE_SIZE)));

    // Draw visible tiles
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = gameState.tiles[y * gameState.width + x];
        if (!tile.isVisible) continue;

        // Calculate screen position
        const screenX = (x - cameraPosition.x) * TILE_SIZE + VIEWPORT_WIDTH / 2;
        const screenY = (y - cameraPosition.y) * TILE_SIZE + VIEWPORT_HEIGHT / 2;

        // Draw tile background
        ctx.fillStyle = getTileColor(tile);
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

        // Draw tile border
        ctx.strokeStyle = '#000';
        ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

        // Draw army count
        if (tile.army > 0) {
          ctx.fillStyle = '#000';
          ctx.font = '16px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tile.army.toString(), screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2);
        }

        // Draw unit ownership indicator
        const unit = [...playerUnits, ...opponentUnits].find(u => 
          u.position.x === tile.x && u.position.y === tile.y
        );
        if (unit) {
          ctx.fillStyle = unit.owner === playerRole ? '#00ff00' : '#ff0000';
          ctx.beginPath();
          ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [gameState, cameraPosition, playerRole, playerUnits, opponentUnits]);

  // Handle click events
  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!gameState || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert screen coordinates to tile coordinates
    const tileX = Math.floor((x - VIEWPORT_WIDTH / 2) / TILE_SIZE + cameraPosition.x);
    const tileY = Math.floor((y - VIEWPORT_HEIGHT / 2) / TILE_SIZE + cameraPosition.y);

    // Get the clicked tile
    const tile = gameState.tiles[tileY * gameState.width + tileX];
    if (tile) {
      if (event.button === 0) { // Left click
        handleTileClick(tile);
      } else if (event.button === 2) { // Right click
        handleTileRightClick(tile);
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={VIEWPORT_WIDTH}
      height={VIEWPORT_HEIGHT}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        handleClick(e);
      }}
      style={{ border: '1px solid #000' }}
    />
  );
};

// Helper function to get tile color
const getTileColor = (tile: Tile): string => {
  if (tile.isMountain) return '#808080';
  if (tile.isCity) return '#FFD700';
  if (tile.isLord) return '#FF0000';
  if (tile.owner === 'player1') return '#0000FF';
  if (tile.owner === 'player2') return '#FF0000';
  return '#FFFFFF';
}; 