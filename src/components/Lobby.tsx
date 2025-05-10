import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Lobby: React.FC = () => {
  const [playerName, setPlayerName] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      navigate(`/play?name=${encodeURIComponent(playerName.trim())}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Grid Tactics Arena
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label 
              htmlFor="playerName" 
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Enter Your Name
            </label>
            <input
              type="text"
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Your name"
              required
              minLength={1}
              maxLength={20}
            />
          </div>
          
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors duration-200"
          >
            Start Game
          </button>
        </form>
      </div>
    </div>
  );
};

export default Lobby; 