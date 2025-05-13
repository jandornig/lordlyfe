import React from 'react';

interface LoadingScreenProps {
  message: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  return (
    <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center z-10">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Finding Opponent</h2>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
        <p className="text-gray-400">{message}</p>
      </div>
    </div>
  );
};

export default LoadingScreen; 