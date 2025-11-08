/**
 * WebSocketClient - Handles real-time communication with server
 * Implements event batching and automatic reconnection
 */
class WebSocketClient {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.roomId = 'default';
        this.isConnected = false;
        
        // Event batching
        this.eventQueue = [];
        this.batchTimer = null;
        this.batchInterval = 16; // ~60fps
        
        // Cursor throttling
        this.cursorTimer = null;
        this.cursorInterval = 50; // 20fps
        
        // Reconnection
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // Event handlers
        this.handlers = {
            connected: [],
            disconnected: [],
            userJoined: [],
            userLeft: [],
            usersList: [],
            remoteDraw: [],
            remoteDrawEnd: [],
            remoteUndo: [],
            remoteRedo: [],
            remoteClear: [],
            remoteCursor: [],
            syncState: [],
            error: []
        };
    }

    /**
     * Connect to server
     */
    connect(serverUrl = '') {
        return new Promise((resolve, reject) => {
            try {
                this.socket = io(serverUrl, {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionDelay: this.reconnectDelay,
                    reconnectionAttempts: this.maxReconnectAttempts
                });

                this.setupSocketListeners();
                
                this.socket.on('connect', () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    console.log('Connected to server');
                    this.emit('connected');
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    console.error('Connection error:', error);
                    reject(error);
                });

            } catch (error) {
                console.error('Socket initialization error:', error);
                reject(error);
            }
        });
    }

    /**
     * Setup all socket event listeners
     */
    setupSocketListeners() {
        // Connection events
        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            console.log('Disconnected:', reason);
            this.emit('disconnected', reason);
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('Reconnected after', attemptNumber, 'attempts');
            this.joinRoom(this.roomId);
        });

        this.socket.on('reconnect_failed', () => {
            console.error('Reconnection failed');
            this.emit('error', 'Failed to reconnect to server');
        });

        // User events
        this.socket.on(EVENTS.USER_JOINED, (data) => {
            console.log('User joined:', data);
            this.emit('userJoined', data);
        });

        this.socket.on(EVENTS.USER_LEFT, (data) => {
            console.log('User left:', data);
            this.emit('userLeft', data);
        });

        this.socket.on(EVENTS.USERS_LIST, (data) => {
            console.log('Users list:', data);
            this.emit('usersList', data);
        });

        // Drawing events
        this.socket.on(EVENTS.REMOTE_DRAW_BATCH, (data) => {
            this.emit('remoteDraw', data);
        });

        this.socket.on(EVENTS.REMOTE_DRAW_END, (data) => {
            this.emit('remoteDrawEnd', data);
        });

        this.socket.on(EVENTS.REMOTE_UNDO, (data) => {
            this.emit('remoteUndo', data);
        });

        this.socket.on(EVENTS.REMOTE_REDO, (data) => {
            this.emit('remoteRedo', data);
        });

        this.socket.on(EVENTS.REMOTE_CLEAR, (data) => {
            this.emit('remoteClear', data);
        });

        this.socket.on(EVENTS.REMOTE_CURSOR, (data) => {
            this.emit('remoteCursor', data);
        });

        // State sync
        this.socket.on(EVENTS.SYNC_STATE, (data) => {
            console.log('Received state sync');
            this.emit('syncState', data);
        });

        // Error handling
        this.socket.on(EVENTS.ERROR, (error) => {
            console.error('Server error:', error);
            this.emit('error', error);
        });
    }

    /**
     * Join a room
     */
    joinRoom(roomId = 'default') {
        this.roomId = roomId;
        
        if (this.socket && this.isConnected) {
            this.socket.emit(EVENTS.JOIN_ROOM, { roomId }, (response) => {
                if (response.success) {
                    this.userId = response.userId;
                    console.log('Joined room:', roomId, 'as user:', this.userId);
                } else {
                    console.error('Failed to join room:', response.error);
                }
            });
        }
    }

    /**
     * Send drawing points (batched)
     */
    sendDrawPoints(points) {
        // Add to queue
        points.forEach(point => {
            this.eventQueue.push({
                type: 'point',
                data: point
            });
        });

        // Start batch timer if not running
        if (!this.batchTimer) {
            this.batchTimer = setTimeout(() => {
                this.flushDrawQueue();
            }, this.batchInterval);
        }
    }

    /**
     * Flush drawing queue
     */
    flushDrawQueue() {
        if (this.eventQueue.length === 0) {
            this.batchTimer = null;
            return;
        }

        const batch = this.eventQueue.splice(0);
        
        if (this.socket && this.isConnected) {
            this.socket.emit(EVENTS.DRAW_BATCH, {
                points: batch.map(e => e.data),
                timestamp: Date.now()
            });
        }

        this.batchTimer = null;
    }

    /**
     * Send stroke start
     */
    sendDrawStart(x, y, color, width, tool) {
        // Flush any pending points first
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.flushDrawQueue();
        }

        if (this.socket && this.isConnected) {
            this.socket.emit(EVENTS.DRAW_START, {
                x, y, color, width, tool,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Send stroke end
     */
    sendDrawEnd(strokeData) {
        // Flush any pending points first
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.flushDrawQueue();
        }

        if (this.socket && this.isConnected) {
            this.socket.emit(EVENTS.DRAW_END, {
                stroke: strokeData,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Send undo command
     */
    sendUndo(operationId) {
        if (this.socket && this.isConnected) {
            this.socket.emit(EVENTS.UNDO, {
                operationId,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Send redo command
     */
    sendRedo(operationId) {
        if (this.socket && this.isConnected) {
            this.socket.emit(EVENTS.REDO, {
                operationId,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Send clear canvas command
     */
    sendClear() {
        if (this.socket && this.isConnected) {
            this.socket.emit(EVENTS.CLEAR_CANVAS, {
                timestamp: Date.now()
            });
        }
    }

    /**
     * Send cursor position (throttled)
     */
    sendCursorPosition(x, y) {
        if (this.cursorTimer) return;

        this.cursorTimer = setTimeout(() => {
            if (this.socket && this.isConnected) {
                this.socket.emit(EVENTS.CURSOR_MOVE, {
                    x, y,
                    timestamp: Date.now()
                });
            }
            this.cursorTimer = null;
        }, this.cursorInterval);
    }

    /**
     * Register event handler
     */
    on(event, handler) {
        if (this.handlers[event]) {
            this.handlers[event].push(handler);
        }
    }

    /**
     * Unregister event handler
     */
    off(event, handler) {
        if (this.handlers[event]) {
            this.handlers[event] = this.handlers[event].filter(h => h !== handler);
        }
    }

    /**
     * Emit event to registered handlers
     */
    emit(event, data) {
        if (this.handlers[event]) {
            this.handlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            });
        }
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.isConnected = false;
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            userId: this.userId,
            roomId: this.roomId,
            queueSize: this.eventQueue.length
        };
    }

    /**
     * Get network latency (ping)
     */
    async getPing() {
        return new Promise((resolve) => {
            if (!this.socket || !this.isConnected) {
                resolve(-1);
                return;
            }

            const startTime = Date.now();
            this.socket.emit('ping', {}, () => {
                const latency = Date.now() - startTime;
                resolve(latency);
            });

            // Timeout after 5 seconds
            setTimeout(() => resolve(-1), 5000);
        });
    }
}