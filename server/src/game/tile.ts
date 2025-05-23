export interface Tile {
  x: number;
  y: number;
  owner: string | null;
  army: number;
  isLord: boolean;
  isCity: boolean;
  territory: string | null;
  isMountain: boolean;
  isVisible: boolean;
} 