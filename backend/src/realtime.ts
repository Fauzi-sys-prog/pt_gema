import type { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

let wss: WebSocketServer | null = null;
export function attachRealtime(server: HttpServer) {
  wss = new WebSocketServer({ server, path: "/realtime" });
  wss.on("connection", socket => socket.send(JSON.stringify({ type: "connected", at: new Date().toISOString() })));
  return wss;
}
export function broadcastDataChanged(module = "all") {
  if (!wss) return;
  const message = JSON.stringify({ type: "data.changed", module, at: new Date().toISOString() });
  wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(message); });
}
