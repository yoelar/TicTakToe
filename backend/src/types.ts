// Types for WebSocket query parameters
export interface WSQueryParams {
  gameId: string;
  clientId?: string;  // Optional client identifier
}

export interface GameWebSocket extends WebSocket {
  clientId?: string;  // Track client ID on socket instance
  gameId?: string;    // Track game ID on socket instance
}