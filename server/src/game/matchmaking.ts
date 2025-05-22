import { io } from '../index';
import { gameStateManager } from './gameState';
import { v4 as uuidv4 } from 'uuid';
import { socketMatchMap } from '../index';

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

      const matchId = uuidv4();
      console.log(`Match found: ${matchId}`, { player1, player2 });

      // Have players join the room
      const socket1 = io.sockets.sockets.get(player1.socketId);
      const socket2 = io.sockets.sockets.get(player2.socketId);

      if (socket1) {
        socket1.join(matchId);
        socketMatchMap.set(socket1.id, matchId);
        console.log(`Player ${player1.playerId} (socket ${player1.socketId}) joined match room ${matchId}`);
        // Inform server logic of match membership
        socket1.emit('join-match-room', { matchId });
      } else {
        console.error(`Socket not found for player ${player1.playerId}`);
        if (player2) this.queue.unshift(player2);
        return;
      }

      if (socket2) {
        socket2.join(matchId);
        socketMatchMap.set(socket2.id, matchId);
        console.log(`Player ${player2.playerId} (socket ${player2.socketId}) joined match room ${matchId}`);
        // Inform server logic of match membership
        socket2.emit('join-match-room', { matchId });
      } else {
        console.error(`Socket not found for player ${player2.playerId}`);
        socket1.leave(matchId);
        socketMatchMap.delete(socket1.id);
        this.queue.unshift(player1);
        return;
      }

      // Start the game with both players, including matchId
      const gameState = gameStateManager.initializeGame(
        matchId,
        30, 
        30, 
        player1.playerId, 
        player1.playerName,
        player2.playerId,
        player2.playerName
      );
      
      // Notify both players that game is starting (SHOULD NOW BE SENT TO ROOM)
      // This will be handled by gameStateManager.initializeGame broadcasting to the room
      // io.to(player1.socketId).emit('game-started', gameState);
      // io.to(player2.socketId).emit('game-started', gameState);
    }
  }
}

// Create a singleton instance
export const matchmakingQueue = new MatchmakingQueue(); 