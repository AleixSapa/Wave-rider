import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';

const PORT = 3000;

interface Room {
  id: string;
  players: Record<string, any>;
  state: 'waiting' | 'playing' | 'finished';
  startTime?: number;
}

const rooms: Record<string, Room> = {};

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', (customRoomId?: string, playerName?: string) => {
      const roomId = customRoomId || Math.random().toString(36).substring(2, 8).toUpperCase();
      rooms[roomId] = {
        id: roomId,
        players: {
          [socket.id]: { id: socket.id, name: playerName || 'Anonymous', score: 0, distance: 0, x: 200, y: 0, rotation: 0, isDead: false }
        },
        state: 'waiting'
      };
      socket.join(roomId);
      socket.emit('room_created', roomId);
      io.to(roomId).emit('room_state', rooms[roomId]);
    });

    socket.on('join_room', (roomId: string, playerName?: string) => {
      const room = rooms[roomId];
      if (room && room.state === 'waiting') {
        room.players[socket.id] = { id: socket.id, name: playerName || 'Anonymous', score: 0, distance: 0, x: 200, y: 0, rotation: 0, isDead: false };
        socket.join(roomId);
        socket.emit('joined_room', roomId);
        io.to(roomId).emit('room_state', room);
      } else {
        socket.emit('error', 'Room not found or already playing');
      }
    });

    socket.on('start_game', (roomId: string) => {
      const room = rooms[roomId];
      if (room && room.players[socket.id]) {
        room.state = 'playing';
        room.startTime = Date.now() + 3000; // 3 seconds countdown
        io.to(roomId).emit('game_starting', room.startTime);
      }
    });

    socket.on('update_player', (roomId: string, data: any) => {
      const room = rooms[roomId];
      if (room && room.players[socket.id]) {
        room.players[socket.id] = { ...room.players[socket.id], ...data };
        // Broadcast to others
        socket.to(roomId).emit('players_update', room.players);
      }
    });

    socket.on('player_died', (roomId: string) => {
      const room = rooms[roomId];
      if (room && room.players[socket.id]) {
        room.players[socket.id].isDead = true;
        socket.to(roomId).emit('player_died_event', socket.id);
        
        // Check if all players dead
        const allDead = Object.values(room.players).every(p => p.isDead === true);
        if (allDead) {
          room.state = 'finished';
          io.to(roomId).emit('game_finished', room.players);
        }
      }
    });

    socket.on('disconnect', () => {
      // Find rooms the player was in and remove them
      for (const roomId in rooms) {
        if (rooms[roomId].players[socket.id]) {
          delete rooms[roomId].players[socket.id];
          if (Object.keys(rooms[roomId].players).length === 0) {
            delete rooms[roomId];
          } else {
            io.to(roomId).emit('room_state', rooms[roomId]);
          }
        }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
