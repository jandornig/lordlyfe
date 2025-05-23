export interface Movement {
  from: { x: number; y: number };
  to: { x: number; y: number };
  army: number;
  startTick: number;
  endTick: number;
  currentTick: number;
  waypoints: { x: number; y: number }[];
} 