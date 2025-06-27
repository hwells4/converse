#!/usr/bin/env ts-node

/**
 * Script to list all invitation tokens
 * 
 * Usage:
 *   npm run script scripts/list-invitations.ts
 *   npm run script scripts/list-invitations.ts --unused-only
 */

import { db } from "../server/db";
import { invitationTokens, users } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

interface ListOptions {
  unusedOnly?: boolean;
}

async function listInvitations(options: ListOptions = {}) {
  try {
    console.log("📋 Listing invitation tokens...\n");
    
    // Query invitations with optional filtering
    let query = db
      .select({
        id: invitationTokens.id,
        token: invitationTokens.token,
        email: invitationTokens.email,
        isUsed: invitationTokens.isUsed,
        expiresAt: invitationTokens.expiresAt,
        createdAt: invitationTokens.createdAt,
        usedAt: invitationTokens.usedAt,
        usedBy: invitationTokens.usedBy,
      })
      .from(invitationTokens)
      .orderBy(desc(invitationTokens.createdAt));

    const invitations = await query;
    
    if (invitations.length === 0) {
      console.log("No invitation tokens found.");
      process.exit(0);
    }
    
    // Filter if requested
    const filteredInvitations = options.unusedOnly 
      ? invitations.filter(inv => !inv.isUsed)
      : invitations;
    
    if (filteredInvitations.length === 0) {
      console.log("No unused invitation tokens found.");
      process.exit(0);
    }

    console.log(`Found ${filteredInvitations.length} invitation token(s):`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    for (const invitation of filteredInvitations) {
      const isExpired = invitation.expiresAt && new Date() > invitation.expiresAt;
      const status = invitation.isUsed 
        ? "🔴 USED" 
        : isExpired 
        ? "🟡 EXPIRED" 
        : "🟢 ACTIVE";
      
      console.log(`\n🎫 Token: ${invitation.token}`);
      console.log(`🆔 ID: ${invitation.id}`);
      console.log(`📧 Email: ${invitation.email || "(Any email)"}`);
      console.log(`📊 Status: ${status}`);
      console.log(`📅 Created: ${invitation.createdAt?.toLocaleDateString()}`);
      console.log(`⏰ Expires: ${invitation.expiresAt?.toLocaleDateString() || "Never"}`);
      
      if (invitation.isUsed) {
        console.log(`✅ Used: ${invitation.usedAt?.toLocaleDateString()}`);
        console.log(`👤 Used by: User ID ${invitation.usedBy}`);
      }
    }
    
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const activeCount = invitations.filter(inv => !inv.isUsed && (!inv.expiresAt || new Date() <= inv.expiresAt)).length;
    const usedCount = invitations.filter(inv => inv.isUsed).length;
    const expiredCount = invitations.filter(inv => !inv.isUsed && inv.expiresAt && new Date() > inv.expiresAt).length;
    
    console.log(`\n📊 Summary:`);
    console.log(`   🟢 Active: ${activeCount}`);
    console.log(`   🔴 Used: ${usedCount}`);
    console.log(`   🟡 Expired: ${expiredCount}`);
    console.log(`   📋 Total: ${invitations.length}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to list invitations:", error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: ListOptions = {};
  
  for (const arg of args) {
    if (arg === "--unused-only") {
      options.unusedOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("List invitation tokens");
      console.log("");
      console.log("Usage:");
      console.log("  npm run script scripts/list-invitations.ts [options]");
      console.log("");
      console.log("Options:");
      console.log("  --unused-only      Show only unused tokens");
      console.log("  --help, -h         Show this help message");
      console.log("");
      console.log("Examples:");
      console.log("  npm run script scripts/list-invitations.ts");
      console.log("  npm run script scripts/list-invitations.ts --unused-only");
      process.exit(0);
    }
  }
  
  return options;
}

// Main execution
const options = parseArgs();
listInvitations(options);