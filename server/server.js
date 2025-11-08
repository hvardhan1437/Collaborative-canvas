/**
 * Main Server - Express + Socket.io for real-time collaboration
 */
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const RoomManager = require('./RoomManager');
const { EVENTS } = require('../shared/constants');

// Configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Initialize Room Manager
const roomManager = new RoomManager();

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        stats: roomManager.getStats(),
        timestamp: Date.now()
    });
});

// Stats endpoint
app.get('/stats', (req, res) => {
    res.json(roomManager.getStats());
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`[Server] Client connected: ${socket.id}`);

    // Join room
    socket.on(EVENTS.JOIN_ROOM, (data, callback) => {
        const { roomId = 'default', username } = data;

        const result = roomManager.joinRoom(socket.id, roomId, username);

        if (result.success) {
            const { user, room } = result;

            // Join socket.io room
            socket.join(roomId);

            // Send confirmation to user
            if (callback) {
                callback({
                    success: true,
                    userId: user.id,
                    user: user,
                    room: room
                });
            }

            // Notify others in room
            socket.to(roomId).emit(EVENTS.USER_JOINED, {
                user: {
                    id: user.id,
                    name: user.name,
                    color: user.color
                }
            });

            // Send current users list to new user
            socket.emit(EVENTS.USERS_LIST, {
                users: room.users
            });

            // Send current canvas state to new user
            const roomObj = roomManager.getRoom(roomId);
            const operations = roomObj.operationLog.getAllOperations();
            
            if (operations.length > 0) {
                socket.emit(EVENTS.SYNC_STATE, {
                    operations: operations,
                    timestamp: Date.now()
                });
            }

            console.log(`[Server] User ${user.name} joined room ${roomId}`);
        } else {
            if (callback) {
                callback({
                    success: false,
                    error: result.error
                });
            }
        }
    });

    // Drawing events
    socket.on(EVENTS.DRAW_START, (data) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;

        roomManager.updateActivity(socket.id);

        // Broadcast to others
        socket.to(user.roomId).emit(EVENTS.REMOTE_DRAW_BATCH, {
            userId: user.id,
            points: [{ x: data.x, y: data.y }],
            color: data.color,
            width: data.width,
            tool: data.tool,
            timestamp: data.timestamp
        });
    });

    socket.on(EVENTS.DRAW_BATCH, (data) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;

        roomManager.updateActivity(socket.id);

        // Broadcast to others
        socket.to(user.roomId).emit(EVENTS.REMOTE_DRAW_BATCH, {
            userId: user.id,
            points: data.points,
            timestamp: data.timestamp
        });
    });

    socket.on(EVENTS.DRAW_END, (data) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;

        roomManager.updateActivity(socket.id);

        const room = roomManager.getRoom(user.roomId);
        
        // Add to operation log
        const operation = room.operationLog.addOperation(
            user.id,
            'stroke',
            data.stroke
        );

        // Broadcast to others
        socket.to(user.roomId).emit(EVENTS.REMOTE_DRAW_END, {
            userId: user.id,
            stroke: data.stroke,
            operationId: operation.id,
            timestamp: data.timestamp
        });
    });

    // Undo/Redo events
    socket.on(EVENTS.UNDO, (data) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;

        roomManager.updateActivity(socket.id);

        const room = roomManager.getRoom(user.roomId);
        
        // Get last active operation if no operationId provided
        let operationId = data.operationId;
        if (!operationId) {
            const lastOp = room.operationLog.getLastActiveOperation();
            if (lastOp) {
                operationId = lastOp.id;
            }
        }

        if (operationId) {
            const result = room.operationLog.undoOperation(operationId, user.id);

            if (result.success) {
                // Broadcast to all (including sender)
                io.to(user.roomId).emit(EVENTS.REMOTE_UNDO, {
                    userId: user.id,
                    operationId: operationId,
                    timestamp: Date.now()
                });
            }
        }
    });

    socket.on(EVENTS.REDO, (data) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;

        roomManager.updateActivity(socket.id);

        const room = roomManager.getRoom(user.roomId);
        
        // Get last undone operation if no operationId provided
        let operationId = data.operationId;
        if (!operationId) {
            const lastOp = room.operationLog.getLastUndoneOperation();
            if (lastOp) {
                operationId = lastOp.id;
            }
        }

        if (operationId) {
            const result = room.operationLog.redoOperation(operationId, user.id);

            if (result.success) {
                // Broadcast to all (including sender)
                io.to(user.roomId).emit(EVENTS.REMOTE_REDO, {
                    userId: user.id,
                    operationId: operationId,
                    timestamp: Date.now()
                });
            }
        }
    });

    // Clear canvas
    socket.on(EVENTS.CLEAR_CANVAS, (data) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;

        roomManager.updateActivity(socket.id);

        const room = roomManager.getRoom(user.roomId);
        room.operationLog.clearOperations(user.id);

        // Broadcast to all (including sender)
        io.to(user.roomId).emit(EVENTS.REMOTE_CLEAR, {
            userId: user.id,
            timestamp: Date.now()
        });
    });

    // Cursor movement
    socket.on(EVENTS.CURSOR_MOVE, (data) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;

        // Broadcast to others (no need to store)
        socket.to(user.roomId).emit(EVENTS.REMOTE_CURSOR, {
            userId: user.id,
            x: data.x,
            y: data.y,
            timestamp: data.timestamp
        });
    });

    // Ping for latency measurement
    socket.on('ping', (data, callback) => {
        if (callback) callback();
    });

    // Disconnect
    socket.on('disconnect', (reason) => {
        console.log(`[Server] Client disconnected: ${socket.id}, reason: ${reason}`);

        const result = roomManager.leaveRoom(socket.id);
        
        if (result) {
            const { user, room } = result;

            // Notify others
            socket.to(user.roomId).emit(EVENTS.USER_LEFT, {
                user: {
                    id: user.id,
                    name: user.name
                }
            });

            // Update users list for remaining users
            if (room.users.length > 0) {
                io.to(user.roomId).emit(EVENTS.USERS_LIST, {
                    users: room.users
                });
            }
        }
    });

    // Error handling
    socket.on('error', (error) => {
        console.error(`[Server] Socket error for ${socket.id}:`, error);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[Server] Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
server.listen(PORT,'0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  🎨 Collaborative Canvas Server');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Server running on port ${PORT}`);
    console.log(`  Environment: ${NODE_ENV}`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('[Server] Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('[Server] Server closed');
        process.exit(0);
    });
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
    console.error('[Server] Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { app, server, io, roomManager };