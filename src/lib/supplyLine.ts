let currentSupplyLineButton: { x: number; y: number } | null = null;

export const showSupplyLineButton = (tile: { x: number; y: number }) => {
  currentSupplyLineButton = { x: tile.x, y: tile.y };
};

export const hideSupplyLineButton = () => {
  currentSupplyLineButton = null;
};

export const getCurrentSupplyLineButton = () => currentSupplyLineButton; 