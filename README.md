3D Tic-Tac-Toe (3x3x3) - Minimal Implementation

This workspace contains a minimal TypeScript implementation of the 3D Tic-Tac-Toe spec.

Structure:
- backend/: Express + WebSocket server (TypeScript)
  - `src/game.ts` - game logic, winning lines, move validation
  - `src/index.ts` - lightweight API and WS server

- frontend/: Vite + React (TypeScript) simple client
  - `src/App.tsx` - UI to create/join game and play
  - `index.html` - mount point

Notes:
- This is a starting point matching the specification's logic and APIs.
- Real-time updates:
  - Uses WebSocket for live game state updates (moves, winner).
  - Auto-reconnects if WebSocket connection is lost.
  - Falls back to polling every 2s if WebSocket unavailable.
  - Optimistic UI updates: moves appear instantly, then sync with server.
- To run locally:
  1. Install Node.js 18+.
  2. Run `npm ci` to install dependencies.
  3. Run `npm test` to run tests.
  4. Build backend: `npm run build` then `npm start` to run the server.
