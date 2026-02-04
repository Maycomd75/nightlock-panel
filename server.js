const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.static("public"));

// ================================
// 📦 BANCO LOCAL (JSON)
// ================================
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "groups-state.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}");

// ================================
// 🧠 CARREGA ESTADO SALVO
// ================================
let groups = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(groups, null, 2));
}

// ================================
// 🔌 SOCKET.IO
// ================================
io.on("connection", socket => {
  console.log("🟢 Conectado:", socket.id);

  // 🔁 Envia estado atual ao conectar
  socket.emit("group:bulk", Object.values(groups));

  // 📡 Recebe eventos do agente
  socket.on("log:event", data => {
    if (data.type !== "LOCK" && data.type !== "UNLOCK") return;

    const current = groups[data.group];

    // 🛑 Evita duplicação (mesmo estado)
    if (current && current.locked === (data.type === "LOCK")) {
      return;
    }

    groups[data.group] = {
      id: data.group,
      name: data.group,
      locked: data.type === "LOCK",
      action: data.type,
      timestamp: data.timestamp
    };

    saveDB();

    io.emit("group:update", groups[data.group]);
  });

  // 🎛️ CONTROLE PM2
  socket.on("pm2:restart", () => io.emit("pm2:restart"));
  socket.on("pm2:stop", () => io.emit("pm2:stop"));
  socket.on("pm2:start", () => io.emit("pm2:start"));
  socket.on("pm2:flush", () => io.emit("pm2:flush"));
});

// ================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Painel rodando na porta", PORT);
});
