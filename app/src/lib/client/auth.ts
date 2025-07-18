import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  fetchOptions: {
    credentials: "include",
    onError: (error) => {
      console.error("Auth error:", error) 
    }
  },
})

// Export hooks for easy use throughout the app
export const { 
  useSession, 
  signIn, 
  signUp, 
  signOut
} = authClient

// Types are now centralized in @/types
// Re-export for backward compatibility
export type { AuthStatus, AuthUser } from '@/types'; 