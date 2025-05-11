import { io } from 'socket.io-client';

// Connect to the server
const socket = io('http://localhost:3000');

// Test connection
socket.on('connect', () => {
    console.log('Connected to server!');
    
    // Test sending a message
    socket.emit('test-message', { message: 'Hello from test client!' });
});

// Listen for response
socket.on('test-response', (data) => {
    console.log('Received response:', data);
});

// Handle errors
socket.on('error', (error) => {
    console.error('Socket error:', error);
});

// Handle disconnection
socket.on('disconnect', () => {
    console.log('Disconnected from server');
}); 