class ChestAccess {
  constructor(capacity = 2) {
    this.capacity = capacity;
    this.rooms = new Map();
  }

  status(roomId) {
    return { occupants: this.rooms.get(roomId)?.size || 0, capacity: this.capacity };
  }

  enter(roomId, playerId) {
    const occupants = this.rooms.get(roomId) || new Set();
    if (!occupants.has(playerId) && occupants.size >= this.capacity) return { granted: false, ...this.status(roomId) };
    occupants.add(playerId);
    this.rooms.set(roomId, occupants);
    return { granted: true, occupants: occupants.size, capacity: this.capacity };
  }

  leave(roomId, playerId) {
    const occupants = this.rooms.get(roomId);
    occupants?.delete(playerId);
    if (occupants && !occupants.size) this.rooms.delete(roomId);
    return this.status(roomId);
  }

  removePlayer(playerId) {
    for (const roomId of this.rooms.keys()) this.leave(roomId, playerId);
  }
}

module.exports = { ChestAccess };
