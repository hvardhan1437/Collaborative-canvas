/**
 * UIController - Manages UI interactions and updates
 */
class UIController {
    constructor() {
        // Tool state
        this.currentTool = 'brush';
        this.currentColor = CONFIG.DEFAULT_COLOR;
        this.currentBrushSize = CONFIG.DEFAULT_BRUSH_SIZE;
        
        // Users
        this.users = new Map();
        this.remoteCursors = new Map();
        
        // Elements
        this.elements = {};
        
        // Callbacks
        this.callbacks = {};
    }

    /**
     * Initialize UI
     */
    initialize() {
        this.cacheElements();
        this.setupToolbar();
        this.setupCanvas();
        this.setupKeyboardShortcuts();
        this.updateBrushPreview();
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Status
            connectionStatus: document.getElementById('connectionStatus'),
            usersOnline: document.getElementById('usersOnline'),
            canvasOverlay: document.getElementById('canvasOverlay'),
            
            // Toolbar
            toolButtons: document.querySelectorAll('.tool-btn'),
            colorPicker: document.getElementById('colorPicker'),
            colorPresets: document.querySelectorAll('.color-preset'),
            brushSize: document.getElementById('brushSize'),
            brushPreview: document.getElementById('brushPreview'),
            brushSizeValue: document.getElementById('brushSizeValue'),
            
            // Actions
            undoBtn: document.getElementById('undoBtn'),
            redoBtn: document.getElementById('redoBtn'),
            clearBtn: document.getElementById('clearBtn'),
            
            // Canvas
            canvas: document.getElementById('canvas'),
            cursorsLayer: document.getElementById('cursorsLayer'),
            
            // Users
            usersList: document.getElementById('usersList')
        };
    }

    /**
     * Setup toolbar interactions
     */
    setupToolbar() {
        // Tool buttons
        this.elements.toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTool(btn.dataset.tool);
            });
        });

        // Color picker
        this.elements.colorPicker.addEventListener('input', (e) => {
            this.setColor(e.target.value);
        });

        // Color presets
        this.elements.colorPresets.forEach(preset => {
            preset.addEventListener('click', () => {
                this.setColor(preset.dataset.color);
            });
        });

        // Brush size
        this.elements.brushSize.addEventListener('input', (e) => {
            this.setBrushSize(parseInt(e.target.value));
        });

        // Action buttons
        this.elements.undoBtn.addEventListener('click', () => {
            this.trigger('undo');
        });

        this.elements.redoBtn.addEventListener('click', () => {
            this.trigger('redo');
        });

        this.elements.clearBtn.addEventListener('click', () => {
            if (confirm('Clear the entire canvas? This cannot be undone.')) {
                this.trigger('clear');
            }
        });
    }

    /**
     * Setup canvas interactions
     */
    setupCanvas() {
        const canvas = this.elements.canvas;
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;

        // Mouse events
        canvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            lastX = e.clientX - rect.left;
            lastY = e.clientY - rect.top;
            
            this.trigger('drawStart', {
                x: lastX,
                y: lastY,
                color: this.currentColor,
                width: this.currentBrushSize,
                tool: this.currentTool
            });
        });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Send cursor position
            this.trigger('cursorMove', { x, y });

            if (isDrawing) {
                this.trigger('drawMove', {
                    x, y,
                    pressure: e.pressure || 1
                });
            }
            
            lastX = x;
            lastY = y;
        });

        canvas.addEventListener('mouseup', () => {
            if (isDrawing) {
                isDrawing = false;
                this.trigger('drawEnd');
            }
        });

        canvas.addEventListener('mouseleave', () => {
            if (isDrawing) {
                isDrawing = false;
                this.trigger('drawEnd');
            }
        });

        // Touch events for mobile
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            lastX = touch.clientX - rect.left;
            lastY = touch.clientY - rect.top;
            
            this.trigger('drawStart', {
                x: lastX,
                y: lastY,
                color: this.currentColor,
                width: this.currentBrushSize,
                tool: this.currentTool
            });
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            this.trigger('drawMove', {
                x, y,
                pressure: touch.force || 1
            });
        });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.trigger('drawEnd');
        });
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Z = Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.trigger('undo');
            }
            
            // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = Redo
            if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
                e.preventDefault();
                this.trigger('redo');
            }

            // B = Brush
            if (e.key === 'b' || e.key === 'B') {
                this.selectTool('brush');
            }

            // E = Eraser
            if (e.key === 'e' || e.key === 'E') {
                this.selectTool('eraser');
            }

            // [ = Decrease brush size
            if (e.key === '[') {
                this.setBrushSize(Math.max(CONFIG.MIN_BRUSH_SIZE, this.currentBrushSize - 1));
            }

            // ] = Increase brush size
            if (e.key === ']') {
                this.setBrushSize(Math.min(CONFIG.MAX_BRUSH_SIZE, this.currentBrushSize + 1));
            }
        });
    }

    /**
     * Select tool
     */
    selectTool(tool) {
        this.currentTool = tool;
        
        // Update UI
        this.elements.toolButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });

        // Update cursor
        if (tool === 'eraser') {
            this.elements.canvas.style.cursor = 'cell';
        } else {
            this.elements.canvas.style.cursor = 'crosshair';
        }
    }

    /**
     * Set color
     */
    setColor(color) {
        this.currentColor = color;
        this.elements.colorPicker.value = color;
        this.updateBrushPreview();
    }

    /**
     * Set brush size
     */
    setBrushSize(size) {
        this.currentBrushSize = size;
        this.elements.brushSize.value = size;
        this.elements.brushSizeValue.textContent = `${size}px`;
        this.updateBrushPreview();
    }

    /**
     * Update brush preview
     */
    updateBrushPreview() {
        this.elements.brushPreview.style.setProperty('--brush-size', `${this.currentBrushSize}px`);
        this.elements.brushPreview.style.setProperty('--brush-color', this.currentColor);
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(connected) {
        const statusDot = this.elements.connectionStatus.querySelector('.status-dot');
        const statusText = this.elements.connectionStatus.querySelector('.status-text');
        
        if (connected) {
            statusDot.classList.add('connected');
            statusText.textContent = 'Connected';
            this.hideOverlay();
        } else {
            statusDot.classList.remove('connected');
            statusText.textContent = 'Disconnected';
            this.showOverlay('Reconnecting...');
        }
    }

    /**
     * Update users list
     */
    updateUsersList(users, currentUserId) {
        this.users = new Map(users.map(u => [u.id, u]));
        
        // Update count
        const count = this.elements.usersOnline.querySelector('.users-count');
        count.textContent = users.length;
        
        // Update list
        this.elements.usersList.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-color" style="background: ${user.color}"></div>
                <div class="user-name">${user.name}</div>
                ${user.id === currentUserId ? '<span class="user-you">You</span>' : ''}
            </div>
        `).join('');
        
        // Set current user's color in the color picker
        const currentUser = users.find(u => u.id === currentUserId);
        if (currentUser) {
            this.setColor(currentUser.color);
            // Optionally disable color picker to force user color
            // this.elements.colorPicker.disabled = true;
            // this.elements.colorPresets.forEach(preset => preset.disabled = true);
        }
    }

    /**
     * Update remote cursor
     */
    updateRemoteCursor(userId, x, y) {
        const user = this.users.get(userId);
        if (!user) return;

        let cursor = this.remoteCursors.get(userId);
        
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.className = 'remote-cursor';
            cursor.style.background = user.color;
            cursor.style.setProperty('--cursor-color', user.color);
            cursor.dataset.username = user.name;
            this.elements.cursorsLayer.appendChild(cursor);
            this.remoteCursors.set(userId, cursor);
        }

        // Update position relative to canvas
        const rect = this.elements.canvas.getBoundingClientRect();
        cursor.style.left = `${rect.left + x}px`;
        cursor.style.top = `${rect.top + y}px`;
        cursor.style.display = 'block';
    }

    /**
     * Remove remote cursor
     */
    removeRemoteCursor(userId) {
        const cursor = this.remoteCursors.get(userId);
        if (cursor) {
            cursor.remove();
            this.remoteCursors.delete(userId);
        }
    }

    /**
     * Update undo/redo buttons
     */
    updateUndoRedoButtons(canUndo, canRedo) {
        this.elements.undoBtn.disabled = !canUndo;
        this.elements.redoBtn.disabled = !canRedo;
    }

    /**
     * Show overlay
     */
    showOverlay(message) {
        const overlay = this.elements.canvasOverlay;
        overlay.querySelector('.overlay-message').textContent = message;
        overlay.classList.remove('hidden');
    }

    /**
     * Hide overlay
     */
    hideOverlay() {
        this.elements.canvasOverlay.classList.add('hidden');
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Simple console notification (can be enhanced with toast)
        console.log(`[${type.toUpperCase()}]`, message);
    }

    /**
     * Register callback
     */
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    /**
     * Trigger callback
     */
    trigger(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(cb => cb(data));
        }
    }

    /**
     * Get current tool settings
     */
    getCurrentSettings() {
        return {
            tool: this.currentTool,
            color: this.currentColor,
            brushSize: this.currentBrushSize
        };
    }
}