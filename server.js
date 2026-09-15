const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", socket => {

  socket.on("join-room", room => {
    room = String(room).trim().toUpperCase();

    if (!room) return;

    const users = io.sockets.adapter.rooms.get(room);
    const existingUsers = users ? [...users] : [];

    socket.join(room);
    socket.room = room;

    socket.emit("room-users", existingUsers);

    socket.to(room).emit("user-joined", socket.id);
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", {
      from: socket.id,
      data
    });
  });

  socket.on("disconnect", () => {
    if (socket.room) {
      socket.to(socket.room).emit("user-left", socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`RoomCall running on port ${PORT}`);
});
