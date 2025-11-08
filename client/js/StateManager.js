/**
 * StateManager - Handles operation history and undo/redo with tombstone pattern
 * Uses event sourcing for global state synchronization
 */
class StateManager {
    constructor(canvasEngine) {
        this.canvasEngine = canvasEngine;
        
        // Operation log with tombstone pattern
        this.operations = []; // {id, type, data, state, userId, timestamp}
        this.currentIndex = -1; // Pointer to current operation
        
        // Vector clock for conflict resolution
        this.vectorClock = {};
        this.userId = null;
        
        // Operation states
        this.STATES = {
            ACTIVE: 'active',
            UNDONE: 'undone',
            REDONE: 'redone'
        };
        
        // Operation types
        this.TYPES = {
            STROKE: 'stroke',
            CLEAR: 'clear'
        };
        
        // Max history size
        this.maxHistorySize = 500;
    }

    /**
     * Initialize with user ID
     */
    initialize(userId) {
        this.userId = userId;
        this.vectorClock[userId] = 0;
    }

    /**
     * Add a new operation to history
     */
    addOperation(type, data, userId = this.userId) {
        // Increment vector clock
        if (!this.vectorClock[userId]) {
            this.vectorClock[userId] = 0;
        }
        this.vectorClock[userId]++;
        
        const operation = {
            id: this.generateOperationId(),
            type: type,
            data: data,
            state: this.STATES.ACTIVE,
            userId: userId,
            timestamp: Date.now(),
            vectorClock: {...this.vectorClock}
        };
        
        // Remove any operations after current index (when adding after undo)
        if (this.currentIndex < this.operations.length - 1) {
            this.operations = this.operations.slice(0, this.currentIndex + 1);
        }
        
        this.operations.push(operation);
        this.currentIndex++;
        
        // Trim history if too large
        this.trimHistory();
        
        return operation;
    }

    /**
     * Mark operation as undone
     */
    undoOperation() {
        // Find the last active operation
        for (let i = this.currentIndex; i >= 0; i--) {
            if (this.operations[i].state === this.STATES.ACTIVE) {
                this.operations[i].state = this.STATES.UNDONE;
                this.operations[i].undoneBy = this.userId;
                this.operations[i].undoneAt = Date.now();
                this.currentIndex = i - 1;
                
                this.rebuildCanvas();
                return this.operations[i];
            }
        }
        
        return null;
    }

    /**
     * Mark operation as redone
     */
    redoOperation() {
        // Find the next undone operation
        for (let i = this.currentIndex + 1; i < this.operations.length; i++) {
            if (this.operations[i].state === this.STATES.UNDONE) {
                this.operations[i].state = this.STATES.ACTIVE;
                this.operations[i].redoneBy = this.userId;
                this.operations[i].redoneAt = Date.now();
                this.currentIndex = i;
                
                this.rebuildCanvas();
                return this.operations[i];
            }
        }
        
        return null;
    }

    /**
     * Process remote undo operation
     */
    processRemoteUndo(operationId, userId) {
        const operation = this.operations.find(op => op.id === operationId);
        
        if (operation && operation.state === this.STATES.ACTIVE) {
            operation.state = this.STATES.UNDONE;
            operation.undoneBy = userId;
            operation.undoneAt = Date.now();
            
            this.rebuildCanvas();
            return true;
        }
        
        return false;
    }

    /**
     * Process remote redo operation
     */
    processRemoteRedo(operationId, userId) {
        const operation = this.operations.find(op => op.id === operationId);
        
        if (operation && operation.state === this.STATES.UNDONE) {
            operation.state = this.STATES.ACTIVE;
            operation.redoneBy = userId;
            operation.redoneAt = Date.now();
            
            this.rebuildCanvas();
            return true;
        }
        
        return false;
    }

