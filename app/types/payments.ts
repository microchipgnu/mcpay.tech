/**
 * Payment and transaction-related types
 */

/** Legacy payment info with number amounts (used in registration) */
export interface PaymentInfoLegacy {
  maxAmountRequired: number
  asset: string
  network: string
  resource: string
  description: string
}

/** Tool with optional payment info */
export interface Tool {
  name: string
  description: string
  payment?: PaymentInfoLegacy
}

/** Registration metadata */
export interface RegistrationMetadata {
  timestamp: string
  toolsCount: number
  registeredFromUI: boolean
  monetizedToolsCount: number
}

/** Registration data structure */
export interface RegistrationData {
  id: string
  serverId: string
  mcpOrigin: string
  creatorId: string
  // Add other registration data fields as needed
}