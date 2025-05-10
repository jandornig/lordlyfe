import { ClientMessage, ServerMessage, GameState } from '../types/game';

type MessageHandler = (message: ServerMessage) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private currentPlayerId: string | null = null;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private lastError: Error | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private initializationTime: number = Date.now();
  private isInitialized: boolean = false;
  public onGameStateUpdate: ((state: GameState) => void) | null = null;

  constructor() {
    setTimeout(() => {
      this.initialize();
    }, 0);
  }

  private initialize() {
    this.isInitialized = false;
    this.connect();
  }

  private connect() {
    if (this.connectionState === 'connected') {
      return;
    }

    this.connectionState = 'connecting';
    
    try {
      const wsUrl = `ws://localhost:3002`;
      
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.addEventListener('open', () => {
        this.connectionState = 'connected';
        this.lastError = null;
        this.reconnectAttempts = 0;
        this.isInitialized = true;
        this.notifyHandlers({ 
          type: 'ROOM_JOINED',
          payload: {
            playerId: this.currentPlayerId || undefined,
            roomId: undefined
          }
        });
      });

      this.ws.addEventListener('close', (event) => {
        this.connectionState = 'disconnected';
        this.isInitialized = false;
        this.handleReconnect();
      });

      this.ws.addEventListener('error', (error) => {
        this.lastError = new Error('WebSocket error occurred');
        this.connectionState = 'error';
        this.isInitialized = false;
        this.notifyHandlers({ 
          type: 'ERROR',
          payload: { message: 'WebSocket connection error' }
        });
      });

      this.ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage;
          this.notifyHandlers(message);
        } catch (error) {
          this.notifyHandlers({ 
            type: 'ERROR',
            payload: { message: 'Error parsing message' }
          });
        }
      });
    } catch (error) {
      this.lastError = error as Error;
      this.connectionState = 'error';
      this.isInitialized = false;
      this.notifyHandlers({ 
        type: 'ERROR',
        payload: { message: 'Failed to create WebSocket connection' }
      });
      this.handleReconnect();
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = 1000 * Math.pow(2, this.reconnectAttempts);
      this.reconnectTimeout = setTimeout(() => this.connect(), delay);
    } else {
      this.connectionState = 'error';
      this.isInitialized = false;
      this.notifyHandlers({ 
        type: 'ERROR',
        payload: { message: 'Max reconnection attempts reached' }
      });
    }
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  private notifyHandlers(message: ServerMessage) {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  public joinRoom(name: string, addBot: boolean = false, roomId?: string): void {
    if (!this.isInitialized || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.notifyHandlers({ 
        type: 'ERROR',
        payload: { message: 'Cannot join room - WebSocket not initialized or connected' }
      });
      return;
    }

    const message: ClientMessage = {
      type: roomId ? 'JOIN_ROOM' : 'CREATE_ROOM',
      payload: {
        roomId,
        playerName: name
      }
    };

    this.ws.send(JSON.stringify(message));
  }

  public getState() {
    return {
      connectionState: this.connectionState,
      wsExists: this.ws !== null,
      wsReadyState: this.ws?.readyState,
      currentPlayerId: this.currentPlayerId,
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError?.message,
      age: `${((Date.now() - this.initializationTime) / 1000).toFixed(1)}s`,
      handlers: this.messageHandlers.size,
      isInitialized: this.isInitialized
    };
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connectionState = 'disconnected';
    this.isInitialized = false;
    this.currentPlayerId = null;
    this.lastError = null;
    this.reconnectAttempts = 0;
  }
}