import type { Request, Response, NextFunction } from "express";
import "../types/session"; // Import session type extensions
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        isActive: boolean;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
    email: string;
    isActive: boolean;
  };
}

// List of protected route patterns
const PROTECTED_ROUTES = [
  // Document management (write operations only)
  { method: 'POST', pattern: /^\/api\/documents$/ },
  { method: 'PATCH', pattern: /^\/api\/documents\/\d+$/ },
  { method: 'DELETE', pattern: /^\/api\/documents\/\d+$/ },
  
  // Carrier management (write operations only)
  { method: 'POST', pattern: /^\/api\/carriers$/ },
  { method: 'PATCH', pattern: /^\/api\/carriers\/\d+$/ },
  { method: 'DELETE', pattern: /^\/api\/carriers\/\d+$/ },
  
  // S3 operations
  { method: 'POST', pattern: /^\/api\/s3\// },
  
  // Processing triggers
  { method: 'POST', pattern: /^\/api\/pdf-parser\/trigger$/ },
  { method: 'POST', pattern: /^\/api\/lambda\/invoke-textract$/ },
  
  // N8N integrations
  { method: 'POST', pattern: /^\/api\/n8n\// },
  { method: 'POST', pattern: /^\/api\/documents\/\d+\/resubmit-failed-transactions$/ },
];

// Middleware to check if user is authenticated
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if session exists and has user ID
    if (!req.session?.userId) {
      return res.status(401).json({ 
        message: "Authentication required",
        error: "NO_SESSION"
      });
    }

    // Get user from database
    const userResult = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);

    if (userResult.length === 0) {
      // User not found, clear session
      req.session.destroy((err) => {
        if (err) console.error("Session destroy error:", err);
      });
      return res.status(401).json({ 
        message: "User not found",
        error: "USER_NOT_FOUND"
      });
    }

    const user = userResult[0];

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ 
        message: "Account is disabled",
        error: "ACCOUNT_DISABLED"
      });
    }

    // Extend session expiry on each authenticated request (rolling sessions)
    req.session.touch();

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ 
      message: "Authentication error",
      error: "INTERNAL_ERROR"
    });
  }
}

// Optional auth middleware - adds user to request if authenticated but doesn't require it
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.session?.userId) {
      const userResult = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (userResult.length > 0 && userResult[0].isActive) {
        req.user = userResult[0];
        req.session.touch(); // Extend session
      }
    }
    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    next(); // Continue without authentication
  }
}

// Middleware to check if user is NOT authenticated (for login/register pages)
export function requireGuest(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    return res.status(400).json({ 
      message: "Already authenticated",
      error: "ALREADY_AUTHENTICATED"
    });
  }
  next();
}

// Middleware that checks if route needs authentication
export function conditionalAuth(req: Request, res: Response, next: NextFunction) {
  const needsAuth = PROTECTED_ROUTES.some(route => 
    route.method === req.method && route.pattern.test(req.path)
  );
  
  if (needsAuth) {
    // Apply custom session authentication
    return requireAuth(req, res, next);
  }
  
  // Skip authentication for unprotected routes
  next();
}