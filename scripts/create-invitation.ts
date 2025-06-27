#!/usr/bin/env ts-node

/**
 * Script to create invitation tokens for user registration
 * 
 * Usage:
 *   npm run script scripts/create-invitation.ts
 *   npm run script scripts/create-invitation.ts --email user@example.com
 *   npm run script scripts/create-invitation.ts --email user@example.com --days 7
 */

import { db } from "../server/db";
import { invitationTokens } from "../shared/schema";
import crypto from "crypto";

interface CreateInvitationOptions {
  email?: string;
  days?: number;
}

async function createInvitation(options: CreateInvitationOptions = {}) {
  try {
    console.log("🎫 Creating invitation token...");
    
    // Generate a unique token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiry date (default 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (options.days || 30));

    // Create invitation
    const [newInvitation] = await db
      .insert(invitationTokens)
      .values({
        token,
        email: options.email,
        expiresAt,
        isUsed: false,
      })
      .returning();

    console.log("\n✅ Invitation token created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🎫 Token: ${newInvitation.token}`);
    if (newInvitation.email) {
      console.log(`📧 Email: ${newInvitation.email}`);
    } else {
      console.log("📧 Email: (Any email can use this token)");
    }
    console.log(`📅 Expires: ${newInvitation.expiresAt?.toLocaleDateString()}`);
    console.log(`🆔 ID: ${newInvitation.id}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    console.log("\n📋 Instructions:");
    console.log("1. Share this token with the person you want to invite");
    console.log("2. They should use it on the sign-up page");
    console.log("3. Each token can only be used once");
    
    if (newInvitation.email) {
      console.log(`4. This token is tied to ${newInvitation.email} only`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to create invitation:", error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: CreateInvitationOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "--email" && i + 1 < args.length) {
      options.email = args[i + 1];
      i++; // Skip next argument since we used it
    } else if (arg === "--days" && i + 1 < args.length) {
      const days = parseInt(args[i + 1]);
      if (isNaN(days) || days <= 0) {
        console.error("❌ --days must be a positive number");
        process.exit(1);
      }
      options.days = days;
      i++; // Skip next argument since we used it
    } else if (arg === "--help" || arg === "-h") {
      console.log("Create invitation token for user registration");
      console.log("");
      console.log("Usage:");
      console.log("  npm run script scripts/create-invitation.ts [options]");
      console.log("");
      console.log("Options:");
      console.log("  --email <email>    Tie token to specific email address");
      console.log("  --days <number>    Token expiry in days (default: 30)");
      console.log("  --help, -h         Show this help message");
      console.log("");
      console.log("Examples:");
      console.log("  npm run script scripts/create-invitation.ts");
      console.log("  npm run script scripts/create-invitation.ts --email user@example.com");
      console.log("  npm run script scripts/create-invitation.ts --email user@example.com --days 7");
      process.exit(0);
    }
  }
  
  return options;
}

// Main execution
const options = parseArgs();
createInvitation(options);