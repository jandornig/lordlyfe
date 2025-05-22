# Next Steps - Bug Fixes

## 1. Path Selection Issues ✓
- [x] Fix path selection interference with camera panning
  - [x] Prevent path endpoint selection during camera panning
  - [x] Add proper click vs drag detection
  - [x] Ensure path selection only triggers on intentional clicks
  - [x] Add minimum drag distance threshold for panning

## 2. Victory/Defeat State Handling ✓
- [x] Fix victory/defeat popup logic
  - [x] Ensure correct popup shows for each player based on their role
  - [x] Player 1 should see "Defeated" when their lord is captured
  - [x] Player 2 should see "Victory" when capturing Player 1's lord
  - [x] Add proper state checks for victory/defeat conditions
  - [x] Verify popup triggers only for the affected player

## 3. Game Balance ✓
- [x] Fix starting army balance
  - [x] Ensure Player 2's lord tile starts with same army size as Player 1 (10 armies)
  - [x] Verify army initialization in game state
  - [x] Add validation for equal starting conditions
  - [x] Test game start with multiple players to confirm balance

## 4. UI Text Updates
- [x] Update UI text references
  - [x] Change "AI Army" to "Player 2" in top UI element
  - [x] Review and update any remaining AI references
  - [x] Ensure consistent player naming throughout UI
  - [x] Verify text updates in all game states
- [ ] Fix inconsistent army labels
  - [ ] Change "Your Army" to "Player 1 Army" for consistency
  - [ ] Update territory labels to match army label style
  - [ ] Ensure consistent naming across all UI elements

## 5. Movement Queue Controls ✓
- [x] Fix movement queue clearing functionality
  - [x] Implement 'q' key handler to clear player's movement queue
  - [x] Ensure queue clearing only affects current player's movements
  - [x] Add visual feedback when queue is cleared
  - [x] Verify queue clearing works in all game states

## 6. Matchmaking Flow
- [x] Fix "Play Again" functionality
  - [x] Ensure players re-enter matchmaking queue after game end
  - [x] Add proper state cleanup after game end
  - [x] Add loading state while waiting for opponent
  - [x] Test reconnection scenarios
- [ ] Fix single player game start (especially after play again button)
  - [ ] Add validation to prevent game start with single player
  - [ ] Implement proper matchmaking queue checks
  - [ ] Add server-side validation for minimum player count
  - [ ] Test matchmaking flow with various player counts

## 7. Code Improvements
- [ ] Refactor starting army configuration
  - [ ] Create a single constant for starting army size
  - [ ] Update all references to use this constant
  - [ ] Add validation to ensure both players use same starting army size
  - [ ] Document the configuration in code comments

## 8. Camera System
- [ ] Fix camera flickering issues
  - [ ] Add logging for non-player camera movements
  - [ ] Track camera movement triggers
  - [ ] Identify and fix sources of unwanted camera updates
  - [ ] Implement debouncing for camera position updates
  - [ ] Add camera movement validation
