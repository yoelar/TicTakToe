# 3D Tic-Tac-Toe (3x3x3) Web Application Specification

## 🌟 Project Goal
Develop a **multiplayer 3D Tic-Tac-Toe game** using **TypeScript end-to-end** with robust testing and clean architecture.

---

## 🔻 Tech Stack
- **Frontend:** React 18 + Vite + TypeScript  
- **Backend:** Node.js + Express.js + WebSocket (`ws`)  
- **Testing:** Jest (unit) + Cypress (integration/UI)  
- **Code quality:** ESLint + Prettier  
- **Coverage:** ≥ 80%

---

## 🧩 Game Rules and Logic
- The board is a 3×3×3 cube (three 3x3 layers).
- Players alternate turns: **X** and **O**.
- Each turn: select one empty cell, press **Submit** to confirm.
- Invalid actions (occupied cell, double move, empty submission) show clear UI feedback.
- Detect wins across **49 lines**:
  - 27 straight lines (rows, columns, verticals)
  - 18 plane diagonals (6 planes × 3 layers)
  - 4 space diagonals across all layers

Example diagonal:
```ts
[(0, 0, 0), (1, 1, 1), (2, 2, 2)]
```

Outcomes: **Win** or **Ongoing**.

> Note: In a 3×3×3 standard play, a complete board without a winner (a true draw) is effectively impossible due to the game's win-line density; therefore the application treats outcomes as either a win for a player or ongoing.

---

## 🗃️ Data Model
```ts
interface Move {
  player: 'X' | 'O';
  x: number;
  y: number;
  z: number;
}

interface GameState {
  id: string;
  board: string[][][];
  currentPlayer: 'X' | 'O';
  winner?: 'X' | 'O';
}
```
- State stored in memory (or JSON store).
- Games identified by `gameId` only (no authentication).

---

## 🔌 Backend API (Express + WebSocket)
| Endpoint | Method | Description |
|-----------|---------|-------------|
| `/api/game` | `POST` | Create new game → returns `{gameId}` |
| `/api/game/:id/join` | `POST` | Join existing game |
| `/api/game/:id/move` | `POST` | Submit `{player,x,y,z}` move |
| `/api/game/:id/state` | `GET` | Fetch current state |

### WebSocket Behavior
- Join "room" by `gameId`.
- After valid move: broadcast updated `GameState`.
- Disconnects:
  - Temporary (< timeout): game remains active.
  - Long disconnect: player removed, opponent wins.

---

## 🖥️ Frontend Requirements
- Show 3 stacked 3x3 grids labeled **Layer 1-3**.
- Active player only can click cells.
- Display current player, game ID, and status (turn/win).
- **Submit** button locks move; disable board until next turn.
- UI feedback:
  - Highlight selected cell
  - Disable non-active board
  - Show toast/banner for invalid move
- Game end: offer **Play Again** / **New Game**.
- Inputs:
  - Create new game (shows ID)
  - Join game (enter ID)

---

## 🗂️ Folder Structure
```
tictactoe-3d/
├── backend/
│   ├── src/{controllers,models,services,utils}/
│   ├── tests/{unit,integration}/
│   └── index.ts
├── frontend/
│   ├── src/{components,pages,hooks,utils}/
│   ├── tests/{unit,integration}/
│   └── index.tsx
├── docs/specification.md
├── scripts/setup.sh
└── .github/workflows/ci.yml
```

---

## 🧪 Testing Requirements
### Backend
- **Game logic:** test all 49 win lines and ongoing scenarios.
- **API:** validate request/response, invalid actions.
- **WebSocket:** join/leave, disconnect, broadcast.
- Use **Jest**, organized under `__tests__`, with mocks.

### Frontend
- **Unit tests:** components, hooks, state (React Testing Library + Jest). 
  - Example: `frontend/src/__tests__/App.test.tsx` created to exercise basic flows.
- **Integration/UI:** flows for create, join, move, win (Cypress).
- **Visual/accessibility:** snapshots + ARIA roles.
- Enforce ≥80% coverage (checked in CI).

---

## ⚙️ Development Notes
- Modular, type-safe, and JSDoc-documented code.
- Professional naming and consistent structure.
- No redundant network payloads.
- Pure logic functions – no side effects in React components.

---

## ✅ Expected Output
- Fully functional **3D multiplayer Tic-Tac-Toe**.
- React frontend + Express backend + WebSocket sync.
- Comprehensive Jest + Cypress test suites.
- Clean, maintainable TypeScript implementation.

