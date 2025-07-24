"use client"

import { ConnectButton } from "@/components/custom-ui/connect-button"
import { useTheme } from "@/components/providers/theme-context"
import { usePrimaryWallet, useUser, useUserWallets } from "@/components/providers/user"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { urlUtils } from "@/lib/client/utils"
import { switchToNetwork } from "@/lib/client/wallet-utils"
import {
  formatTokenAmount,
  getNetworkByChainId,
  getTokenInfo,
} from "@/lib/commons"
import { getNetworkInfo } from "@/lib/commons/tokens"
import { type Network } from "@/types/blockchain"
import { PricingEntry } from "@/types/payments"
import { InputProperty, MCPClient, MCPToolFromClient, MCPToolsCollection, ToolExecutionModalProps, ToolInputSchema, type ToolFromMcpServerWithStats } from "@/types/mcp"
import { type UserWallet } from "@/types/wallet"
import { experimental_createMCPClient } from "ai"
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Coins,
  Copy,
  Loader2,
  Play,
  RefreshCw,
  Wallet,
  Wrench
} from "lucide-react"
import { createPaymentTransport } from "mcpay/client"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { privateKeyToAccount } from "viem/accounts"
import { useAccount, useChainId, useWalletClient } from "wagmi"

// Helper function to format wallet address for display
const formatWalletAddress = (address: string): string => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================



type ExecutionStatus = 'idle' | 'initializing' | 'executing' | 'success' | 'error'

interface ToolExecution {
  status: ExecutionStatus
  result?: unknown
  error?: string
  transactionId?: string
}


// =============================================================================
// STYLING UTILITIES
// =============================================================================

