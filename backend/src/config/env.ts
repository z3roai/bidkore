import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export type NodeEnvironment = "development" | "production" | "test";

interface DatabaseConfig {
  name: string;
  user: string;
  password: string;
  host: string;
  port: number;
  logging: boolean;
}

interface RedisConfig {
  host: string;
  port: number;
  password?: string | undefined;
  tls?: boolean;
}

interface AuthConfig {
  jwtSecret: string;
  allowPasswordless?: boolean;
}

interface StripeConfig {
  secretKey?: string | undefined;
  webhookSecret?: string | undefined;
}

interface EmailConfig {
  sendgridApiKey?: string | undefined;
  fromEmail: string;
}

interface UrlsConfig {
  frontend: string[];
  backend: string;
}

interface SamGovConfig {
  apiKey?: string | undefined;
}

interface DropboxConfig {
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  redirectUri?: string;
}

interface OpenAIConfig {
  apiKey?: string | undefined;
}

interface MicrosoftConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

interface GoogleConfig {
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  redirectUri?: string;
}

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  server: {
    port: number;
  };
  urls: UrlsConfig;
  db: DatabaseConfig;
  redis: RedisConfig;
  auth: AuthConfig;
  stripe: StripeConfig;
  email: EmailConfig;
  samGov: SamGovConfig;
  dropbox: DropboxConfig;
  openai: OpenAIConfig;
  microsoft: MicrosoftConfig;
  google: GoogleConfig;
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  BACKEND_PORT: z.coerce.number().int().min(1).max(65535).optional(),

  FRONTEND_URL: z.string().optional(),
  FRONTEND_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  BACKEND_URL: z.string().url().optional(),

  // Database
  POSTGRES_DB: z.string().default("bidkore"),
  POSTGRES_USER: z.string().default("admin"),
  POSTGRES_PASSWORD: z.string().default("bidkore123"),
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().default(5432),

  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z
    .string()
    .optional()
    .transform((v) => (v ? v.toLowerCase() === "true" : false)),

  // Auth
  JWT_SECRET: z.string().min(16),
  ALLOW_PASSWORDLESS_LOGIN: z
    .string()
    .optional()
    .transform((v) => (v ? v.toLowerCase() === "true" : true)), // Default to true (allow passkeys)

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Email
  SENDGRID_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().default("noreply@bidkore.com"),

  // Misc
  SAM_API_KEY: z.string().optional(),

  // Dropbox
  DROPBOX_CLIENT_ID: z.string().optional(),
  DROPBOX_CLIENT_SECRET: z.string().optional(),
  DROPBOX_REDIRECT_URI: z.string().url().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),

  // Microsoft
  MICROSOFT_CLIENT_ID: z.string(),
  MICROSOFT_CLIENT_SECRET: z.string() || "",
  MICROSOFT_TENANT_ID: z.string(),
  MICROSOFT_REDIRECT_URI: z.string().url().optional(),

  // Google
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
});

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  // Throw a concise error listing invalid/missing variables
  const errorMessages = envResult.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );
  throw new Error(`Environment validation error: ${errorMessages.join(", ")}`);
}

const env = envResult.data;

const nodeEnv = env.NODE_ENV as NodeEnvironment;
const isDevelopment = nodeEnv === "development";

const backendPort = env.BACKEND_PORT ?? env.PORT;
const frontendPort = env.FRONTEND_PORT;
const backendUrl = env.BACKEND_URL ?? `http://localhost:${backendPort}`;

export const config: AppConfig = {
  nodeEnv,
  server: {
    // Keep internal server port as PORT; BACKEND_PORT affects computed URLs only
    port: env.PORT,
  },
  urls: {
    frontend: env.FRONTEND_URL
      ? env.FRONTEND_URL.split(",").map((url) => url.trim())
      : [`http://localhost:${frontendPort ?? 3000}`],
    backend: backendUrl,
  },
  db: {
    name: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    logging: false,
  },
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    tls: env.REDIS_TLS,
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    allowPasswordless: env.ALLOW_PASSWORDLESS_LOGIN,
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },
  email: {
    sendgridApiKey: env.SENDGRID_API_KEY,
    fromEmail: env.FROM_EMAIL,
  },
  samGov: {
    apiKey: env.SAM_API_KEY,
  },
  dropbox: {
    clientId: env.DROPBOX_CLIENT_ID,
    clientSecret: env.DROPBOX_CLIENT_SECRET,
    redirectUri:
      env.DROPBOX_REDIRECT_URI ?? `${backendUrl}/api/auth/dropbox/callback`,
  },
  openai: {
    apiKey: env.OPENAI_API_KEY,
  },
  microsoft: {
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    tenantId: env.MICROSOFT_TENANT_ID, // Required for production, will be overridden by MSAL config in development
    redirectUri:
      env.MICROSOFT_REDIRECT_URI ??
      `${
        env.FRONTEND_URL?.split(",")[0] ??
        `http://localhost:${frontendPort ?? 3000}`
      }/auth/microsoft/callback`,
  },
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri:
      env.GOOGLE_REDIRECT_URI ?? `${backendUrl}/api/auth/google/callback`,
  },
};

export const isProd = nodeEnv === "production";
export const isDev = isDevelopment;
export const isTest = nodeEnv === "test";

export default config;
