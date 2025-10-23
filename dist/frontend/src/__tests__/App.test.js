"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("@testing-library/react");
const App_1 = __importDefault(require("../App"));
global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ gameId: 'test' }), ok: true }));
describe('Frontend App', () => {
    test('renders create game button and interacts', async () => {
        (0, react_1.render)((0, jsx_runtime_1.jsx)(App_1.default, {}));
        expect(react_1.screen.getByText('Create Game')).toBeInTheDocument();
        react_1.fireEvent.click(react_1.screen.getByText('Create Game'));
        await (0, react_1.waitFor)(() => expect(react_1.screen.getByPlaceholderText('Game ID')).toHaveValue('test'));
    });
});
