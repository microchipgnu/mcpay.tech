"use client"

import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useTheme } from "@/components/providers/theme-context"
import { urlUtils } from "@/lib/client/utils"
import {
  ArrowRight,
  Rocket,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import Hero from "@/components/custom-ui/hero"
import HeroStats from "@/components/custom-ui/hero-stats"
import ServersGrid from "@/components/custom-ui/servers-grid"
import ContentCards from "@/components/custom-ui/content-cards"
import Footer from "@/components/custom-ui/footer"
// API response types
interface APITool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  isMonetized: boolean;
  payment: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface MCPTool {
  name: string
  description?: string
  inputSchema: {
    type: string
    properties: Record<string, MCPInputPropertySchema>
  }
  annotations?: {
    title?: string
    readOnlyHint?: boolean
    destructiveHint?: boolean
    idempotentHint?: boolean
    openWorldHint?: boolean
  }
}

interface MCPInputPropertySchema {
  type: string;
  description?: string;
  [key: string]: unknown;
}
export interface MCPServer { // Exporting MCPServer as it's used in the props
  id: string
  name: string
  description: string
  url: string
  category: string
  tools: MCPTool[]
  icon: React.ReactNode
  verified?: boolean
}

// Note: Backend supports multi-wallet and blockchain-agnostic user management
// Frontend currently displays single wallet but is prepared for multi-wallet features

interface APIServer {
  id: string;
  serverId: string;
  name: string;
  receiverAddress: string;
  description: string;
  metadata?: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
  tools: APITool[];
}

const transformServerData = (apiServer: APIServer): MCPServer => ({
  id: apiServer.serverId,
  name: apiServer.name || 'Unknown Server',
  description: apiServer.description || 'No description available',
  url: apiServer.receiverAddress,
  category: (apiServer.metadata as Record<string, unknown>)?.category as string || 'General',
  icon: <TrendingUp className="h-6 w-6" />,
  verified: apiServer.status === 'active',
  tools: apiServer.tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: (tool.inputSchema as Record<string, unknown>)?.type as string || "object",
      properties: (tool.inputSchema as Record<string, unknown>)?.properties as Record<string, MCPInputPropertySchema> || {}
    },
    annotations: {
      title: tool.name,
      readOnlyHint: !tool.isMonetized,
      destructiveHint: false,
    },
  })),
});

export default function MCPBrowser() {
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreServers, setHasMoreServers] = useState(true)

  const { isDark, toggleTheme } = useTheme()

  // Helper function to get user-friendly error messages
  const getFriendlyErrorMessage = (error: string) => {
    if (error.includes('404')) {
      return {
        title: "Welcome to MCPay!",
        message: "We're setting up the server directory. Be the first to register your MCP server and start earning!",
        actionText: "Register your server",
        actionHref: "/register",
        showRetry: false
      }
    }

    if (error.includes('500') || error.includes('502') || error.includes('503')) {
      return {
        title: "Server maintenance",
        message: "We're performing some quick maintenance. Please try again in a few moments.",
        actionText: "Try again",
        actionHref: null,
        showRetry: true
      }
    }

    if (error.includes('Network') || error.includes('fetch')) {
      return {
        title: "Connection issue",
        message: "Please check your internet connection and try again.",
        actionText: "Try again",
        actionHref: null,
        showRetry: true
      }
    }

    // Generic error fallback
    return {
      title: "Something went wrong",
      message: "We're working to fix this issue. In the meantime, you can register your MCP server.",
      actionText: "Register your server",
      actionHref: "/register",
      showRetry: true
    }
  }

  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true)
        setError(null)

        const serversResponse = await fetch(urlUtils.getApiUrl('/servers?limit=9&type=trending'))
        if (!serversResponse.ok) {
          throw new Error(`Failed to fetch servers: ${serversResponse.status}`)
        }

        const servers: APIServer[] = await serversResponse.json()
        const transformedServers = servers.map(server => transformServerData(server))

        setMcpServers(transformedServers)
        setHasMoreServers(servers.length === 9) // If we got 9 servers, there might be more
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch servers')
      } finally {
        setLoading(false)
      }
    }
    fetchServers()
  }, [])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const currentOffset = mcpServers.length
      const serversResponse = await fetch(urlUtils.getApiUrl(`/servers?limit=9&offset=${currentOffset}&type=trending`))

      if (!serversResponse.ok) {
        throw new Error(`Failed to fetch more servers: ${serversResponse.status}`)
      }

      const servers: APIServer[] = await serversResponse.json()
      const transformedServers = servers.map(server => transformServerData(server))

      setMcpServers((prev: MCPServer[]) => [...prev, ...transformedServers])
      setHasMoreServers(servers.length === 9) // If we got 9 servers, there might be more
    } catch (err) {
      console.error('Error loading more servers:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  // Error state
  if (error) {
    const errorInfo = getFriendlyErrorMessage(error)

    return (
      <div className="min-h-screen bg-background">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Section */}
          <div className="text-center mb-16 relative">
            <div className="mb-[100px]"></div>
            <h1 className={`text-5xl font-extrabold tracking-tight mb-6 animate-fade-in-up ${isDark ? "text-white" : "text-gray-900"}`}>
              {errorInfo.title}
            </h1>

            <p className={`text-lg max-w-3xl mx-auto leading-relaxed animate-fade-in-up animation-delay-300 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              {errorInfo.message}
            </p>

            <div className="flex items-center justify-center gap-6 mt-8 animate-fade-in-up animation-delay-500">
              {errorInfo.actionHref && (
                <Link href={errorInfo.actionHref}>
                  <Button
                    size="lg"
                    className="bg-[#0052FF] hover:bg-[#0052FF]/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <Rocket className="h-5 w-5 mr-2" />
                    {errorInfo.actionText}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              )}

              {errorInfo.showRetry && (
                <Button
                  onClick={() => window.location.reload()}
                  size="lg"
                  variant="outline"
                  className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  {errorInfo.actionHref ? "Try Again" : errorInfo.actionText}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <section className="mb-16 md:mb-40">
          <Hero />
        </section>

        <section className="mb-40">
          <HeroStats />
        </section>

        <section className="mb-40">
          <div className="max-w-6xl px-4 md:px-6 mx-auto">
            <h2 className="text-3xl font-semibold font-host mb-10">Featured Servers</h2>
          </div>
          <ServersGrid servers={mcpServers} loading={loading} />
        </section>

        {/* Load More Button */}
        {hasMoreServers && !loading && (
          <div className="text-center mb-16">
            <Button
              onClick={loadMore}
              disabled={loadingMore}
              size="lg"
              variant="outline"
              className={`px-8 py-3 ${isDark ? "bg-gray-800/50 hover:bg-gray-700/50 border-gray-600" : "bg-white/50 hover:bg-white/80 border-gray-300"} backdrop-blur transition-all duration-300 hover:shadow-lg`}
            >
              {loadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                  Loading...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Load More Servers
                </>
              )}
            </Button>
          </div>
        )}

        <section className="mb-40">
          <div className="max-w-6xl px-4 md:px-6 mx-auto">
            <h2 className="text-3xl font-semibold font-host mb-10">How it works</h2>
          </div>
          <ContentCards />
        </section>
      </div>
      <Footer />
    </div>
  )
}
