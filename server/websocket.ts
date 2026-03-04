import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[WebSocket] User connected: ${socket.id}`);

    // 當案件列表更新時，廣播給所有連接的客戶端
    socket.on("case:updated", (data) => {
      console.log(`[WebSocket] Case updated: ${data.caseId}`);
      io.emit("case:updated", data);
    });

    // 當新增案件時，廣播給所有連接的客戶端
    socket.on("case:created", (data) => {
      console.log(`[WebSocket] Case created: ${data.caseNumber}`);
      io.emit("case:created", data);
    });

    // 當刪除案件時，廣播給所有連接的客戶端
    socket.on("case:deleted", (data) => {
      console.log(`[WebSocket] Case deleted: ${data.caseId}`);
      io.emit("case:deleted", data);
    });

    socket.on("disconnect", () => {
      console.log(`[WebSocket] User disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitCaseUpdate(io: SocketIOServer, data: any) {
  io.emit("case:updated", data);
}

export function emitCaseCreated(io: SocketIOServer, data: any) {
  io.emit("case:created", data);
}

export function emitCaseDeleted(io: SocketIOServer, data: any) {
  io.emit("case:deleted", data);
}
