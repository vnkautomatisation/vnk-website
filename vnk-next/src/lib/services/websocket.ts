// WebSocket client helper — se connecte à /ws avec reconnect automatique
// Utilisé par ChatWidget et les notifications temps réel
"use client";

type WsMessage =
  | { type: "new_message"; message: any }
  | { type: "typing"; userId: number }
  | { type: "notification"; notification: any }
  | { type: "presence"; clients: number[] };

type WsHandler = (msg: WsMessage) => void;

class VnkWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Set<WsHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  connect() {
    if (typeof window === "undefined") return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      this.ws = new WebSocket(`${protocol}//${location.host}/ws`);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.startPing();
      };

      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as WsMessage;
          this.handlers.forEach((h) => h(msg));
        } catch {}
      };

      this.ws.onclose = () => {
        this.stopPing();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    // Exponential backoff : 1s, 2s, 4s, 8s, ... capped at 30s
    const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts++));
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  }

  private stopPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  disconnect() {
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  subscribe(handler: WsHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

let instance: VnkWebSocket | null = null;

export function getWebSocket() {
  if (!instance) {
    instance = new VnkWebSocket();
    instance.connect();
  }
  return instance;
}
