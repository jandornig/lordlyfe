import { GameState, Tile } from '../types/game';
import { socket } from '../services/socket';
import { Socket } from 'socket.io-client';

interface MovementRequest {
  from: { x: number, y: number };
  to: { x: number, y: number };
  waypoints: { x: number, y: number }[];
}

// Basic validation for movement
const isValidMovement = (fromTile: Tile, toTile: Tile): boolean => {
  console.log('Validating movement:', {
    from: {
      x: fromTile.x,
      y: fromTile.y,
      owner: fromTile.owner,
      army: fromTile.army,
      isLord: fromTile.isLord,
      isCity: fromTile.isCity
    },
    to: {
      x: toTile.x,
      y: toTile.y,
      owner: toTile.owner,
      army: toTile.army,
      isLord: toTile.isLord,
      isCity: toTile.isCity
    }
  });

  // Check if source tile has enough armies
  const hasEnoughArmies = fromTile.army > 1;
  if (!hasEnoughArmies) {
    console.log('Invalid movement: Source tile has insufficient armies', {
      fromTile: { x: fromTile.x, y: fromTile.y, army: fromTile.army }
    });
    return false;
  }

  // Check if target tile is not a mountain
  const isNotMountain = !toTile.isMountain;
  if (!isNotMountain) {
    console.log('Invalid movement: Target tile is a mountain', {
      toTile: { x: toTile.x, y: toTile.y }
    });
    return false;
  }

  return true;
};

export const requestMovement = async (
  gameState: GameState,
  fromTile: Tile,
  toTile: Tile,
  waypoints: { x: number, y: number }[]
): Promise<boolean> => {
  try {
    console.log('=== Movement Request ===', {
      from: { 
        x: fromTile.x, 
        y: fromTile.y, 
        army: fromTile.army, 
        owner: fromTile.owner,
        isLord: fromTile.isLord,
        isCity: fromTile.isCity
      },
      to: { 
        x: toTile.x, 
        y: toTile.y, 
        owner: toTile.owner,
        isLord: toTile.isLord,
        isCity: toTile.isCity
      },
      waypoints
    });

    // Basic validation
    if (!isValidMovement(fromTile, toTile)) {
      return false;
    }

    // Calculate armies to move (total - minGarrison)
    const armiesToMove = fromTile.army - gameState.minGarrison;

    console.log('Sending movement request:', {
      from: { 
        x: fromTile.x, 
        y: fromTile.y, 
      totalArmies: fromTile.army,
        isLord: fromTile.isLord,
        isCity: fromTile.isCity
      },
      to: { 
        x: toTile.x, 
        y: toTile.y,
        isLord: toTile.isLord,
        isCity: toTile.isCity
      },
      armiesToMove,
      waypoints
    });

    // Send movement request via WebSocket
    socket.emit('move-army', {
      movements: [{
        from: { x: fromTile.x, y: fromTile.y },
        to: { x: toTile.x, y: toTile.y },
        waypoints,
        armiesToMove
      }]
    });

    return true;
  } catch (error) {
    console.error('Error requesting movement:', error);
    return false;
  }
};

export const handleMoveArmy = (
  fromTile: Tile,
  toTile: Tile,
  gameState: GameState,
  socket: Socket
): void => {
  console.log('=== Movement Initiated ===');
  console.log('Game State:', {
    player1Id: gameState.player1Id,
    player2Id: gameState.player2Id,
    myPlayerId: socket.id
  });
  console.log('From Tile:', { 
    x: fromTile.x, 
    y: fromTile.y, 
    owner: fromTile.owner, 
    army: fromTile.army,
    isLord: fromTile.isLord,
    isCity: fromTile.isCity
  });
  console.log('To Tile:', { 
    x: toTile.x, 
    y: toTile.y, 
    owner: toTile.owner, 
    army: toTile.army,
    isLord: toTile.isLord,
    isCity: toTile.isCity
  });

  // Get player role and ID from socket ID
  const isPlayer1 = gameState.player1Id === socket.id;
  const isPlayer2 = gameState.player2Id === socket.id;
  const playerId = isPlayer1 ? gameState.player1Id : isPlayer2 ? gameState.player2Id : null;
  const isPlayerTile = (isPlayer1 && fromTile.owner === 'player1') || 
                      (isPlayer2 && fromTile.owner === 'player2');

  console.log('Ownership Check:', {
    isPlayer1,
    isPlayer2,
    isPlayerTile,
    tileOwner: fromTile.owner,
    expectedOwner: isPlayer1 ? 'player1' : 'player2',
    playerId
  });

  if (!isPlayerTile || !playerId) {
    console.log('Movement rejected: Not player tile or invalid player ID');
    return;
  }

  // Create movement request for server to process
  const movement = {
    from: { x: fromTile.x, y: fromTile.y },
    to: { x: toTile.x, y: toTile.y },
    waypoints: [],
    armiesToMove,
    playerId
  };

  console.log('Created movement request:', movement);

  // Send movement request to server
  socket.emit('move-army', {
    movements: [movement]
  });
}; 