const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Store active calls and users
const activeCalls = {};
const users = {};

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('register', (userId) => {
    users[userId] = socket.id;
    socket.userId = userId;
    console.log(`User registered: ${userId}`);
  });

  socket.on('createCall', (callId) => {
    activeCalls[callId] = {
        host: socket.userId,  // Track who created the call
        participants: [socket.userId]
    };
    socket.join(callId);
    console.log(`Call created: ${callId} by ${socket.userId}`);
});

socket.on('joinCall', (callId) => {
  if (activeCalls[callId]) {
      activeCalls[callId].participants.push(socket.userId);
      socket.join(callId);
      
      // Send current participant list to the new joiner
      socket.emit('initialParticipants', {
          participants: activeCalls[callId].participants,
          host: activeCalls[callId].host
      });
      
      // Notify others about the new participant
      socket.to(callId).emit('userJoined', socket.userId);
      
      console.log(`${socket.userId} joined call ${callId}`);
  }
});

  socket.on('signal', ({ to, signal }) => {
    if (users[to]) {
      io.to(users[to]).emit('signal', {
        from: socket.userId,
        signal
      });
    }
  });

  socket.on('sendMessage', ({ callId, message }) => {
    // Ensure proper message format
    const formattedMessage = typeof message === 'string' ? {
        from: socket.userId,
        message: message,
        timestamp: new Date().toISOString()
    } : message;
    
    io.to(callId).emit('newMessage', formattedMessage);
});

  socket.on('disconnect', () => {
    if (socket.userId) {
      delete users[socket.userId];
      console.log(`User disconnected: ${socket.userId}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});

socket.on('leaveCall', () => {
  // Remove user from all calls they might be in
  for (const callId in activeCalls) {
      activeCalls[callId].participants = activeCalls[callId].participants.filter(
          p => p !== socket.userId
      );
      
      if (activeCalls[callId].participants.length === 0) {
          delete activeCalls[callId];
      } else {
          io.to(callId).emit('userLeft', socket.userId);
      }
  }
});

socket.on('disconnect', () => {
  // Same cleanup as leaveCall
  for (const callId in activeCalls) {
      activeCalls[callId].participants = activeCalls[callId].participants.filter(
          p => p !== socket.userId
      );
      
      if (activeCalls[callId].participants.length === 0) {
          delete activeCalls[callId];
      } else {
          io.to(callId).emit('userLeft', socket.userId);
      }
  }
  
  if (socket.userId) {
      delete users[socket.userId];
  }
});