const getThemeClasses = (isDark: boolean) => ({
  input: isDark ? "bg-gray-700 border-gray-600 text-white" : "",
  button: isDark ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "",
  modal: isDark ? "bg-gray-800 border-gray-700" : "",
  text: {
    primary: isDark ? "text-gray-300" : "text-gray-700",
    secondary: isDark ? "text-gray-400" : "text-gray-600",
    error: isDark ? "text-gray-300" : "text-gray-800"
  },
  background: {
    error: isDark ? "bg-red-900/20 text-red-400 border border-red-800" : "bg-red-50 text-red-600 border border-red-200",
    success: isDark ? "bg-green-900/20 text-green-400 border-green-800" : "bg-green-50 text-green-600 border-green-200",
    warning: isDark ? "bg-orange-900/20 text-orange-400 border-orange-800" : "bg-orange-50 text-orange-600 border-orange-200",
    info: isDark ? "bg-blue-900/20 text-blue-400 border-blue-800" : "bg-blue-50 text-blue-600 border-blue-200",
    code: isDark ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200"
  }
})

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ToolExecutionModal({ isOpen, onClose, tool, serverId }: ToolExecutionModalProps) {
  const { isDark } = useTheme()
  const { hasWallets } = useUser()
  const primaryWallet = usePrimaryWallet()
  const userWallets = useUserWallets()
  const { data: walletClient } = useWalletClient()
  const { address: connectedWalletAddress, isConnected: isBrowserWalletConnected } = useAccount()
  const chainId = useChainId()
  const themeClasses = getThemeClasses(isDark)
  
  // State for selected wallet (defaults to primary wallet)
  const [selectedWallet, setSelectedWallet] = useState<UserWallet | null>(null)
  const [walletPopoverOpen, setWalletPopoverOpen] = useState(false)
  const [pricingPopoverOpen, setPricingPopoverOpen] = useState(false)
  const [selectedPricingTier, setSelectedPricingTier] = useState(0) // Index of selected pricing tier

  // Set selected wallet to primary when primary wallet changes
  useEffect(() => {
    if (primaryWallet && !selectedWallet) {
      setSelectedWallet(primaryWallet)
    }
  }, [primaryWallet, selectedWallet])



  // Get wallet connection status
  const activeWallet = selectedWallet || primaryWallet
  const walletAddress = activeWallet?.walletAddress
  const hasAccountWallets = hasWallets() && !!walletAddress
  
  // Check if selected wallet requires browser connection
  const requiresBrowserConnection = activeWallet?.walletType === 'external'
  const hasWalletClient = !!walletClient
  const needsBrowserConnection = requiresBrowserConnection && (!isBrowserWalletConnected || connectedWalletAddress?.toLowerCase() !== walletAddress?.toLowerCase())
  const needsWalletClient = requiresBrowserConnection // Only external wallets need wagmi wallet client
  
  // Overall connection status
  const isConnected = hasAccountWallets && (!needsWalletClient || hasWalletClient) && !needsBrowserConnection
  
  // Create stable tool reference to avoid infinite loops
  const toolInputSchemaString = useMemo(() => JSON.stringify(tool?.inputSchema), [tool?.inputSchema])
  
  const stableTool = useMemo(() => {
    if (!tool) return null
    return tool as ToolFromMcpServerWithStats & {
      pricing?: PricingEntry[]
    }
  }, [tool, tool?.id, tool?.name, toolInputSchemaString, tool?.description, tool?.isMonetized, tool?.pricing])

  // State management
  const [toolInputs, setToolInputs] = useState<Record<string, unknown>>({})
  const [execution, setExecution] = useState<ToolExecution>({ status: 'idle' })
  const [isMobile, setIsMobile] = useState(false)
  const [mcpClient, setMcpClient] = useState<MCPClient | null>(null)
  const [mcpToolsCollection, setMcpToolsCollection] = useState<MCPToolsCollection>({})
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)
  const [showPrettyJson, setShowPrettyJson] = useState(true)

  // =============================================================================
  // NETWORK UTILITIES
  // =============================================================================

  const getActivePricing = useCallback((): PricingEntry[] => {
    if (!stableTool?.isMonetized || !stableTool.pricing?.length) return []
    return (stableTool.pricing as PricingEntry[]).filter(p => p.active === true)
  }, [stableTool])

  const getRequiredNetwork = useCallback((): string | null => {
    const activePricing = getActivePricing()
    if (!activePricing.length) return null
    const selectedPricing = activePricing[selectedPricingTier] || activePricing[0]
    return selectedPricing.network
  }, [getActivePricing, selectedPricingTier])

  const getCurrentNetwork = useCallback((): string | null => {
    const network = chainId ? getNetworkByChainId(chainId) : undefined
    return typeof network === 'string' ? network : null
  }, [chainId])

  const isOnCorrectNetwork = useCallback((): boolean => {
    const requiredNetwork = getRequiredNetwork()
    const currentNetwork = getCurrentNetwork()

    if (!requiredNetwork) return true // Free tools don't require specific network
    
    // Managed wallets don't need network switching - handled server-side
    if (activeWallet?.walletType === 'managed') return true
    
    return requiredNetwork === currentNetwork
  }, [getRequiredNetwork, getCurrentNetwork, activeWallet?.walletType])

  const shouldShowNetworkStatus = useCallback((): boolean => {
    const activePricing = getActivePricing()
    if (!activePricing.length || !isConnected) {
      return false
    }
    return isOnCorrectNetwork()
  }, [getActivePricing, isConnected, isOnCorrectNetwork])

  const handleNetworkSwitch = async () => {
    const requiredNetwork = getRequiredNetwork()
    if (!requiredNetwork) return

    setIsSwitchingNetwork(true)
    setExecution({ status: 'idle' }) // Clear any previous errors

    try {
      console.log(`[Network Switch] Starting switch to ${requiredNetwork}`)
      
      // Get network info from unified system

      const networkInfo = getNetworkInfo(requiredNetwork as Network)
      console.log(`[Network Switch] Network info:`, networkInfo)

      await switchToNetwork(requiredNetwork as Network)
      console.log(`[Network Switch] Successfully switched to ${requiredNetwork}`)

      // Clear any previous errors after successful switch
      if (execution.status === 'error') {
        setExecution({ status: 'idle' })
      }
    } catch (error) {
      console.error('[Network Switch] Failed to switch network:', error)
      console.error('[Network Switch] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        requiredNetwork,
        error
      })

      setExecution({
        status: 'error',
        error: `Failed to switch to ${requiredNetwork}: ${error instanceof Error ? error.message : 'Unknown error. Check browser console for details.'}`
      })
    } finally {
      setIsSwitchingNetwork(false)
    }
  }

  // Reset pricing tier when active pricing changes
  useEffect(() => {
    const activePricing = getActivePricing()
    if (selectedPricingTier >= activePricing.length) {
      setSelectedPricingTier(0)
    }
  }, [getActivePricing, selectedPricingTier])

  // =============================================================================
  // CURRENCY AND TOKEN UTILITIES
  // =============================================================================

  const formatCurrency = useCallback((amount: string | number, currency: string, network?: string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount

    // If we have network info, try to get token info from registry
    if (network) {
      const tokenInfo = getTokenInfo(currency, network as Network)
      if (tokenInfo) {
        // Use our awesome token registry formatting
        return formatTokenAmount(num, currency, network as Network, {
          showSymbol: true,
          precision: tokenInfo.isStablecoin ? 2 : 4,
          compact: num >= 1000
        })
      }
    }

    // Fallback: check if it's a token address and show abbreviated
    if (currency.startsWith('0x') && currency.length === 42) {
      return `${num.toFixed(6)} ${currency.slice(0, 6)}...${currency.slice(-4)}`
    }

    // Simple currency display
    return `${num.toFixed(6)} ${currency}`
  }, [])

  // Enhanced token display with verification badge
  const TokenDisplay = ({
    currency,
    network,
    amount
  }: {
    currency: string
    network: string
    amount?: string | number
  }) => {
    const tokenInfo = getTokenInfo(currency, network as Network)

    return (
      <div className="flex items-center gap-2">
        {/* Token Logo */}
        {tokenInfo?.logoUri && (
          <div className="w-4 h-4 rounded-full overflow-hidden">
            <Image
              src={tokenInfo.logoUri}
              alt={tokenInfo.symbol}
              width={16}
              height={16}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Amount and Symbol */}
        <div className="flex items-center gap-1">
          {amount && (
            <span className="font-medium">
              {formatCurrency(amount, currency, network)}
            </span>
          )}
          {!amount && tokenInfo && (
            <span className="font-medium">{tokenInfo.symbol}</span>
          )}
          {!amount && !tokenInfo && (
            <span className="font-mono text-xs">
              {currency.startsWith('0x') ? `${currency.slice(0, 6)}...` : currency}
            </span>
          )}
        </div>
      </div>
    )
  }

  // =============================================================================
  // MOBILE DETECTION
  // =============================================================================

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)

    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  // =============================================================================
  // TOOL SCHEMA UTILITIES
  // =============================================================================

  const getToolProperties = useCallback((toolArg: ToolFromMcpServerWithStats): Record<string, InputProperty> => {
    // First try to get from MCP client tools (if available and initialized)
    if (isInitialized && mcpToolsCollection[toolArg.name]) {
      const mcpTool = mcpToolsCollection[toolArg.name] as MCPToolFromClient
      if (mcpTool.inputSchema?.jsonSchema?.properties) {
        return mcpTool.inputSchema.jsonSchema.properties
      }
      if (mcpTool.parameters?.jsonSchema?.properties) {
        return mcpTool.parameters.jsonSchema.properties
      }
    }

    // Fallback to server tool inputSchema
    const schema = toolArg.inputSchema as ToolInputSchema
    if (schema && typeof schema === 'object' && schema.properties) {
      return schema.properties
    }
    return {}
  }, [isInitialized, mcpToolsCollection])

  const getRequiredFields = useCallback((toolArg: ToolFromMcpServerWithStats): string[] => {
    // First try to get from MCP client tools (if available and initialized)
    if (isInitialized && mcpToolsCollection[toolArg.name]) {
      const mcpTool = mcpToolsCollection[toolArg.name] as MCPToolFromClient
      if (mcpTool.parameters?.jsonSchema?.required) {
        return mcpTool.parameters.jsonSchema.required
      }
      if (mcpTool.inputSchema?.jsonSchema?.required) {
        return mcpTool.inputSchema.jsonSchema.required
      }
    }

    // Fallback to server tool inputSchema
    const schema = toolArg.inputSchema as ToolInputSchema
    if (schema && typeof schema === 'object' && schema.required) {
      return schema.required
    }
    return []
  }, [isInitialized, mcpToolsCollection])

  const hasToolInputs = useCallback((toolArg: ToolFromMcpServerWithStats): boolean => {
    const properties = getToolProperties(toolArg)
    return Object.keys(properties).length > 0
  }, [getToolProperties])

  // =============================================================================
  // TOOL INPUT MANAGEMENT
  // =============================================================================

  // Track previous tool ID and wallet ID to avoid unnecessary resets
  const [previousToolId, setPreviousToolId] = useState<string | null>(null)
  const [previousWalletId, setPreviousWalletId] = useState<string | null>(null)

  useEffect(() => {
    if (!stableTool) {
      setPreviousToolId(null)
      return
    }

    const currentWalletId = activeWallet?.id || null

    // Reset MCP initialization if the tool or active wallet changed
    const toolChanged = previousToolId !== stableTool.id
    const walletChanged = previousWalletId !== currentWalletId

    if (toolChanged || walletChanged) {
      if (toolChanged) setPreviousToolId(stableTool.id)
      if (walletChanged) setPreviousWalletId(currentWalletId)
      
      setIsInitialized(false)
      setIsSwitchingNetwork(false)
    }

    // Initialize tool inputs (this doesn't depend on MCP being ready)
    const inputs: Record<string, unknown> = {}
    const properties = getToolProperties(stableTool)

    Object.entries(properties).forEach(([key, prop]) => {
      if (prop.type === 'array') {
        inputs[key] = prop.default || []
      } else {
        inputs[key] = prop.default || ''
      }
    })

    setToolInputs(inputs)
    setExecution({ status: 'idle' })
  }, [stableTool, activeWallet?.id, previousToolId, previousWalletId, getToolProperties])

  // Update inputs when MCP data becomes available (enhances the initial inputs)
  useEffect(() => {
    if (!stableTool || !isInitialized || !mcpToolsCollection[stableTool.name]) return

    const inputs: Record<string, unknown> = {}
    const properties = getToolProperties(stableTool)

    Object.entries(properties).forEach(([key, prop]) => {
      if (prop.type === 'array') {
        inputs[key] = prop.default || []
      } else {
        inputs[key] = prop.default || ''
      }
    })

    setToolInputs(inputs)
  }, [stableTool, isInitialized, mcpToolsCollection, getToolProperties])

  // =============================================================================
  // MCP CLIENT INITIALIZATION
  // =============================================================================

  useEffect(() => {
    if (!isOpen || !isConnected || !walletAddress || !stableTool || isInitialized) return
    // Only check for walletClient if it's an external wallet that needs it
    if (needsWalletClient && !walletClient) return

    const initializeMcpClient = async () => {
      try {
        setExecution({ status: 'initializing' })

        // Create the MCP URL using the serverId
        const mcpUrl = new URL(urlUtils.getMcpUrl(serverId))

        // Create a viem-compatible Account object that x402 can use
        let account
        
        if (activeWallet?.walletType === 'external') {
          // For external wallets, use the wagmi wallet client
          if (!walletClient) {
            throw new Error("Wallet client required for external wallets")
          }
          account = walletClient
          console.log("Using external wallet client:", walletClient);
          console.log("Wallet client chain info:", walletClient.chain);
        } else {
          // For managed wallets, create a dummy account for transport initialization
          // The actual payment signing will be intercepted and handled server-side via CDP
          // We use a dummy private key just to create a valid viem account structure
          const dummyPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001'
          const dummyAccount = privateKeyToAccount(dummyPrivateKey)
          
          // Override the address to match the managed wallet address
          account = {
            ...dummyAccount,
            address: walletAddress as `0x${string}`,
          }
          
          console.log("Using managed wallet with dummy account (server-side payment):", {
            address: account.address,
            type: 'managed',
            walletType: activeWallet?.walletType
          });
        }

        const transport = createPaymentTransport(new URL(mcpUrl), account, {
          maxPaymentValue: BigInt(0.1 * 10 ** 6), // 0.1 USDC max
          requestInit: {
            // Add headers to help server identify managed wallet requests
            headers: {
              'X-Wallet-Type': activeWallet?.walletType || 'unknown',
              'X-Wallet-Address': walletAddress || '',
              'X-Wallet-Provider': activeWallet?.provider || 'unknown',
            }
          }
        });

        // Create MCP client
        const client = await experimental_createMCPClient({
          transport: transport,
        })

        console.log("MCP client created", client)

        // Get available tools
        const tools = await client.tools()
        console.log("Available MCP tools:", tools)

        setMcpClient(client)
        setMcpToolsCollection(tools)
        setIsInitialized(true)
        setExecution({ status: 'idle' })

        console.log(`MCP client initialized for tool: ${stableTool.name}`)
        console.log(`Available tools: ${Object.keys(tools).join(', ')}`)

        // Check if the current tool is available in MCP
        if (tools[stableTool.name]) {
          console.log(`Current tool found in MCP:`, tools[stableTool.name])
          const mcpTool = tools[stableTool.name] as unknown as MCPToolFromClient
          console.log(`Provider options:`, mcpTool)
          console.log(`Current tool schema:`, mcpTool.inputSchema || mcpTool.parameters)
        } else {
          console.warn(`Warning: Tool "${stableTool.name}" not found in MCP server tools`)
        }
      } catch (error) {
        console.error("Failed to initialize MCP client:", error)
        setExecution({
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to initialize MCP client'
        })
      }
    }

    initializeMcpClient()
  }, [isOpen, isConnected, walletAddress, stableTool, serverId, walletClient, isInitialized, needsWalletClient, activeWallet])

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false)
      setMcpClient(null)
      setMcpToolsCollection({})
      setExecution({ status: 'idle' })
      setIsSwitchingNetwork(false)
      setWalletPopoverOpen(false)
      setPricingPopoverOpen(false)
      setSelectedPricingTier(0)
    }
  }, [isOpen])

  // =============================================================================
  // TOOL EXECUTION
  // =============================================================================

  const updateToolInput = (inputName: string, value: unknown) => {
    setToolInputs(prev => ({
      ...prev,
      [inputName]: value
    }))
  }

  const executeTool = async () => {
    if (!stableTool || !mcpClient || !isInitialized) return
    // For external wallets, ensure wallet client is available
    if (needsWalletClient && !walletClient) return

    setExecution({ status: 'executing' })

    try {
      // Get the MCP tool by name
      const mcpTool = mcpToolsCollection[stableTool.name] as MCPToolFromClient

      if (!mcpTool) {
        throw new Error(`Tool "${stableTool.name}" not found in MCP server`)
      }

      console.log(`[Tool Execution] Starting execution for: ${stableTool.name}`)
      console.log(`[Tool Execution] Wallet type: ${activeWallet?.walletType}`)
      console.log(`[Tool Execution] Wallet address: ${walletAddress}`)
      console.log(`[Tool Execution] Tool inputs:`, toolInputs)
      console.log(`[Tool Execution] MCP tool schema:`, mcpTool.parameters?.jsonSchema || mcpTool.inputSchema?.jsonSchema)

      // Execute the tool using the MCP client's callTool method
      const result = await mcpTool.execute?.(toolInputs, {
        toolCallId: Date.now().toString(),
        messages: []
      })

      console.log(`[Tool Execution] Execution successful:`, result)

      // Try to extract transaction ID from result if available
      let transactionId: string | undefined
      if (typeof result === 'object' && result !== null) {
        const resultObj = result as Record<string, unknown>
        transactionId = resultObj.transactionId as string || 
                      resultObj.txId as string || 
                      resultObj.hash as string ||
                      resultObj.transaction_id as string
      }

      setExecution({
        status: 'success',
        result,
        transactionId
      })
    } catch (error) {
      console.error("[Tool Execution] Execution failed:", error)
      
      // Enhanced error handling for managed wallets
      if (activeWallet?.walletType === 'managed' && error instanceof Error) {
        if (error.message.includes('CDP') || error.message.includes('managed')) {
          setExecution({
            status: 'error',
            error: `Managed wallet error: ${error.message}. Please try again or contact support if the issue persists.`
          })
        } else {
          setExecution({
            status: 'error',
            error: `Tool execution failed: ${error.message}`
          })
        }
      } else {
        setExecution({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        })
      }
    }
  }

  const copyResult = (result: unknown, format: 'json' | 'raw' = 'json') => {
    if (format === 'raw') {
      navigator.clipboard.writeText(String(result))
      toast.success("Raw result copied to clipboard")
    } else {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2))
      toast.success("JSON copied to clipboard")
    }
  }

  const downloadResult = (result: unknown) => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${stableTool?.name || 'tool'}-result.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Result downloaded as JSON")
  }

  // =============================================================================
  // INPUT FIELD RENDERING
  // =============================================================================

  const renderInputField = (inputName: string, inputProp: InputProperty) => {
    console.log("Rendering input field:", inputName, inputProp)
    if (!stableTool) return null

    const currentValue = toolInputs[inputName] || ''
    const requiredFields = getRequiredFields(stableTool)
    const isRequired = requiredFields.includes(inputName)

    // Handle array inputs
    if (inputProp.type === 'array') {
      const arrayValue = Array.isArray(currentValue) ? currentValue : []

      const addArrayItem = () => {
        const newArray = [...arrayValue, '']
        updateToolInput(inputName, newArray)
      }

      const removeArrayItem = (index: number) => {
        const newArray = arrayValue.filter((_: unknown, i: number) => i !== index)
        updateToolInput(inputName, newArray)
      }

      const updateArrayItem = (index: number, value: string) => {
        const newArray = [...arrayValue]
        newArray[index] = value
        updateToolInput(inputName, newArray)
      }

      return (
        <div key={inputName} className="space-y-2">
          <label className={`text-sm font-medium flex items-center gap-1 ${themeClasses.text.primary}`}>
            {inputName}
            {isRequired && <span className="text-red-500">*</span>}
          </label>
          <div className="space-y-2">
            {arrayValue.map((item: unknown, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={String(item)}
                  onChange={(e) => updateArrayItem(index, e.target.value)}
                  placeholder={`Enter ${inputName} item ${index + 1}`}
                  className={`flex-1 ${themeClasses.input}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeArrayItem(index)}
                  className={`px-2 ${themeClasses.button}`}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addArrayItem}
              className={`w-full ${themeClasses.button}`}
            >
              + Add {inputName} item
            </Button>
          </div>
          {inputProp.description && (
            <p className={`text-xs ${themeClasses.text.secondary}`}>
              {inputProp.description}
            </p>
          )}
        </div>
      )
    }

    if (inputProp.enum) {
      return (
        <div key={inputName} className="space-y-2">
          <label className={`text-sm font-medium flex items-center gap-1 ${themeClasses.text.primary}`}>
            {inputName}
            {isRequired && <span className="text-red-500">*</span>}
          </label>
          <select
            className={`w-full px-3 py-2 rounded-md border text-sm ${isDark
                ? "bg-gray-700 border-gray-600 text-white"
                : "bg-white border-gray-300 text-gray-900"
              }`}
            value={String(currentValue)}
            onChange={(e) => updateToolInput(inputName, e.target.value)}
          >
            <option value="">Select {inputName}</option>
            {inputProp.enum.map(option => (
              <option key={String(option)} value={String(option)}>{String(option)}</option>
            ))}
          </select>
          {inputProp.description && (
            <p className={`text-xs ${themeClasses.text.secondary}`}>
              {inputProp.description}
            </p>
          )}
        </div>
      )
    }

    if (inputProp.type === 'number' || inputProp.type === 'integer') {
      return (
        <div key={inputName} className="space-y-2">
          <label className={`text-sm font-medium flex items-center gap-1 ${themeClasses.text.primary}`}>
            {inputName}
            {isRequired && <span className="text-red-500">*</span>}
          </label>
          <Input
            type="number"
            value={String(currentValue)}
            onChange={(e) => updateToolInput(inputName, parseFloat(e.target.value) || '')}
            placeholder={`Enter ${inputName}`}
            min={inputProp.minimum}
            max={inputProp.maximum}
            className={themeClasses.input}
          />
          {inputProp.description && (
            <p className={`text-xs ${themeClasses.text.secondary}`}>
              {inputProp.description}
            </p>
          )}
        </div>
      )
    }

    if (inputProp.type === 'boolean') {
      return (
        <div key={inputName} className="space-y-2">
          <label className={`flex items-center gap-2 text-sm font-medium ${themeClasses.text.primary}`}>
            <input
              type="checkbox"
              checked={currentValue === true}
              onChange={(e) => updateToolInput(inputName, e.target.checked)}
              className="rounded"
            />
            {inputName}
            {isRequired && <span className="text-red-500">*</span>}
          </label>
          {inputProp.description && (
            <p className={`text-xs ml-6 ${themeClasses.text.secondary}`}>
              {inputProp.description}
            </p>
          )}
        </div>
      )
    }

    // Default to text input
    const isLongText = inputProp.description && inputProp.description.length > 100

    return (
      <div key={inputName} className="space-y-2">
        <label className={`text-sm font-medium flex items-center gap-1 ${themeClasses.text.primary}`}>
          {inputName}
          {isRequired && <span className="text-red-500">*</span>}
        </label>
        {isLongText ? (
          <Textarea
            value={String(currentValue)}
            onChange={(e) => updateToolInput(inputName, e.target.value)}
            placeholder={`Enter ${inputName}`}
            rows={3}
            className={themeClasses.input}
          />
        ) : (
          <Input
            type="text"
            value={String(currentValue)}
            onChange={(e) => updateToolInput(inputName, e.target.value)}
            placeholder={`Enter ${inputName}`}
            className={themeClasses.input}
          />
        )}
        {inputProp.description && (
          <p className={`text-xs ${themeClasses.text.secondary}`}>
            {inputProp.description}
          </p>
        )}
      </div>
    )
  }

  // =============================================================================
  // CONTENT RENDERING
  // =============================================================================

  const renderPricingSection = () => {
    const activePricing = getActivePricing()
    
    if (!stableTool?.isMonetized || !activePricing.length) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-green-600" />
            <h4 className="font-medium">Pricing</h4>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 ml-6">
            This tool is free to use
          </div>
        </div>
      )
    }

    const selectedPricing = activePricing[selectedPricingTier] || activePricing[0]
    const amount = parseFloat(selectedPricing?.maxAmountRequiredRaw || '0') / Math.pow(10, selectedPricing?.tokenDecimals || 0)
    const hasMultipleTiers = activePricing.length > 1

    console.log("selectedPricing", selectedPricing)

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4" />
          <h4 className="font-medium">Pricing</h4>
        </div>
        <div className="ml-6">
          <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{formatCurrency(amount, selectedPricing?.assetAddress || '', selectedPricing?.network || '')}</span>
              <span className="text-gray-600 dark:text-gray-400 text-sm">on {selectedPricing?.network}</span>
            </div>
            
            {hasMultipleTiers && (
              <Popover open={pricingPopoverOpen} onOpenChange={setPricingPopoverOpen}>
                                  <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    {activePricing.length} Options
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-4">
                    <h5 className="text-sm font-medium mb-3">Select Pricing Tier</h5>
                    <div className="space-y-2">
                      {activePricing.map((pricing, index) => {
                        const tierAmount = parseFloat(pricing.maxAmountRequiredRaw) / Math.pow(10, pricing.tokenDecimals)
                        return (
                          <div
                            key={pricing.id}
                            onClick={() => {
                              setSelectedPricingTier(index)
                              setPricingPopoverOpen(false)
                            }}
                            className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                              selectedPricingTier === index
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' 
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                                                 <div className="flex items-center gap-2">
                                   <span className="font-medium text-sm">
                                     {formatCurrency(tierAmount, pricing.assetAddress, pricing.network)}
                                   </span>
                                   <span className="text-xs text-gray-500">on {pricing.network}</span>
                                 </div>
                              </div>
                              {selectedPricingTier === index && (
                                <CheckCircle className="w-4 h-4 text-blue-500" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderWalletSection = () => {
    if (!hasAccountWallets) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            <h4 className="font-medium">Payment Wallet</h4>
          </div>
          <div className={`ml-6 p-3 rounded-lg border ${themeClasses.background.warning}`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">Connect a wallet to execute this tool</p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          <h4 className="font-medium">Payment Wallet</h4>
        </div>
        <div className="ml-6">
          <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {activeWallet?.provider || 'Wallet'} ({formatWalletAddress(walletAddress || '')})
              </span>
              {needsBrowserConnection && (
                <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400" title="Connection required">
                  <AlertCircle className="h-3 w-3" />
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {needsBrowserConnection && (
                <ConnectButton />
              )}
              {userWallets.length > 1 && (
                <Popover open={walletPopoverOpen} onOpenChange={setWalletPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      Change
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-4">
                      <h5 className="text-sm font-medium mb-3">Select Payment Wallet</h5>
                      <div className="space-y-2">
                        {[...userWallets]
                          .sort((a, b) => {
                            if (a.isPrimary && !b.isPrimary) return -1
                            if (!a.isPrimary && b.isPrimary) return 1
                            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                          })
                          .map((wallet) => (
                            <div
                              key={wallet.id}
                              onClick={() => {
                                setSelectedWallet(wallet)
                                setWalletPopoverOpen(false)
                              }}
                              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                                selectedWallet?.id === wallet.id
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' 
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm">
                                    {formatWalletAddress(wallet.walletAddress)}
                                  </span>
                                  {wallet.provider && (
                                    <Badge variant="outline" className="text-xs">{wallet.provider}</Badge>
                                  )}
                                </div>
                                {selectedWallet?.id === wallet.id && (
                                  <CheckCircle className="w-4 h-4 text-blue-500" />
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          {needsBrowserConnection && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 ml-3">
              Browser wallet connection required
            </p>
          )}
        </div>
      </div>
    )
  }

  const renderPaymentPreview = () => {
    const activePricing = getActivePricing()
    if (!stableTool?.isMonetized || !activePricing.length || !isConnected) return null
    
    const selectedPricing = activePricing[selectedPricingTier] || activePricing[0]
    const amount = parseFloat(selectedPricing.maxAmountRequiredRaw) / Math.pow(10, selectedPricing.tokenDecimals)

    return (
      <div className="text-center text-sm text-gray-600 dark:text-gray-400 py-2">
        You&apos;ll be charged <span className="font-medium">{formatCurrency(amount, selectedPricing.assetAddress, selectedPricing.network)}</span> via{" "}
        <span className="font-medium">{activeWallet?.provider || 'your wallet'}</span>
      </div>
    )
  }



  const getStatusIndicator = () => {
    if (!hasAccountWallets) {
      return { icon: AlertCircle, text: "Wallet Required", variant: "warning" as const }
    }
    
    if (needsBrowserConnection) {
      return { icon: AlertCircle, text: "Connection Required", variant: "warning" as const }
    }
    
    if (!isInitialized && execution.status !== 'error') {
      return { icon: Loader2, text: "Initializing...", variant: "info" as const, animate: true }
    }
    
    if (execution.status === 'error') {
      return { icon: AlertCircle, text: "Error", variant: "error" as const }
    }
    
    if (stableTool?.isMonetized && !isOnCorrectNetwork() && activeWallet?.walletType !== 'managed') {
      return { icon: RefreshCw, text: "Network Switch Required", variant: "warning" as const }
    }
    
    if (isSwitchingNetwork) {
      return { icon: Loader2, text: "Switching Network...", variant: "info" as const, animate: true }
    }
    
    if (execution.status === 'executing') {
      return { icon: Loader2, text: "Executing...", variant: "info" as const, animate: true }
    }
    
    if (execution.status === 'initializing') {
      return { icon: Loader2, text: "Initializing...", variant: "info" as const, animate: true }
    }
    
    if (isInitialized && mcpToolsCollection[stableTool?.name || ''] && isConnected) {
      return { icon: CheckCircle, text: "Ready to Execute", variant: "success" as const }
    }
    
    return { icon: AlertCircle, text: "Not Ready", variant: "warning" as const }
  }

  const renderStatusChip = () => {
    const status = getStatusIndicator()
    const Icon = status.icon
    
    const variantClasses = {
      success: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20",
      warning: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20", 
      error: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
      info: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
    }
    
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${variantClasses[status.variant]}`}>
        <Icon className={`h-3 w-3 ${status.animate ? 'animate-spin' : ''}`} />
        {status.text}
      </div>
    )
  }

  const resetTool = () => {
    // Reset form inputs to defaults
    const inputs: Record<string, unknown> = {}
    const properties = getToolProperties(stableTool!)

    Object.entries(properties).forEach(([key, prop]) => {
      if (prop.type === 'array') {
        inputs[key] = prop.default || []
      } else {
        inputs[key] = prop.default || ''
      }
    })

    setToolInputs(inputs)
    setExecution({ status: 'idle' })
    toast.success("Form reset")
  }

  const renderErrorWithRetry = () => {
    if (execution.status !== 'error' || !execution.error) return null
    
    return (
      <div className={`p-3 rounded-lg border ${themeClasses.background.error}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Error</p>
              <p className="text-xs mt-1">{execution.error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setExecution({ status: 'idle' })
              if (stableTool?.isMonetized && !isOnCorrectNetwork() && activeWallet?.walletType !== 'managed') {
                handleNetworkSwitch()
              } else {
                executeTool()
              }
            }}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const renderNetworkSwitchPrompt = () => {
    const activePricing = getActivePricing()
    if (!stableTool?.isMonetized || !activePricing.length || !isConnected || isOnCorrectNetwork()) {
      return null
    }

    // Managed wallets don't need network switching - handled server-side
    if (activeWallet?.walletType === 'managed') {
      return null
    }

    return (
      <div className={`p-3 rounded-lg border ${themeClasses.background.warning}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <div>
              <p className="text-sm font-medium">Network Switch Required</p>
              <p className="text-xs">Switch to {getRequiredNetwork()} to execute this tool</p>
            </div>
          </div>
          <Button
            onClick={handleNetworkSwitch}
            disabled={isSwitchingNetwork}
            size="sm"
            variant="outline"
          >
            {isSwitchingNetwork ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Switching...
              </>
            ) : (
              `Switch Network`
            )}
          </Button>
        </div>
      </div>
    )
  }

  const renderExecutionResult = () => {
    if (execution.status === 'success' && execution.result) {
      const formatResult = () => {
        if (execution.result === undefined) return 'No result'
        if (typeof execution.result === 'string') {
          // Try to parse and reformat if it's JSON string
          try {
            const parsed = JSON.parse(execution.result)
            return showPrettyJson ? JSON.stringify(parsed, null, 2) : execution.result
          } catch {
            return execution.result
          }
        }
        try {
          return showPrettyJson ? JSON.stringify(execution.result, null, 2) : JSON.stringify(execution.result)
        } catch {
          return String(execution.result)
        }
      }

      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <h4 className="text-sm font-medium">Result (JSON)</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPrettyJson(!showPrettyJson)}
                className="text-xs h-6 px-2"
              >
                {showPrettyJson ? 'Raw' : 'Pretty'}
              </Button>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyResult(execution.result, 'json')}
                className="text-xs h-7 px-2"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadResult(execution.result)}
                className="text-xs h-7 px-2"
              >
                Download
              </Button>
            </div>
          </div>
          <div className={`rounded-md border max-h-60 overflow-hidden ${themeClasses.background.code}`}>
            <pre className={`text-xs p-3 max-h-60 overflow-auto whitespace-pre-wrap ${themeClasses.text.primary}`}>
              {formatResult()}
            </pre>
          </div>
          
          {/* Transaction Info & New Query */}
          <div className="space-y-3 pt-2">
            {execution.transactionId && (
              <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                Transaction ID: <span className="font-mono">{execution.transactionId}</span>
              </div>
            )}
            
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={resetTool}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                New Query
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  const renderContent = () => {
    if (!stableTool) return null

    const properties = getToolProperties(stableTool)
    const hasInputs = hasToolInputs(stableTool)
    const status = getStatusIndicator()

    return (
      <div className="space-y-4">


        {/* Pricing Section */}
        {renderPricingSection()}

        {/* Payment Wallet Section */}
        {renderWalletSection()}

        {/* Network Switch Prompt */}
        {renderNetworkSwitchPrompt()}

        {/* Parameters Section */}
        {hasInputs && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <h4 className="font-medium">Parameters</h4>
            </div>
            <div className="ml-6 grid grid-cols-1 gap-4">
              {Object.entries(properties).map(([inputName, inputProp]) =>
                renderInputField(inputName, inputProp)
              )}
            </div>
          </div>
        )}

        {/* Error with Retry */}
        {renderErrorWithRetry()}

                {/* Payment Preview */}
        {renderPaymentPreview()}

        {/* Execute Button */}
        <div className="flex justify-center">
          <Button
            onClick={executeTool}
            disabled={
              !isConnected ||
              !isInitialized ||
              !mcpToolsCollection[stableTool.name] ||
              execution.status === 'executing' ||
              execution.status === 'initializing' ||
              (stableTool.isMonetized && !isOnCorrectNetwork() && activeWallet?.walletType !== 'managed') ||
              isSwitchingNetwork ||
              needsBrowserConnection
            }
            size="lg"
            className={`px-8 ${isDark ? "bg-blue-600 hover:bg-blue-700" : ""}`}
          >
            {execution.status === 'executing' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute Tool
              </>
            )}
          </Button>
        </div>

        {/* Execution Result */}
        {renderExecutionResult()}
      </div>
    )
  }

  // =============================================================================
  // MODAL RENDERING
  // =============================================================================

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className={`max-h-[85vh] ${themeClasses.modal}`}>
                  <DrawerHeader>
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {stableTool?.name || 'Run Tool'}
            </DrawerTitle>
            {stableTool && renderStatusChip()}
          </div>
          <DrawerDescription>
            {stableTool 
              ? (isInitialized && (mcpToolsCollection[stableTool.name] as MCPToolFromClient)?.description) || stableTool.description
              : 'Configure and execute'
            }
          </DrawerDescription>
        </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            {renderContent()}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-2xl max-h-[85vh] overflow-hidden flex flex-col ${themeClasses.modal}`}>
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {stableTool?.name || 'Run Tool'}
            </DialogTitle>
            {stableTool && renderStatusChip()}
          </div>
          <DialogDescription>
            {stableTool 
              ? (isInitialized && (mcpToolsCollection[stableTool.name] as MCPToolFromClient)?.description) || stableTool.description
              : 'Configure and execute'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
} 