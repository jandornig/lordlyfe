import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lobby } from './Lobby';
import { GameRoom } from '../types/game';

export function Home() {
  const navigate = useNavigate();
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);

  const handleGameStart = (room: GameRoom) => {
    setGameRoom(room);
    navigate('/play');
  };

  return <Lobby onGameStart={handleGameStart} />;
} 