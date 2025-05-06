import { describe, it, expect } from 'vitest';
import { GameState, Command, Tile, Movement } from '../types/game';
import { createGameState, createMoveCommand, applyCommands } from './gameState';

describe('Game State Integration', () => {
  it('should advance deterministically with identical commands', () => {
    // Create two separate initial states
    const initialState1 = createGameState(20, 20);
    const initialState2 = createGameState(20, 20);

    // Find the player's lord tile
    const playerLordTile1 = initialState1.tiles.find(t => t.isLord && t.owner === 'player')!;
    const aiLordTile1 = initialState1.tiles.find(t => t.isLord && t.owner === 'ai')!;

    // Create a sequence of commands to test
    const commands: Command[] = [
      createMoveCommand('player', [
        {
          from: playerLordTile1,
          to: initialState1.tiles[playerLordTile1.y * 20 + playerLordTile1.x + 1],
          count: 5
        }
      ]),
      createMoveCommand('ai', [
        {
          from: aiLordTile1,
          to: initialState1.tiles[aiLordTile1.y * 20 + aiLordTile1.x - 1],
          count: 5
        }
      ])
    ];

    // Advance both states through three turns with identical commands
    let state1 = initialState1;
    let state2 = initialState2;

    for (let turn = 0; turn < 3; turn++) {
      // Apply the same commands to both states
      state1 = applyCommands(state1, commands);
      state2 = applyCommands(state2, commands);

      // Assert states are identical after each turn
      expect(state1).toEqual(state2);
    }

    // Additional assertions about the final state
    expect(state1.tick).toBe(3);
    expect(state1.tiles).toHaveLength(400); // 20x20 grid
    expect(state1.movementQueue).toHaveLength(0); // All movements should be processed
  });

  it('should handle empty command sequences', () => {
    const initialState = createGameState(20, 20);
    const finalState = applyCommands(initialState, []);
    
    expect(finalState.tick).toBe(1);
    expect(finalState.movementQueue).toHaveLength(0);
  });

  it('should maintain state invariants after advancement', () => {
    const initialState = createGameState(20, 20);
    
    // Find the player's lord tile
    const playerLordTile = initialState.tiles.find(t => t.isLord && t.owner === 'player')!;
    const targetTile = initialState.tiles[playerLordTile.y * 20 + playerLordTile.x + 1];

    const commands: Command[] = [
      createMoveCommand('player', [
        {
          from: playerLordTile,
          to: targetTile,
          count: 5
        }
      ])
    ];

    const finalState = applyCommands(initialState, commands);

    // Check grid dimensions
    expect(finalState.width).toBe(20);
    expect(finalState.height).toBe(20);
    expect(finalState.tiles).toHaveLength(400);

    // Check tile properties
    finalState.tiles.forEach(tile => {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(20);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(20);
      expect(tile.armyCount).toBeGreaterThanOrEqual(0);
    });

    // Check territory properties
    finalState.territories.forEach(territory => {
      expect(territory.tiles).toBeDefined();
      expect(territory.color).toBeDefined();
      expect(territory.id).toBeDefined();
    });
  });
}); 