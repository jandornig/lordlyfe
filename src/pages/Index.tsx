
import React from 'react';
import Game from '@/components/Game';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white p-4">
      <header className="container mx-auto py-4">
        <h1 className="text-2xl font-bold">Grid Tactics Arena</h1>
      </header>
      
      <main className="container mx-auto flex-1 mb-4">
        <div className="bg-gray-850 rounded-lg shadow-xl overflow-hidden h-[80vh]">
          <Game />
        </div>
      </main>
      
      <footer className="container mx-auto text-center text-xs text-gray-500 py-4">
        <p>Grid Tactics Arena - A strategy game prototype</p>
      </footer>
    </div>
  );
};

export default Index;
