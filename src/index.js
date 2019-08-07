const express = require("express");
const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = socketio(server);
const Filter = require("bad-words");
const {
  generateMessage,
  generateLocationMessage
} = require("./utils/messages");
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom
} = require("./utils/users");

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "../public")));

//  server (emit) -> client (receive) - countUpdated
//  client (emit) -> server (receive) - increment

io.on("connection", socket => {
  console.log("New WebSocket connection");

  //   socket.emit("message", generateMessage("Welcome!"));
  //   socket.broadcast.emit("message", generateMessage("A new user has joined!"));

  socket.on("join", ({ username, room }, callback) => {
    const { error, user } = addUser({
      id: socket.id,
      username,
      room
    });

    if (error) {
      return callback(error);
    }

    socket.join(user.room);

    socket.emit("message", generateMessage("Admin", "Welcome!"));

    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        generateMessage("Admin", `${user.username} has joined!`)
      );

    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room)
    });

    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);
    const filter = new Filter();
    if (filter.isProfane(message)) {
      return callback("Profanity is not allowed");
    }
    io.to(user.room).emit("message", generateMessage(user.username, message));
    callback("Delivered");
  });

  socket.on("sendLocation", (location, callback) => {
    const user = getUser(socket.id);
    io.to(user.room).emit(
      "locationMessage",
      generateLocationMessage(
        user.username,
        `https://google.com/maps?q=${location.latitude},${location.longitude}`
      )
    );
    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      // io.emit("message", generateMessage("A user has left"));
      io.to(user.room).emit(
        "message",
        generateMessage("Admin", `${user.username} has left!`)
      );
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room)
      });
    }
  });
});

server.listen(port, () => {
  console.log(`server running on port ${port}`);
});

//events from server to client using 3 methods (think of it as event/listeners)
// 1. socket.emit ->  sends an event to a specific client
// 2. io.emitn -> sends an event to every connected client
// 3. socket.broadcast.emit -> sends an event to every client except the socket (socket that triggered the event)

//with the introduction of rooms we have 2 new methods for emitting events
// 1. io.to().emit -> emits an event to everybody in a specific room
// 2. socket.broadcast.to().emit -> sent an event to everyone except the socket (socket that triggered the event) but it is limited TO the room that it is connected too
