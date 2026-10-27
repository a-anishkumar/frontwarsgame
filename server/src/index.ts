import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ─── Room management ──────────────────────────────────────────────────────────
interface Room {
  id: string;
  name: string;
  players: Map<string, { id: string; name: string; socketId: string }>;
  maxPlayers: number;
  isStarted: boolean;
  hostId: string;
  config: Record<string, unknown>;
}

const rooms = new Map<string, Room>();

// ─── REST: list rooms ─────────────────────────────────────────────────────────
app.get("/rooms", (_req, res) => {
  const list = Array.from(rooms.values()).map(r => ({
    id: r.id,
    name: r.name,
    playerCount: r.players.size,
    maxPlayers: r.maxPlayers,
    isStarted: r.isStarted,
  }));
  res.json(list);
});

app.get("/health", (_req, res) => res.json({ status: "ok", rooms: rooms.size }));

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on("connection", socket => {
  console.log(`Player connected: ${socket.id}`);

  socket.on("create_room", ({ roomName, playerName, config }, cb) => {
    const roomId = uuidv4().slice(0, 8).toUpperCase();
    const playerId = uuidv4();
    const room: Room = {
      id: roomId,
      name: roomName || `Room ${roomId}`,
      players: new Map([[playerId, { id: playerId, name: playerName || "Player", socketId: socket.id }]]),
      maxPlayers: config?.maxPlayers || 4,
      isStarted: false,
      hostId: playerId,
      config: config || {},
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerId = playerId;
    console.log(`Room created: ${roomId}`);
    cb?.({ success: true, roomId, playerId });
    io.to(roomId).emit("room_update", getRoomState(room));
  });

  socket.on("join_room", ({ roomId, playerName }, cb) => {
    const room = rooms.get(roomId);
    if (!room) { cb?.({ success: false, error: "Room not found" }); return; }
    if (room.isStarted) { cb?.({ success: false, error: "Game already started" }); return; }
    if (room.players.size >= room.maxPlayers) { cb?.({ success: false, error: "Room is full" }); return; }

    const playerId = uuidv4();
    room.players.set(playerId, { id: playerId, name: playerName || "Player", socketId: socket.id });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerId = playerId;
    console.log(`${playerName} joined room ${roomId}`);
    cb?.({ success: true, roomId, playerId });
    io.to(roomId).emit("room_update", getRoomState(room));
  });

  socket.on("start_game", (_, cb) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) { cb?.({ success: false }); return; }
    if (room.hostId !== socket.data.playerId) { cb?.({ success: false, error: "Only host can start" }); return; }
    if (room.players.size < 2) { cb?.({ success: false, error: "Need at least 2 players" }); return; }

    room.isStarted = true;
    io.to(roomId).emit("game_started", { config: room.config });
    cb?.({ success: true });
  });

  socket.on("player_action", (action) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    // In a full implementation, validate and process action server-side
    // For now, broadcast to room (basic prototype)
    socket.to(roomId).emit("player_action", { ...action, playerId: socket.data.playerId });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    if (!roomId || !playerId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.players.delete(playerId);
    console.log(`Player ${playerId} left room ${roomId}`);

    if (room.players.size === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    } else {
      // Reassign host if needed
      if (room.hostId === playerId) {
        room.hostId = room.players.keys().next().value ?? "";
      }
      io.to(roomId).emit("player_left", { playerId });
      io.to(roomId).emit("room_update", getRoomState(room));
    }
  });
});

function getRoomState(room: Room) {
  return {
    id: room.id,
    name: room.name,
    players: Array.from(room.players.values()).map(p => ({ id: p.id, name: p.name })),
    hostId: room.hostId,
    isStarted: room.isStarted,
  };
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Frontline Conquest server running on http://localhost:${PORT}`);
});
