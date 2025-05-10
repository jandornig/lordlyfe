export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: any) => void)[] = [];
  private connectHandlers: (() => void)[] = [];
  private disconnectHandlers: (() => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private playerId: string | null = null;

  constructor() {
    // Don't connect immediately in constructor
    // Let the component control when to connect
  }

  setPlayerId(id: string) {
    console.log('[WebSocketService] Setting player ID:', id);
    this.playerId = id;
  }

  // Game action functions
  selectTile(x: number, y: number) {
    if (!this.playerId) {
      console.error('[WebSocketService] Cannot select tile: no player ID');
      return;
    }
    console.log('[WebSocketService] Selecting tile:', { x, y });
    const message = {
      type: 'SELECT_TILE',
      payload: {
        playerId: this.playerId,
        action: {
          type: 'SELECT_TILE',
          data: { x, y },
          timestamp: Date.now()
        }
      }
    };
    console.log('[WebSocketService] Sending SELECT_TILE message:', message);
    this.send(message);
  }

  moveArmy(from: { x: number, y: number }, to: { x: number, y: number }) {
    if (!this.playerId) {
      console.error('[WebSocketService] Cannot move army: no player ID');
      return;
    }
    console.log('[WebSocketService] Moving army:', { from, to });
    this.send({
      type: 'MOVE_ARMY',
      payload: {
        playerId: this.playerId,
        action: {
          type: 'MOVE_ARMY',
          data: { from, to },
          timestamp: Date.now()
        }
      }
    });
  }

  togglePause() {
    if (!this.playerId) {
      console.error('[WebSocketService] Cannot toggle pause: no player ID');
      return;
    }
    console.log('[WebSocketService] Toggling pause');
    this.send({
      type: 'TOGGLE_PAUSE',
      payload: {
        playerId: this.playerId,
        action: {
          type: 'TOGGLE_PAUSE',
          data: {},
          timestamp: Date.now()
        }
      }
    });
  }

  // Room management functions
  createRoom() {
    console.log('[WebSocketService] Creating room');
    this.send({ 
      type: 'CREATE_ROOM',
      payload: {
        playerName: 'Player',
        addBot: true
      }
    });
  }

  startGame() {
    console.log('[WebSocketService] Starting game');
    this.send({
      type: 'START_GAME',
      payload: {}
    });
  }

  joinRoom(playerName: string, addBot: boolean, roomId?: string) {
    console.log('[WebSocketService] Joining room', { playerName, addBot, roomId });
    this.send({ 
      type: 'JOIN_ROOM',
      payload: {
        playerName,
        addBot,
        roomId
      }
    });
  }

  leaveRoom() {
    console.log('[WebSocketService] Leaving room');
    this.send({ type: 'LEAVE_ROOM', payload: null });
  }

  connect() {
    if (this.isConnecting) {
      console.log('[WebSocketService] Already connecting');
      return;
    }

    this.isConnecting = true;
    console.log('[WebSocketService] Connecting...');

    try {
      const wsUrl = `ws://localhost:8081`;
      console.log('[WebSocketService] Connecting to:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocketService] Connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        // Send a test message to verify connection
        const testMessage = {
          type: 'TEST_CONNECTION',
          payload: {
            timestamp: Date.now()
          }
        };
        console.log('[WebSocketService] Sending test message:', testMessage);
        this.send(testMessage);
        this.connectHandlers.forEach(handler => handler());
      };

      this.ws.onclose = (event) => {
        console.log('[WebSocketService] Disconnected:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        this.isConnecting = false;
        this.cleanup();
        this.attemptReconnect();
        this.disconnectHandlers.forEach(handler => handler());
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocketService] WebSocket error:', error);
        this.isConnecting = false;
        this.cleanup();
        this.attemptReconnect();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[WebSocketService] Raw message received:', event.data);
          console.log('[WebSocketService] Parsed message:', message);

          // Handle test connection response
          if (message.type === 'TEST_CONNECTION_RESPONSE') {
            console.log('[WebSocketService] Test connection successful:', message.payload);
            return;
          }

          // Handle error messages
          if (message.type === 'ERROR') {
            console.error('[WebSocketService] Server error:', message.payload);
            return;
          }

          // Handle ROOM_JOINED message
          if (message.type === 'ROOM_JOINED' && message.payload?.playerId) {
            console.log('[WebSocketService] Setting player ID:', message.payload.playerId);
            this.setPlayerId(message.payload.playerId);
          }
          // Handle GAME_STATE message
          else if (message.type === 'GAME_STATE' && message.payload?.state) {
            const gameState = message.payload.state;
            console.log('[WebSocketService] Game state received:', {
              hasTiles: !!gameState.tiles,
              tileCount: gameState.tiles?.length,
              firstTile: gameState.tiles?.[0],
              hasTerritories: !!gameState.territories,
              territoryCount: gameState.territories?.length
            });

            // If we don't have a player ID yet, try to find it in the game state
            if (!this.playerId) {
              const lordTiles = gameState.tiles?.filter((tile: any) => tile.isLord) || [];
              console.log('[WebSocketService] Found lord tiles:', lordTiles.map((tile: any) => ({
                x: tile.x,
                y: tile.y,
                owner: tile.owner,
                isLord: tile.isLord
              })));

              const playerLord = lordTiles.find((tile: any) => 
                tile.isLord && tile.owner === 'player1'
              );

              if (playerLord) {
                console.log('[WebSocketService] Found player lord tile:', {
                  x: playerLord.x,
                  y: playerLord.y,
                  owner: playerLord.owner
                });
                this.setPlayerId('player1');
              } else {
                console.log('[WebSocketService] No player lord tile found in game state');
              }
            }
          }

          this.messageHandlers.forEach(handler => handler(message));
        } catch (error) {
          console.error('[WebSocketService] Error parsing message:', error);
        }
      };

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          console.log('[WebSocketService] Connection timeout');
          this.isConnecting = false;
          this.cleanup();
          this.attemptReconnect();
        }
      }, 5000);
    } catch (error) {
      console.error('[WebSocketService] Error creating WebSocket:', error);
      this.isConnecting = false;
      this.cleanup();
      this.attemptReconnect();
    }
  }

  private cleanup() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        console.error('[WebSocketService] Error closing WebSocket:', error);
      }
      this.ws = null;
    }
    this.isConnecting = false;
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocketService] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[WebSocketService] Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  disconnect() {
    console.log('[WebSocketService] Disconnecting WebSocket');
    this.cleanup();
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify(message);
        console.log('[WebSocketService] Sending raw message:', messageStr);
        this.ws.send(messageStr);
      } catch (error) {
        console.error('[WebSocketService] Error sending message:', error);
        this.cleanup();
        this.attemptReconnect();
      }
    } else {
      console.warn('[WebSocketService] Cannot send message, WebSocket not connected:', {
        readyState: this.ws?.readyState,
        isConnecting: this.isConnecting
      });
    }
  }

  onMessage(handler: (message: any) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  onConnect(handler: () => void) {
    this.connectHandlers.push(handler);
    return () => {
      this.connectHandlers = this.connectHandlers.filter(h => h !== handler);
    };
  }

  onDisconnect(handler: () => void) {
    this.disconnectHandlers.push(handler);
    return () => {
      this.disconnectHandlers = this.disconnectHandlers.filter(h => h !== handler);
    };
  }

  getState() {
    return {
      connectionState: this.ws ? 
        this.ws.readyState === WebSocket.OPEN ? 'connected' :
        this.ws.readyState === WebSocket.CONNECTING ? 'connecting' :
        'disconnected' : 'disconnected',
      reconnectAttempts: this.reconnectAttempts,
      isConnecting: this.isConnecting
    };
  }
} 