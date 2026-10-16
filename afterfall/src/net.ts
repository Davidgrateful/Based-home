// Co-op networking: a thin WebSocket client for the room server.
// The room's host runs the night (enemies, timers, campfire); everyone else
// mirrors it. Every player owns their own survivor and streams it to the room.

import type { Look } from "./models";

export interface PeerInfo {
  id: number;
  name: string;
  look: Look | null;
}

// biome-ignore lint/suspicious/noExplicitAny: wire messages are loose JSON
export type Msg = { t: string; from?: number; to?: number; [k: string]: any };

function serverUrl() {
  const q = new URLSearchParams(location.search).get("mp");
  const env = import.meta.env.VITE_MP_SERVER as string | undefined;
  if (q) return q;
  if (env) return env;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}

export const randomRoom = () => {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join("");
};

class Net {
  ws: WebSocket | null = null;
  id = 0;
  hostId = 0;
  room = "";
  peers = new Map<number, PeerInfo>();
  private handlers = new Map<string, ((m: Msg) => void)[]>();

  get active() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN && this.id > 0;
  }
  get isHost() {
    return !this.active || this.hostId === this.id;
  }
  get isClient() {
    return this.active && this.hostId !== this.id;
  }

  on(t: string, fn: (m: Msg) => void) {
    const list = this.handlers.get(t) ?? [];
    list.push(fn);
    this.handlers.set(t, list);
  }

  private emit(m: Msg) {
    for (const fn of this.handlers.get(m.t) ?? []) {
      try {
        fn(m);
      } catch (e) {
        console.error("[net]", m.t, e);
      }
    }
  }

  send(m: Msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  connect(room: string, name: string, look: Look | null): Promise<void> {
    this.leave();
    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(serverUrl());
      } catch (e) {
        reject(e);
        return;
      }
      this.ws = ws;
      const fail = setTimeout(() => {
        reject(new Error("Couldn't reach the co-op server."));
        ws.close();
      }, 8000);
      ws.onopen = () => ws.send(JSON.stringify({ t: "join", room, name, look }));
      ws.onerror = () => {
        clearTimeout(fail);
        reject(new Error("Couldn't reach the co-op server."));
      };
      ws.onclose = () => {
        const was = this.id;
        this.id = 0;
        this.peers.clear();
        if (was) this.emit({ t: "closed" });
      };
      ws.onmessage = (ev) => {
        let m: Msg;
        try {
          m = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        switch (m.t) {
          case "welcome":
            clearTimeout(fail);
            this.id = m.id;
            this.hostId = m.host;
            this.room = m.room;
            for (const p of m.players as PeerInfo[]) this.peers.set(p.id, p);
            resolve();
            break;
          case "full":
            clearTimeout(fail);
            reject(new Error(`Room ${m.room} is full.`));
            ws.close();
            return;
          case "join":
            this.peers.set(m.id, { id: m.id, name: m.name, look: m.look });
            break;
          case "leave":
            this.peers.delete(m.id);
            break;
          case "host":
            this.hostId = m.id;
            break;
        }
        this.emit(m);
      };
    });
  }

  leave() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.ws = null;
    this.id = 0;
    this.peers.clear();
  }
}

export const net = new Net();
