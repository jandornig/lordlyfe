import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const SOCKET_URL = 'http://localhost:3000';

export const socket = io(SOCKET_URL, {
  auth: {
    clientId: uuidv4() // Use our UUID as the client ID
  }
}); 