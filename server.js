const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "troque-esta-senha";

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, service: "Conexao FM" }));

let djSocketId = null;
let radioInfo = { name: process.env.RADIO_NAME || "Conexão FM", live: false, track: "Aguardando transmissão", listeners: 0 };

function updateListeners() {
  const listeners = [...io.sockets.sockets.values()].filter(s => s.data.role === "listener").length;
  radioInfo.listeners = listeners;
  io.emit("radio:status", radioInfo);
}

io.on("connection", socket => {
  socket.emit("radio:status", radioInfo);

  socket.on("admin:login", (password, cb) => {
    if (password !== ADMIN_PASSWORD) return cb?.({ ok: false, message: "Senha incorreta." });
    socket.data.role = "admin";
    socket.emit("admin:authenticated", { ok: true });
    cb?.({ ok: true });
  });

  socket.on("dj:start", data => {
    if (socket.data.role !== "admin") return;
    if (djSocketId && djSocketId !== socket.id) {
      io.to(djSocketId).emit("dj:replaced");
    }
    djSocketId = socket.id;
    radioInfo.name = String(data?.name || radioInfo.name).slice(0, 80);
    radioInfo.live = true;
    radioInfo.track = "Ao vivo";
    socket.broadcast.emit("radio:status", radioInfo);
    io.emit("radio:status", radioInfo);
    socket.emit("listeners:existing", [...io.sockets.sockets.values()].filter(s => s.data.role === "listener").map(s => s.id));
  });

  socket.on("dj:track", track => {
    if (socket.data.role !== "admin" || socket.id !== djSocketId) return;
    radioInfo.track = String(track || "Ao vivo").slice(0, 120);
    io.emit("radio:status", radioInfo);
  });

  socket.on("signal:offer", ({ target, offer }) => {
    if (socket.data.role !== "admin" || socket.id !== djSocketId) return;
    io.to(target).emit("signal:offer", { from: socket.id, offer });
  });
  socket.on("signal:answer", ({ target, answer }) => {
    if (socket.data.role !== "listener") return;
    io.to(target).emit("signal:answer", { from: socket.id, answer });
  });
  socket.on("signal:ice", ({ target, candidate }) => {
    if (!target || !candidate) return;
    if (socket.data.role === "admin" && socket.id !== djSocketId) return;
    io.to(target).emit("signal:ice", { from: socket.id, candidate });
  });

  socket.on("listener:join", () => {
    socket.data.role = "listener";
    updateListeners();
    if (djSocketId) io.to(djSocketId).emit("listener:joined", { id: socket.id });
    socket.emit("radio:status", radioInfo);
  });

  socket.on("dj:stop", () => {
    if (socket.data.role !== "admin" || socket.id !== djSocketId) return;
    djSocketId = null;
    radioInfo.live = false;
    radioInfo.track = "Transmissão encerrada";
    io.emit("radio:status", radioInfo);
    io.emit("radio:ended");
  });

  socket.on("disconnect", () => {
    if (socket.id === djSocketId) {
      djSocketId = null;
      radioInfo.live = false;
      radioInfo.track = "Transmissão desconectada";
      io.emit("radio:status", radioInfo);
      io.emit("radio:ended");
    }
    updateListeners();
  });
});

server.listen(PORT, "0.0.0.0", () => console.log(`Conexao FM rodando na porta ${PORT}`));