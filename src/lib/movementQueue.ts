import { GameState, Movement } from '../types/game';
import { createPathMovements } from './gameLogic';

export const enqueueMovement = (
  gameState: GameState,
  armyId: string,
  path: { x: number; y: number }[]
): void => {
  if (path.length === 0) return;

  const army = gameState.armies.find(a => a.id === armyId);
  if (!army) return;

  const startTile = gameState.tiles.find(
    t => t.x === army.position.x && t.y === army.position.y
  );
  if (!startTile) return;

  const endTile = gameState.tiles.find(
    t => t.x === path[path.length - 1].x && t.y === path[path.length - 1].y
  );
  if (!endTile) return;

  const movements = createPathMovements(
    gameState,
    startTile,
    endTile,
    1,
    path.slice(0, -1) // All points except the last one are waypoints
  );

  if (movements.length > 0) {
    gameState.movementQueue.push(...movements);
  }
}; 