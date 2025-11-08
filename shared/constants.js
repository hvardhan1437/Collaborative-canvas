// Shared constants between client and server
const EVENTS = {
  // Client -> Server
  JOIN_ROOM: 'join_room',
  DRAW_BATCH: 'draw_batch',
  DRAW_START: 'draw_start',
  DRAW_END: 'draw_end',
  UNDO: 'undo',
  REDO: 'redo',
  CLEAR_CANVAS: 'clear_canvas',
  CURSOR_MOVE: 'cursor_move',
  
  // Server -> Client
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  USERS_LIST: 'users_list',
  REMOTE_DRAW_BATCH: 'remote_draw_batch',
  REMOTE_DRAW_END: 'remote_draw_end',
  REMOTE_UNDO: 'remote_undo',
  REMOTE_REDO: 'remote_redo',
  REMOTE_CLEAR: 'remote_clear',
  REMOTE_CURSOR: 'remote_cursor',
  SYNC_STATE: 'sync_state',
  ERROR: 'error'
};

const CONFIG = {
  CANVAS_WIDTH: 1200,
  CANVAS_HEIGHT: 800,
  DEFAULT_COLOR: '#000000',
  DEFAULT_BRUSH_SIZE: 3,
  MIN_BRUSH_SIZE: 1,
  MAX_BRUSH_SIZE: 50,
  BATCH_INTERVAL: 16, // ~60fps
  CURSOR_UPDATE_INTERVAL: 50, // 20fps for cursors
  MAX_HISTORY_SIZE: 500, // Maximum operations to keep
  USER_COLORS: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52B788'
  ]
};

const TOOLS = {
  BRUSH: 'brush',
  ERASER: 'eraser'
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EVENTS, CONFIG, TOOLS };
}