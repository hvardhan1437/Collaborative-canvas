/**
 * VectorClock - Implements vector clock for distributed event ordering
 * Used for conflict resolution in collaborative drawing
 */
class VectorClock {
    constructor() {
        this.clock = {}; // userId -> timestamp
    }

    /**
     * Increment clock for a user
     */
    increment(userId) {
        if (!this.clock[userId]) {
            this.clock[userId] = 0;
        }
        this.clock[userId]++;
        return this.getClock();
    }

    /**
     * Update clock with remote clock (merge)
     */
    update(remoteClock) {
        if (!remoteClock) return;

        for (const [userId, timestamp] of Object.entries(remoteClock)) {
            this.clock[userId] = Math.max(
                this.clock[userId] || 0,
                timestamp
            );
        }
    }

    /**
     * Get current clock state
     */
    getClock() {
        return { ...this.clock };
    }

    /**
     * Compare two vector clocks
     * Returns: -1 (clockA < clockB), 0 (concurrent), 1 (clockA > clockB)
     */
    compare(clockA, clockB) {
        if (!clockA || !clockB) return 0;

        let hasLess = false;
        let hasGreater = false;

        // Get all user IDs from both clocks
        const allUsers = new Set([
            ...Object.keys(clockA),
            ...Object.keys(clockB)
        ]);

        for (const userId of allUsers) {
            const valueA = clockA[userId] || 0;
            const valueB = clockB[userId] || 0;

            if (valueA < valueB) hasLess = true;
            if (valueA > valueB) hasGreater = true;
        }

        // Determine relationship
        if (hasLess && !hasGreater) return -1; // clockA happened before clockB
        if (hasGreater && !hasLess) return 1;  // clockA happened after clockB
        return 0; // Concurrent or equal
    }

    /**
     * Check if clockA happened before clockB
     */
    happensBefore(clockA, clockB) {
        return this.compare(clockA, clockB) === -1;
    }

    /**
     * Check if two clocks are concurrent (no causal relationship)
     */
    areConcurrent(clockA, clockB) {
        return this.compare(clockA, clockB) === 0;
    }

    /**
     * Merge multiple vector clocks
     */
    static merge(...clocks) {
        const merged = {};

        clocks.forEach(clock => {
            if (!clock) return;

            Object.entries(clock).forEach(([userId, timestamp]) => {
                merged[userId] = Math.max(
                    merged[userId] || 0,
                    timestamp
                );
            });
        });

        return merged;
    }

    /**
     * Sort events by causal order using vector clocks
     */
    static sortEvents(events) {
        return events.sort((a, b) => {
            const clockA = a.vectorClock;
            const clockB = b.vectorClock;

            if (!clockA || !clockB) {
                return a.timestamp - b.timestamp;
            }

            const vc = new VectorClock();
            const comparison = vc.compare(clockA, clockB);

            if (comparison !== 0) {
                return comparison;
            }

            // If concurrent, use timestamp as tiebreaker
            return a.timestamp - b.timestamp;
        });
    }

    /**
     * Reset clock
     */
    reset() {
        this.clock = {};
    }

    /**
     * Get clock size (number of users tracked)
     */
    size() {
        return Object.keys(this.clock).length;
    }

    /**
     * Convert to string for debugging
     */
    toString() {
        return JSON.stringify(this.clock);
    }
}

module.exports = VectorClock;