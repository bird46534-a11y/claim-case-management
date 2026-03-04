import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface WebSocketEvents {
  "case:created": (data: any) => void;
  "case:updated": (data: any) => void;
  "case:deleted": (data: any) => void;
}

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<Function>>>(new Map());

  useEffect(() => {
    // 建立 WebSocket 連接
    const socket = io(window.location.origin, {
      path: "/socket.io",
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("[WebSocket] Connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("[WebSocket] Disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("[WebSocket] Connection error:", error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  // 訂閱事件
  const subscribe = useCallback(
    (event: keyof WebSocketEvents, callback: Function) => {
      if (!socketRef.current) return;

      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());

        // 設置 Socket.io 事件監聽
        socketRef.current.on(event, (data) => {
          const callbacks = listenersRef.current.get(event);
          if (callbacks) {
            callbacks.forEach((cb) => cb(data));
          }
        });
      }

      const callbacks = listenersRef.current.get(event)!;
      callbacks.add(callback);

      // 返回取消訂閱函數
      return () => {
        callbacks.delete(callback);
      };
    },
    []
  );

  // 發送事件
  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return {
    socket: socketRef.current,
    subscribe,
    emit,
    isConnected: socketRef.current?.connected ?? false,
  };
}
