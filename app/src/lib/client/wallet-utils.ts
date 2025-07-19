import { type Connector } from 'wagmi'
import { type Network, NETWORKS, getNetworkByChainId, type NetworkInfo } from '@/lib/commons'
import type { EthereumProvider, WalletWindow, WalletError } from '@/types'

// Helper function to get wallet window
function getWalletWindow(): WalletWindow {
  if (typeof window === 'undefined') return {}
  return window as unknown as WalletWindow
}

// Check if MetaMask is available in the browser
export function isMetaMaskAvailable(): boolean {
  if (typeof window === 'undefined') return false
  const walletWindow = getWalletWindow()
  return !!walletWindow.ethereum?.isMetaMask
}

// Check if Coinbase Wallet is available in the browser
export function isCoinbaseWalletAvailable(): boolean {
  if (typeof window === 'undefined') return false
  const walletWindow = getWalletWindow()
  return !!walletWindow.ethereum?.isCoinbaseWallet || !!walletWindow.coinbaseWalletExtension
}

// Check if Porto is available in the browser
export function isPortoAvailable(): boolean {
  if (typeof window === 'undefined') return false
  const walletWindow = getWalletWindow()
  return !!walletWindow.ethereum?.isPorto || !!walletWindow.porto
}

// Check if current connector is MetaMask
export function isMetaMaskConnector(connector?: Connector): boolean {
  if (!connector) return false
  return connector.name.toLowerCase().includes('metamask') || connector.id === 'metaMask'
}

// Check if current connector is Coinbase Wallet
export function isCoinbaseWalletConnector(connector?: Connector): boolean {
  if (!connector) return false
  return connector.name.toLowerCase().includes('coinbase') || connector.id === 'coinbaseWallet'
}

// Check if current connector is Porto
export function isPortoConnector(connector?: Connector): boolean {
  if (!connector) return false
  return connector.name.toLowerCase().includes('porto') || connector.id === 'porto'
}

// Verify MetaMask connection status
export function verifyMetaMaskConnection(
  isConnected: boolean, 
  address?: string, 
  connector?: Connector
): {
  isValid: boolean
  error?: string
  warnings: string[]
} {
  const warnings: string[] = []
  
  if (!isConnected) {
    return {
      isValid: false,
      error: 'Wallet not connected',
      warnings
    }
  }

  if (!address) {
    return {
      isValid: false,
      error: 'No wallet address found',
      warnings
    }
  }

  // Check if MetaMask is the preferred connector
  if (connector && !isMetaMaskConnector(connector)) {
    warnings.push(`Connected via ${connector.name} instead of MetaMask`)
  }

  // Check if MetaMask is available but not being used
  if (isMetaMaskAvailable() && connector && !isMetaMaskConnector(connector)) {
    warnings.push('MetaMask is available but not being used')
  }

  return {
    isValid: true,
    warnings
  }
}

// Verify wallet connection status (generic for any wallet)
export function verifyWalletConnection(
  isConnected: boolean, 
  address?: string
): {
  isValid: boolean
  error?: string
  warnings: string[]
} {
  const warnings: string[] = []
  
  if (!isConnected) {
    return {
      isValid: false,
      error: 'Wallet not connected',
      warnings
    }
  }

  if (!address) {
    return {
      isValid: false,
      error: 'No wallet address found',
      warnings
    }
  }

  return {
    isValid: true,
    warnings
  }
}

