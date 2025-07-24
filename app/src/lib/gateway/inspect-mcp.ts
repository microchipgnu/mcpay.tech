import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { experimental_createMCPClient as createMCPClient } from "ai"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { PricingEntry } from "@/types/payments"
import { toBaseUnits, AmountConversionError } from "@/lib/commons"
import { STABLECOIN_CONFIGS, getNetworkTokens, type UnifiedNetwork } from "@/lib/commons/networks"
import { PaymentConfig } from "mcpay/handler"
import { nanoid } from "nanoid"

// Payment annotation type definitions
interface SimplePaymentOption {
  type?: 'simple'
  price: number
  currency?: string
  network?: string
  recipient?: string
}

interface AdvancedPaymentOption {
  type?: 'advanced'
  rawAmount: string | number
  tokenDecimals?: number
  tokenSymbol?: string
  currency?: string
  network?: string
  recipient?: string
  description?: string
}

interface LegacyPaymentOption {
  asset?: string
  network?: string
  maxAmountRequired?: string | number
  payTo?: string
  recipient?: string
  resource?: string
  description?: string
}

export async function getMcpTools(url: string) {
  try {
    const transport = new StreamableHTTPClientTransport(new URL(url))

    const client = await createMCPClient({
      transport,
    })

    const tools = await client.tools()

    if (!tools) {
      throw new Error("No tools found")
    }

    const toolsNames = Object.keys(tools)

    return toolsNames.map((toolName) => ({
      name: toolName,
      description: tools[toolName]?.description,
      inputSchema: tools[toolName]?.inputSchema,
    }))
  } catch (error) {
    console.error("Error fetching MCP tools:", error)
    throw new Error("Failed to fetch tools from MCP server")
  }
}

/**
 * Enhanced version that extracts payment information from tool annotations
 */
export async function getMcpToolsWithPayments(url: string, userWalletAddress: string) {
  try {
    const transport = new StreamableHTTPClientTransport(new URL(url))
    const client = new Client({ name: "mcpay-inspect", version: "1.0.0" })

    await client.connect(transport)
    const toolsResult = await client.listTools()

    return toolsResult.tools.map((tool) => {
      // Extract payment information from annotations
      const pricingInfo = extractPaymentFromAnnotations(tool.annotations, userWalletAddress)

      return {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        pricing: pricingInfo
      }
    })
  } catch (error) {
    console.error("Error fetching MCP tools with payments:", error)
    throw new Error("Failed to fetch tools from MCP server")
  }
}

/**
 * Extracts payment information from tool annotations using proper amount conversion
 */
