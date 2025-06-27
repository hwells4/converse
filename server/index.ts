import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import "./types/session"; // Import session type extensions
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { conditionalAuth } from "./middleware/auth";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration with PostgreSQL store
const PgSession = ConnectPgSimple(session);

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}
if (!process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET not set - using default (change in production!)");
}

const sessionStore = new PgSession({
  conString: process.env.DATABASE_URL,
  tableName: "sessions", // Use our custom sessions table
  createTableIfMissing: true, // Allow connect-pg-simple to create compatible table
  schemaName: "public", // Default schema
  pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
  errorLog: (error) => {
    console.error("Session store error:", error);
  },
});

// Configure session middleware
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || "your-super-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  name: "sessionId", // Custom session name
  cookie: {
    secure: process.env.NODE_ENV === "production", // HTTPS in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 14 * 24 * 60 * 60 * 1000, // 2 weeks in milliseconds
    sameSite: "strict", // CSRF protection
  },
  rolling: true, // Reset expiry on each request (keep user logged in)
}));

// Add CORS headers to allow frontend to communicate with backend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Log all webhook requests for debugging
  if (path === '/api/pdf-parse-webhook') {
    console.log('🔍 WEBHOOK REQUEST INTERCEPTED');
    console.log('🔍 Method:', req.method);
    console.log('🔍 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔍 Body:', JSON.stringify(req.body, null, 2));
  }

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Apply conditional authentication middleware to all API routes
app.use("/api", conditionalAuth);

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port} - Converse AI Hub v1`);
  });
})();
