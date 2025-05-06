import React from 'react';
import { Lock } from 'lucide-react';

interface SupplyLineButtonProps {
  x: number;
  y: number;
}

const SupplyLineButton: React.FC<SupplyLineButtonProps> = ({ x, y }) => {
  return (
    <div
      className="absolute z-50"
      style={{
        top: '-1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      <button
        className="w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-700 
                   flex items-center justify-center shadow-lg
                   transition-all duration-200 ease-in-out
                   border-2 border-white"
        onClick={(e) => {
          e.stopPropagation();
          // Functionality will be added later
        }}
      >
        <Lock className="w-3 h-3 text-white" />
      </button>
    </div>
  );
};

export default SupplyLineButton; 