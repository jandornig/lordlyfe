import { GameState, Tile, Territory, ClientMessage } from '../types/game.js';
import { WebSocket } from 'ws';

export class GameStateManager {
  private state: GameState;
  private updateInterval: NodeJS.Timeout | null = null;
  private gameTickInterval: NodeJS.Timeout | null = null;
  private lastGameTick: number = 0;
  private clients: Set<WebSocket> = new Set();
  private readonly UPDATE_INTERVAL = 200; // 200ms for state updates
  private readonly GAME_TICK_INTERVAL = 1000; // 1000ms for game ticks
  private pendingActions: Map<string, any[]> = new Map(); // Store actions between ticks
  private isGameStarted: boolean = false;

  constructor(width: number = 30, height: number = 30) {
    console.log('[GameStateManager] Initializing with dimensions:', { width, height });
    this.state = this.initializeGame(width, height);
  }

  public startGame(): void {
    if (this.isGameStarted) {
      console.log('[GameStateManager] Game already started');
      return;
    }
    console.log('[GameStateManager] Starting game');
    this.isGameStarted = true;
    this.startGameLoop();
  }

  private initializeGame(width: number, height: number): GameState {
    console.log('[GameStateManager] Creating new game state');
    const tiles: Tile[] = [];
    const territories = new Map<string, Territory>();

    // Create basic grid
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tiles.push({
          x,
          y,
          owner: null,
          army: 0,
          isLord: false,
          isCity: false,
          isMountain: false
        });
      }
    }

    // Place player lords
    this.placeLord(tiles, 0, 0, 'player1');
    this.placeLord(tiles, width - 1, height - 1, 'player2');

    // Place some cities and mountains
    this.placeRandomCities(tiles, 5);
    this.placeRandomMountains(tiles, 10);

    console.log('[GameStateManager] Game state initialized:', {
      width,
      height,
      totalTiles: tiles.length,
      player1Lord: tiles.find(t => t.isLord && t.owner === 'player1'),
      player2Lord: tiles.find(t => t.isLord && t.owner === 'player2'),
      cities: tiles.filter(t => t.isCity).length,
      mountains: tiles.filter(t => t.isMountain).length
    });

    return {
      width,
      height,
      tiles,
      selectedTile: null,
      isPaused: false,
      tickCount: 0,
      currentPlayer: undefined, // No current player in simultaneous play
      territories
    };
  }

  private placeLord(tiles: Tile[], x: number, y: number, owner: 'player1' | 'player2'): void {
    const tile = tiles.find(t => t.x === x && t.y === y);
    if (tile) {
      tile.isLord = true;
      tile.owner = owner;
      tile.army = 10;
      console.log(`[GameStateManager] Placed ${owner} lord at:`, { x, y });
    }
  }

  private placeRandomCities(tiles: Tile[], count: number): void {
    for (let i = 0; i < count; i++) {
      const availableTiles = tiles.filter(t => !t.isLord && !t.isCity && !t.isMountain);
      if (availableTiles.length > 0) {
        const randomTile = availableTiles[Math.floor(Math.random() * availableTiles.length)];
        randomTile.isCity = true;
        randomTile.army = 5;
        console.log('[GameStateManager] Placed city at:', { x: randomTile.x, y: randomTile.y });
      }
    }
  }

  private placeRandomMountains(tiles: Tile[], count: number): void {
    for (let i = 0; i < count; i++) {
      const availableTiles = tiles.filter(t => !t.isLord && !t.isCity && !t.isMountain);
      if (availableTiles.length > 0) {
        const randomTile = availableTiles[Math.floor(Math.random() * availableTiles.length)];
        randomTile.isMountain = true;
        console.log('[GameStateManager] Placed mountain at:', { x: randomTile.x, y: randomTile.y });
      }
    }
  }

  private startGameLoop(): void {
    console.log('[GameStateManager] Starting game loops:', {
      updateInterval: this.UPDATE_INTERVAL,
      gameTickInterval: this.GAME_TICK_INTERVAL
    });

    // State update loop (200ms)
    this.updateInterval = setInterval(() => {
      this.broadcastState();
    }, this.UPDATE_INTERVAL);

    // Game tick loop (1000ms)
    this.gameTickInterval = setInterval(() => {
      if (!this.state.isPaused) {
        this.processGameTick();
        this.lastGameTick = Date.now();
      }
    }, this.GAME_TICK_INTERVAL);
  }

  private processGameTick(): void {
    this.state.tickCount++;
    console.log(`[GameStateManager] Processing game tick ${this.state.tickCount}`);

    // Process all pending actions
    this.processPendingActions();

    // Process each tile
    this.state.tiles.forEach(tile => {
      if (tile.owner && !tile.isMountain) {
        // Generate armies
        if (tile.isLord) {
          tile.army += 2;
        } else if (tile.isCity) {
          tile.army += 1;
        } else {
          tile.army += 0.5;
        }
        tile.army = Math.floor(tile.army);
      }
    });

    // Update territories
    this.updateTerritories();
  }

  private processPendingActions(): void {
    console.log('[GameStateManager] Processing pending actions:', {
      playerCount: this.pendingActions.size,
      totalActions: Array.from(this.pendingActions.values()).reduce((sum, actions) => sum + actions.length, 0)
    });

    // Process all pending actions for each player
    this.pendingActions.forEach((actions, playerId) => {
      actions.forEach(action => {
        this.processAction(action);
      });
    });
    // Clear all pending actions after processing
    this.pendingActions.clear();
  }

  private processAction(action: any): void {
    const { type, payload } = action;
    console.log('[GameStateManager] Processing action:', { type, playerId: payload.playerId });

    switch (type) {
      case 'SELECT_TILE':
        this.handleTileSelection(payload);
        break;
      case 'MOVE_ARMY':
        this.handleArmyMovement(payload);
        break;
      case 'TOGGLE_PAUSE':
        this.handlePauseToggle(payload);
        break;
      default:
        console.warn('[GameStateManager] Unknown action type:', type);
    }
  }

  private handleTileSelection(payload: any): void {
    console.log('[GameStateManager] Handling tile selection:', payload);
    const { playerId, action } = payload;
    if (!playerId || !action || !action.data) {
      console.error('[GameStateManager] Invalid tile selection payload:', payload);
      return;
    }

    const { x, y } = action.data;
    console.log('[GameStateManager] Player selecting tile:', { playerId, x, y });

    // Find the selected tile
    const selectedTile = this.state.tiles.find(t => t.x === x && t.y === y);
    if (!selectedTile) {
      console.error('[GameStateManager] Tile not found:', { x, y });
      return;
    }

    // Update the selected tile in the game state
    this.state.selectedTile = selectedTile;
    console.log('[GameStateManager] Tile selected:', {
      x: selectedTile.x,
      y: selectedTile.y,
      owner: selectedTile.owner,
      isLord: selectedTile.isLord,
      isCity: selectedTile.isCity,
      army: selectedTile.army
    });

    // Broadcast the updated state
    this.broadcastState();
  }

  private handleArmyMovement(payload: any): void {
    const { playerId, action } = payload;
    const { from, to } = action.data;
    console.log('[GameStateManager] Player moving army:', { playerId, from, to });

    // Find source and destination tiles
    const fromTile = this.state.tiles.find(t => t.x === from.x && t.y === from.y);
    const toTile = this.state.tiles.find(t => t.x === to.x && t.y === to.y);

    if (!fromTile || !toTile) {
      console.error('[GameStateManager] Source or destination tile not found:', { from, to });
      return;
    }

    // Check if player owns the source tile
    if (fromTile.owner !== playerId) {
      console.error('[GameStateManager] Player does not own source tile:', { playerId, fromTile });
      return;
    }

    // Move armies
    const armiesToMove = Math.floor(fromTile.army / 2);
    fromTile.army -= armiesToMove;
    toTile.army += armiesToMove;

    // If destination is unowned, capture it
    if (!toTile.owner) {
      toTile.owner = playerId;
    }

    console.log('[GameStateManager] Army movement completed:', {
      from: { x: fromTile.x, y: fromTile.y, army: fromTile.army },
      to: { x: toTile.x, y: toTile.y, army: toTile.army, owner: toTile.owner }
    });

    // Broadcast the updated state
    this.broadcastState();
  }

  private handlePauseToggle(payload: any): void {
    const { playerId } = payload;
    console.log('[GameStateManager] Player toggling pause:', { playerId });
    this.state.isPaused = !this.state.isPaused;
  }

  private updateTerritories(): void {
    // Basic territory update logic
    // This will be expanded later
    console.log('[GameStateManager] Updating territories');
  }

  public addClient(client: WebSocket): void {
    this.clients.add(client);
    console.log('[GameStateManager] New client connected, total clients:', this.clients.size);
    this.sendStateToClient(client);
  }

  public removeClient(client: WebSocket): void {
    this.clients.delete(client);
    console.log('[GameStateManager] Client disconnected, remaining clients:', this.clients.size);
  }

  private sendStateToClient(client: WebSocket): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'GAME_STATE',
        payload: { state: this.state }
      }));
    }
  }

  private broadcastState(): void {
    console.log('[GameStateManager] Broadcasting state:', {
      clientCount: this.clients.size,
      selectedTile: this.state.selectedTile ? {
        x: this.state.selectedTile.x,
        y: this.state.selectedTile.y,
        owner: this.state.selectedTile.owner
      } : null,
      isPaused: this.state.isPaused,
      tickCount: this.state.tickCount
    });

    const message = {
      type: 'GAME_STATE',
      payload: {
        state: this.state
      }
    };

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          console.error('[GameStateManager] Error sending state to client:', error);
        }
      }
    });
  }

  public handleMessage(message: ClientMessage): void {
    console.log('[GameStateManager] Handling message:', {
      type: message.type,
      payload: message.payload
    });
    
    // Handle CREATE_ROOM message
    if (message.type === 'CREATE_ROOM') {
      const { playerName, addBot } = message.payload;
      console.log('[GameStateManager] Creating room:', { playerName, addBot });
      return;
    }

    // Handle START_GAME message
    if (message.type === 'START_GAME') {
      console.log('[GameStateManager] Starting game');
      this.startGame();
      return;
    }
    
    if (!message.payload?.playerId || !message.payload?.action) {
      console.error('[GameStateManager] Message missing required fields:', {
        payload: message.payload
      });
      return;
    }

    // Process the action immediately
    switch (message.type) {
      case 'SELECT_TILE': {
        console.log('[GameStateManager] Processing SELECT_TILE message:', message.payload);
        const { playerId, action } = message.payload;
        const { x, y } = action.data;
        
        // Find the selected tile
        const selectedTile = this.state.tiles.find(t => t.x === x && t.y === y);
        if (!selectedTile) {
          console.error('[GameStateManager] Tile not found:', { x, y });
          return;
        }

        // Update the selected tile in the game state
        this.state.selectedTile = selectedTile;
        console.log('[GameStateManager] Tile selected:', {
          x: selectedTile.x,
          y: selectedTile.y,
          owner: selectedTile.owner,
          isLord: selectedTile.isLord,
          isCity: selectedTile.isCity,
          army: selectedTile.army
        });

        // Broadcast the updated state
        this.broadcastState();
        break;
      }
      case 'MOVE_ARMY':
        this.handleArmyMovement(message.payload);
        break;
      case 'TOGGLE_PAUSE':
        this.handlePauseToggle(message.payload);
        break;
      default:
        console.warn('[GameStateManager] Unknown message type:', message.type);
    }
  }

  public cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.gameTickInterval) {
      clearInterval(this.gameTickInterval);
      this.gameTickInterval = null;
    }
    console.log('[GameStateManager] Cleaned up game loops');
  }
} 