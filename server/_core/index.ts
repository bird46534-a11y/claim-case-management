import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Server as SocketIOServer } from "socket.io";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function setupWebSocket(httpServer: any) {
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

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // 設置 WebSocket
  const io = setupWebSocket(server);
  
  // 將 io 實例附加到 app，以便在路由中使用
  (app as any).io = io;

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`[WebSocket] Socket.io server is ready`);
  });
}

startServer().catch(console.error);
