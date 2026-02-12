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

// 🔥 função que cria ID FIXO do grupo
function normalizeGroupId(jid){
  // remove tudo depois do @
  // 1203632040-162345@g.us -> 1203632040-162345
  return String(jid).split('@')[0];
}

// ================================
// 🔌 SOCKET.IO
// ================================
io.on("connection", socket => {
  console.log("🟢 Conectado:", socket.id);

  // envia estado completo ao conectar
  socket.emit("group:bulk", Object.values(groups));

  // 📡 Recebe eventos do agente
  socket.on("log:event", data => {

    if (!data || !data.group) return;
    if (data.type !== "LOCK" && data.type !== "UNLOCK") return;

    // 🔥 usa ID normalizado (NÃO MAIS o JID bruto)
    const groupId = normalizeGroupId(data.group);

    const current = groups[groupId];

    // evita duplicação do mesmo estado
    if (current && current.locked === (data.type === "LOCK")) {
      return;
    }

    groups[groupId] = {
      id: groupId,
      name: data.group, // ainda mostramos o nome original
      locked: data.type === "LOCK",
      action: data.type,
      timestamp: data.timestamp || Date.now()
    };

    saveDB();

    // envia atualização individual
    io.emit("group:update", groups[groupId]);

    // 🔥 força sincronização total (corrige painel)
    io.emit("group:bulk", Object.values(groups));
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
