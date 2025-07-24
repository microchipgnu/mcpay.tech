import { PricingEntry } from "@/types"
import { type ApiError } from "@/types/api"
import { DailyServerAnalytics, McpServerWithStats, ServerCreateData, ServerRegistrationData, ServerSummaryAnalytics } from "@/types/mcp"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Text sanitization utilities for security
export const textUtils = {
  // Sanitize text for display - removes potentially dangerous characters
  sanitizeForDisplay: (text: string, maxLength: number = 100): string => {
    if (!text || typeof text !== 'string') return ''
    
    // Remove HTML tags and dangerous characters
    const sanitized = text
      .replace(/<[^>]*>?/gm, '') // Remove HTML tags
      .replace(/[<>]/g, '') // Remove remaining angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/data:/gi, '') // Remove data: URLs
      .replace(/vbscript:/gi, '') // Remove vbscript: URLs
      .trim()
    
    // Truncate if too long
    if (sanitized.length > maxLength) {
      return sanitized.substring(0, maxLength) + '...'
    }
    
    return sanitized
  },
  
  // Validate search term on client side
  validateSearchTerm: (searchTerm: string): { isValid: boolean; error?: string } => {
    if (!searchTerm || typeof searchTerm !== 'string') {
      return { isValid: false, error: 'Search term is required' }
    }
    
    const trimmed = searchTerm.trim()
    if (trimmed.length < 1) {
      return { isValid: false, error: 'Search term cannot be empty' }
    }
    
    if (trimmed.length > 100) {
      return { isValid: false, error: 'Search term too long (maximum 100 characters)' }
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /[<>]/,  // HTML/XML tags
      /['"]/,  // Quote characters
      /--|\/\*|\*\//, // SQL comment patterns
      /\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|UNION|SELECT)\b/i, // SQL keywords
      /\b(script|javascript|vbscript|onload|onerror|onclick)\b/i, // Script injection patterns
    ]
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(trimmed)) {
        return { isValid: false, error: 'Invalid characters in search term' }
      }
    }
    
    return { isValid: true }
  },
  
  // Escape text for safe HTML display
  escapeHtml: (text: string): string => {
    if (!text || typeof text !== 'string') return ''
    
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// API Configuration
export const API_CONFIG = {
  baseUrl: "/api",
  mcpBaseUrl: "/mcp",
  timeout: 30000, // 30 seconds in milliseconds
}

// URL Generation Utilities
export const urlUtils = {
  // Get the API base URL
  getApiBaseUrl: () => API_CONFIG.baseUrl,
  
  // Get the MCP base URL
  getMcpBaseUrl: () => API_CONFIG.mcpBaseUrl,
  
  // Generate API endpoint URL
  getApiUrl: (endpoint: string) => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${API_CONFIG.baseUrl}${cleanEndpoint}`
  },
  
  // Generate MCP server URL
  getMcpUrl: (serverId: string) => {
    return `${window.location.origin}/mcp/${serverId}`
  },
}

// API utility function with proper error handling
export async function apiCall<T = unknown>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = urlUtils.getApiUrl(endpoint)
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const config: RequestInit = {
    ...options,
    headers: defaultHeaders,
    credentials: 'include'
  }

  // Add timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout)
  config.signal = controller.signal

  try {
    const response = await fetch(url, config)
    clearTimeout(timeoutId)

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`
      let errorDetails: unknown = null
      
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorData.message || errorMessage
        errorDetails = errorData.details || errorData
      } catch {
        // Failed to parse error JSON, use status text
        errorMessage = `${response.status}: ${response.statusText}`
      }

      // Include status code in error message for frontend handling
      const statusAwareMessage = `${response.status}: ${errorMessage}`
      const error = new Error(statusAwareMessage) as ApiError
      error.status = response.status
      error.details = errorDetails
      throw error
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please try again')
      }
      throw error
    }
    
    throw new Error('An unknown error occurred')
  }
}

