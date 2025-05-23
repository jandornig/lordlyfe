import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { gameStateManager } from './server/src/game/gameState.js';
import { matchmakingQueue } from './server/src/game/matchmaking.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store socket to player ID mapping
const socketPlayerMap = new Map();
const socketMatchMap = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('A user connected');

    // Generate and assign playerId
    const playerId = uuidv4();
    socketPlayerMap.set(socket.id, playerId);
    socket.emit('player-id-assigned', { playerId });

    // Handle player connection
    socket.on('player-connect', (data) => {
        const currentSocketId = socket.id;
        const assignedPlayerId = socketPlayerMap.get(currentSocketId);

        if (!assignedPlayerId) {
            console.error('Player ID not found for socket. This should not happen.');
            return;
        }
        
        if (!socket.data.hasConnectedWithName) {
            console.log('Player connected:', {
                playerId: assignedPlayerId,
                playerName: data.playerName,
                socketId: currentSocketId
            });
            socket.data.hasConnectedWithName = true;
        }
    });

    // Handle game start
    socket.on('start-game', (data) => {
        const currentSocketId = socket.id;
        const assignedPlayerId = socketPlayerMap.get(currentSocketId);

        if (!assignedPlayerId) {
            console.error('Player ID not found during start-game. This should not happen.');
            return;
        }

        console.log('Game start requested:', {
            playerId: assignedPlayerId,
            playerName: data.playerName,
            socketId: currentSocketId,
            width: data.width,
            height: data.height
        });

        matchmakingQueue.addPlayer({
            playerId: assignedPlayerId,
            playerName: data.playerName,
            socketId: currentSocketId
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected');
        const disconnectedPlayerId = socketPlayerMap.get(socket.id);
        const matchId = socketMatchMap.get(socket.id);
        matchmakingQueue.removePlayer(socket.id);
        socketPlayerMap.delete(socket.id);
        socketMatchMap.delete(socket.id);
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 