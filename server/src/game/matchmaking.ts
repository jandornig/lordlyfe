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
  private activeMatches: Set<string> = new Set(); // Track active matches

  constructor() {
    // Start the matchmaking loop
    setInterval(() => this.processQueue(), 1000);
  }

  addPlayer(player: QueuedPlayer) {
    console.log('Adding player to queue:', player);
    
    // Check if player is already in queue
    const existingPlayerIndex = this.queue.findIndex(p => p.playerId === player.playerId);
    if (existingPlayerIndex !== -1) {
      console.log('Player already in queue, updating socket ID');
      this.queue[existingPlayerIndex].socketId = player.socketId;
      return;
    }
    
    // Check if player is in an active match
    if (this.activeMatches.has(player.playerId)) {
      console.log('Player is in an active match, cannot join queue');
      io.to(player.socketId).emit('queue-status', {
        status: 'error',
        message: 'Cannot join queue while in an active match'
      });
      return;
    }
    
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
    // Only process if we have exactly 2 players
    if (this.queue.length === this.MIN_PLAYERS) {
      // Get the first two players
      const player1 = this.queue.shift()!;
      const player2 = this.queue.shift()!;

      // Validate both players are still connected
      const socket1 = io.sockets.sockets.get(player1.socketId);
      const socket2 = io.sockets.sockets.get(player2.socketId);

      console.log('Processing queue match:', {
        player1: {
          id: player1.playerId,
          name: player1.playerName,
          socketId: player1.socketId,
          connected: !!socket1,
          hasConnectedWithName: socket1?.data.hasConnectedWithName
        },
        player2: {
          id: player2.playerId,
          name: player2.playerName,
          socketId: player2.socketId,
          connected: !!socket2,
          hasConnectedWithName: socket2?.data.hasConnectedWithName
        }
      });

      if (!socket1 || !socket2) {
        console.log('One or both players disconnected before match start');
        // Return players to queue if they're still connected
        if (socket1) {
          this.queue.unshift(player1);
          io.to(player1.socketId).emit('queue-status', { 
            status: 'waiting',
            position: 1,
            message: 'Waiting for opponent...'
          });
        }
        if (socket2) {
          this.queue.unshift(player2);
          io.to(player2.socketId).emit('queue-status', { 
            status: 'waiting',
            position: 1,
            message: 'Waiting for opponent...'
          });
        }
        return;
      }

      // Additional validation to ensure both players are ready
      if (!socket1.data.hasConnectedWithName || !socket2.data.hasConnectedWithName) {
        console.log('One or both players not fully connected:', {
          player1Connected: socket1.data.hasConnectedWithName,
          player2Connected: socket2.data.hasConnectedWithName
        });
        // Return players to queue
        this.queue.unshift(player1);
        this.queue.unshift(player2);
        return;
      }

      const matchId = uuidv4();
      console.log(`Match found: ${matchId}`, { player1, player2 });

      // Mark players as being in an active match
      this.activeMatches.add(player1.playerId);
      this.activeMatches.add(player2.playerId);

      // Have players join the room
      socket1.join(matchId);
      socketMatchMap.set(socket1.id, matchId);
      console.log(`Player ${player1.playerId} (socket ${player1.socketId}) joined match room ${matchId}`);
      socket1.emit('join-match-room', { matchId });

      socket2.join(matchId);
      socketMatchMap.set(socket2.id, matchId);
      console.log(`Player ${player2.playerId} (socket ${player2.socketId}) joined match room ${matchId}`);
      socket2.emit('join-match-room', { matchId });

      // Start the game with both players
      const gameState = gameStateManager.initializeGame(
        matchId,
        30, 
        30, 
        player1.playerId, 
        player1.playerName,
        player2.playerId,
        player2.playerName
      );
    } else if (this.queue.length > 0) {
      // Notify waiting players of their position
      this.queue.forEach((player, index) => {
        io.to(player.socketId).emit('queue-status', {
          status: 'waiting',
          position: index + 1,
          message: 'Waiting for opponent...'
        });
      });
    }
  }

  // Add method to remove player from active matches
  removeFromActiveMatch(playerId: string) {
    this.activeMatches.delete(playerId);
  }
}

// Create a singleton instance
export const matchmakingQueue = new MatchmakingQueue(); 