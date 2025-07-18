/**
 * Central Types Index
 * 
 * This file re-exports all type definitions from the modular type system,
 * providing a single import point for all types used throughout MCPay.tech.
 * 
 * Usage:
 * import { User, PaymentInfo, MCPServer, TokenInfo } from '@/types';
 * 
 * Or import specific modules:
 * import type { AuthUser } from '@/types/auth';
 * import type { StablecoinBalance } from '@/types/blockchain';
 */

// =============================================================================
// AUTHENTICATION TYPES
// =============================================================================

export type {
  // Core auth types
  AuthStatus,
  AuthMethod,
  
  // Database-inferred types
  User,
  UserInsert,
  UserWallet,
  UserWalletInsert,
  
  // Enhanced user types
  AuthUser,
  UserWithWallet,
  EnhancedUser,
  
  // Registration types
  WalletRegistrationInfo,
  
  // Integration types
  AuthType,
  CDPWalletMetadata,
  
  // Session types
  AuthDetectionResult,
  ApiKeyAuth,
  AuthType,
} from './auth';

// =============================================================================
// BLOCKCHAIN & NETWORK TYPES
// =============================================================================

export type {
  // Core blockchain types
  Network,
  BlockchainArchitecture,
  TokenCategory,
  StablecoinSymbol,
  BlockchainAddress,
  
  // Token types
  TokenInfo,
  NetworkInfo,
  
  // Amount and formatting types
  FormatAmountOptions,
  DbAmountRecord,
  RevenueByCurrency,
  
  // Stablecoin types
  StablecoinConfig,
  StablecoinBalance,
  StablecoinBalanceError,
  MultiChainStablecoinResult,
  StablecoinClient,
  
  // Chain configuration types
  BaseChainConfig,
  EVMTokenConfig,
  SolanaTokenConfig,
  NearTokenConfig,
  EVMChainConfig,
  SolanaChainConfig,
  NearChainConfig,
  ChainConfig,
  
  // Price provider types
  PriceProvider,
  
  // UI balance types
  ChainBalance,
  BalancesByChain,
  
  // Wallet provider types
  EthereumProvider,
  WalletWindow,
  WalletError,
  
  // Legacy support
  SupportedChain,
} from './blockchain';

// Export constants
export { COMMON_DECIMALS } from './blockchain';

// =============================================================================
// MCP (MODEL CONTEXT PROTOCOL) TYPES
// =============================================================================

export type {
  // Database-inferred types
  McpServer,
  McpServerInsert,
  McpTool,
  McpToolInsert,
  
  // Core MCP server types
  MCPServer,
  EnhancedServerRegistration,
  
  // MCP tool types
  MCPTool,
  MCPToolInputSchema,
  MCPInputPropertySchema,
  MCPToolFromClient,
  
  // Tool execution types
  ExecutionStatus,
  ToolExecution,
  
  // Tool schema types
  InputProperty,
  ToolInputSchema,
  Tool,
  
  // Tool execution modal types
  ToolExecutionModalProps,
  MCPClient,
  MCPToolsCollection,
  
  // Tool call types
  ToolCall,
  PaymentToolCall,
  MCPRouteToolCall,
  
  // Analytics types
  AnalyticsData,
  
  // Search and filtering types
  SearchState,
  
  // Server data types
  ServerData,
  ServerTool,
  ConvertedTool,
  
  // API types
  APIServer,
  APITool,
  
  // Database result types
  DbToolResult,
  
  // Tool configuration types
  McpToolConfig,
  
  // Registration types
  RegistrationMetadata,
  RegistrationData,
  
  // Execution headers types
  ExecutionHeaders,
  StoredExecutionHeaders,
  
  // Legacy compatibility types
  McpServerList,
  McpServerWithRelations,
  McpServerWithActivity,
  
  // Payment info (forward declaration)
  PaymentInfo,
} from './mcp';

// =============================================================================
// PAYMENT & TRANSACTION TYPES
// =============================================================================

export type {
  // Database-inferred types
  Payment,
  PaymentInsert,
  ToolPricing,
  ToolPricingInsert,
  
  // Signer wallet types
  SignerWallet,
  
  // Network configuration types
  SupportedNetwork,
  
  // Payment payload types
  ExactEvmPayloadAuthorization,
  ExactEvmPayload,
  PaymentPayload,
  UnsignedPaymentPayload,
  
  // Payment requirements types
  ExtendedPaymentRequirements,
  SupportedPaymentRequirements,
  
  // Payment response types
  VerifyResponse,
  SettleResponse,
  
  // Payment info types
  PaymentInfo,
  ToolPaymentInfo,
  MCPToolPaymentInfo,
  
  // Payment strategy types
  PaymentStrategyConfig,
  PaymentSigningContext,
  PaymentSigningResult,
  PaymentSigningStrategy,
  
  // CDP payment types
  CDPNetwork,
  CDPNetworkSmartAccount,
  CDPAccountInfo,
  CreateCDPWalletOptions,
  CDPWalletResult,
  CDPWallet,
  
  // Onramp integration types
  OnrampAddress,
  OnrampSessionTokenRequest,
  OnrampSessionTokenResponse,
  OnrampUrlOptions,
  
  // Verification and proof types
  ToolMetadata,
  ExecutionContext,
  WebProofRequest,
  WebProofResponse,
  VerificationResult,
  
  // Utility types
  PaymentRequirementsSelector,
  CreateHeaders,
  TransactionType,
  
  // Serialization types
  SerializeBigInts,
  
  // Database types
  RevenueDetail,
  RevenueDetails,
  
  // Legacy gateway types
  ChainConfig,
} from './payments';

// Export constants and schemas
export {
  NetworkSchema,
  SupportedEVMNetworks,
  EvmNetworkToChainId,
  ChainIdToNetwork,
  schemes,
  ExactEvmPayloadAuthorizationSchema,
  ExactEvmPayloadSchema,
  PaymentPayloadSchema,
  ExtendedPaymentRequirementsSchema,
  VerifyResponseSchema,
  SettleResponseSchema,
} from './payments';

// =============================================================================
// UI & CLIENT TYPES
// =============================================================================

export type {
  // Core client types
  ApiResponse,
  ApiError,
  
  // Modal types
  AccountModalTab,
  UseAccountModalReturn,
  AccountModalProps,
  
  // Form types
  FormFieldContextValue,
  FormItemContextValue,
  
  // Carousel types
  CarouselApi,
  UseCarouselParameters,
  CarouselOptions,
  CarouselPlugin,
  CarouselProps,
  CarouselContextProps,
  
  // Pagination types
  PaginationContentProps,
  PaginationLinkProps,
  
  // Tooltip types
  TooltipProviderProps,
  TooltipProps,
  TooltipTriggerProps,
  TooltipContentProps,
  
  // Chart types
  ChartTooltipProps,
  
  // Environment types
  Env,
  
  // App context types
  AppContext,
  
  // Session types
  AuthSession,
} from './ui';

// =============================================================================
// CONVENIENCE RE-EXPORTS
// =============================================================================

// Re-export commonly used blockchain types for convenience
export type { Network, TokenInfo, NetworkInfo } from './ui';

// =============================================================================
// VERSION INFORMATION
// =============================================================================

/**
 * Type system version for tracking compatibility
 * Update this when making breaking changes to the type system
 */
export const TYPE_SYSTEM_VERSION = '1.0.0' as const;