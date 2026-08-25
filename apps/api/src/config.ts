import { resolve } from "node:path";
import { z } from "zod";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  DATABASE_PATH: z.string().min(1).default("./data/tribute.db"),
  DATABASE_URL: z.string().min(1).optional(),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("memory-photos"),
  WEB_ORIGINS: z.string().default("http://localhost:5173"),
  ADMIN_API_KEY: z.string().min(24).optional(),
  MODERATE_TRIBUTES: z.enum(["true", "false"]).default("false"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppConfig = {
  port: number;
  databasePath: string;
  databaseUrl?: string;
  uploadDir: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseStorageBucket: string;
  webOrigins: string[];
  adminApiKey?: string;
  moderateTributes: boolean;
  nodeEnv: "development" | "test" | "production";
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(environment);

  if (parsed.NODE_ENV === "production") {
    if (!parsed.DATABASE_URL) {
      throw new Error("DATABASE_URL is required in production.");
    }
    if (!parsed.SUPABASE_URL || !parsed.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.",
      );
    }
  }

  return {
    port: parsed.PORT,
    databasePath:
      parsed.DATABASE_PATH === ":memory:"
        ? parsed.DATABASE_PATH
        : resolve(process.cwd(), parsed.DATABASE_PATH),
    databaseUrl: parsed.DATABASE_URL,
    uploadDir: resolve(process.cwd(), parsed.UPLOAD_DIR),
    supabaseUrl: parsed.SUPABASE_URL,
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    supabaseStorageBucket: parsed.SUPABASE_STORAGE_BUCKET,
    webOrigins: parsed.WEB_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    adminApiKey: parsed.ADMIN_API_KEY,
    moderateTributes: parsed.MODERATE_TRIBUTES === "true",
    nodeEnv: parsed.NODE_ENV,
  };
}