export function extractPaymentFromAnnotations(annotations: unknown, userWalletAddress: string): PricingEntry[] | undefined {
  // Type guard to check if annotations has the expected structure
  if (!annotations || typeof annotations !== 'object') return undefined

  const annotationsObj = annotations as Record<string, unknown>
  if (!annotationsObj.payment) return undefined

  const payment = annotationsObj.payment as PaymentConfig | PaymentConfig[]
  console.log('Extracting payment from annotations:', payment)

  // Handle array of payment options (take the first one)
  const paymentOption = Array.isArray(payment) ? payment[0] : payment

  if (!paymentOption || typeof paymentOption !== 'object') return undefined

  try {
    // Handle simple payment format (USD price that needs conversion)
    if (isSimplePaymentOption(paymentOption)) {
      const price = paymentOption.price
      const currency = paymentOption.currency || 'USD'
      const network = (paymentOption.network || 'base-sepolia') as UnifiedNetwork

      // For USD prices, convert to USDC base units
      if (currency === 'USD' || currency === 'usd') {
        const targetToken = resolveTokenForCurrency('USDC', network)
        if (!targetToken) {
          console.warn(`USDC not available on network ${network}, falling back to base-sepolia`)
          const fallbackToken = resolveTokenForCurrency('USDC', 'base-sepolia')
          if (!fallbackToken) {
            throw new Error('USDC not available on fallback network')
          }

          return [{
            id: nanoid(),
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            assetAddress: fallbackToken.address || getDefaultUSDCAddress(network),
            network,
            maxAmountRequiredRaw: toBaseUnits(String(price || 0), fallbackToken.decimals),
            tokenDecimals: fallbackToken.decimals,
          }]
        }

        return [{
          id: nanoid(),
          assetAddress: targetToken.address || getDefaultUSDCAddress(network),
          network,
          maxAmountRequiredRaw: toBaseUnits(String(price || 0), targetToken.decimals),
          tokenDecimals: targetToken.decimals,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      }

      // For other currencies, try to resolve the token
      const token = resolveTokenForCurrency(currency, network)
      if (!token) {
        console.warn(`Token ${currency} not found on network ${network}`)
        return undefined
      }

      return [{
        assetAddress: token.address || getDefaultTokenAddress(currency, network),
        maxAmountRequiredRaw: toBaseUnits(String(price || 0), token.decimals),
        tokenDecimals: token.decimals,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        id: nanoid(),
        network,
      }]
    }

    // Handle advanced payment format (rawAmount already in base units)
    if (isAdvancedPaymentOption(paymentOption)) {
      const tokenSymbol = paymentOption.tokenSymbol || paymentOption.currency || 'USDC'
      const network = (paymentOption.network || 'base-sepolia') as UnifiedNetwork
      const rawAmount = String(paymentOption.rawAmount || 0)
      const recipient = paymentOption.recipient || userWalletAddress

      // Validate the rawAmount is a valid base unit amount
      if (!/^\d+$/.test(rawAmount)) {
        throw new AmountConversionError(`Invalid rawAmount format: ${rawAmount}`)
      }

      const token = resolveTokenForCurrency(tokenSymbol, network)
      if (!token) {
        console.warn(`Token ${tokenSymbol} not found on network ${network}`)
        return undefined
      }

      return [{
        assetAddress: token.address || getDefaultTokenAddress(tokenSymbol, network),
        maxAmountRequiredRaw: rawAmount,
        tokenDecimals: token.decimals,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        id: nanoid(),
        network,
      }]
    }

  } catch (error) {
    console.error('Error extracting payment from annotations:', error)
    if (error instanceof AmountConversionError) {
      console.error('Amount conversion error:', error.message)
    }
    return undefined
  }

  console.log('Could not extract payment info from:', paymentOption)
  return undefined
}

// Type guard functions
function isSimplePaymentOption(option: unknown): option is SimplePaymentOption {
  return typeof option === 'object' && option !== null && 'price' in option && typeof (option as Record<string, unknown>).price === 'number'
}

function isAdvancedPaymentOption(option: unknown): option is AdvancedPaymentOption {
  return typeof option === 'object' && option !== null && 'rawAmount' in option && (option as Record<string, unknown>).rawAmount !== undefined
}

function isLegacyPaymentOption(option: unknown): option is LegacyPaymentOption {
  if (typeof option !== 'object' || option === null) return false
  const obj = option as Record<string, unknown>
  return ('asset' in obj || 'maxAmountRequired' in obj) && !('price' in obj) && !('rawAmount' in obj)
}

/**
 * Helper function to resolve token information for a currency symbol on a specific network
 */
function resolveTokenForCurrency(currencySymbol: string, network: UnifiedNetwork) {
  // First, check stablecoin configs for known decimals
  const upperSymbol = currencySymbol.toUpperCase()
  if (upperSymbol in STABLECOIN_CONFIGS) {
    const stablecoinConfig = STABLECOIN_CONFIGS[upperSymbol as keyof typeof STABLECOIN_CONFIGS]

    // Get the actual token from the network
    const tokens = getNetworkTokens(network)
    const token = tokens.find(t => t.symbol === upperSymbol && t.isStablecoin)

    if (token) {
      return token
    }

    // Fallback to stablecoin config if not found in network
    return {
      symbol: stablecoinConfig.symbol,
      name: stablecoinConfig.name,
      decimals: stablecoinConfig.decimals,
      isStablecoin: true,
      verified: true
    }
  }

  // For non-stablecoins, look in network token registry
  const tokens = getNetworkTokens(network)
  return tokens.find(t => t.symbol === upperSymbol)
}

/**
 * Helper function to get default token addresses when token lookup fails
 */
function getDefaultTokenAddress(tokenSymbol: string, network: UnifiedNetwork): string {
  // Known token addresses for common networks
  const tokenAddresses: Record<string, Record<string, string>> = {
    'base-sepolia': {
      'USDC': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      'ETH': '0x0000000000000000000000000000000000000000',
    },
    'base': {
      'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      'ETH': '0x0000000000000000000000000000000000000000',
    },
    'sei-testnet': {
      'USDC': '0x4fCF1784B31630811181f670Aea7A7bEF803eaED',
      'SEI': '0x0000000000000000000000000000000000000000',
    }
  }

  return tokenAddresses[network]?.[tokenSymbol.toUpperCase()] || '0x0000000000000000000000000000000000000000'
}

/**
 * Helper function to get default USDC address for a network
 */
function getDefaultUSDCAddress(network: UnifiedNetwork): string {
  return getDefaultTokenAddress('USDC', network)
}

/**
 * Validates that a payment info object has required fields
 */
export function validatePaymentInfo(payment: PricingEntry): boolean {
  return !!(
    payment.assetAddress &&
    payment.network &&
    payment.maxAmountRequiredRaw &&
    !isNaN(parseFloat(payment.maxAmountRequiredRaw))
  )
}