# Phase 1: Basic Multiplayer Foundation

## Overview
Phase 1 focuses on establishing the core multiplayer infrastructure, enabling multiple players to connect, join rooms, and see synchronized game states. This phase is crucial as it forms the foundation for all subsequent multiplayer features.

## 1. Player Identification & Session Management ✅

### 1.1 Player ID System ✅
- [x] **Server: Implement Server-Generated Player IDs (Supersedes client-side UUIDs)**
  - [x] On client connection or join/play request, server generates a unique `playerId`.
  - [x] Server maintains a mapping between `socket.id` and `playerId`.
  - [x] Server replies to the client, sending the assigned `playerId`.
- [x] **Client: Adopt Server-Generated Player ID**
  - [x] Remove client-side `playerId` (UUID) generation.
  - [x] Client requests (if necessary) and stores its server-assigned `playerId` (e.g., as `myPlayerId` in context).
- [x] Add player metadata
  - Player name/display name (Player provides this, associated with their `playerId`)
  - Connection timestamp
  - Last activity timestamp
- [x] UI Changes Required:
  - Add player name input field to game start page
    - Make it required before game start
    - Add validation (min/max length, allowed characters)
    - Show error messages for invalid input
  - Display player name in game UI
  - Add connection status indicator
  - Show player list in game (if multiple players)
  - Add basic player info tooltip/hover state
- [x] Testing:
  - Verify unique ID generation
  - Confirm ID persistence across reconnects
  - Test ID collision handling (Server ensures uniqueness)
  - Test UI responsiveness to connection changes
  - Verify player name display and updates
  - Test name validation and error messages

### 1.2 Session Management ✅
- [x] Implement session tracking
  - Create session storage system
  - Add session timeout handling
  - Implement session cleanup
- [x] Add connection state management
  - Track connected/disconnected states
  - Handle connection events
  - Implement basic error handling
- [x] Testing:
  - Verify session creation/deletion
  - Test timeout handling
  - Confirm cleanup of abandoned sessions

## 2. Matchmaking System ✅

### 2.1 Matchmaking Queue Implementation ✅
- [x] Implement matchmaking queue data structure
  - Queue ID generation
  - Queue metadata (player count, status, etc.)
  - Player capacity limits (initially 2, later 4-8)
- [x] Add queue management
  - Add player to queue
  - Remove player from queue
  - Handle queue full conditions
- [x] **Server: Implement Match Rooms**
  - [x] When a match is made, generate a unique `matchId` (e.g., UUID).
  - [x] Add both player sockets (identified by their `socket.id`) to a Socket.IO room named with `matchId`.
- [x] Testing:
  - [x] Verify queue functionality
  - [x] Test queue full handling
  - [x] Confirm game start when queue is full

### 2.2 Game Start Logic ✅
- [x] Implement game start logic
  - Check queue player count
  - Start game when queue is full
  - Handle game initialization
- [x] Add game start events
  - Notify players when game starts
  - Update game state
- [x] **Server: Broadcast Game State to Match Room**
  - [x] All game-specific state updates (e.g., `game-state-update`, `game-started`) are emitted only to the specific `matchId` room (e.g., `io.to(matchId).emit(...)`).
- [x] Testing:
  - [x] Verify game start logic
  - [x] Test game initialization
  - [x] Confirm player notifications (Clients in the room receive the broadcast)

### 2.3 Multiplayer Game Logic Modifications ✅
- [x] **Architecture: Implement Authoritative Server Model**
  - [x] Clients send only intent-based messages to the server (e.g., `intent-move` including `myPlayerId` and relevant action data).
  - [x] The server is the single source of truth for `gameState`.
  - [x] Server validates all client intents against the authoritative `gameState` and game rules.
  - [x] Server updates the authoritative `gameState` if an intent is valid.
  - [x] Clients do not modify their local game state optimistically; they only render the `gameState` received from server broadcasts.
- [x] **Client: Implement Player Role Detection (e.g., in GameContext)**
  - [x] Client stores its `myPlayerId` (received from the server, see 1.1).
  - [x] When a `gameState` is received from the server (this state will include `player1Id` and `player2Id` for the match):
    - [x] Determine and store the client's role for the current match: e.g., `role = (myPlayerId === gameState.player1Id) ? 'player1' : (myPlayerId === gameState.player2Id ? 'player2' : 'observer')`.
  - [x] Expose this `role` and the latest `gameState` via React context for UI components to use.
- [x] Update game initialization
  - [x] Modify createNewGame to support two players (Server initializes with `player1Id`, `player2Id`)
  - [x] Remove AI player initialization
  - [x] Add second player lord tile placement

## 3. Initial State Synchronization (In Progress)

