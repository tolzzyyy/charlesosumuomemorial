import "dotenv/config";
import { loadConfig } from "./config.js";
import { migrateDatabase, openDatabase, type TributeDatabase } from "./database.js";
import { createPhotoStorage } from "./storage.js";

const tables = [
  "memorials",
  "timeline_events",
  "favourites",
  "funeral_information",
  "media",
  "tributes",
  "tribute_media",
  "photo_memories",
  "rsvps",
] as const;

type DatabaseValue = string | number | null;

function databaseValue(value: unknown, column: string): DatabaseValue {
  if (value === null || typeof value === "string" || typeof value === "number") {
    return value;
  }
  throw new Error(`Unsupported value in column ${column}.`);
}

async function copyTable(
  source: TributeDatabase,
  destination: TributeDatabase,
  table: (typeof tables)[number],
): Promise<number> {
  const rows = await source.all<Record<string, unknown>>(`SELECT * FROM ${table}`);

  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => "?").join(", ");
    const values = columns.map((column) => databaseValue(row[column], column));
    await destination.run(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
      ...values,
    );
  }

  return rows.length;
}

const config = loadConfig({ ...process.env, NODE_ENV: "development" });
if (!config.databaseUrl || !config.supabaseUrl || !config.supabaseServiceRoleKey) {
  throw new Error(
    "Set DATABASE_URL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY before importing.",
  );
}

const source = openDatabase({ databasePath: config.databasePath });
const destination = openDatabase({
  databasePath: ":memory:",
  databaseUrl: config.databaseUrl,
});

try {
  await migrateDatabase(destination);
  const existing = await destination.get<{ total: number | string }>(
    "SELECT COUNT(*) AS total FROM memorials",
  );
  if (Number(existing?.total ?? 0) > 0) {
    throw new Error(
      "The Supabase database already contains memorial data. Import was stopped to avoid overwriting it.",
    );
  }

  const localStorage = createPhotoStorage({
    uploadDir: config.uploadDir,
    supabaseStorageBucket: config.supabaseStorageBucket,
  });
  const cloudStorage = createPhotoStorage(config);
  const storedFiles = await source.all<{ storageKey: string }>(`
    SELECT storage_key AS storageKey FROM photo_memories
    UNION
    SELECT storage_key AS storageKey FROM tribute_media
  `);
  const files = await Promise.all(
    storedFiles.map(async ({ storageKey }) => {
      const file = await localStorage.read(storageKey);
      if (!file) throw new Error(`Local upload is missing: ${storageKey}`);
      const metadata = await source.get<{ mimeType: string }>(`
        SELECT mime_type AS mimeType FROM photo_memories WHERE storage_key = ?
        UNION ALL
        SELECT mime_type AS mimeType FROM tribute_media WHERE storage_key = ?
        LIMIT 1
      `, storageKey, storageKey);
      return { storageKey, file, mimeType: metadata?.mimeType ?? "image/jpeg" };
    }),
  );

  const counts = new Map<string, number>();
  const uploadedKeys: string[] = [];
  let uploadedFiles = 0;
  try {
    await destination.transaction(async (transaction) => {
      for (const table of tables) {
        counts.set(table, await copyTable(source, transaction, table));
      }
      for (const { storageKey, file, mimeType } of files) {
        await cloudStorage.save(storageKey, file, mimeType);
        uploadedKeys.push(storageKey);
        uploadedFiles += 1;
      }
    });
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map((key) => cloudStorage.remove(key)));
    throw error;
  }

  console.log(
    `Imported ${counts.get("tributes") ?? 0} testimonials, ${counts.get("photo_memories") ?? 0} photo records, and ${uploadedFiles} uploaded files.`,
  );
} finally {
  await Promise.all([source.close(), destination.close()]);
}
