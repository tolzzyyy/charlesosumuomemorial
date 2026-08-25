import { resolve } from "node:path";
import { z } from "zod";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  DATABASE_PATH: z.string().min(1).default("./data/tribute.db"),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  WEB_ORIGINS: z.string().default("http://localhost:5173"),
  ADMIN_API_KEY: z.string().min(24).optional(),
  MODERATE_TRIBUTES: z.enum(["true", "false"]).default("false"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppConfig = {
  port: number;
  databasePath: string;
  uploadDir: string;
  webOrigins: string[];
  adminApiKey?: string;
  moderateTributes: boolean;
  nodeEnv: "development" | "test" | "production";
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(environment);

  return {
    port: parsed.PORT,
    databasePath:
      parsed.DATABASE_PATH === ":memory:"
        ? parsed.DATABASE_PATH
        : resolve(process.cwd(), parsed.DATABASE_PATH),
    uploadDir: resolve(process.cwd(), parsed.UPLOAD_DIR),
    webOrigins: parsed.WEB_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    adminApiKey: parsed.ADMIN_API_KEY,
    moderateTributes: parsed.MODERATE_TRIBUTES === "true",
    nodeEnv: parsed.NODE_ENV,
  };
}
