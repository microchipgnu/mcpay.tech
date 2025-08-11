"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useTheme } from "@/components/providers/theme-context"
import { urlUtils } from "@/lib/client/utils"
import {
  ArrowRight,
  BarChart3,
  Globe,
  Moon,
  Rocket,
  Sparkles,
  Sun,
  PenToolIcon as Tool,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import Hero from "@/components/custom-ui/hero"
import HeroStats from "@/components/custom-ui/hero-stats"

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Endpoint copied • paste into `fetch()`")
  }

  // Enhanced skeleton card component
  const SkeletonCard = ({ delay = 0 }: { delay?: number }) => (
    <Card className={`overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${isDark ? "bg-gray-800/50 backdrop-blur" : "bg-white/90 backdrop-blur"
      }`} style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="pb-4 relative">
        <div className="absolute top-4 right-4">
          <div className={`h-5 w-16 rounded-full animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        </div>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl w-14 h-14 animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          <div className="flex-1 space-y-3">
            <div className={`h-6 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '70%' }} />
            <div className={`h-4 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '50%' }} />
          </div>
        </div>
        <div className="space-y-2 mt-4">
          <div className={`h-4 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          <div className={`h-4 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '85%' }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className={`h-4 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '30%' }} />
          <div className={`h-10 rounded-lg animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        </div>
        <div className="space-y-2">
          <div className={`h-4 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '50%' }} />
          <div className={`h-10 rounded-lg animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        </div>
        <div className={`h-12 rounded-lg animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
      </CardContent>
    </Card>
  )

  // Error state
  if (error) {
    const errorInfo = getFriendlyErrorMessage(error)

    return (
      <div className={`min-h-screen ${isDark ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" : "bg-gradient-to-br from-gray-50 via-white to-gray-100"}`}>
        {/* Subtle background gradient */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute inset-0 ${isDark ? "bg-gradient-to-br from-gray-900/50 via-transparent to-gray-800/30" : "bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/20"}`} />
        </div>

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

          {/* Enhanced Footer */}
          <div className={`text-center py-12 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                <p className={`text-lg ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                  Powered by the <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Model Context Protocol</a> and <a href="https://x402.org" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">x402</a>
                </p>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <a
                  href="https://github.com/microchipgnu/mcpay.fun"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`hover:text-[#0052FF] transition-colors duration-200 ${isDark ? "text-gray-400" : "text-gray-500"} cursor-pointer`}
                >
                  GitHub
                </a>
                <span className={isDark ? "text-gray-600" : "text-gray-400"}>·</span>
                <a
                  href="https://x.com/microchipgnu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`hover:text-[#0052FF] transition-colors duration-200 ${isDark ? "text-gray-400" : "text-gray-500"} cursor-pointer`}
                >
                  X
                </a>
                <span className={isDark ? "text-gray-600" : "text-gray-400"}>·</span>
                <button
                  onClick={toggleTheme}
                  className={`flex items-center gap-1.5 hover:text-[#0052FF] transition-colors duration-200 ${isDark ? "text-gray-400" : "text-gray-500"} cursor-pointer`}
                >
                  {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  {isDark ? "Light" : "Dark"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" : "bg-gradient-to-br from-gray-50 via-white to-gray-100"}`}>
      {/* Subtle background gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute inset-0 ${isDark ? "bg-gradient-to-br from-gray-900/50 via-transparent to-gray-800/30" : "bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/20"}`} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <section className="mb-16 md:mb-32">
          <Hero />
        </section>

        <section className="mb-10">
          <HeroStats />
        </section>

        {/* Enhanced Browse Servers Section */}
        <div className="mb-12" id="servers-section">
          <div className="text-center mb-12">
            <h2 className={`text-4xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
              Discover MCP Servers
            </h2>
            <div className="h-0.5 w-32 mx-auto mb-6 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full" />
            <p className={`text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Explore powerful tools and services from our community
            </p>
          </div>
        </div>

        {/* Enhanced MCP Server Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`skeleton-${index}`} delay={index * 100} />
            ))
          ) : mcpServers.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="p-6 rounded-2xl bg-gray-100 dark:bg-gray-800 w-fit mx-auto mb-6">
                <Globe className={`h-16 w-16 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
              </div>
              <h3 className="text-2xl font-bold mb-4">No Servers Found</h3>
              <p className={`mb-6 text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Be the first to register a server!
              </p>
            </div>
          ) : (
            mcpServers.map((server: MCPServer, index: number) => (
              <Card key={server.id} className={`group relative overflow-hidden border ${isDark
                ? "bg-surface-dark backdrop-blur border-white/[0.08] shadow-sm hover:shadow-md"
                : "bg-surface backdrop-blur border-black/[0.05] shadow-sm hover:shadow-md"
                } transition-all duration-300 hover:scale-[1.02] animate-fade-in-up`} style={{ animationDelay: `${index * 100}ms` }}>
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <CardHeader className="pb-4 relative">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? "bg-blue-900/20" : "bg-blue-50"} shadow-lg group-hover:shadow-xl transition-shadow duration-300`}>
                      {server.icon}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all duration-300">
                        {server.name}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                        {server.category}
                      </Badge>
                    </div>
                  </div>

                  <CardDescription className="text-sm leading-relaxed mt-4 h-12 line-clamp-2">
                    {server.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Enhanced URL section */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      MCP Connection URL
                    </label>
                    <div className="flex items-center gap-2">
                      <code className={`flex-1 text-xs p-3 rounded-lg font-mono break-all transition-colors duration-200 ${isDark ? "bg-gray-700/50 border border-gray-600/50 hover:bg-gray-700" : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                        }`}>
                        {urlUtils.getMcpUrl(server.id)}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.preventDefault();
                          e.stopPropagation();
                          copyToClipboard(urlUtils.getMcpUrl(server.id));
                        }}
                        className="shrink-0 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  {/* Enhanced tools section */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Tool className="h-4 w-4" />
                      Available Tools
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {server.tools.length}
                      </Badge>
                    </label>
                  </div>

                  {/* Enhanced action button */}
                  <Link
                    href={`/servers/${server.id}`}
                    className="w-full"
                    scroll={true}
                  >
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300"
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Open Dashboard →
                    </Button>
                  </Link>
                </CardContent>

                {/* Shine effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 transform translate-x-full group-hover:-translate-x-full transition-transform duration-1000" />
                </div>
              </Card>
            ))
          )}
        </div>

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

        {/* Enhanced Footer */}
        <div className={`text-center py-12 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              <p className={`text-lg ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                Powered by the <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Model Context Protocol</a> and <a href="https://x402.org" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">x402</a>
              </p>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <a
                href="https://github.com/microchipgnu/mcpay.fun"
                target="_blank"
                rel="noopener noreferrer"
                className={`hover:text-[#0052FF] transition-colors duration-200 ${isDark ? "text-gray-400" : "text-gray-500"} cursor-pointer`}
              >
                GitHub
              </a>
              <span className={isDark ? "text-gray-600" : "text-gray-400"}>·</span>
              <a
                href="https://x.com/microchipgnu"
                target="_blank"
                rel="noopener noreferrer"
                className={`hover:text-[#0052FF] transition-colors duration-200 ${isDark ? "text-gray-400" : "text-gray-500"} cursor-pointer`}
              >
                X
              </a>
              <span className={isDark ? "text-gray-600" : "text-gray-400"}>·</span>
              <button
                onClick={toggleTheme}
                className={`flex items-center gap-1.5 hover:text-[#0052FF] transition-colors duration-200 ${isDark ? "text-gray-400" : "text-gray-500"} cursor-pointer`}
              >
                {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {isDark ? "Light" : "Dark"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
