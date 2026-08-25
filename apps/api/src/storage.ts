import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface PhotoStorage {
  save(key: string, data: Buffer, mimeType: string): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

class LocalPhotoStorage implements PhotoStorage {
  constructor(private readonly uploadDir: string) {}

  async save(key: string, data: Buffer): Promise<void> {
    const path = resolve(this.uploadDir, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data, { flag: "wx" });
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(resolve(this.uploadDir, key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(resolve(this.uploadDir, key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

class SupabasePhotoStorage implements PhotoStorage {
  private bucketReady?: Promise<void>;

  constructor(
    private readonly client: SupabaseClient,
    private readonly bucket: string,
  ) {}

  private ensureBucket(): Promise<void> {
    this.bucketReady ??= (async () => {
      const { data, error } = await this.client.storage.getBucket(this.bucket);
      if (data) return;
      if (error && !error.message.toLowerCase().includes("not found")) throw error;

      const result = await this.client.storage.createBucket(this.bucket, {
        public: false,
        fileSizeLimit: 8 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      });
      if (result.error) throw result.error;
    })();

    return this.bucketReady;
  }

  async save(key: string, data: Buffer, mimeType: string): Promise<void> {
    await this.ensureBucket();
    const { error } = await this.client.storage.from(this.bucket).upload(key, data, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) throw error;
  }

  async read(key: string): Promise<Buffer | null> {
    await this.ensureBucket();
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error) {
      if (error.message.toLowerCase().includes("not found")) return null;
      throw error;
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    await this.ensureBucket();
    const { error } = await this.client.storage.from(this.bucket).remove([key]);
    if (error) throw error;
  }
}

export function createPhotoStorage(config: {
  uploadDir: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseStorageBucket: string;
}): PhotoStorage {
  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    return new SupabasePhotoStorage(
      createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      config.supabaseStorageBucket,
    );
  }

  return new LocalPhotoStorage(config.uploadDir);
}
