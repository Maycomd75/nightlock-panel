const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.static("public"));

const groups = {};
const logs = [];

io.on("connection", socket => {
  console.log("🟢 Conectado:", socket.id);

  // Envia estado atual
  socket.emit("group:bulk", Object.values(groups));

  socket.on("log:event", data => {
    logs.push(data);

    if (data.type === "LOCKED" || data.type === "UNLOCKED") {
      groups[data.group] = {
        id: data.group,
        name: data.group,
        locked: data.type === "LOCKED",
        action: data.type,
        timestamp: data.timestamp
      };

      io.emit("group:update", groups[data.group]);
    }

    io.emit("log:event", data);
  });

  socket.on("pm2:restart", () => io.emit("pm2:restart"));
  socket.on("pm2:stop", () => io.emit("pm2:stop"));
  socket.on("pm2:start", () => io.emit("pm2:start"));
  socket.on("pm2:flush", () => io.emit("pm2:flush"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Painel rodando na porta", PORT);
});