// Specific API functions
export const api = {
  // Register a new MCP server
  registerServer: async (data: {
    mcpOrigin: string
    receiverAddress: string
    name?: string
    description?: string
    requireAuth?: boolean
    authHeaders?: Record<string, unknown>
    tools?: Array<{
      name: string
      pricing?: PricingEntry[]
    }>
    metadata?: Record<string, unknown>
  }): Promise<ServerCreateData> => {
    return apiCall('/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Get MCP tools from a server URL
  getMcpTools: async (url: string) => {
    return apiCall(`/inspect-mcp-tools?url=${encodeURIComponent(url)}`)
  },

  // Get servers list
  getServers: async (limit = 10, offset = 0) => {
    return apiCall(`/servers?limit=${limit}&offset=${offset}`)
  },

  // Get server by ID
  getServer: async (serverId: string): Promise<McpServerWithStats & { dailyAnalytics: DailyServerAnalytics, summaryAnalytics: ServerSummaryAnalytics }> => {
    return apiCall(`/servers/${serverId}`)
  },

  // Get server registration data
  getServerRegistration: async (serverId: string): Promise<ServerRegistrationData> => {
    return apiCall(`/servers/${serverId}/registration`)
  },

  // Get server tools
  getServerTools: async (serverId: string) => {
    return apiCall(`/servers/${serverId}/tools`)
  },

  // Wallet management (future functionality)
  getUserWallets: async (userId: string) => {
    return apiCall(`/users/${userId}/wallets`)
  },

  // Get user wallets with balance information
  getUserWalletsWithBalances: async (userId: string, includeTestnet = true) => {
    return apiCall(`/users/${userId}/wallets?includeTestnet=${includeTestnet}`)
  },

  addWalletToUser: async (userId: string, walletData: {
    walletAddress: string;
    blockchain: string;
    walletType: 'external' | 'managed' | 'custodial';
    provider?: string;
    isPrimary?: boolean;
    walletMetadata?: Record<string, unknown>;
  }) => {
    return apiCall(`/users/${userId}/wallets`, {
      method: 'POST',
      body: JSON.stringify(walletData),
    })
  },

  setWalletAsPrimary: async (userId: string, walletId: string) => {
    return apiCall(`/users/${userId}/wallets/${walletId}/primary`, {
      method: 'PUT',
    })
  },

  removeWallet: async (userId: string, walletId: string) => {
    return apiCall(`/users/${userId}/wallets/${walletId}`, {
      method: 'DELETE',
    })
  },

  // Coinbase Onramp integration
  createOnrampUrl: async (userId: string, options: {
    walletAddress?: string;
    network?: string;
    asset?: string;
    amount?: number;
    currency?: string;
    redirectUrl?: string;
  } = {}) => {
    return apiCall(`/users/${userId}/onramp/buy-url`, {
      method: 'POST',
      body: JSON.stringify(options),
    })
  },

  getOnrampConfig: async () => {
    return apiCall('/onramp/config')
  },

  // API Keys management
  getUserApiKeys: async (userId: string) => {
    return apiCall(`/users/${userId}/api-keys`)
  },

  createApiKey: async (userId: string, data: {
    name: string;
    permissions: string[];
    expiresInDays?: number;
  }) => {
    return apiCall(`/users/${userId}/api-keys`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  revokeApiKey: async (userId: string, keyId: string) => {
    return apiCall(`/users/${userId}/api-keys/${keyId}`, {
      method: 'DELETE',
    })
  },

  // User History
  getUserToolUsageHistory: async (userId: string, limit = 50, offset = 0) => {
    return apiCall(`/users/${userId}/tool-usage?limit=${limit}&offset=${offset}`)
  },

  getUserPaymentHistory: async (userId: string, limit = 50, offset = 0) => {
    return apiCall(`/users/${userId}/payments?limit=${limit}&offset=${offset}`)
  }
}
