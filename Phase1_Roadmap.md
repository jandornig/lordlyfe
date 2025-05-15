# Phase 1: Basic Multiplayer Foundation

## Overview
Phase 1 focuses on establishing the core multiplayer infrastructure, enabling multiple players to connect, join rooms, and see synchronized game states. This phase is crucial as it forms the foundation for all subsequent multiplayer features.

## 1. Player Identification & Session Management

### 1.1 Player ID System
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

### 1.2 Session Management
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

## 2. Matchmaking System

### 2.1 Matchmaking Queue Implementation
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
- [ ] Testing:
  - [x] Verify queue functionality
  - [x] Test queue full handling
  - [x] Confirm game start when queue is full

### 2.2 Game Start Logic
- [x] Implement game start logic
  - Check queue player count
  - Start game when queue is full
  - Handle game initialization
- [x] Add game start events
  - Notify players when game starts
  - Update game state
- [x] **Server: Broadcast Game State to Match Room**
  - [x] All game-specific state updates (e.g., `game-state-update`, `game-started`) are emitted only to the specific `matchId` room (e.g., `io.to(matchId).emit(...)`).
- [ ] Testing:
  - [x] Verify game start logic
  - [x] Test game initialization
  - Confirm player notifications (Clients in the room receive the broadcast)

### 2.3 Multiplayer Game Logic Modifications
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
- [ ] Update game initialization
  - [x] Modify createNewGame to support two players (Server initializes with `player1Id`, `player2Id`)
  - [x] Remove AI player initialization
  - Add second player lord tile placement
  - Update territory distribution for two players
- [ ] Update game state management
  - Modify GameState to track both players
  - Update player turn handling
  - Add player-specific game state tracking
- [ ] Update game mechanics
  - Modify army growth rates for multiplayer balance
  - Update victory conditions for PvP
  - Add player turn indicators
- [ ] Testing:
  - [x] Verify two-player game initialization
  - Test player turn handling
  - Confirm victory conditions
  - Test game state synchronization (Clients in room receive authoritative state; roles determine perspective)

## 3. Initial State Synchronization
*(Note: Many aspects of this section will be addressed by the Authoritative Server Model and Match Room Broadcasting outlined in Section 2. The server sending the complete, authoritative state to the room upon game start and after each validated intent is the core of state synchronization.)*

### 3.1 Game State Modification
- [ ] Update game state structure
  - Add player-specific state tracking
  - Modify existing state for multiplayer
  - Implement state versioning
- [ ] Add state validation
  - Verify state consistency
  - Handle state conflicts
  - Implement state recovery
- [ ] Testing:
  - Verify state structure
  - Test state validation
  - Confirm state recovery

### 3.2 State Broadcasting
- [ ] Implement state update system
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

### 3.3 Player-Specific State
- [ ] Add player state tracking
  - Track player actions
  - Store player preferences
  - Handle player-specific data
- [ ] Implement state isolation
  - Separate player states
  - Handle state conflicts
  - Add state merging
- [ ] Testing:
  - Verify player state tracking
  - Test state isolation
  - Confirm state merging

## Testing Milestones

### Milestone 1: Player System
- Multiple players can connect to the server
- Each player has a unique, **server-assigned** identifier (`playerId`)
- Sessions are properly tracked and managed (associating `socket.id` with `playerId`)
- Connection/disconnection is handled gracefully

### Milestone 2: Room System
- Players can create and join rooms (Implicitly, server creates match rooms)
- Room state is properly maintained (Authoritative `gameState` per match/room)
- Players can leave rooms (Server handles disconnects from rooms)
- Room cleanup works correctly
- **Game broadcasts are isolated to match rooms.**

### Milestone 3: State Synchronization
- All players in a room see the same **authoritative** game state
- State updates are properly broadcast **to the correct room**
- Player-specific states are maintained (Server tracks this, clients derive role)
- State conflicts are resolved correctly (Server is authoritative, preventing conflicts)
- **Clients correctly identify their role (Player 1/Player 2) based on `myPlayerId` and match data.**
- **Client actions are processed as intents by the server.**

## Implementation Notes

### Technical Considerations
- Use Socket.IO rooms for efficient broadcasting
- Implement proper error handling throughout
- Add logging for debugging
- Consider performance implications
- Plan for scalability

### Security Considerations
- Validate all incoming data
- Implement rate limiting
- Add basic input sanitization
- Consider future authentication needs

### Performance Considerations
- Optimize state updates
- Implement state compression
- Add connection quality handling
- Consider bandwidth usage

## Next Steps After Phase 1
- [ ] Implement turn-based mechanics (player turn handling, turn indicators)
- [ ] Add player action validation (server-side turn enforcement)
- [ ] Develop conflict resolution system (for PvP)
- [ ] Add player-specific state tracking and isolation

### Quality of Life Features
- [ ] Implement player reconnection handling
- [ ] Add player activity tracking
- [ ] Enhance error handling for connection issues
- [ ] Add player session persistence
- [ ] Implement player session recovery
- [ ] Add player session timeout UI feedback
- [ ] Test player reconnection scenarios
- [ ] Verify player session persistence
- [ ] Test player session recovery
- [ ] Verify player session timeout handling