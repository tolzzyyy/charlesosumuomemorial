import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import postgres from "postgres";

type QueryParameter = string | number | null;

export type QueryResult = {
  changes: number;
};

export interface TributeDatabase {
  readonly dialect: "sqlite" | "postgres";
  get<T extends Record<string, unknown>>(
    query: string,
    ...parameters: QueryParameter[]
  ): Promise<T | undefined>;
  all<T extends Record<string, unknown>>(
    query: string,
    ...parameters: QueryParameter[]
  ): Promise<T[]>;
  run(query: string, ...parameters: QueryParameter[]): Promise<QueryResult>;
  exec(query: string): Promise<void>;
  transaction<T>(operation: (database: TributeDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

class SqliteTributeDatabase implements TributeDatabase {
  readonly dialect = "sqlite" as const;

  constructor(private readonly database: DatabaseSync) {}

  async get<T extends Record<string, unknown>>(
    query: string,
    ...parameters: QueryParameter[]
  ): Promise<T | undefined> {
    return this.database.prepare(query).get(...parameters) as T | undefined;
  }

  async all<T extends Record<string, unknown>>(
    query: string,
    ...parameters: QueryParameter[]
  ): Promise<T[]> {
    return this.database.prepare(query).all(...parameters) as T[];
  }

  async run(query: string, ...parameters: QueryParameter[]): Promise<QueryResult> {
    const result = this.database.prepare(query).run(...parameters);
    return { changes: Number(result.changes) };
  }

  async exec(query: string): Promise<void> {
    this.database.exec(query);
  }

  async transaction<T>(operation: (database: TributeDatabase) => Promise<T>): Promise<T> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = await operation(this);
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async close(): Promise<void> {
    this.database.close();
  }
}

function toPostgresQuery(query: string): string {
  let parameterIndex = 0;
  return query
    .replace(/\?/g, () => `$${++parameterIndex}`)
    .replace(/\bAS\s+([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)/g, 'AS "$1"');
}

class PostgresTributeDatabase implements TributeDatabase {
  readonly dialect = "postgres" as const;

  constructor(
    private readonly sql: postgres.Sql | postgres.TransactionSql,
    private readonly ownsConnection = true,
  ) {}

  async get<T extends Record<string, unknown>>(
    query: string,
    ...parameters: QueryParameter[]
  ): Promise<T | undefined> {
    const rows = await this.sql.unsafe<T[]>(toPostgresQuery(query), parameters);
    return rows[0];
  }

  async all<T extends Record<string, unknown>>(
    query: string,
    ...parameters: QueryParameter[]
  ): Promise<T[]> {
    return await this.sql.unsafe<T[]>(toPostgresQuery(query), parameters);
  }

  async run(query: string, ...parameters: QueryParameter[]): Promise<QueryResult> {
    const result = await this.sql.unsafe(toPostgresQuery(query), parameters);
    return { changes: Number(result.count ?? 0) };
  }

  async exec(query: string): Promise<void> {
    await this.sql.unsafe(query);
  }

  async transaction<T>(operation: (database: TributeDatabase) => Promise<T>): Promise<T> {
    if (!("begin" in this.sql)) {
      throw new Error("Nested Postgres transactions are not supported.");
    }

    const [result] = await this.sql.begin(async (transactionSql) => [
      await operation(new PostgresTributeDatabase(transactionSql, false)),
    ] as const);
    return result as T;
  }

  async close(): Promise<void> {
    if (this.ownsConnection && "end" in this.sql) {
      await this.sql.end({ timeout: 5 });
    }
  }
}

export function openDatabase(options: {
  databasePath: string;
  databaseUrl?: string;
}): TributeDatabase {
  if (options.databaseUrl) {
    return new PostgresTributeDatabase(
      postgres(options.databaseUrl, {
        max: 5,
        prepare: false,
        ssl: "require",
        idle_timeout: 20,
        connect_timeout: 15,
      }),
    );
  }

  if (options.databasePath !== ":memory:") {
    mkdirSync(dirname(options.databasePath), { recursive: true });
  }

  const database = new DatabaseSync(options.databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");

  if (options.databasePath !== ":memory:") {
    database.exec("PRAGMA journal_mode = WAL");
  }

  return new SqliteTributeDatabase(database);
}

const schema = `
  CREATE TABLE IF NOT EXISTS memorials (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    full_name TEXT,
    preferred_name TEXT,
    title TEXT NOT NULL,
    birth_year INTEGER,
    birth_date TEXT,
    death_date TEXT,
    birth_place TEXT,
    place_of_passing TEXT,
    last_residence TEXT,
    opening_statement TEXT,
    hero_media_url TEXT,
    content_status TEXT NOT NULL DEFAULT 'draft'
      CHECK (content_status IN ('draft', 'published')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS timeline_events (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    event_year INTEGER,
    event_date TEXT,
    title TEXT NOT NULL,
    location TEXT,
    description TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS favourites (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    value TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE (memorial_id, category)
  );

  CREATE TABLE IF NOT EXISTS funeral_information (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL UNIQUE REFERENCES memorials(id) ON DELETE CASCADE,
    funeral_date TEXT,
    funeral_time TEXT,
    venue TEXT,
    church_venue TEXT,
    burial_location TEXT,
    wake_details TEXT,
    thanksgiving_date TEXT,
    thanksgiving_time TEXT,
    thanksgiving_venue TEXT,
    reception_details TEXT,
    dress_code TEXT,
    programme_url TEXT,
    flyer_url TEXT,
    livestream_url TEXT,
    rsvp_phone TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL DEFAULT 'image'
      CHECK (media_type IN ('image', 'video', 'document')),
    url TEXT NOT NULL,
    alt_text TEXT,
    caption TEXT,
    is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tributes (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    message TEXT NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL,
    reviewed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tribute_media (
    id TEXT PRIMARY KEY,
    tribute_id TEXT NOT NULL UNIQUE REFERENCES tributes(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    alt_text TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS photo_memories (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    contributor_name TEXT NOT NULL,
    caption TEXT,
    storage_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL,
    reviewed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS rsvps (
    id TEXT PRIMARY KEY,
    memorial_id TEXT NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    attendance TEXT NOT NULL
      CHECK (attendance IN ('attending', 'not_attending', 'unsure')),
    guest_count INTEGER NOT NULL DEFAULT 1 CHECK (guest_count BETWEEN 0 AND 10),
    note TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_timeline_memorial
    ON timeline_events(memorial_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_favourites_memorial
    ON favourites(memorial_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_tributes_public
    ON tributes(memorial_id, status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_tribute_media_tribute
    ON tribute_media(tribute_id);
  CREATE INDEX IF NOT EXISTS idx_photo_memories_public
    ON photo_memories(memorial_id, status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_rsvps_memorial
    ON rsvps(memorial_id, created_at DESC);
`;

export async function migrateDatabase(database: TributeDatabase): Promise<void> {
  await database.exec(schema);

  const legacyMigration = `
    INSERT ${database.dialect === "sqlite" ? "OR IGNORE" : ""} INTO photo_memories (
      id, memorial_id, contributor_name, caption, storage_key, original_name,
      mime_type, size_bytes, status, created_at, reviewed_at
    )
    SELECT
      tm.id, t.memorial_id, t.name, tm.alt_text, tm.storage_key, tm.original_name,
      tm.mime_type, tm.size_bytes, t.status, tm.created_at, t.reviewed_at
    FROM tribute_media tm
    INNER JOIN tributes t ON t.id = tm.tribute_id
    ${database.dialect === "postgres" ? "ON CONFLICT (id) DO NOTHING" : ""};
  `;

  await database.exec(legacyMigration);
}
