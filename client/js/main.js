/**
 * Main Application Entry Point
 * Initializes and connects all components
 */

class CollaborativeCanvas {
    constructor() {
        this.canvasEngine = null;
        this.stateManager = null;
        this.wsClient = null;
        this.uiController = null;
        
        this.isDrawing = false;
        this.currentStrokeId = null;
    }

    /**
     * Initialize the application
     */
    async initialize() {
        console.log('Initializing Collaborative Canvas...');

        try {
            // Initialize components
            this.initializeComponents();
            
            // Connect to server
            await this.connectToServer();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            console.log('Application initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.uiController.showOverlay('Failed to connect to server. Refresh to retry.');
        }
    }

    /**
     * Initialize all components
     */
    initializeComponents() {
        const canvas = document.getElementById('canvas');
        
        // Initialize engines
        this.canvasEngine = new CanvasEngine(canvas);
        this.stateManager = new StateManager(this.canvasEngine);
        this.wsClient = new WebSocketClient();
        this.uiController = new UIController();
        
        // Initialize UI
        this.uiController.initialize();
        
        console.log('Components initialized');
    }

    /**
     * Connect to WebSocket server
     */
    async connectToServer() {
        this.uiController.showOverlay('Connecting to server...');
        
        try {
            await this.wsClient.connect();
            
            // Join default room
            this.wsClient.joinRoom('default');
            
            // Wait for room join confirmation
            await this.waitForRoomJoin();
            
            console.log('Connected to server');
            
        } catch (error) {
            console.error('Connection failed:', error);
            throw error;
        }
    }

    /**
     * Wait for room join confirmation
     */
    waitForRoomJoin() {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(), 3000);
            
            const handler = (data) => {
                clearTimeout(timeout);
                this.stateManager.initialize(this.wsClient.userId);
                this.wsClient.off('usersList', handler);
                resolve();
            };
            
            this.wsClient.on('usersList', handler);
        });
    }

    /**
     * Setup all event handlers
     */
    setupEventHandlers() {
        this.setupUIHandlers();
        this.setupWebSocketHandlers();
    }

    /**
     * Setup UI event handlers
     */
    setupUIHandlers() {
        // Drawing events
        this.uiController.on('drawStart', (data) => {
            this.handleDrawStart(data);
        });

        this.uiController.on('drawMove', (data) => {
            this.handleDrawMove(data);
        });

        this.uiController.on('drawEnd', () => {
            this.handleDrawEnd();
        });

        // Cursor movement
        this.uiController.on('cursorMove', (data) => {
            this.wsClient.sendCursorPosition(data.x, data.y);
        });

        // Actions
        this.uiController.on('undo', () => {
            this.handleUndo();
        });

        this.uiController.on('redo', () => {
            this.handleRedo();
        });

        this.uiController.on('clear', () => {
            this.handleClear();
        });
    }

    /**
     * Setup WebSocket event handlers
     */
    setupWebSocketHandlers() {
        // Connection events
        this.wsClient.on('connected', () => {
            this.uiController.updateConnectionStatus(true);
        });

        this.wsClient.on('disconnected', () => {
            this.uiController.updateConnectionStatus(false);
        });

        // User events
        this.wsClient.on('userJoined', (data) => {
            this.uiController.showNotification(`${data.user.name} joined`, 'info');
        });

        this.wsClient.on('userLeft', (data) => {
            this.uiController.showNotification(`${data.user.name} left`, 'info');
            this.uiController.removeRemoteCursor(data.user.id);
        });

        this.wsClient.on('usersList', (data) => {
            this.uiController.updateUsersList(data.users, this.wsClient.userId);
        });

        // Drawing events
        this.wsClient.on('remoteDraw', (data) => {
            this.handleRemoteDraw(data);
        });

        this.wsClient.on('remoteDrawEnd', (data) => {
            this.handleRemoteDrawEnd(data);
        });

        // Action events
        this.wsClient.on('remoteUndo', (data) => {
            this.handleRemoteUndo(data);
        });

        this.wsClient.on('remoteRedo', (data) => {
            this.handleRemoteRedo(data);
        });

        this.wsClient.on('remoteClear', (data) => {
            this.handleRemoteClear(data);
        });

        // Cursor events
        this.wsClient.on('remoteCursor', (data) => {
            this.uiController.updateRemoteCursor(data.userId, data.x, data.y);
        });

        // State sync
        this.wsClient.on('syncState', (data) => {
            this.handleStateSync(data);
        });

        // Error events
        this.wsClient.on('error', (error) => {
            this.uiController.showNotification(error, 'error');
        });
    }

    /**
     * Handle draw start
     */
    handleDrawStart(data) {
        this.isDrawing = true;
        this.currentStrokeId = this.generateStrokeId();
        
        // Use the color selected by user from color picker
        // NOT the assigned identification color
        this.canvasEngine.startStroke(
            data.x, data.y, data.color, data.width, data.tool
        );
        
        // Send to server
        this.wsClient.sendDrawStart(
            data.x, data.y, data.color, data.width, data.tool
        );
    }

    /**
     * Handle draw move
     */
    handleDrawMove(data) {
        if (!this.isDrawing) return;
        
        // Add point to canvas
        const point = this.canvasEngine.addPoint(data.x, data.y, data.pressure);
        
        if (point) {
            // Send to server (will be batched)
            this.wsClient.sendDrawPoints([point]);
        }
    }

    /**
     * Handle draw end
     */
    handleDrawEnd() {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        // End stroke in canvas
        const stroke = this.canvasEngine.endStroke();
        
        if (stroke) {
            // Add to state manager
            const operation = this.stateManager.addOperation(
                this.stateManager.TYPES.STROKE,
                stroke
            );
            
            // Send to server
            this.wsClient.sendDrawEnd({
                ...stroke,
                operationId: operation.id
            });
            
            // Update undo/redo buttons
            this.updateUndoRedoState();
        }
    }

    /**
     * Handle remote draw
     */
    handleRemoteDraw(data) {
        const { userId, points, color, width, tool } = data;
        
        // Check if stroke already started
        if (!this.canvasEngine.activeStrokes.has(userId)) {
            // Start remote stroke with first point
            if (points.length > 0) {
                const firstPoint = points[0];
                this.canvasEngine.startRemoteStroke(
                    userId,
                    firstPoint.x,
                    firstPoint.y,
                    color || '#000000',
                    width || 3,
                    tool || 'brush'
                );
            }
        }
        
        // Add all points
        points.forEach(point => {
            this.canvasEngine.addRemotePoint(userId, point.x, point.y, point.pressure || 1);
        });
    }

    /**
     * Handle remote draw end
     */
    handleRemoteDrawEnd(data) {
        const { userId, stroke, operationId } = data;
        
        // End remote stroke
        this.canvasEngine.endRemoteStroke(userId);
        
        // Add to state manager
        this.stateManager.addOperation(
            this.stateManager.TYPES.STROKE,
            stroke,
            userId
        );
        
        // Update UI
        this.updateUndoRedoState();
    }

    /**
     * Handle undo
     */
    handleUndo() {
        const operation = this.stateManager.undoOperation();
        
        if (operation) {
            // Send to server
            this.wsClient.sendUndo(operation.id);
            
            // Update UI
            this.updateUndoRedoState();
        }
    }

    /**
     * Handle redo
     */
    handleRedo() {
        const operation = this.stateManager.redoOperation();
        
        if (operation) {
            // Send to server
            this.wsClient.sendRedo(operation.id);
            
            // Update UI
            this.updateUndoRedoState();
        }
    }

    /**
     * Handle clear
     */
    handleClear() {
        const operation = this.stateManager.clearHistory();
        
        if (operation) {
            // Send to server
            this.wsClient.sendClear();
            
            // Update UI
            this.updateUndoRedoState();
        }
    }

    /**
     * Handle remote undo
     */
    handleRemoteUndo(data) {
        this.stateManager.processRemoteUndo(data.operationId, data.userId);
        this.updateUndoRedoState();
    }

    /**
     * Handle remote redo
     */
    handleRemoteRedo(data) {
        this.stateManager.processRemoteRedo(data.operationId, data.userId);
        this.updateUndoRedoState();
    }

    /**
     * Handle remote clear
     */
    handleRemoteClear(data) {
        this.canvasEngine.clear();
        this.stateManager.operations = [];
        this.stateManager.currentIndex = -1;
        this.updateUndoRedoState();
    }

    /**
     * Handle state sync (for late joiners)
     */
    handleStateSync(data) {
        if (data.operations && data.operations.length > 0) {
            this.stateManager.mergeOperations(data.operations);
            this.updateUndoRedoState();
        }
    }

    /**
     * Update undo/redo button states
     */
    updateUndoRedoState() {
        const stats = this.stateManager.getStats();
        this.uiController.updateUndoRedoButtons(stats.canUndo, stats.canRedo);
    }

    /**
     * Generate unique stroke ID
     */
    generateStrokeId() {
        return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get application state
     */
    getState() {
        return {
            canvas: this.canvasEngine.getState(),
            state: this.stateManager.getState(),
            connection: this.wsClient.getStatus()
        };
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CollaborativeCanvas();
    window.app.initialize();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.app && window.app.wsClient) {
        window.app.wsClient.disconnect();
    }
});

// Expose for debugging
window.getAppState = () => {
    if (window.app) {
        return window.app.getState();
    }
    return null;
};