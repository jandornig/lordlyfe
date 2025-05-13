import { io } from '../index';
import { gameStateManager } from './gameState';

interface QueuedPlayer {
  playerId: string;
  playerName: string;
  socketId: string;
}

class MatchmakingQueue {
  private queue: QueuedPlayer[] = [];
  private readonly MIN_PLAYERS = 2;
  private readonly MIN_WAIT_TIME = 1000; // 1 second minimum wait time

  constructor() {
    // Start the matchmaking loop
    setInterval(() => this.processQueue(), 1000);
  }

  addPlayer(player: QueuedPlayer) {
    console.log('Adding player to queue:', player);
    this.queue.push(player);
    io.to(player.socketId).emit('queue-status', { 
      status: 'waiting',
      position: this.queue.length,
      message: 'Waiting for opponent...'
    });
  }

  removePlayer(socketId: string) {
    console.log('Removing player from queue:', socketId);
    this.queue = this.queue.filter(p => p.socketId !== socketId);
  }

  private async processQueue() {
    if (this.queue.length >= this.MIN_PLAYERS) {
      // Get the first two players
      const player1 = this.queue.shift()!;
      const player2 = this.queue.shift()!;

      console.log('Match found:', { player1, player2 });

      // Notify both players that match is found
      io.to(player1.socketId).emit('match-found', { 
        status: 'found',
        message: 'Match found! Starting game...'
      });
      io.to(player2.socketId).emit('match-found', { 
        status: 'found',
        message: 'Match found! Starting game...'
      });

      // Wait for minimum wait time
      await new Promise(resolve => setTimeout(resolve, this.MIN_WAIT_TIME));

      // Start the game with both players
      const gameState = gameStateManager.initializeGame(
        30, 
        30, 
        player1.playerId, 
        player1.playerName,
        player2.playerId,
        player2.playerName
      );
      
      // Notify both players that game is starting
      io.to(player1.socketId).emit('game-started', gameState);
      io.to(player2.socketId).emit('game-started', gameState);
    }
  }
}

// Create a singleton instance
export const matchmakingQueue = new MatchmakingQueue(); 