/**
 * RoomManager - Manages multiple drawing rooms and user sessions
 */
const OperationLog = require('./OperationLog');
const { CONFIG } = require('../shared/constants');

class RoomManager {
    constructor() {
        this.rooms = new Map(); // roomId -> Room
        this.users = new Map(); // socketId -> User
        this.userColors = [...CONFIG.USER_COLORS];
        
        // Configuration
        this.maxUsersPerRoom = 20;
        this.roomTimeout = 3600000; // 1 hour of inactivity
        
        // Start cleanup interval
        this.startCleanupTimer();
    }

    /**
     * Create a new room
     */
    createRoom(roomId) {
        if (this.rooms.has(roomId)) {
            return this.rooms.get(roomId);
        }

        const room = {
            id: roomId,
            users: new Map(), // userId -> User
            operationLog: new OperationLog(roomId),
            createdAt: Date.now(),
            lastActivity: Date.now()
        };

        this.rooms.set(roomId, room);
        console.log(`[RoomManager] Created room: ${roomId}`);

        return room;
    }

    /**
     * Get or create a room
     */
    getRoom(roomId) {
        if (!this.rooms.has(roomId)) {
            return this.createRoom(roomId);
        }
        return this.rooms.get(roomId);
    }

    /**
     * Join a user to a room
     */
    joinRoom(socketId, roomId, username = null) {
        const room = this.getRoom(roomId);

        // Check room capacity
        if (room.users.size >= this.maxUsersPerRoom) {
            return {
                success: false,
                error: 'Room is full'
            };
        }

        // Create user
        const userId = this.generateUserId();
        const user = {
            id: userId,
            socketId,
            name: username || this.generateUsername(),
            color: this.assignColor(room),
            roomId,
            joinedAt: Date.now(),
            lastActivity: Date.now()
        };

        // Add user to room and global map
        room.users.set(userId, user);
        this.users.set(socketId, user);

        // Update activity
        room.lastActivity = Date.now();

        console.log(`[RoomManager] User ${user.name} joined room ${roomId}`);

        return {
            success: true,
            user,
            room: this.getRoomInfo(room)
        };
    }

    /**
     * Remove user from room
     */
    leaveRoom(socketId) {
        const user = this.users.get(socketId);
        if (!user) return null;

        const room = this.rooms.get(user.roomId);
        if (!room) return null;

        // Remove user
        room.users.delete(user.id);
        this.users.delete(socketId);

        // Return color to pool
        this.returnColor(room, user.color);

        console.log(`[RoomManager] User ${user.name} left room ${user.roomId}`);

        // Clean up empty rooms
        if (room.users.size === 0) {
            this.scheduleRoomCleanup(room.id);
        }

        return {
            user,
            room: this.getRoomInfo(room)
        };
    }

    /**
     * Get user by socket ID
     */
    getUser(socketId) {
        return this.users.get(socketId);
    }

    /**
     * Get user by user ID
     */
    getUserById(userId) {
        for (const user of this.users.values()) {
            if (user.id === userId) return user;
        }
        return null;
    }

    /**
     * Get all users in a room
     */
    getRoomUsers(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return [];
        return Array.from(room.users.values());
    }

    /**
     * Get room info
     */
    getRoomInfo(room) {
        return {
            id: room.id,
            userCount: room.users.size,
            users: Array.from(room.users.values()).map(u => ({
                id: u.id,
                name: u.name,
                color: u.color
            })),
            stats: room.operationLog.getStats()
        };
    }

    /**
     * Broadcast to room (except sender)
     */
    broadcastToRoom(io, roomId, event, data, excludeSocketId = null) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.users.forEach(user => {
            if (user.socketId !== excludeSocketId) {
                io.to(user.socketId).emit(event, data);
            }
        });
    }

    /**
     * Broadcast to all in room (including sender)
     */
    broadcastToAll(io, roomId, event, data) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.users.forEach(user => {
            io.to(user.socketId).emit(event, data);
        });
    }

    /**
     * Update user activity
     */
    updateActivity(socketId) {
        const user = this.users.get(socketId);
        if (!user) return;

        user.lastActivity = Date.now();

        const room = this.rooms.get(user.roomId);
        if (room) {
            room.lastActivity = Date.now();
        }
    }

    /**
     * Assign color to user
     */
    assignColor(room) {
        const usedColors = new Set(
            Array.from(room.users.values()).map(u => u.color)
        );

        // Find available color
        for (const color of CONFIG.USER_COLORS) {
            if (!usedColors.has(color)) {
                return color;
            }
        }

        // If all colors used, generate random one
        return this.generateRandomColor();
    }

    /**
     * Return color to pool (not really needed, but for symmetry)
     */
    returnColor(room, color) {
        // Colors are automatically available when user leaves
        // This is a placeholder for future enhancement
    }

    /**
     * Generate random color
     */
    generateRandomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 70%, 60%)`;
    }

    /**
     * Generate unique user ID
     */
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate username
     */
    generateUsername() {
        const adjectives = ['Happy', 'Creative', 'Swift', 'Clever', 'Bold', 'Bright'];
        const nouns = ['Artist', 'Painter', 'Drawer', 'Creator', 'Designer', 'Maker'];
        
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 100);
        
        return `${adj}${noun}${num}`;
    }

    /**
     * Schedule room cleanup
     */
    scheduleRoomCleanup(roomId) {
        setTimeout(() => {
            const room = this.rooms.get(roomId);
            if (room && room.users.size === 0) {
                const age = Date.now() - room.lastActivity;
                if (age > 60000) { // 1 minute grace period
                    this.deleteRoom(roomId);
                }
            }
        }, 60000); // Check after 1 minute
    }

    /**
     * Delete a room
     */
    deleteRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        console.log(`[RoomManager] Deleting room ${roomId} (inactive)`);
        this.rooms.delete(roomId);
    }

    /**
     * Start cleanup timer for inactive rooms
     */
    startCleanupTimer() {
        setInterval(() => {
            const now = Date.now();
            const toDelete = [];

            this.rooms.forEach((room, roomId) => {
                const inactiveTime = now - room.lastActivity;
                
                // Delete empty rooms older than 5 minutes
                if (room.users.size === 0 && inactiveTime > 300000) {
                    toDelete.push(roomId);
                }
                // Delete inactive rooms older than 1 hour
                else if (inactiveTime > this.roomTimeout) {
                    toDelete.push(roomId);
                }
            });

            toDelete.forEach(roomId => this.deleteRoom(roomId));

            if (toDelete.length > 0) {
                console.log(`[RoomManager] Cleaned up ${toDelete.length} inactive rooms`);
            }
        }, 300000); // Check every 5 minutes
    }

    /**
     * Get statistics
     */
    getStats() {
        const totalUsers = this.users.size;
        const totalRooms = this.rooms.size;
        const roomStats = [];

        this.rooms.forEach((room, roomId) => {
            roomStats.push({
                id: roomId,
                users: room.users.size,
                operations: room.operationLog.operations.length,
                age: Date.now() - room.createdAt,
                lastActivity: Date.now() - room.lastActivity
            });
        });

        return {
            totalUsers,
            totalRooms,
            rooms: roomStats,
            timestamp: Date.now()
        };
    }

    /**
     * Get all rooms info
     */
    getAllRooms() {
        const rooms = [];
        this.rooms.forEach(room => {
            rooms.push(this.getRoomInfo(room));
        });
        return rooms;
    }
}

module.exports = RoomManager;