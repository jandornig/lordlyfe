import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function Lobby() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wsService, isConnected } = useWebSocket();
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [addBot, setAddBot] = useState(false);

  const createButton = {
    disabled: !isConnected || !playerName,
    reasons: {
      notConnected: !isConnected ? 'Not connected' : null,
      noName: !playerName ? 'Enter your name' : null
    }
  };

  const joinButton = {
    disabled: !isConnected || !playerName || !roomId,
    reasons: {
      notConnected: !isConnected ? 'Not connected' : null,
      noName: !playerName ? 'Enter your name' : null,
      noRoomId: !roomId ? 'Enter room ID' : null
    }
  };

  const createRoom = () => {
    if (!isConnected) {
      console.error('[Lobby] WebSocket not connected');
      return;
    }
    console.log('[Lobby] Creating room with player name:', playerName);
    wsService.createRoom();
  };

  const joinRoom = () => {
    if (!isConnected) {
      console.error('[Lobby] WebSocket not connected');
      return;
    }
    console.log('[Lobby] Joining room:', { roomId, playerName, addBot });
    wsService.joinRoom(playerName, addBot, roomId);
  };

  // Listen for room joined messages
  useEffect(() => {
    const unsubscribe = wsService.onMessage((message) => {
      if (message.type === 'ROOM_JOINED') {
        console.log('[Lobby] Room joined:', message.payload);
        if (message.payload?.playerId) {
          console.log('[Lobby] Player ID assigned:', message.payload.playerId);
          // Navigate to game page when room is joined
          navigate('/game');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [wsService, navigate]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Game Lobby</h1>
      
      {/* WebSocket State Display */}
      <div className="mb-8 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-xl font-bold mb-2">WebSocket State</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Connection State:</div>
          <div className={isConnected ? 'text-green-500' : 'text-red-500'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Your Name</Label>
          <Input
            id="name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
          />
        </div>

        <div>
          <Label htmlFor="roomId">Room ID (optional)</Label>
          <Input
            id="roomId"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter room ID to join"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="addBot"
            checked={addBot}
            onCheckedChange={(checked) => setAddBot(checked as boolean)}
          />
          <Label htmlFor="addBot">Add Bot Player</Label>
        </div>

        <div className="flex space-x-4">
          <Button
            onClick={createRoom}
            disabled={createButton.disabled}
            title={Object.values(createButton.reasons).filter(Boolean).join(', ')}
          >
            Create Room
          </Button>
          <Button
            onClick={joinRoom}
            disabled={joinButton.disabled}
            title={Object.values(joinButton.reasons).filter(Boolean).join(', ')}
          >
            Join Room
          </Button>
        </div>
      </div>
    </div>
  );
} 