/**
 * Blockchain and chain-related types
 */

import type { Address } from "viem";

/** Simple chain configuration with USDC info */
export type ChainConfig = {
    usdcAddress: Address;
    usdcName: string;
};