### 3.1 Game State Modification
- [x] Update game state structure
  - [x] Add player-specific state tracking
  - [x] Modify existing state for multiplayer
  - [x] Implement state versioning
- [x] **Player-Specific Unit Focus and Control**
  - [x] **Implementation Plan:**
    1. **Game State Updates**
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

    2. **Server-Side Implementation**
       - [x] Modify `createNewGame` in `server/src/game/gameLogic.ts`:
         - Initialize empty `player1Units` and `player2Units` arrays
         - Set initial lord positions for both players
         - Create initial units for each player
       - [x] Update unit movement validation:
         - Add ownership checks in movement logic
         - Verify `controlledBy` matches acting player's ID
       - [x] Update game state broadcasting:
         - Ensure unit arrays are included in state updates
         - Add unit-specific events if needed

    3. **Client-Side Implementation**
       - [x] Update `GameContext` to handle player-specific units:
         - Add unit filtering based on player role
         - Add unit ownership checks
       - [x] Modify unit rendering:
         - Add visual indicators for owned units
         - Update unit selection logic
       - [x] Update movement handling:
         - Add ownership validation before sending moves
         - Update UI feedback for invalid moves
       - [x] Implement player-specific camera focus:
         - Add initial camera position based on player role
         - Focus camera on player's lord tile on game start
         - Add camera controls for each player independently
         - Ensure camera state doesn't affect other players
         - Note: Multiple re-renders during initialization are expected and don't affect functionality
         - Future optimization: Consider reducing re-renders by consolidating state updates

    4. **Testing & Validation**
       - [ ] Unit tests for:
         - Game state initialization
         - Unit ownership validation
         - Movement permissions
       - [ ] Integration tests for:
         - Player-specific unit tracking
         - Movement validation
         - State synchronization
       - [ ] Manual testing:
         - Verify unit ownership display
         - Test movement restrictions
         - Check state consistency
         - Verify camera focus works correctly for each player

### 3.2 State Broadcasting (In Progress)
- [x] Implement state update system
  - Add state change detection
  - Create state update messages
  - Implement broadcast logic
- [ ] Add state synchronization
  - Handle state updates
  - Implement state reconciliation
  - Add state compression
- [ ] Testing:
  - Verify state updates
  - Test synchronization
  - Confirm state consistency

### 3.3 Player-Specific State (In Progress)
- [x] Add player state tracking
  - Track player actions
  - Store player preferences
  - Handle player-specific data
- [ ] Implement state isolation
  - Separate player states
  - Handle state conflicts
  - Add state merging
- [ ] Update game mechanics
  - Modify army growth rates for multiplayer balance
  - Update victory conditions for PvP
  - Add real-time action indicators (if needed)
- [ ] Testing:
  - Verify player state tracking
  - Test state isolation
  - Confirm state merging

## Quality of Life Features (Future)
- [ ] Implement player reconnection handling
- [ ] Add player activity tracking
- [ ] Enhance error handling for connection issues
- [ ] Add player session persistence
- [ ] Implement player session recovery
- [ ] Add player session timeout UI feedback
- [ ] Optimize state updates to reduce re-renders
- [ ] Add performance monitoring for state updates

## Testing Milestones

### Milestone 1: Player System ✅
- [x] Multiple players can connect to the server
- [x] Each player has a unique, **server-assigned** identifier (`playerId`)
- [x] Sessions are properly tracked and managed (associating `socket.id` with `playerId`)
- [x] Connection/disconnection is handled gracefully

### Milestone 2: Room System ✅
- [x] Players can create and join rooms (Implicitly, server creates match rooms)
- [x] Room state is properly maintained (Authoritative `gameState` per match/room)
- [x] Players can leave rooms (Server handles disconnects from rooms)
- [x] Room cleanup works correctly
- [x] **Game broadcasts are isolated to match rooms.**

### Milestone 3: State Synchronization (In Progress)
- [x] All players in a room see the same **authoritative** game state
- [x] State updates are properly broadcast **to the correct room**
- [x] Player-specific states are maintained (Server tracks this, clients derive role)
- [x] State conflicts are resolved correctly (Server is authoritative, preventing conflicts)
- [x] **Clients correctly identify their role (Player 1/Player 2) based on `myPlayerId` and match data.**
- [x] **Client actions are processed as intents by the server.**
- [x] Player-specific unit tracking and control
- [x] Unit ownership validation and movement restrictions
- [x] Visual feedback for unit ownership and control
- [ ] Complete state synchronization testing
- [ ] Verify all player-specific features work correctly

## Next Steps After Phase 1
- [ ] Implement real-time, tick-based action processing for multiple players
- [ ] Add player action validation (server-side enforcement of valid actions per tick)
- [ ] Develop conflict resolution system for simultaneous actions (for PvP)
- [ ] Add player-specific state tracking and isolation

