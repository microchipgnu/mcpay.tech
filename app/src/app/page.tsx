"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useTheme } from "@/components/providers/theme-context"
import { urlUtils, textUtils } from "@/lib/client/utils"
import type { MCPServer, APITool, MCPTool, MCPInputPropertySchema, APIServer, AnalyticsData, SearchState } from "@/types"
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  DollarSign,
  Globe,
  Moon,
  Rocket,
  Search,
  Server,
  Sparkles,
  Sun,
  PenToolIcon as Tool,
  TrendingUp,
  X,
  Zap
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

// Note: Backend supports multi-wallet and blockchain-agnostic user management
// Frontend currently displays single wallet but is prepared for multi-wallet features

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
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreServers, setHasMoreServers] = useState(true)
  
  // Consolidated search state
  const [search, setSearch] = useState<SearchState>({
    query: '',
    results: [],
    isActive: false,
    isLoading: false,
    error: null
  })
  
  const { isDark, toggleTheme } = useTheme()

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearch(prev => ({
        ...prev,
        isActive: false,
        results: [],
        error: null,
        isLoading: false
      }))
      return
    }

    const validation = textUtils.validateSearchTerm(query)
    if (!validation.isValid) {
      setSearch(prev => ({
        ...prev,
        error: validation.error || null,
        results: [],
        isLoading: false
      }))
      return
    }

    setSearch(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      isActive: true
    }))

    try {
      const response = await fetch(urlUtils.getApiUrl(`/servers/search?q=${encodeURIComponent(query.trim())}&limit=20`))
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Search failed: ${response.status}`)
      }

      const servers: APIServer[] = await response.json()
      const transformedServers = servers.map(server => transformServerData(server))
      
      setSearch(prev => ({
        ...prev,
        results: transformedServers,
        isLoading: false,
        error: null
      }))
    } catch (err) {
      setSearch(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Search failed',
        results: [],
        isLoading: false
      }))
    }
  }, [])

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(search.query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [search.query, performSearch])

  // Search input handler
  const handleSearchInput = (value: string) => {
    setSearch(prev => ({
      ...prev,
      query: value,
      // Clear error when user starts typing
      error: prev.error && value.trim() ? null : prev.error
    }))
  }

  // Clear search
  const clearSearch = () => {
    setSearch({
      query: '',
      results: [],
      isActive: false,
      isLoading: false,
      error: null
    })
  }

  // Get current servers to display
  const currentServers = search.isActive ? search.results : mcpServers
  const isShowingSearchResults = search.isActive
  const isSearching = search.isLoading
  const searchError = search.error

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setAnalyticsLoading(true)
        setAnalyticsError(null)

        const analyticsResponse = await fetch(urlUtils.getApiUrl('/analytics/usage'))
        if (!analyticsResponse.ok) {
          throw new Error(`Failed to fetch analytics: ${analyticsResponse.status}`)
        }

        const analyticsData: AnalyticsData = await analyticsResponse.json()
        setAnalytics(analyticsData)
      } catch (err) {
        setAnalyticsError(err instanceof Error ? err.message : 'Failed to fetch analytics')
      } finally {
        setAnalyticsLoading(false)
      }
    }

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

    fetchAnalytics()
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

  // Format number with commas
  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '0'
    return num.toLocaleString()
  }

  // Format currency
  const formatCurrency = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '$0.00'
    return `$${num.toFixed(2)}`
  }

  // Enhanced stats card component with original color scheme
  const StatsCard = ({
    title,
    value,
    icon: Icon,
    subtitle,
    trend,
    delay = 0
  }: {
    title: string
    value: string | number
    icon: React.ComponentType<{ className?: string }>
    subtitle?: string
    trend?: string
    delay?: number
  }) => (
    <Card className={`group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1 ${isDark ? "bg-gray-800/50 backdrop-blur" : "bg-white/80 backdrop-blur"
      }`} style={{ animationDelay: `${delay}ms` }}>
      {/* Subtle background */}
      <div className={`absolute inset-0 ${isDark ? "bg-blue-900/5" : "bg-blue-50/50"} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

      {/* Content */}
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl ${isDark ? "bg-blue-900/20" : "bg-blue-50"} shadow-lg`}>
            <Icon className={`h-6 w-6 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
          </div>
          {trend && (
            <div className={`flex items-center text-sm font-medium px-2 py-1 rounded-full ${trend.startsWith('+')
              ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
              : trend.startsWith('-')
                ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
                : 'text-gray-600 bg-gray-50 dark:bg-gray-700'
              }`}>
              <TrendingUp className="h-3 w-3 mr-1" />
              {trend}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {title}
          </p>
          <p className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-lg" />
    </Card>
  )

  // Enhanced stats skeleton component
  const StatsSkeleton = ({ delay = 0 }: { delay?: number }) => (
    <Card className={`overflow-hidden border-0 shadow-lg ${isDark ? "bg-gray-800/50 backdrop-blur" : "bg-white/80 backdrop-blur"
      }`} style={{ animationDelay: `${delay}ms` }}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
            <div className="h-6 w-6" />
          </div>
          <div className={`h-6 w-12 rounded-full animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        </div>
        <div className="space-y-2">
          <div className={`h-4 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '60%' }} />
          <div className={`h-8 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '40%' }} />
          <div className={`h-3 rounded animate-pulse ${isDark ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: '80%' }} />
        </div>
      </div>
    </Card>
  )

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
    return (
      <div className={`min-h-screen ${isDark ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" : "bg-gradient-to-br from-gray-50 via-white to-gray-100"}`}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/20 w-fit mx-auto mb-6">
                <AlertCircle className={`h-12 w-12 ${isDark ? "text-red-400" : "text-red-500"}`} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Oops! Something went wrong</h3>
              <p className={`mb-6 text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>{error}</p>
              <Button onClick={() => window.location.reload()} size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600">
                <Rocket className="h-4 w-4 mr-2" />
                Try Again
              </Button>
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
        {/* Enhanced Header */}
        <div className="text-center mb-16 relative">
          <div className="mb-[100px]"></div>
          <h1 className={`text-5xl font-extrabold tracking-tight mb-6 animate-fade-in-up ${isDark ? "text-white" : "text-gray-900"}`}>
            Monetize your MCP server in <span className="text-[#0052FF]">one&nbsp;click.</span>
          </h1>

          <p className={`text-lg max-w-3xl mx-auto leading-relaxed animate-fade-in-up animation-delay-300 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            Serve, price & settle with on-chain USDC via <a href="https://x402.org" className="underline hover:text-[#00D8FF] transition-colors" target="_blank" rel="noopener noreferrer">x402</a>.
          </p>

          <div className="flex items-center justify-center gap-6 mt-8 animate-fade-in-up animation-delay-500">
            <Link href="/register">
              <Button
                size="lg"
                className="bg-[#0052FF] hover:bg-[#0052FF]/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Rocket className="h-5 w-5 mr-2" />
                Monetize your server
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>

            <button
              className="text-sm underline hover:text-[#0052FF] transition-colors cursor-pointer"
              onClick={() => {
                // Scroll to servers section
                document.querySelector('#servers-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Discover MCP servers
            </button>
          </div>

        </div>

        {/* Enhanced Platform Stats */}
        <div className="mb-16">
          {analyticsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <StatsSkeleton key={`stats-skeleton-${index}`} delay={index * 100} />
              ))}
            </div>
          ) : analyticsError ? (
            <div className="text-center py-12">
              <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/20 w-fit mx-auto mb-6">
                <AlertCircle className={`h-12 w-12 ${isDark ? "text-red-400" : "text-red-500"}`} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Unable to load statistics</h3>
              <p className={`text-sm ${isDark ? "text-red-400" : "text-red-500"}`}>
                We&apos;re working to restore the data feed
              </p>
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Live MCP Servers"
                value={formatNumber(analytics.totalServers)}
                icon={Server}
                subtitle={`${analytics.activeServers} online now`}
                delay={0}
              />
              <StatsCard
                title="USDC Paid Out"
                value={formatCurrency(analytics.totalRevenue)}
                icon={DollarSign}
                subtitle={`${formatNumber(analytics.totalPayments)} transactions`}
                delay={100}
              />
              <StatsCard
                title="Avg. payout / 1k calls"
                value={formatCurrency(analytics.totalRequests > 0 ? (analytics.totalRevenue / (analytics.totalRequests / 1000)) : 0)}
                icon={TrendingUp}
                subtitle={`${analytics.successRate}% success rate`}
                delay={200}
              />
              <StatsCard
                title="Easiest server setup"
                value="< 1 min"
                icon={Zap}
                subtitle={`${analytics.monetizedTools} monetized tools`}
                delay={300}
              />
            </div>
          ) : null}
        </div>

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

        {/* Enhanced Search Bar */}
        <div className="flex justify-center mb-8">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className={`h-5 w-5 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
            </div>
            <Input
              type="text"
              placeholder="Search servers, tools, or descriptions..."
              value={search.query}
              onChange={(e) => handleSearchInput(e.target.value)}
              className={`pl-10 pr-10 py-3 w-full rounded-2xl border-0 shadow-lg ${
                isDark 
                  ? "bg-gray-800/50 backdrop-blur text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500" 
                  : "bg-white/80 backdrop-blur text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
              }`}
              maxLength={100}
              disabled={loading}
            />
            {search.query && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSearch}
                  className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Search Status */}
        {isShowingSearchResults && (
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isSearching && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              )}
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                {isSearching 
                  ? "Searching..." 
                  : searchError
                    ? `Search failed: ${searchError}`
                    : `Found ${search.results.length} server${search.results.length === 1 ? '' : 's'} matching "${textUtils.sanitizeForDisplay(search.query, 50)}"`
                }
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={clearSearch}
              className="text-xs"
            >
              Back to trending servers
            </Button>
          </div>
        )}

        {/* Enhanced MCP Server Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {(loading || isSearching) ? (
            Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`skeleton-${index}`} delay={index * 100} />
            ))
          ) : searchError ? (
            <div className="col-span-full text-center py-16">
              <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-900/20 w-fit mx-auto mb-6">
                <AlertCircle className={`h-16 w-16 ${isDark ? "text-red-400" : "text-red-500"}`} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Search Error</h3>
              <p className={`mb-6 text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                {searchError}
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={clearSearch} size="lg" variant="outline">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Back to trending servers
                </Button>
                <Button 
                  onClick={() => {
                    setSearch(prev => ({ ...prev, query: '', error: null }))
                    const inputElement = document.querySelector(`input[type="text"]`) as HTMLInputElement
                    inputElement?.focus()
                  }} 
                  size="lg" 
                  className={`${isDark ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-600 hover:bg-blue-700"} text-white`}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Try different search
                </Button>
              </div>
            </div>
          ) : currentServers.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="p-6 rounded-2xl bg-gray-100 dark:bg-gray-800 w-fit mx-auto mb-6">
                {isShowingSearchResults ? (
                  <Search className={`h-16 w-16 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                ) : (
                  <Globe className={`h-16 w-16 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                )}
              </div>
              <h3 className="text-2xl font-bold mb-4">
                {isShowingSearchResults ? "No results found" : "No Servers Found"}
              </h3>
              <p className={`mb-6 text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                {isShowingSearchResults 
                  ? `We couldn't find any servers matching "${textUtils.sanitizeForDisplay(search.query, 50)}".`
                  : "Be the first to register a server!"
                }
              </p>
              {isShowingSearchResults && (
                <div className="flex gap-4 justify-center">
                  <Button onClick={clearSearch} size="lg" variant="outline">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Back to trending servers
                  </Button>
                  <Button 
                    onClick={() => {
                      setSearch(prev => ({ ...prev, query: '', error: null }))
                      const inputElement = document.querySelector(`input[type="text"]`) as HTMLInputElement
                      inputElement?.focus()
                    }} 
                    size="lg" 
                    className={`${isDark ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-600 hover:bg-blue-700"} text-white`}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Try different search
                  </Button>
                </div>
              )}
            </div>
          ) : (
            currentServers.map((server: MCPServer, index: number) => (
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

        {/* Load More Button - only show when not in search mode */}
        {!isShowingSearchResults && hasMoreServers && !loading && (
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
