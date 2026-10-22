const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get('/', (req, res) => {
  res.send('Video & Audio Call Server is running successfully! 🚀');
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomCode) => {
    socket.join(roomCode);
    console.log(`User ${socket.id} joined room: ${roomCode}`);
    socket.to(roomCode).emit('user-connected', socket.id);
  });

  socket.on('offer', ({ target, offer }) => {
    io.to(target).emit('offer', { offer, sender: socket.id });
  });

  socket.on('answer', ({ target, answer }) => {
    io.to(target).emit('answer', { answer, sender: socket.id });
  });

  socket.on('ice-candidate', ({ target, candidate }) => {
    io.to(target).emit('ice-candidate', { candidate, sender: socket.id });
  });

  // Chat fi Message (Text, Voice, Video blob) wal-dabarsuu
  socket.on('send-message', ({ roomCode, messageData }) => {
    socket.to(roomCode).emit('receive-message', messageData);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    io.emit('user-disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
