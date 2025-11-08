# 🎨 Real-Time Collaborative Drawing Canvas

A multi-user drawing application where multiple people can draw simultaneously on the same canvas with real-time synchronization. Built with vanilla JavaScript, HTML5 Canvas, Node.js, and Socket.io.

## ✨ Features

### Core Functionality
- **Real-time Collaboration**: Multiple users can draw simultaneously with instant synchronization
- **Drawing Tools**: Brush and eraser with adjustable size (1-50px)
- **Color Picker**: Full color palette with quick-access presets
- **Global Undo/Redo**: Works across all users using tombstone pattern
- **User Management**: See who's online with unique colors for each user
- **Cursor Tracking**: View other users' cursor positions in real-time
- **Conflict Resolution**: Vector clock-based causal ordering

### Technical Highlights
- **Three-Layer Rendering**: Optimized canvas drawing with separate layers
- **Event Batching**: Efficient network usage (60fps drawing, 20fps cursors)
- **Event Sourcing**: Complete operation history with state reconstruction
- **Automatic Reconnection**: Handles network interruptions gracefully
- **Room System**: Support for multiple isolated drawing sessions

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- npm >= 8.0.0

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd collaborative-canvas

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at `http://localhost:3000`

### Development Mode

```bash
# Run with auto-restart on file changes
npm run dev
```

## 🧪 Testing with Multiple Users

### Local Testing

1. **Open multiple browser windows**:
   ```bash
   # Terminal 1: Start server
   npm start
   
   # Then open in browser:
   http://localhost:3000  # Window 1
   http://localhost:3000  # Window 2
   http://localhost:3000  # Window 3
   ```

2. **Test on different devices**:
   - Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
   - Access from other devices: `http://YOUR_IP:3000`

### Test Scenarios

#### Basic Drawing
1. Open two browser windows
2. Draw in one window - should appear in the other instantly
3. Change colors and brush sizes - should work independently

#### Undo/Redo Testing
1. User A draws a red line
2. User B draws a blue line
3. User A undoes their line (red disappears from both)
4. User B undoes their line (blue disappears from both)
5. User A redoes (red reappears)

#### Network Resilience
1. Start drawing
2. Disable network briefly
3. Re-enable network
4. Drawing should resume and sync

#### Cursor Tracking
1. Move mouse in one window
2. Other window should show cursor position

## ⌨️ Keyboard Shortcuts

- `B` - Switch to Brush tool
- `E` - Switch to Eraser tool
- `[` - Decrease brush size
- `]` - Increase brush size
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` - Redo

## 📁 Project Structure

```
collaborative-canvas/
├── client/                 # Frontend code
│   ├── index.html         # Main HTML structure
│   ├── styles.css         # UI styling
│   └── js/
│       ├── CanvasEngine.js      # Canvas drawing logic
│       ├── StateManager.js      # Operation history & undo/redo
│       ├── WebSocketClient.js   # Network communication
│       ├── UIController.js      # UI interactions
│       └── main.js              # Application initialization
├── server/                # Backend code
│   ├── server.js         # Express + Socket.io server
│   ├── RoomManager.js    # Multi-room management
│   ├── OperationLog.js   # Event sourcing
│   └── VectorClock.js    # Conflict resolution
├── shared/               # Shared constants
│   └── constants.js
├── package.json
├── README.md
└── ARCHITECTURE.md
```

## 🔧 Configuration

### Environment Variables

```bash
PORT=3000                    # Server port (default: 3000)
NODE_ENV=production          # Environment mode
```

### Canvas Configuration

Edit `shared/constants.js`:

```javascript
const CONFIG = {
  CANVAS_WIDTH: 1200,        // Canvas width in pixels
  CANVAS_HEIGHT: 800,        // Canvas height in pixels
  DEFAULT_BRUSH_SIZE: 3,     // Default brush size
  BATCH_INTERVAL: 16,        // Drawing batch interval (ms)
  MAX_HISTORY_SIZE: 500      // Maximum undo operations
};
```

## 📊 Performance Metrics

- **Drawing Latency**: ~16-50ms (depends on network)
- **Event Batching**: 60fps for drawing, 20fps for cursors
- **Max Concurrent Users**: 20 per room (configurable)
- **Memory Usage**: ~5-10MB per room with 500 operations

## 🐛 Known Limitations

1. **Browser Storage**: No persistence - canvas clears on server restart
2. **Max Users**: Recommended 20 users per room for optimal performance
3. **Network Latency**: High latency (>200ms) may cause noticeable lag
4. **Mobile Support**: Basic touch support, optimized for desktop
5. **Browser Compatibility**: Requires modern browsers (Chrome, Firefox, Safari)

## 🔍 Troubleshooting

### Server won't start
```bash
# Check if port is already in use
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process or change port
PORT=3001 npm start
```

### Drawing not syncing
1. Check browser console for errors
2. Verify WebSocket connection (look for "Connected" status)
3. Check network latency: Server logs show connection info
4. Try refreshing the page

### High latency
1. Check network connection
2. Reduce brush size
3. Close unnecessary browser tabs
4. Check server logs for performance warnings

### Canvas appears blank
1. Ensure server is running
2. Check browser console for errors
3. Try clearing browser cache
4. Verify Socket.io is loading correctly

## 🚢 Deployment

### Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Deploy
git push heroku main

# Open app
heroku open
```

### Vercel (Serverless)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts
```

### Docker

```dockerfile
# Dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t collaborative-canvas .
docker run -p 3000:3000 collaborative-canvas
```

## 📈 Future Enhancements

- [ ] Database persistence (MongoDB/PostgreSQL)
- [ ] User authentication
- [ ] Shape tools (rectangle, circle, line)
- [ ] Text tool
- [ ] Image upload
- [ ] Export canvas as PNG/SVG
- [ ] Drawing layers
- [ ] Private rooms with passwords
- [ ] Chat functionality
- [ ] Drawing history playback


## 👨‍💻 Author

Created as a technical assessment demonstrating:
- Real-time collaboration
- Event sourcing patterns
- Conflict resolution algorithms
- Canvas API mastery
- WebSocket programming

## ⏱️ Time Spent

**Total Development Time**: ~18-20 hours

Breakdown:
- Architecture & Planning: 2 hours
- Frontend Implementation: 8 hours
- Backend Implementation: 5 hours
- Testing & Debugging: 3 hours
- Documentation: 2 hours

