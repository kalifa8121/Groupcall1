const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// Kanaan "Cannot GET /" jedhu hambisna
app.get('/', (req, res) => {
  res.send('Video Call Server is running successfully! 🚀');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.post('/api/room', async (req, res) => {
  const { roomCode } = req.body;
  try {
    let room = await prisma.room.findUnique({ where: { roomCode } });
    if (!room) {
      room = await prisma.room.create({ data: { roomCode } });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomCode) => {
    socket.join(roomCode);
    socket.to(roomCode).emit('user-connected', socket.id);

    socket.on('offer', (data) => {
      io.to(data.target).emit('offer', { offer: data.offer, sender: socket.id });
    });

    socket.on('answer', (data) => {
      io.to(data.target).emit('answer', { answer: data.answer, sender: socket.id });
    });

    socket.on('ice-candidate', (data) => {
      io.to(data.target).emit('ice-candidate', { candidate: data.candidate, sender: socket.id });
    });

    socket.on('disconnect', () => {
      socket.to(roomCode).emit('user-disconnected', socket.id);
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