    /**
     * Rebuild canvas from operation history
     */
    rebuildCanvas() {
        // Get all active operations
        const activeOperations = this.operations.filter(
            op => op.state === this.STATES.ACTIVE
        );
        
        // Clear canvas
        this.canvasEngine.clear();
        
        // Redraw all active strokes
        const strokes = activeOperations
            .filter(op => op.type === this.TYPES.STROKE)
            .map(op => op.data);
        
        this.canvasEngine.loadStrokes(strokes);
    }

    /**
     * Merge remote operations (for late joiners)
     */
    mergeOperations(remoteOperations) {
        // Update vector clock
        remoteOperations.forEach(op => {
            if (op.vectorClock) {
                Object.keys(op.vectorClock).forEach(userId => {
                    this.vectorClock[userId] = Math.max(
                        this.vectorClock[userId] || 0,
                        op.vectorClock[userId]
                    );
                });
            }
        });
        
        // Merge operations maintaining causality
        const merged = this.mergeWithCausality(this.operations, remoteOperations);
        this.operations = merged;
        
        // Update current index
        this.currentIndex = this.operations.filter(
            op => op.state === this.STATES.ACTIVE
        ).length - 1;
        
        this.rebuildCanvas();
    }

    /**
     * Merge operations using vector clocks for ordering
     */
    mergeWithCausality(local, remote) {
        const allOps = [...local, ...remote];
        const uniqueOps = new Map();
        
        // Remove duplicates
        allOps.forEach(op => {
            if (!uniqueOps.has(op.id)) {
                uniqueOps.set(op.id, op);
            }
        });
        
        // Sort by vector clock (causal order)
        return Array.from(uniqueOps.values()).sort((a, b) => {
            if (this.happensBefore(a.vectorClock, b.vectorClock)) return -1;
            if (this.happensBefore(b.vectorClock, a.vectorClock)) return 1;
            return a.timestamp - b.timestamp; // Fallback to timestamp
        });
    }

    /**
     * Check if event A happened before event B (vector clock comparison)
     */
    happensBefore(clockA, clockB) {
        if (!clockA || !clockB) return false;
        
        let hasLess = false;
        const allUsers = new Set([
            ...Object.keys(clockA),
            ...Object.keys(clockB)
        ]);
        
        for (const userId of allUsers) {
            const valueA = clockA[userId] || 0;
            const valueB = clockB[userId] || 0;
            
            if (valueA > valueB) return false;
            if (valueA < valueB) hasLess = true;
        }
        
        return hasLess;
    }

    /**
     * Clear all operations
     */
    clearHistory() {
        const clearOp = this.addOperation(this.TYPES.CLEAR, {
            timestamp: Date.now()
        });
        
        this.canvasEngine.clear();
        return clearOp;
    }

    /**
     * Trim history to max size
     */
    trimHistory() {
        if (this.operations.length > this.maxHistorySize) {
            const toRemove = this.operations.length - this.maxHistorySize;
            this.operations = this.operations.slice(toRemove);
            this.currentIndex = Math.max(0, this.currentIndex - toRemove);
        }
    }

    /**
     * Generate unique operation ID
     */
    generateOperationId() {
        return `${this.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check if undo is possible
     */
    canUndo() {
        for (let i = this.currentIndex; i >= 0; i--) {
            if (this.operations[i].state === this.STATES.ACTIVE) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if redo is possible
     */
    canRedo() {
        for (let i = this.currentIndex + 1; i < this.operations.length; i++) {
            if (this.operations[i].state === this.STATES.UNDONE) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get current state for synchronization
     */
    getState() {
        return {
            operations: this.operations,
            vectorClock: {...this.vectorClock},
            currentIndex: this.currentIndex
        };
    }

    /**
     * Get active strokes for display
     */
    getActiveStrokes() {
        return this.operations
            .filter(op => op.type === this.TYPES.STROKE && op.state === this.STATES.ACTIVE)
            .map(op => op.data);
    }

    /**
     * Get statistics
     */
    getStats() {
        const active = this.operations.filter(op => op.state === this.STATES.ACTIVE).length;
        const undone = this.operations.filter(op => op.state === this.STATES.UNDONE).length;
        
        return {
            total: this.operations.length,
            active,
            undone,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }
}