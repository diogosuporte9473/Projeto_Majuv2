import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import _cookieParser from "cookie-parser";
import { createServer } from "http";

const cookieParser = (_cookieParser as any).default || _cookieParser;
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";
import { serveStatic, setupVite } from "./vite.js";

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

export async function createApp() {
  const app = express();
  const server = createServer(app);
  // Parse cookies before tRPC context
  app.use(cookieParser());
  
  // Health check for debugging Vercel 500 errors
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok", time: new Date().toISOString(), env: process.env.NODE_ENV });
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // tRPC API with global JSON error handler
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path }) {
        console.error(`❌ tRPC Error on path "${path}":`, error);
        // Ensure error response is always JSON by setting content-type
        // though tRPC handles this, we can log extra info here
      },
    })
  );

  // Fallback 404 handler for API routes
  app.use("/api", (req: Request, res: Response) => {
    res.status(404).json({
      error: {
        message: `API endpoint "${req.originalUrl}" not found`,
        code: "NOT_FOUND",
      },
    });
  });

  // Global error handler to ensure JSON response for API routes
  app.use("/api", (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("[API Error]", err);
    res.status(err.status || 500).json({
      error: {
        message: err.message || "Internal Server Error",
        code: err.code || "INTERNAL_SERVER_ERROR",
      },
    });
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  return { app, server };
}

async function startServer() {
  const { app, server } = await createApp();

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  startServer().catch(console.error);
}
