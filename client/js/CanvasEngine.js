/**
 * CanvasEngine - Handles all canvas drawing operations
 * Uses three-layer rendering for performance optimization
 */
class CanvasEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { 
            alpha: true,  // Changed to true for eraser support
            desynchronized: true // Performance hint
        });
        
        // Three-layer system
        this.committedStrokes = []; // Completed strokes
        this.activeStrokes = new Map(); // userId -> in-progress stroke
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d');
        
        // Set canvas size
        this.tempCanvas.width = canvas.width;
        this.tempCanvas.height = canvas.height;
        
        // Drawing state
        this.currentStroke = null;
        this.rafId = null;
        this.needsRedraw = false;
        
        // Performance tracking
        this.lastFrameTime = 0;
        this.frameCount = 0;
        
        this.initialize();
    }

    initialize() {
        // Set canvas background
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set default drawing properties
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.imageSmoothingEnabled = true;
    }

    /**
     * Start a new stroke for local user
     */
    startStroke(x, y, color, width, tool = 'brush') {
        this.currentStroke = {
            points: [{x, y, pressure: 1}],
            color: color,
            width: width,
            tool: tool,
            isComplete: false
        };
        
        return this.currentStroke;
    }

    /**
     * Add point to current stroke (local user)
     */
    addPoint(x, y, pressure = 1) {
        if (!this.currentStroke) return null;
        
        const point = {x, y, pressure};
        this.currentStroke.points.push(point);
        
        // Draw incrementally for smooth feedback
        this.drawStrokeSegment(
            this.currentStroke,
            this.currentStroke.points.length - 2
        );
        
        return point;
    }

    /**
     * End current stroke
     */
    endStroke() {
        if (!this.currentStroke) return null;
        
        this.currentStroke.isComplete = true;
        const stroke = {...this.currentStroke};
        
        // Commit to base layer
        this.committedStrokes.push(stroke);
        this.currentStroke = null;
        
        return stroke;
    }

    /**
     * Start remote user's stroke
     */
    startRemoteStroke(userId, x, y, color, width, tool = 'brush') {
        const stroke = {
            points: [{x, y, pressure: 1}],
            color: color,
            width: width,
            tool: tool,
            userId: userId,
            isComplete: false
        };
        
        this.activeStrokes.set(userId, stroke);
        this.scheduleRedraw();
    }

    /**
     * Add point to remote user's stroke
     */
    addRemotePoint(userId, x, y, pressure = 1) {
        const stroke = this.activeStrokes.get(userId);
        if (!stroke) return;
        
        stroke.points.push({x, y, pressure});
        this.scheduleRedraw();
    }

    /**
     * End remote user's stroke
     */
    endRemoteStroke(userId) {
        const stroke = this.activeStrokes.get(userId);
        if (!stroke) return;
        
        stroke.isComplete = true;
        this.committedStrokes.push(stroke);
        this.activeStrokes.delete(userId);
        this.scheduleRedraw();
    }

    /**
     * Draw a stroke segment (for incremental drawing)
     */
    drawStrokeSegment(stroke, fromIndex) {
        if (fromIndex < 0) fromIndex = 0;
        if (fromIndex >= stroke.points.length - 1) return;
        
        const points = stroke.points;
        
        this.ctx.strokeStyle = stroke.color;
        this.ctx.lineWidth = stroke.width;
        this.ctx.globalCompositeOperation = 
            stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
        
        this.ctx.beginPath();
        
        if (fromIndex === 0) {
            this.ctx.moveTo(points[0].x, points[0].y);
        } else {
            this.ctx.moveTo(points[fromIndex].x, points[fromIndex].y);
        }
        
        // Draw smooth curve through points
        for (let i = fromIndex + 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            
            // Use quadratic curves for smoothness
            const midX = (prev.x + curr.x) / 2;
            const midY = (prev.y + curr.y) / 2;
            
            this.ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
        
        // Final point
        const lastPoint = points[points.length - 1];
        this.ctx.lineTo(lastPoint.x, lastPoint.y);
        this.ctx.stroke();
        
        this.ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * Draw complete stroke
     */
    drawStroke(stroke, context = this.ctx) {
        if (!stroke.points || stroke.points.length === 0) return;
        
        // Set composite operation based on tool
        if (stroke.tool === 'eraser') {
            context.globalCompositeOperation = 'destination-out';
            context.strokeStyle = 'rgba(0,0,0,1)'; // Color doesn't matter for eraser
            context.fillStyle = 'rgba(0,0,0,1)';
        } else {
            context.globalCompositeOperation = 'source-over';
            context.strokeStyle = stroke.color;
            context.fillStyle = stroke.color;
        }
        
        context.lineWidth = stroke.width;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        
        context.beginPath();
        
        const points = stroke.points;
        context.moveTo(points[0].x, points[0].y);
        
        if (points.length === 1) {
            // Single point - draw a dot
            context.arc(points[0].x, points[0].y, stroke.width / 2, 0, Math.PI * 2);
            context.fill();
        } else {
            // Multiple points - draw smooth curve
            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const midX = (prev.x + curr.x) / 2;
                const midY = (prev.y + curr.y) / 2;
                context.quadraticCurveTo(prev.x, prev.y, midX, midY);
            }
            
            // Final point
            const last = points[points.length - 1];
            context.lineTo(last.x, last.y);
            context.stroke();
        }
        
        // Reset composite operation
        context.globalCompositeOperation = 'source-over';
    }

    /**
     * Schedule a redraw (debounced with RAF)
     */
    scheduleRedraw() {
        if (this.rafId) return;
        
        this.rafId = requestAnimationFrame(() => {
            this.redraw();
            this.rafId = null;
        });
    }

    /**
     * Full canvas redraw from committed strokes
     */
    redraw() {
        // Clear canvas
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw all committed strokes
        this.committedStrokes.forEach(stroke => {
            this.drawStroke(stroke);
        });
        
        // Draw active strokes (remote users currently drawing)
        this.activeStrokes.forEach(stroke => {
            this.drawStroke(stroke);
        });
        
        // Draw current user's in-progress stroke
        if (this.currentStroke) {
            this.drawStroke(this.currentStroke);
        }
    }

    /**
     * Load strokes from history (for undo/redo)
     */
    loadStrokes(strokes) {
        this.committedStrokes = [...strokes];
        this.scheduleRedraw();
    }

    /**
     * Clear canvas completely
     */
    clear() {
        this.committedStrokes = [];
        this.activeStrokes.clear();
        this.currentStroke = null;
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Get canvas as data URL
     */
    toDataURL(type = 'image/png') {
        return this.canvas.toDataURL(type);
    }

    /**
     * Get current canvas state
     */
    getState() {
        return {
            strokes: [...this.committedStrokes],
            activeStrokes: Array.from(this.activeStrokes.entries()),
            timestamp: Date.now()
        };
    }

    /**
     * Optimize stroke data (reduce points)
     */
    optimizeStroke(stroke, tolerance = 2) {
        if (stroke.points.length <= 2) return stroke;
        
        const optimized = [stroke.points[0]];
        
        for (let i = 1; i < stroke.points.length - 1; i++) {
            const prev = stroke.points[i - 1];
            const curr = stroke.points[i];
            const next = stroke.points[i + 1];
            
            // Calculate distance from line
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const lineLengthSquared = dx * dx + dy * dy;
            
            if (lineLengthSquared === 0) continue;
            
            const t = ((curr.x - prev.x) * dx + (curr.y - prev.y) * dy) / lineLengthSquared;
            const projX = prev.x + t * dx;
            const projY = prev.y + t * dy;
            
            const distance = Math.sqrt(
                (curr.x - projX) ** 2 + (curr.y - projY) ** 2
            );
            
            if (distance > tolerance) {
                optimized.push(curr);
            }
        }
        
        optimized.push(stroke.points[stroke.points.length - 1]);
        
        return {...stroke, points: optimized};
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            committedStrokes: this.committedStrokes.length,
            activeStrokes: this.activeStrokes.size,
            totalPoints: this.committedStrokes.reduce(
                (sum, stroke) => sum + stroke.points.length, 0
            )
        };
    }
}