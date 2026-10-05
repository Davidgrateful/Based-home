// AFTERFALL server: serves the built game (dist/) and runs co-op rooms over a
// WebSocket at /ws. One process, one deploy (Render, Railway, Fly, a VPS...).
//
//   PORT=8787 node server/server.mjs
//
// Protocol (JSON). The server only relays; the room's host runs the world.
//   -> {t:"join", room, name, look}
//   <- {t:"welcome", id, host, room, players:[{id,name,look}]}
//   <- {t:"join", id, name, look}   {t:"leave", id}   {t:"host", id}
//   -> any other {t, ..., to?}  relayed to the room (or to one player) with `from`

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8787);
const ROOT = fileURLToPath(new URL("../dist/", import.meta.url));
const MAX_PLAYERS = 8;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

const http = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://x");
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404).end("Build the game first: npm run build");
    return;
  }
  const ext = extname(file);
  res.writeHead(200, {
    "content-type": MIME[ext] || "application/octet-stream",
    "cache-control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  createReadStream(file).pipe(res);
});

/** @type {Map<string, {players: Map<number, {ws: import("ws").WebSocket, name: string, look: unknown}>, host: number}>} */
const rooms = new Map();
let nextId = 1;

const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));
const roomCode = (s) =>
  String(s || "CAMP")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "CAMP";
const cleanName = (s) =>
  String(s || "Hundred")
    .replace(/[^\p{L}\p{N} '\-.]/gu, "")
    .trim()
    .slice(0, 16) || "Hundred";

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
http.on("upgrade", (req, socket, head) => {
  if (!req.url?.startsWith("/ws")) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
});

wss.on("connection", (ws) => {
  const id = nextId++;
  let code = null;
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.t === "join" && !code) {
      code = roomCode(msg.room);
      let room = rooms.get(code);
      if (!room) {
        room = { players: new Map(), host: id };
        rooms.set(code, room);
      }
      if (room.players.size >= MAX_PLAYERS) {
        send(ws, { t: "full", room: code });
        code = null;
        return;
      }
      const me = { ws, name: cleanName(msg.name), look: msg.look ?? null };
      const others = [...room.players].map(([pid, p]) => ({ id: pid, name: p.name, look: p.look }));
      room.players.set(id, me);
      send(ws, { t: "welcome", id, host: room.host, room: code, players: others });
      for (const [pid, p] of room.players) if (pid !== id) send(p.ws, { t: "join", id, name: me.name, look: me.look });
      return;
    }
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    msg.from = id;
    if (typeof msg.to === "number") {
      const target = room.players.get(msg.to);
      if (target) send(target.ws, msg);
      return;
    }
    for (const [pid, p] of room.players) if (pid !== id) send(p.ws, msg);
  });

  ws.on("close", () => {
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    room.players.delete(id);
    if (!room.players.size) {
      rooms.delete(code);
      return;
    }
    for (const p of room.players.values()) send(p.ws, { t: "leave", id });
    if (room.host === id) {
      room.host = Math.min(...room.players.keys());
      for (const p of room.players.values()) send(p.ws, { t: "host", id: room.host });
    }
  });
});

// drop dead connections
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) ws.terminate();
    else {
      ws.isAlive = false;
      ws.ping();
    }
  }
}, 15000);

http.listen(PORT, () => console.log(`AFTERFALL on http://localhost:${PORT}  (co-op at /ws)`));
