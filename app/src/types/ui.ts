/**
 * UI & Client Types
 * 
 * Centralized UI component, client utilities, and form type definitions for MCPay.tech
 * Includes React component props, form handling, and client-side utility types.
 */

import React from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import type { Network, TokenInfo, NetworkInfo } from "./blockchain";

// =============================================================================
// CORE CLIENT TYPES
// =============================================================================

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  details?: unknown;
  success?: boolean;
  message?: string;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

// =============================================================================
// MODAL TYPES
// =============================================================================

export type AccountModalTab = 'profile' | 'wallets' | 'settings';

export interface UseAccountModalReturn {
  isOpen: boolean;
  activeTab: AccountModalTab;
  openModal: (tab?: AccountModalTab) => void;
  closeModal: () => void;
  setActiveTab: (tab: AccountModalTab) => void;
}

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// FORM TYPES
// =============================================================================

export type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName;
};

export type FormItemContextValue = {
  id: string;
};

// =============================================================================
// CAROUSEL TYPES
// =============================================================================

export type CarouselApi = any; // UseEmblaCarouselType[1] - will be properly typed when available
export type UseCarouselParameters = any[]; // Parameters<typeof useEmblaCarousel> - will be properly typed
export type CarouselOptions = any; // UseCarouselParameters[0] - will be properly typed
export type CarouselPlugin = any; // UseCarouselParameters[1] - will be properly typed

export type CarouselProps = {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  setApi?: (api: CarouselApi) => void;
};

export type CarouselContextProps = {
  carouselRef: any; // ReturnType<typeof useEmblaCarousel>[0] - will be properly typed
  api: any; // ReturnType<typeof useEmblaCarousel>[1] - will be properly typed
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

// =============================================================================
// PAGINATION TYPES
// =============================================================================

export type PaginationContentProps = {
  size?: 'default' | 'sm' | 'lg';
};

export type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<PaginationContentProps, "size"> &
  React.ComponentProps<any>; // Will be properly typed with Link component

// =============================================================================
// TOOLTIP TYPES
// =============================================================================

export type TooltipProviderProps = React.ComponentProps<any>; // TooltipPrimitive.Provider
export type TooltipProps = React.ComponentProps<any>; // TooltipPrimitive.Root
export type TooltipTriggerProps = React.ComponentProps<any>; // TooltipPrimitive.Trigger
export type TooltipContentProps = React.ComponentProps<any>; // TooltipPrimitive.Content

// =============================================================================
// CHART TYPES
// =============================================================================

export type ChartTooltipProps = React.ComponentProps<any> & { // RechartsPrimitive.Tooltip
  // Extended chart tooltip properties
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  nameKey?: string;
  labelKey?: string;
};

// =============================================================================
// ENVIRONMENT TYPES
// =============================================================================

export type Env = any; // Will be properly typed based on env configuration

// =============================================================================
// LEGACY COMPATIBILITY EXPORTS
// =============================================================================

// Re-export commonly used types from other modules for convenience
export type { Network, TokenInfo, NetworkInfo } from "./blockchain";

// =============================================================================
// APP CONTEXT TYPES
// =============================================================================

export type AppContext = {
  session?: any; // AuthSession - will be properly typed
  user?: any; // AuthUser - will be properly typed
};

// =============================================================================
// SESSION TYPES
// =============================================================================

export type AuthSession = any; // typeof auth.$Infer.Session - will be properly typed when available