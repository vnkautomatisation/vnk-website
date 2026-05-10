"use client";
// Hook SSE pour les messages — admin: ?clientId, client: pas de param
import { useEffect, useRef } from "react";

export type StreamMessage = {
  id: number;
  clientId: number;
  sender: string;
  content: string | null;
  channel: string;
  isRead: boolean;
  isInternalNote: boolean;
  createdAt: string;
  attachmentsData: unknown;
  attachmentData: unknown;
  replyToId: number | null;
};

type StreamEvent =
  | { type: "connected"; lastId: number }
  | { type: "new_message"; message: StreamMessage };

export function useMessageStream(opts: {
  enabled: boolean;
  clientId?: number;
  onNewMessage: (msg: StreamMessage) => void;
}) {
  const cbRef = useRef(opts.onNewMessage);
  cbRef.current = opts.onNewMessage;

  useEffect(() => {
    if (!opts.enabled) return;
    const url = opts.clientId ? `/api/messages/stream?clientId=${opts.clientId}` : "/api/messages/stream";
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as StreamEvent;
        if (data.type === "new_message") {
          cbRef.current(data.message);
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => { /* browser auto-reconnects */ };

    return () => { es.close(); };
  }, [opts.enabled, opts.clientId]);
}
