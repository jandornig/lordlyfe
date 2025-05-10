import React, { createContext, useContext, useEffect, useState } from 'react';
import { WebSocketService } from '../services/WebSocketService';

interface WebSocketContextType {
  wsService: WebSocketService;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wsService] = useState(() => new WebSocketService());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect the WebSocket service when the provider is mounted
    wsService.connect();

    const unsubscribe = wsService.onConnect(() => {
      console.log('[WebSocketContext] Connected');
      setIsConnected(true);
      // Automatically create a room when connected
      console.log('[WebSocketContext] Creating room');
      wsService.createRoom();
    });

    return () => {
      unsubscribe();
      wsService.disconnect();
    };
  }, [wsService]);

  return (
    <WebSocketContext.Provider value={{ wsService, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}; 