import { Router } from "express";
import "../types/session"; // Import session type extensions
import bcrypt from "bcrypt";
import crypto from "crypto";
import { db } from "../db";
import { users } from "../../shared/schema";
import { 
  insertUserSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema,
  type User 
} from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireGuest, type AuthenticatedRequest } from "../middleware/auth";
import rateLimit from "express-rate-limit";
import { sendPasswordResetEmail } from "../utils/email-service";

const router = Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: "TOO_MANY_ATTEMPTS",
    message: "Too many authentication attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  message: {
    error: "TOO_MANY_RESET_ATTEMPTS",
    message: "Too many password reset attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// User registration
router.post("/register", authLimiter, requireGuest, async (req, res) => {
  try {
    // Validate input
    const validatedData = insertUserSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, validatedData.username))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({
        message: "Username already exists",
        error: "USERNAME_EXISTS",
      });
    }

    // Check if email already exists
    const existingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (existingEmail.length > 0) {
      return res.status(400).json({
        message: "Email already exists",
        error: "EMAIL_EXISTS",
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(validatedData.password, saltRounds);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        username: validatedData.username,
        email: validatedData.email,
        passwordHash,
        isActive: true,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    const user = newUser[0];

    // Create session
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error("Session save error during registration:", {
          error: err,
          message: err?.message,
          code: err?.code,
          userId: user.id,
          sessionId: req.sessionID,
          timestamp: new Date().toISOString()
        });
        return res.status(500).json({
          message: "Registration successful but session creation failed",
          error: "SESSION_ERROR",
        });
      }

      res.status(201).json({
        message: "Registration successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      });
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    
    if (error?.name === "ZodError") {
      return res.status(400).json({
        message: "Invalid input data",
        error: "VALIDATION_ERROR",
        details: error.errors,
      });
    }

    res.status(500).json({
      message: "Registration failed",
      error: "INTERNAL_ERROR",
    });
  }
});

// User login
router.post("/login", authLimiter, requireGuest, async (req, res) => {
  try {
    // Validate input
    const validatedData = loginSchema.parse(req.body);

    // Find user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.username, validatedData.username))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(401).json({
        message: "Invalid credentials",
        error: "INVALID_CREDENTIALS",
      });
    }

    const user = userResult[0];

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        message: "Account is disabled",
        error: "ACCOUNT_DISABLED",
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(validatedData.password, user.passwordHash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
        error: "INVALID_CREDENTIALS",
      });
    }

    // Create session
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error("Session save error during login:", {
          error: err,
          message: err?.message,
          code: err?.code,
          userId: user.id,
          sessionId: req.sessionID,
          timestamp: new Date().toISOString()
        });
        return res.status(500).json({
          message: "Login successful but session creation failed",
          error: "SESSION_ERROR",
        });
      }

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      });
    });
  } catch (error: any) {
    console.error("Login error:", error);
    
    if (error?.name === "ZodError") {
      return res.status(400).json({
        message: "Invalid input data",
        error: "VALIDATION_ERROR",
        details: error.errors,
      });
    }

    res.status(500).json({
      message: "Login failed",
      error: "INTERNAL_ERROR",
    });
  }
});

// User logout
router.post("/logout", async (req, res) => {
  try {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error during logout:", {
            error: err,
            message: err?.message,
            code: err?.code,
            sessionId: req.sessionID,
            timestamp: new Date().toISOString()
          });
          return res.status(500).json({
            message: "Logout failed",
            error: "SESSION_ERROR",
          });
        }

        res.clearCookie("connect.sid"); // Clear the session cookie
        res.json({
          message: "Logout successful",
        });
      });
    } else {
      res.json({
        message: "Already logged out",
      });
    }
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      message: "Logout failed",
      error: "INTERNAL_ERROR",
    });
  }
});

// Get current user
router.get("/me", requireAuth, async (req, res) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    res.json({
      user: authenticatedReq.user,
    });
  } catch (error: any) {
    console.error("Get user error:", error);
    res.status(500).json({
      message: "Failed to get user information",
      error: "INTERNAL_ERROR",
    });
  }
});

// Forgot password
router.post("/forgot-password", resetLimiter, async (req, res) => {
  try {
    // Validate input
    const validatedData = forgotPasswordSchema.parse(req.body);

    // Find user by email
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    // Always return success to prevent email enumeration
    if (userResult.length === 0) {
      return res.json({
        message: "If an account with that email exists, a reset link has been sent.",
      });
    }

    const user = userResult[0];

    // Check if user is active
    if (!user.isActive) {
      return res.json({
        message: "If an account with that email exists, a reset link has been sent.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Save reset token
    await db
      .update(users)
      .set({
        resetToken,
        resetTokenExpires,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Send reset email
    await sendPasswordResetEmail(user.email, user.username, resetToken);

    res.json({
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    
    if (error?.name === "ZodError") {
      return res.status(400).json({
        message: "Invalid email address",
        error: "VALIDATION_ERROR",
        details: error.errors,
      });
    }

    res.status(500).json({
      message: "Password reset request failed",
      error: "INTERNAL_ERROR",
    });
  }
});

// Reset password
router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    // Validate input
    const validatedData = resetPasswordSchema.parse(req.body);

    // Find user by reset token
    const userResult = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.resetToken, validatedData.token),
          // Check if token hasn't expired
          // Note: This is a simplified check - in production you might want more sophisticated date comparison
        )
      )
      .limit(1);

    if (userResult.length === 0) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
        error: "INVALID_TOKEN",
      });
    }

    const user = userResult[0];

    // Check if token is expired
    if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return res.status(400).json({
        message: "Reset token has expired",
        error: "TOKEN_EXPIRED",
      });
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(validatedData.newPassword, saltRounds);

    // Update password and clear reset token
    await db
      .update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    res.json({
      message: "Password reset successful",
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    
    if (error?.name === "ZodError") {
      return res.status(400).json({
        message: "Invalid input data",
        error: "VALIDATION_ERROR",
        details: error.errors,
      });
    }

    res.status(500).json({
      message: "Password reset failed",
      error: "INTERNAL_ERROR",
    });
  }
});

export { router as authRoutes };