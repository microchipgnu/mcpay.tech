import { z } from 'zod';

// Helper to parse boolean-like env vars from strings
const booleanFromEnv = z.preprocess((val) => {
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    if (['false', '0', 'no', 'off'].includes(v)) return false;
    if (['true', '1', 'yes', 'on'].includes(v)) return true;
  }
  return val;
}, z.boolean());

// Define the schema for environment variables
const envSchema = z.object({
  // Node.js environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.url('DATABASE_URL must be a valid URL'),

  // Authentication
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),  
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),
  // Auth feature flags
  AUTH_CREATE_CDP_ON_SIGNUP: booleanFromEnv.default(true),

  // Facilitator Configuration
  FACILITATOR_EVM_PRIVATE_KEY: z.string().optional(),
  FACILITATOR_URL: z.url().default('https://x402.org/facilitator'),
  BASE_SEPOLIA_FACILITATOR_URL: z.url().default('https://x402.org/facilitator'),
  SEI_TESTNET_FACILITATOR_URL: z.url().default('https://6y3cdqj5s3.execute-api.us-west-2.amazonaws.com/prod'),

  // CDP Configuration
  CDP_API_KEY: z.string().min(1, 'CDP_API_KEY is required'),
  CDP_API_SECRET: z.string().min(1, 'CDP_API_SECRET is required'),
  CDP_WALLET_SECRET: z.string().min(1, 'CDP_WALLET_SECRET is required'),

  // Vercel KV Configuration
  KV_REST_API_URL: z.url('KV_REST_API_URL must be a valid URL'),
  KV_REST_API_TOKEN: z.string().min(1, 'KV_REST_API_TOKEN is required'),

  // Payment strategy configuration
  PAYMENT_STRATEGY_ENABLED: z.boolean().default(true),
  PAYMENT_STRATEGY_FALLBACK: z.enum(['fail', 'continue', 'log_only']).default('fail'),
  PAYMENT_STRATEGY_MAX_RETRIES: z.number().min(1).max(10).default(3),
  PAYMENT_STRATEGY_TIMEOUT_MS: z.number().min(1000).max(120000).default(30000),
  CDP_STRATEGY_ENABLED: z.boolean().default(true),
  PRIVY_STRATEGY_ENABLED: z.boolean().default(true),
  CDP_PREFER_SMART_ACCOUNTS: z.boolean().default(true),
  CDP_STRATEGY_PRIORITY: z.number().min(0).max(1000).default(100),
  PAYMENT_STRATEGY_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PAYMENT_STRATEGY_LOG_AUTH_DETAILS: z.boolean().default(false),

  // Port configuration
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
});

// Parse and validate environment variables
function parseEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .filter((err) => err.code === 'invalid_type')
        .map((err) => err.path.join('.'));
      
      const invalidVars = error.issues
        .filter((err) => err.code !== 'invalid_type')
        .map((err) => `${err.path.join('.')}: ${err.message}`);

      console.error('❌ Environment validation failed:');
      
      if (missingVars.length > 0) {
        console.error('Missing required variables:', missingVars.join(', '));
      }
      
      if (invalidVars.length > 0) {
        console.error('Invalid variables:', invalidVars.join(', '));
      }
      
      process.exit(1);
    }
    throw error;
  }
}

// Export the validated environment variables
export const env = parseEnv();

// Type for the environment object
export type Env = typeof env;

// Helper functions for specific use cases
export const isDevelopment = () => env.NODE_ENV === 'development';
export const isProduction = () => env.NODE_ENV === 'production';
export const isTest = () => env.NODE_ENV === 'test';

// Helper for getting facilitator URLs by network
export const getFacilitatorUrl = (network?: string): string => {
  switch (network) {
    case 'base-sepolia':
      return env.BASE_SEPOLIA_FACILITATOR_URL;
    case 'sei-testnet':
      return env.SEI_TESTNET_FACILITATOR_URL;
    default:
      return env.FACILITATOR_URL;
  }
};

// Helper for better-auth secret
export const getBetterAuthSecret = (): string => env.BETTER_AUTH_SECRET;

// Helper for database connection
export const getDatabaseUrl = (): string => env.DATABASE_URL;

// Helper for GitHub OAuth config
export const getGitHubConfig = () => ({
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
});

// Helper for CDP configuration
export const getCDPConfig = () => ({
  apiKey: env.CDP_API_KEY,
  apiSecret: env.CDP_API_SECRET,
  walletSecret: env.CDP_WALLET_SECRET,
});

// Helper for KV configuration
export const getKVConfig = () => ({
  restApiUrl: env.KV_REST_API_URL,
  restApiToken: env.KV_REST_API_TOKEN,
});

// Helper for auth feature flags
export const shouldCreateCDPOnSignUp = (): boolean => env.AUTH_CREATE_CDP_ON_SIGNUP;

// Helper for facilitator private key (with validation)
export const getFacilitatorPrivateKey = (): string => {
  if (!env.FACILITATOR_EVM_PRIVATE_KEY) {
    throw new Error('FACILITATOR_EVM_PRIVATE_KEY is required but not set');
  }
  return env.FACILITATOR_EVM_PRIVATE_KEY;
};

// Optional: Runtime environment validation (call this at app startup)
export const validateEnvironment = () => {
  console.log('✅ Environment variables validated successfully');
  
  if (isDevelopment()) {
    console.log('🔧 Running in development mode');
    console.log(`📊 Database: ${env.DATABASE_URL.split('@')[1] || 'local'}`);
  }
};

// Export default as the env object for convenience
export default env;
