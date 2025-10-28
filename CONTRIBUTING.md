Testing guide

This project uses Jest + React Testing Library for unit and integration tests.

Running tests

- Install dependencies:

```bash
npm install
```

- Run the test suite (includes coverage):

```bash
npm test
```

Writing tests

- Prefer `@testing-library/user-event` for user interactions (clicks, typing). Import with:

```ts
import userEvent from '@testing-library/user-event';
const user = userEvent.setup();
await user.click(element);
```

- For testing UI updates pushed from the server over WebSocket, mock the WebSocket as in `frontend/src/__tests__/App.test.tsx` and use `act()` when you trigger server-sent messages:

```ts
await act(async () => {
  ws.onmessage?.({ data: JSON.stringify(state) });
});
```

- When asserting network interactions (fetch), mock `global.fetch` with `jest.fn()` and inspect `fetch.mock.calls` for request URL and body.

- Keep tests deterministic and fast: prefer unit tests for logic and small integration tests for UI+socket interactions.

Files & locations

- Frontend tests: `frontend/src/__tests__`
- Component tests: `frontend/src/components/__tests__`
- Backend tests: `backend/__tests__`

If you need a template test for a new component, ask and I can add one.
