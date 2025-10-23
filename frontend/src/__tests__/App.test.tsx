import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ gameId: 'test' }), ok: true })) as any;

describe('Frontend App', () => {
 test('renders create game button and interacts', async () => {
 render(<App />);
 expect(screen.getByText('Create Game')).toBeInTheDocument();

 fireEvent.click(screen.getByText('Create Game'));
 await waitFor(() => expect(screen.getByPlaceholderText('Game ID')).toHaveValue('test'));
 });
});
