# Next Steps

## Immediate Priority: Player-Specific Unit Focus and Control

### 1. Game State Updates ✅
- [x] Update `GameState` interface in `shared/types/game.ts`:
  ```typescript
  interface GameState {
    // ... existing fields ...
    player1Units: Unit[];
    player2Units: Unit[];
  }
  ```
- [x] Update `Unit` interface:
  ```typescript
  interface Unit {
    id: string;
    controlledBy: string;  // player1Id or player2Id
    position: { x: number; y: number };
    armySize: number;
    owner: Owner;
  }
  ```

### 2. Server-Side Implementation ✅
- [x] Modify `createNewGame` in `server/src/game/gameLogic.ts`:
  - [x] Initialize empty `player1Units` and `player2Units` arrays
  - [x] Set initial lord positions for both players
  - [x] Create initial units for each player
- [x] Update unit movement validation:
  - [x] Add ownership checks in movement logic
  - [x] Verify `controlledBy` matches acting player's ID
- [x] Update game state broadcasting:
  - [x] Ensure unit arrays are included in state updates
  - [x] Add unit-specific events if needed

### 3. Client-Side Implementation ✅
- [x] Update `GameContext` to handle player-specific units:
  - [x] Add unit filtering based on player role
  - [x] Add unit ownership checks
- [x] Modify unit rendering:
  - [x] Add visual indicators for owned units
  - [x] Update unit selection logic
- [x] Update movement handling:
  - [x] Add ownership validation before sending moves
  - [x] Update UI feedback for invalid moves
- [x] Implement player-specific camera focus:
  - [x] Add initial camera position based on player role
  - [x] Focus camera on player's lord tile on game start
  - [x] Add camera controls for each player independently
  - [x] Ensure camera state doesn't affect other players

### 4. Testing & Validation
- [ ] Unit tests for:
  - [ ] Game state initialization
  - [ ] Unit ownership validation
  - [ ] Movement permissions
- [ ] Integration tests for:
  - [ ] Player-specific unit tracking
  - [ ] Movement validation
  - [ ] State synchronization
- [ ] Manual testing:
  - [ ] Verify unit ownership display
  - [ ] Test movement restrictions
  - [ ] Check state consistency
  - [ ] Verify camera focus works correctly for each player

## Future Considerations
- Real-time, tick-based action processing for multiple players
- Player action validation (server-side enforcement)
- Conflict resolution system for simultaneous actions
- Player-specific state tracking and isolation
