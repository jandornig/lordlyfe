import { GameState, Tile } from '@/types/game';
import { socket } from '@/services/socket';

interface MovementRequest {
  from: { x: number, y: number };
  to: { x: number, y: number };
  waypoints: { x: number, y: number }[];
}

// Basic validation for movement
const isValidMovement = (fromTile: Tile, toTile: Tile): boolean => {
  // Check if source tile has enough armies
  const hasEnoughArmies = fromTile.army > 1;

  // Check if source tile belongs to player
  const isPlayerTile = fromTile.owner === 'player';

  // Check if target tile is not a mountain
  const isNotMountain = !toTile.isMountain;

  return hasEnoughArmies && isPlayerTile && isNotMountain;
};

export const requestMovement = async (
  gameState: GameState,
  fromTile: Tile,
  toTile: Tile,
  waypoints: { x: number, y: number }[]
): Promise<boolean> => {
  try {
    // Basic validation
    if (!isValidMovement(fromTile, toTile)) {
      console.error('Invalid movement: source tile must have more than 1 army and target must not be a mountain');
      return false;
    }

    // Calculate available armies (total - 1 for garrison)
    const availableArmies = fromTile.army - 1;
    const armyPercentage = availableArmies / fromTile.army;

    console.log('Movement request:', {
      from: fromTile,
      to: toTile,
      totalArmies: fromTile.army,
      availableArmies,
      armyPercentage
    });

    // Send movement request via WebSocket
    socket.emit('move-army', {
      movements: [{
        from: { x: fromTile.x, y: fromTile.y },
        to: { x: toTile.x, y: toTile.y },
        waypoints,
        armyPercentage
      }]
    });

    return true;
  } catch (error) {
    console.error('Error requesting movement:', error);
    return false;
  }
}; 