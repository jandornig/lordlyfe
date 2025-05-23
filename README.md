# Grid Tactics Arena

A turn-based strategy game where you command armies across a grid-based battlefield. Conquer territories, manage resources, and outmaneuver your opponents in this tactical warfare game.

## Game Features

- **Territory Control**: Capture and defend territories to expand your influence
- **Army Management**: Command armies with strategic movement and combat
- **Resource Management**: Balance your forces between offense and defense
- **Tactical Movement**: Plan your moves carefully with waypoint system
- **Territory Bonuses**: Control territories to gain strategic advantages

## Controls

- **Left Click**: Select and move armies
- **Right Click**: Set waypoints for complex movement paths
- **Q Key**: Cancel all queued movements
- **ESC Key**: Deselect current tile and clear waypoints
- **Mouse Wheel**: Zoom in/out
- **Mouse Drag**: Pan the map

## Development

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

### Getting Started

```sh
# Install dependencies
npm install

# Start development server
npm run dev
```

### Building for Production

```sh
# Build the project
npm run build

# Preview the production build
npm run preview
```

## Game Rules

1. **Movement**:
   - Armies can only move horizontally or vertically
   - Each move must be to an adjacent tile
   - Use waypoints to create complex movement paths

2. **Combat**:
   - Armies must maintain a minimum garrison in their territories
   - Combat is resolved automatically when armies meet
   - Territory control provides strategic advantages

3. **Victory Conditions**:
   - Capture enemy territories
   - Defend your own territories
   - Eliminate enemy forces

## Contributing

Feel free to submit issues and enhancement requests!
