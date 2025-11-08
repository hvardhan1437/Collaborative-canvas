/**
 * OperationLog - Maintains event sourcing log for canvas operations
 * Handles operation history with tombstone pattern for undo/redo
 */
const VectorClock = require('./VectorClock');

class OperationLog {
    constructor(roomId) {
        this.roomId = roomId;
        this.operations = []; // Complete operation history
        this.vectorClock = new VectorClock();
        
        // Operation states
        this.STATES = {
            ACTIVE: 'active',
            UNDONE: 'undone'
        };

        // Operation types
        this.TYPES = {
            STROKE: 'stroke',
            CLEAR: 'clear'
        };

        // Configuration
        this.maxOperations = 1000; // Limit history size
        this.createdAt = Date.now();
    }

    /**
     * Add a new operation to the log
     */
    addOperation(userId, type, data) {
        // Increment vector clock
        const vectorClock = this.vectorClock.increment(userId);

        const operation = {
            id: this.generateOperationId(userId),
            type,
            data,
            userId,
            state: this.STATES.ACTIVE,
            vectorClock,
            timestamp: Date.now(),
            roomId: this.roomId
        };

        this.operations.push(operation);
        this.trimOperations();

        return operation;
    }

    /**
     * Mark an operation as undone
     */
    undoOperation(operationId, userId) {
        const operation = this.operations.find(op => op.id === operationId);

        if (!operation) {
            return { success: false, error: 'Operation not found' };
        }

        if (operation.state !== this.STATES.ACTIVE) {
            return { success: false, error: 'Operation already undone' };
        }

        operation.state = this.STATES.UNDONE;
        operation.undoneBy = userId;
        operation.undoneAt = Date.now();

        return { success: true, operation };
    }

    /**
     * Mark an operation as redone (reactivate)
     */
    redoOperation(operationId, userId) {
        const operation = this.operations.find(op => op.id === operationId);

        if (!operation) {
            return { success: false, error: 'Operation not found' };
        }

        if (operation.state !== this.STATES.UNDONE) {
            return { success: false, error: 'Operation is not undone' };
        }

        operation.state = this.STATES.ACTIVE;
        operation.redoneBy = userId;
        operation.redoneAt = Date.now();

        return { success: true, operation };
    }

    /**
     * Clear all operations
     */
    clearOperations(userId) {
        const clearOp = this.addOperation(userId, this.TYPES.CLEAR, {
            clearedCount: this.getActiveOperations().length,
            timestamp: Date.now()
        });

        // Mark all previous operations as undone
        this.operations.forEach(op => {
            if (op.id !== clearOp.id && op.state === this.STATES.ACTIVE) {
                op.state = this.STATES.UNDONE;
                op.undoneBy = userId;
                op.undoneAt = Date.now();
            }
        });

        return clearOp;
    }

    /**
     * Get all active operations
     */
    getActiveOperations() {
        return this.operations.filter(op => op.state === this.STATES.ACTIVE);
    }

    /**
     * Get all operations (including undone)
     */
    getAllOperations() {
        return [...this.operations];
    }

    /**
     * Get operations for a specific user
     */
    getUserOperations(userId) {
        return this.operations.filter(op => op.userId === userId);
    }

    /**
     * Get the last active operation for undo
     */
    getLastActiveOperation() {
        for (let i = this.operations.length - 1; i >= 0; i--) {
            if (this.operations[i].state === this.STATES.ACTIVE) {
                return this.operations[i];
            }
        }
        return null;
    }

    /**
     * Get the last undone operation for redo
     */
    getLastUndoneOperation() {
        for (let i = this.operations.length - 1; i >= 0; i--) {
            if (this.operations[i].state === this.STATES.UNDONE) {
                return this.operations[i];
            }
        }
        return null;
    }

    /**
     * Merge operations from another source (for synchronization)
     */
    mergeOperations(externalOperations) {
        const existing = new Set(this.operations.map(op => op.id));
        const newOps = externalOperations.filter(op => !existing.has(op.id));

        // Update vector clock
        newOps.forEach(op => {
            if (op.vectorClock) {
                this.vectorClock.update(op.vectorClock);
            }
        });

        // Add new operations
        this.operations.push(...newOps);

        // Sort by causal order
        this.operations = VectorClock.sortEvents(this.operations);

        this.trimOperations();

        return {
            merged: newOps.length,
            total: this.operations.length
        };
    }

    /**
     * Trim operations to max size
     */
    trimOperations() {
        if (this.operations.length > this.maxOperations) {
            const toRemove = this.operations.length - this.maxOperations;
            this.operations = this.operations.slice(toRemove);
            console.log(`[OperationLog] Trimmed ${toRemove} old operations`);
        }
    }

    /**
     * Generate unique operation ID
     */
    generateOperationId(userId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${userId}_${timestamp}_${random}`;
    }

    /**
     * Get operation by ID
     */
    getOperation(operationId) {
        return this.operations.find(op => op.id === operationId);
    }

    /**
     * Check if operation exists
     */
    hasOperation(operationId) {
        return this.operations.some(op => op.id === operationId);
    }

    /**
     * Get statistics
     */
    getStats() {
        const active = this.getActiveOperations().length;
        const undone = this.operations.filter(op => op.state === this.STATES.UNDONE).length;
        const strokes = this.operations.filter(op => op.type === this.TYPES.STROKE).length;
        const clears = this.operations.filter(op => op.type === this.TYPES.CLEAR).length;

        return {
            total: this.operations.length,
            active,
            undone,
            strokes,
            clears,
            roomId: this.roomId,
            createdAt: this.createdAt,
            age: Date.now() - this.createdAt
        };
    }

    /**
     * Get current state snapshot
     */
    getStateSnapshot() {
        return {
            operations: this.getAllOperations(),
            vectorClock: this.vectorClock.getClock(),
            stats: this.getStats(),
            timestamp: Date.now()
        };
    }

    /**
     * Rebuild state from operations (for validation)
     */
    rebuildState() {
        const activeOps = this.getActiveOperations();
        const strokes = activeOps.filter(op => op.type === this.TYPES.STROKE);

        return {
            strokes: strokes.map(op => op.data),
            operationCount: activeOps.length
        };
    }

    /**
     * Export operations for persistence
     */
    export() {
        return {
            roomId: this.roomId,
            operations: this.operations,
            vectorClock: this.vectorClock.getClock(),
            createdAt: this.createdAt,
            exportedAt: Date.now()
        };
    }

    /**
     * Import operations from persistence
     */
    import(data) {
        if (data.roomId !== this.roomId) {
            throw new Error('Room ID mismatch');
        }

        this.operations = data.operations || [];
        this.vectorClock.clock = data.vectorClock || {};
        this.createdAt = data.createdAt || Date.now();

        console.log(`[OperationLog] Imported ${this.operations.length} operations`);
    }

    /**
     * Clear all data
     */
    reset() {
        this.operations = [];
        this.vectorClock.reset();
        console.log(`[OperationLog] Reset room ${this.roomId}`);
    }

    /**
     * Get memory usage estimate (in MB)
     */
    getMemoryUsage() {
        const json = JSON.stringify(this.operations);
        const bytes = new TextEncoder().encode(json).length;
        return (bytes / 1024 / 1024).toFixed(2);
    }
}

module.exports = OperationLog;