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
  private readonly PLAYERS_PER_MATCH = 3; // Changed from MIN_PLAYERS = 2
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
    if (this.queue.length >= this.PLAYERS_PER_MATCH) {
      const playersForMatch: QueuedPlayer[] = [];
      for (let i = 0; i < this.PLAYERS_PER_MATCH; i++) {
        playersForMatch.push(this.queue.shift()!);
      }

      const matchId = uuidv4();
      console.log(`Match found: ${matchId}`, { players: playersForMatch.map(p => p.playerId) });

      const socketsForMatch: any[] = []; // Store socket objects
      let allSocketsFound = true;
      for (const p of playersForMatch) {
        const socket = io.sockets.sockets.get(p.socketId);
        if (socket) {
          socketsForMatch.push(socket);
        } else {
          console.error(`Socket not found for player ${p.playerId}`);
          allSocketsFound = false;
          break;
        }
      }

      if (!allSocketsFound) {
        // Add players back to the front of the queue in their original order
        // Reverse playersForMatch before unshift to maintain original order at the front
        this.queue.unshift(...playersForMatch.reverse()); 
        console.log('Failed to find all sockets for match, players requeued.');
        return;
      }

      socketsForMatch.forEach((socket, index) => {
        const player = playersForMatch[index];
        socket.join(matchId);
        socketMatchMap.set(socket.id, matchId);
        console.log(`Player ${player.playerId} (socket ${socket.id}) joined match room ${matchId}`);
        socket.emit('join-match-room', { matchId });
      });
      
      const playersInfo = playersForMatch.map(p => ({ id: p.playerId, name: p.playerName }));

      // Start the game with all players, including matchId
      const gameState = gameStateManager.initializeGame(
        matchId,
        30, // Default width
        30, // Default height
        playersInfo // Pass the array of player info
      );
      
      // Notify all players in the room that game is starting
      // This will be handled by gameStateManager.initializeGame broadcasting to the room
      // io.to(player1.socketId).emit('game-started', gameState);
      // io.to(player2.socketId).emit('game-started', gameState);
    }
  }
}

// Create a singleton instance
export const matchmakingQueue = new MatchmakingQueue(); 