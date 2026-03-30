import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import _cookieParser from "cookie-parser";
import { createServer } from "http";
import { ENV } from "./env.js";

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
  app.set("trust proxy", 1);
  // Parse cookies before tRPC context
  app.use(cookieParser());

  // Baseline hardening headers.
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (ENV.isProduction) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload"
      );
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
      );
    }
    next();
  });

  const configuredOrigins = (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const localOrigins = ["http://localhost:3000", "http://localhost:5173"];
  const allowedOrigins = new Set([
    ...(ENV.isProduction ? [] : localOrigins),
    ...configuredOrigins,
  ]);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-CSRF-Token"
      );
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });

  // Lightweight API rate limit to reduce brute-force and abuse.
  const rateWindowMs = 15 * 60 * 1000;
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 300);
  const requestCounts = new Map<string, { count: number; resetAt: number }>();
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const existing = requestCounts.get(key);
    if (!existing || existing.resetAt < now) {
      requestCounts.set(key, { count: 1, resetAt: now + rateWindowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > rateLimitMax) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter > 0 ? retryAfter : 1));
      return res.status(429).json({
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests, please try again later.",
        },
      });
    }

    next();
  });
  
  // Health check for debugging Vercel 500 errors
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok", time: new Date().toISOString(), env: process.env.NODE_ENV });
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CSRF defense-in-depth for cookie-authenticated API calls.
  app.use("/api/trpc", (req: Request, res: Response, next: NextFunction) => {
    const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
    if (!stateChangingMethods.has(req.method)) return next();
    if (!ENV.isProduction) return next();

    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Invalid request origin",
        },
      });
    }

    next();
  });

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
