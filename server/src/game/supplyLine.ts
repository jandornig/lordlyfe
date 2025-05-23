import { Tile } from "../../../shared/types/game";

interface SupplyLineButton {
  x: number;
  y: number;
  timestamp: number;
}

// Feature flag to control supply line functionality
let isSupplyLineEnabled = false;

let currentSupplyLineButton: SupplyLineButton | null = null;
let buttonTimeout: NodeJS.Timeout | null = null;

export const enableSupplyLine = (): void => {
  isSupplyLineEnabled = true;
};

export const disableSupplyLine = (): void => {
  isSupplyLineEnabled = false;
  hideSupplyLineButton(); // Hide any existing button when disabling
};

export const isSupplyLineFeatureEnabled = (): boolean => {
  return isSupplyLineEnabled;
};

export const showSupplyLineButton = (endpointTile: Tile): void => {
  if (!isSupplyLineEnabled) return;

  // Clear any existing button timeout
  if (buttonTimeout) {
    clearTimeout(buttonTimeout);
  }

  // Create new button above the endpoint tile
  currentSupplyLineButton = {
    x: endpointTile.x,
    y: endpointTile.y, // Use the same y coordinate as the endpoint tile
    timestamp: Date.now()
  };

  // Set timeout to remove button after 3 seconds
  buttonTimeout = setTimeout(() => {
    currentSupplyLineButton = null;
  }, 3000);
};

export const hideSupplyLineButton = (): void => {
  if (buttonTimeout) {
    clearTimeout(buttonTimeout);
    buttonTimeout = null;
  }
  currentSupplyLineButton = null;
};

export const getCurrentSupplyLineButton = (): SupplyLineButton | null => {
  if (!isSupplyLineEnabled) return null;
  return currentSupplyLineButton;
}; 