import db from "@/lib/gateway/db";
import * as schema from "@/lib/gateway/db/schema";
import { getGitHubConfig } from "@/lib/gateway/env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { randomUUID } from "crypto";
import { txOperations, withTransaction } from "@/lib/gateway/db/actions";
import { CDPWalletMetadata } from "@/types";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      users: schema.users,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  socialProviders: {
    github: {
      clientId: getGitHubConfig().clientId,
      clientSecret: getGitHubConfig().clientSecret,
    }
  },
  user: {
    additionalFields: {
      walletAddress: {
        type: "string",
        required: false,
      },
      displayName: {
        type: "string",
        required: false,
      },
      avatarUrl: {
        type: "string",
        required: false,
      },
    },
    modelName: "users", // Use the "users" table name
  },
  // Generate UUID for user IDs instead of default string IDss
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
    // crossSubDomainCookies: {
    //   enabled: true,
    //   domain: "http://localhost:3232",
    // },
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      partitioned: true // New browser standards for foreign cookies
    }
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      
      // Only proceed if we have a new session (successful authentication)
      if (!newSession?.user?.id) {
        return;
      }

      const user = newSession.user;
      
      // Determine if this is likely a new user based on creation timestamp
      const userCreatedAt = new Date(user.createdAt);
      const now = new Date();
      const timeSinceCreation = now.getTime() - userCreatedAt.getTime();
      const isRecentlyCreated = timeSinceCreation < 60000; // Less than 1 minute old
      
      // Log user info for debugging
      console.log(`[AUTH HOOK] Processing authentication for user ${user.id}:`, {
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        timeSinceCreation: `${Math.round(timeSinceCreation / 1000)}s`,
        isRecentlyCreated,
        sessionId: newSession.session.id
      });

      // Always attempt to create CDP wallet - let the function handle existing wallet logic
      // This is robust because:
      // 1. New users will get wallets created
      // 2. Existing users without wallets will get them
      // 3. Users with wallets will be skipped (no-op)
      setImmediate(async () => {
        try {
          console.log(`[AUTH HOOK] Attempting CDP wallet creation for user ${user.id}`);
          
          const result = await withTransaction(async (tx) => {
            return await txOperations.autoCreateCDPWalletForUser(user.id, {
              email: user.email || undefined,
              name: user.name || undefined,
              displayName: user.displayName || undefined,
            }, {
              createSmartAccount: false, // Create smart account for gas sponsorship
            })(tx);
          });

          if (result) {
            const userType = isRecentlyCreated ? "new user" : "existing user";
            console.log(`[AUTH HOOK] Successfully created CDP wallets for ${userType} ${user.id}:`, {
              accountName: result.accountName,
              walletsCreated: result.wallets.length,
              hasSmartAccount: !!result.cdpResult.smartAccount,
              primaryWallet: result.wallets.find(w => w.isPrimary)?.walletAddress,
              smartWallet: result.wallets.find(w => {
                const metadata = w.walletMetadata as CDPWalletMetadata;
                return metadata?.isSmartAccount;
              })?.walletAddress
            });
          } else {
            console.log(`[AUTH HOOK] User ${user.id} already has CDP wallets, no action needed`);
          }
        } catch (error) {
          console.error(`[AUTH HOOK] Failed to create CDP wallet for user ${user.id}:`, error);
          // Error details for debugging but don't break auth flow
          if (error instanceof Error) {
            console.error(`[AUTH HOOK] Error details: ${error.message}`);
          }
        }
      });
    }),
  },
});