// Update connection status to support any network
export function getConnectionStatus(
  isConnected: boolean,
  address?: string,
  connector?: Connector,
  chainId?: number,
  preferredNetwork?: Network
): {
  status: 'disconnected' | 'connected' | 'connecting' | 'error'
  details: {
    hasAddress: boolean
    connectorName?: string
    isMetaMask: boolean
    isCoinbaseWallet: boolean
    isPorto: boolean
    chainId?: number
    address?: string
    currentNetwork?: Network
    isOnPreferredNetwork?: boolean
  }
  recommendations: string[]
} {
  const recommendations: string[] = []
  
  if (!isConnected) {
    return {
      status: 'disconnected',
      details: {
        hasAddress: false,
        isMetaMask: false,
        isCoinbaseWallet: false,
        isPorto: false
      },
      recommendations: ['Connect your wallet to continue']
    }
  }

  const isMetaMask = connector ? isMetaMaskConnector(connector) : false
  const isCoinbaseWallet = connector ? isCoinbaseWalletConnector(connector) : false
  const isPorto = connector ? isPortoConnector(connector) : false
  const currentNetwork = chainId ? getNetworkByChainId(chainId) : undefined
  const isOnPreferredNetwork = preferredNetwork ? currentNetwork === preferredNetwork : true
  
  if (!address) {
    recommendations.push('Try reconnecting your wallet')
    return {
      status: 'error',
      details: {
        hasAddress: false,
        connectorName: connector?.name,
        isMetaMask,
        isCoinbaseWallet,
        isPorto,
        chainId,
        currentNetwork,
        isOnPreferredNetwork
      },
      recommendations
    }
  }

  // Add recommendations based on setup
  if (isMetaMaskAvailable() && !isMetaMask && !isCoinbaseWallet && !isPorto) {
    recommendations.push('Consider using MetaMask for better compatibility')
  }
  
  if (isCoinbaseWalletAvailable() && !isMetaMask && !isCoinbaseWallet && !isPorto) {
    recommendations.push('Consider using Coinbase Wallet for enhanced features')
  }

  if (isPortoAvailable() && !isMetaMask && !isCoinbaseWallet && !isPorto) {
    recommendations.push('Consider using Porto for Web3 payments')
  }

  // Network-specific recommendations
  if (preferredNetwork && !isOnPreferredNetwork) {
    const networkInfo = NETWORKS[preferredNetwork]
    recommendations.push(`Switch to ${networkInfo.name} network for full functionality`)
  }

  return {
    status: 'connected',
    details: {
      hasAddress: true,
      connectorName: connector?.name,
      isMetaMask,
      isCoinbaseWallet,
      isPorto,
      chainId,
      address,
      currentNetwork,
      isOnPreferredNetwork
    },
    recommendations
  }
}



// Generic network switching function
export async function switchToNetwork(network: Network): Promise<boolean> {
  const walletWindow = getWalletWindow()
  if (typeof window === 'undefined' || !walletWindow.ethereum) {
    throw new Error('No wallet provider available')
  }

  const networkInfo = NETWORKS[network]
  if (!networkInfo) {
    throw new Error(`Unsupported network: ${network}`)
  }

  const chainIdHex = `0x${networkInfo.chainId.toString(16)}`

  try {
    await walletWindow.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    })
    return true
  } catch (error: unknown) {
    const walletError = error as WalletError
    // Chain doesn't exist, try to add it
    if (walletError.code === 4902) {
      try {
        await walletWindow.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: networkInfo.name,
            nativeCurrency: networkInfo.nativeCurrency,
            rpcUrls: networkInfo.rpcUrls,
            blockExplorerUrls: networkInfo.blockExplorerUrls,
          }],
        })
        return true
      } catch (addError) {
        console.error(`Failed to add ${networkInfo.name} network:`, addError)
        return false
      }
    }
    console.error(`Failed to switch to ${networkInfo.name}:`, walletError)
    return false
  }
}

// Specific network switching functions for convenience
export async function switchToBaseSepolia(): Promise<boolean> {
  return switchToNetwork('base-sepolia')
}

export async function switchToSeiTestnet(): Promise<boolean> {
  return switchToNetwork('sei-testnet')
}

// Get all supported networks for UI display
export function getSupportedNetworks(): NetworkInfo[] {
  return Object.values(NETWORKS)
}

// Check if a chain ID is supported
export function isSupportedChainId(chainId: number): boolean {
  return Object.values(NETWORKS).some(network => network.chainId === chainId)
} 