# Technical Guidelines

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + TypeScript + Socket.IO
- **Styling**: Tailwind CSS + shadcn/ui
- **Deployment**: fly.io

## Code Organization
- `/src` - Frontend code
  - `/components` - Reusable UI components
  - `/contexts` - React context providers
  - `/hooks` - Custom React hooks
  - `/pages` - Page components
  - `/services` - API and socket services
  - `/types` - TypeScript type definitions
- `/server` - Backend code
  - `/src` - Server source code
  - `/dist` - Compiled server code

## Coding Standards
1. **TypeScript**
   - Strict mode enabled
   - No `any` types
   - Proper interface/type definitions

2. **React**
   - Functional components
   - Hooks for state management
   - Props interface definitions
   - No prop drilling

3. **State Management**
   - React Context for global state
   - Local state for component-specific data
   - Socket.IO for real-time updates

4. **Testing**
   - Unit tests for utilities
   - Component tests for UI
   - Integration tests for game logic

## Git Workflow
- Feature branches from `main`
- Pull request reviews required
- Conventional commits
- No direct commits to `main`

## Performance
- Minimize re-renders
- Optimize socket messages
- Lazy load components
- Compress game state updates

## Security
- Validate all inputs
- Sanitize player data
- Rate limit socket events
- No sensitive data in client 