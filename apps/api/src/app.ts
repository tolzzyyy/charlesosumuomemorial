import { timingSafeEqual, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { extname, resolve } from "node:path";
import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { z, ZodError } from "zod";
import type { AppConfig } from "./config.js";
import type { TributeDatabase } from "./database.js";

type AppDependencies = {
  database: TributeDatabase;
  config: AppConfig;
};

type MemorialRow = {
  id: string;
  slug: string;
  fullName: string | null;
  preferredName: string | null;
  title: string;
  birthYear: number | null;
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
  placeOfPassing: string | null;
  lastResidence: string | null;
  openingStatement: string | null;
  heroMediaUrl: string | null;
  contentStatus: "draft" | "published";
};

const tributeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  relationship: z.string().trim().min(2).max(100),
  message: z.string().trim().min(10).max(3000),
  email: z.union([z.email(), z.literal("")]).optional(),
  website: z.string().max(0).optional(),
}).strict();

const photoMemorySchema = z.object({
  contributorName: z.string().trim().min(2).max(100),
  caption: z.string().trim().max(500).optional(),
  website: z.string().max(0).optional(),
}).strict();

const rsvpSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(30).optional(),
    email: z.union([z.email(), z.literal("")]).optional(),
    attendance: z.enum(["attending", "not_attending", "unsure"]),
    guestCount: z.coerce.number().int().min(0).max(10).default(1),
    note: z.string().trim().max(1000).optional(),
    website: z.string().max(0).optional(),
  })
  .refine((value) => Boolean(value.phone || value.email), {
    message: "A phone number or email address is required.",
    path: ["phone"],
  });

const moderationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const adminTributeQuerySchema = paginationSchema.extend({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

function safeStringEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

const allowedImageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

function removeUploadedFile(file: Express.Multer.File | undefined): void {
  if (!file) return;

  try {
    unlinkSync(file.path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}

function withPhotoMemoryImage(
  row: Record<string, unknown>,
  options: { admin?: boolean } = {},
) {
  const id = String(row.id);
  const contributorName = String(row.contributorName);
  return {
    ...row,
    image: {
      id,
      url: options.admin
        ? `/api/v1/admin/memory-photo-images/${id}`
        : `/api/v1/memory-photo-images/${id}`,
      altText: row.caption || `Photo shared by ${contributorName}`,
    },
  };
}

function findMemorial(database: TributeDatabase, slug: string): MemorialRow | undefined {
  return database
    .prepare(`
      SELECT
        id,
        slug,
        full_name AS fullName,
        preferred_name AS preferredName,
        title,
        birth_year AS birthYear,
        birth_date AS birthDate,
        death_date AS deathDate,
        birth_place AS birthPlace,
        place_of_passing AS placeOfPassing,
        last_residence AS lastResidence,
        opening_statement AS openingStatement,
        hero_media_url AS heroMediaUrl,
        content_status AS contentStatus
      FROM memorials
      WHERE slug = ?
    `)
    .get(slug) as MemorialRow | undefined;
}

function missingFields(memorial: MemorialRow, funeral: Record<string, unknown> | undefined): string[] {
  const missing: string[] = [];

  if (!memorial.fullName) missing.push("fullName");
  if (!memorial.birthDate) missing.push("birthDate");
  if (!memorial.deathDate) missing.push("deathDate");
  if (!memorial.openingStatement) missing.push("openingStatement");
  if (!memorial.heroMediaUrl) missing.push("heroMediaUrl");
  if (!funeral?.funeralTime) missing.push("funeral.funeralTime");
  if (!funeral?.receptionDetails) missing.push("funeral.receptionDetails");
  if (!funeral?.programmeUrl) missing.push("funeral.programmeUrl");
  if (!funeral?.flyerUrl) missing.push("funeral.flyerUrl");

  return missing;
}

export function createApp({ database, config }: AppDependencies) {
  const app = express();
  mkdirSync(config.uploadDir, { recursive: true });

  const imageUpload = multer({
    storage: multer.diskStorage({
      destination: config.uploadDir,
      filename(_request, file, callback) {
        const extension = allowedImageTypes.get(file.mimetype) ?? extname(file.originalname);
        callback(null, `${randomUUID()}${extension.toLowerCase()}`);
      },
    }),
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter(_request, file, callback) {
      if (!allowedImageTypes.has(file.mimetype)) {
        callback(new Error("Only JPEG, PNG, WebP, and GIF images are supported."));
        return;
      }

      callback(null, true);
    },
  });
  const submissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.nodeEnv === "test" ? 1_000 : 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Too many submissions. Please try again later.",
      },
    },
  });

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.webOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin is not allowed by CORS."));
      },
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_request, response) => {
    response.json({
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get("/api/v1/memorials/:slug", (request, response) => {
    const memorial = findMemorial(database, request.params.slug);

    if (!memorial) {
      response.status(404).json({
        error: { code: "NOT_FOUND", message: "Memorial not found." },
      });
      return;
    }

    const timeline = database
      .prepare(`
        SELECT
          id,
          event_year AS eventYear,
          event_date AS eventDate,
          title,
          location,
          description,
          sort_order AS sortOrder
        FROM timeline_events
        WHERE memorial_id = ?
        ORDER BY sort_order, event_year
      `)
      .all(memorial.id);

    const favourites = database
      .prepare(`
        SELECT id, category, value, sort_order AS sortOrder
        FROM favourites
        WHERE memorial_id = ?
        ORDER BY sort_order, category
      `)
      .all(memorial.id);

    const funeral = database
      .prepare(`
        SELECT
          funeral_date AS funeralDate,
          funeral_time AS funeralTime,
          venue,
          church_venue AS churchVenue,
          burial_location AS burialLocation,
          wake_details AS wakeDetails,
          thanksgiving_date AS thanksgivingDate,
          thanksgiving_time AS thanksgivingTime,
          thanksgiving_venue AS thanksgivingVenue,
          reception_details AS receptionDetails,
          dress_code AS dressCode,
          programme_url AS programmeUrl,
          flyer_url AS flyerUrl,
          livestream_url AS livestreamUrl,
          rsvp_phone AS rsvpPhone
        FROM funeral_information
        WHERE memorial_id = ?
      `)
      .get(memorial.id) as Record<string, unknown> | undefined;

    const media = database
      .prepare(`
        SELECT
          id,
          media_type AS mediaType,
          url,
          alt_text AS altText,
          caption,
          is_featured AS isFeatured,
          sort_order AS sortOrder
        FROM media
        WHERE memorial_id = ?
        ORDER BY is_featured DESC, sort_order
      `)
      .all(memorial.id)
      .map((item) => ({
        ...item,
        isFeatured: Boolean(item.isFeatured),
      }));

    response.json({
      data: {
        memorial,
        timeline,
        favourites,
        funeral: funeral ?? null,
        media,
        missingFields: missingFields(memorial, funeral),
      },
    });
  });

  app.get("/api/v1/memorials/:slug/tributes", (request, response) => {
    const memorial = findMemorial(database, request.params.slug);

    if (!memorial) {
      response.status(404).json({
        error: { code: "NOT_FOUND", message: "Memorial not found." },
      });
      return;
    }

    const { limit, offset } = paginationSchema.parse(request.query);
    const tributes = database
      .prepare(`
        SELECT
          t.id, t.name, t.relationship, t.message,
          t.created_at AS createdAt
        FROM tributes t
        WHERE t.memorial_id = ? AND t.status = 'approved'
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(memorial.id, limit, offset);
    const count = database
      .prepare(`
        SELECT COUNT(*) AS total
        FROM tributes
        WHERE memorial_id = ? AND status = 'approved'
      `)
      .get(memorial.id) as { total: number };

    response.json({ data: tributes, meta: { total: count.total, limit, offset } });
  });

  app.post(
    "/api/v1/memorials/:slug/tributes",
    submissionLimiter,
    (request, response) => {
      const memorial = findMemorial(database, request.params.slug as string);

      if (!memorial) {
        response.status(404).json({
          error: { code: "NOT_FOUND", message: "Memorial not found." },
        });
        return;
      }

      const tribute = tributeSchema.parse(request.body);
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const status = config.moderateTributes ? "pending" : "approved";

      database
        .prepare(`
          INSERT INTO tributes (
            id, memorial_id, name, relationship, message, email, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          id,
          memorial.id,
          tribute.name,
          tribute.relationship,
          tribute.message,
          tribute.email || null,
          status,
          createdAt,
        );

      response.status(201).json({
        data: { id, status, createdAt },
        message:
          status === "approved"
            ? "Thank you. Your testimonial is now published."
            : "Thank you. Your testimonial was submitted for review.",
      });
    },
  );

  app.get("/api/v1/memorials/:slug/memory-photos", (request, response) => {
    const memorial = findMemorial(database, request.params.slug);

    if (!memorial) {
      response.status(404).json({
        error: { code: "NOT_FOUND", message: "Memorial not found." },
      });
      return;
    }

    const { limit, offset } = paginationSchema.parse(request.query);
    const photoMemories = database
      .prepare(`
        SELECT
          id, contributor_name AS contributorName, caption,
          created_at AS createdAt
        FROM photo_memories
        WHERE memorial_id = ? AND status = 'approved'
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(memorial.id, limit, offset)
      .map((row) => withPhotoMemoryImage(row as Record<string, unknown>));
    const count = database
      .prepare(`
        SELECT COUNT(*) AS total
        FROM photo_memories
        WHERE memorial_id = ? AND status = 'approved'
      `)
      .get(memorial.id) as { total: number };

    response.json({
      data: photoMemories,
      meta: { total: count.total, limit, offset },
    });
  });

  app.post(
    "/api/v1/memorials/:slug/memory-photos",
    submissionLimiter,
    imageUpload.single("image"),
    (request, response) => {
      const memorial = findMemorial(database, request.params.slug as string);

      if (!memorial) {
        removeUploadedFile(request.file);
        response.status(404).json({
          error: { code: "NOT_FOUND", message: "Memorial not found." },
        });
        return;
      }

      let photoMemory: z.infer<typeof photoMemorySchema>;

      try {
        photoMemory = photoMemorySchema.parse(request.body);
      } catch (error) {
        removeUploadedFile(request.file);
        throw error;
      }

      if (!request.file) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Please choose a photo to share.",
            fields: { image: ["A photo is required."] },
          },
        });
        return;
      }

      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const status = config.moderateTributes ? "pending" : "approved";

      try {
        database
          .prepare(`
            INSERT INTO photo_memories (
              id, memorial_id, contributor_name, caption, storage_key,
              original_name, mime_type, size_bytes, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            id,
            memorial.id,
            photoMemory.contributorName,
            photoMemory.caption || null,
            request.file.filename,
            request.file.originalname,
            request.file.mimetype,
            request.file.size,
            status,
            createdAt,
          );
      } catch (error) {
        removeUploadedFile(request.file);
        throw error;
      }

      const publishedPhoto =
        status === "approved"
          ? withPhotoMemoryImage({
              id,
              contributorName: photoMemory.contributorName,
              caption: photoMemory.caption || null,
              createdAt,
            })
          : null;

      response.status(201).json({
        data: { id, status, createdAt, photo: publishedPhoto },
        message:
          status === "approved"
            ? "Thank you. Your photo is now part of the Memory Wall."
            : "Thank you. Your photo was submitted for review.",
      });
    },
  );

  app.get("/api/v1/memory-photo-images/:id", (request, response) => {
    const image = database
      .prepare(`
        SELECT storage_key AS storageKey, mime_type AS mimeType
        FROM photo_memories
        WHERE id = ? AND status = 'approved'
      `)
      .get(request.params.id) as { storageKey: string; mimeType: string } | undefined;

    if (!image) {
      response.status(404).json({
        error: { code: "NOT_FOUND", message: "Image not found." },
      });
      return;
    }

    const imagePath = resolve(config.uploadDir, image.storageKey);
    if (!existsSync(imagePath)) {
      response.status(404).json({
        error: { code: "NOT_FOUND", message: "Image file not found." },
      });
      return;
    }

    response
      .type(image.mimeType)
      .set("Cache-Control", "public, max-age=86400")
      .sendFile(imagePath);
  });

  app.post(
    "/api/v1/memorials/:slug/rsvps",
    submissionLimiter,
    (request, response) => {
      const memorial = findMemorial(database, request.params.slug as string);

      if (!memorial) {
        response.status(404).json({
          error: { code: "NOT_FOUND", message: "Memorial not found." },
        });
        return;
      }

      const rsvp = rsvpSchema.parse(request.body);
      const id = randomUUID();
      const createdAt = new Date().toISOString();

      database
        .prepare(`
          INSERT INTO rsvps (
            id, memorial_id, name, phone, email, attendance,
            guest_count, note, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          id,
          memorial.id,
          rsvp.name,
          rsvp.phone || null,
          rsvp.email || null,
          rsvp.attendance,
          rsvp.guestCount,
          rsvp.note || null,
          createdAt,
        );

      response.status(201).json({
        data: { id, createdAt },
        message: "Your RSVP has been received.",
      });
    },
  );

  function requireAdmin(request: Request, response: Response, next: NextFunction) {
    if (!config.adminApiKey) {
      response.status(503).json({
        error: {
          code: "ADMIN_NOT_CONFIGURED",
          message: "Admin access has not been configured.",
        },
      });
      return;
    }

    const providedKey = request.header("x-admin-key") ?? "";

    if (!safeStringEqual(providedKey, config.adminApiKey)) {
      response.status(401).json({
        error: { code: "UNAUTHORIZED", message: "A valid admin key is required." },
      });
      return;
    }

    next();
  }

  app.use("/api/v1/admin", requireAdmin);

  app.get("/api/v1/admin/memorials/:slug/tributes", (request, response) => {
    const memorial = findMemorial(database, request.params.slug);

    if (!memorial) {
      response.status(404).json({
        error: { code: "NOT_FOUND", message: "Memorial not found." },
      });
      return;
    }

    const { status, limit, offset } = adminTributeQuerySchema.parse(request.query);
    const whereStatus = status ? "AND status = ?" : "";
    const parameters = status
      ? [memorial.id, status, limit, offset]
      : [memorial.id, limit, offset];
    const tributes = database
      .prepare(`
        SELECT
          t.id, t.name, t.relationship, t.message, t.email, t.status,
          t.created_at AS createdAt, t.reviewed_at AS reviewedAt
        FROM tributes t
        WHERE t.memorial_id = ? ${whereStatus.replace("status", "t.status")}
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...parameters);

    response.json({ data: tributes, meta: { limit, offset } });
  });

  app.patch("/api/v1/admin/tributes/:id", (request, response) => {
    const { status } = moderationSchema.parse(request.body);
    const reviewedAt = new Date().toISOString();
    const result = database
      .prepare(`
        UPDATE tributes
        SET status = ?, reviewed_at = ?
        WHERE id = ?
      `)
      .run(status, reviewedAt, request.params.id);

    if (result.changes === 0) {
      response.status(404).json({
        error: { code: "NOT_FOUND", message: "Tribute not found." },
      });
      return;
    }

    response.json({ data: { id: request.params.id, status, reviewedAt } });
  });

  app.get("/api/v1/admin/memorials/:slug/memory-photos", (request, response) => {
    const memorial = findMemorial(database, request.params.slug);

    if (!memorial) {
      response.status(404).json({
        error: { code: "NOT_FOUND", message: "Memorial not found." },
      });
      return;
    }

    const { status, limit, offset } = adminTributeQuerySchema.parse(request.query);
    const whereStatus = status ? "AND status = ?" : "";
    const parameters = status
      ? [memorial.id, status, limit, offset]
      : [memorial.id, limit, offset];
    const photoMemories = database
      .prepare(`
        SELECT
          id, contributor_name AS contributorName, caption, status,
          original_name AS originalName, mime_type AS mimeType,
          size_bytes AS sizeBytes, created_at AS createdAt,
          reviewed_at AS reviewedAt
        FROM photo_memories
        WHERE memorial_id = ? ${whereStatus}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...parameters)
      .map((row) =>
        withPhotoMemoryImage(row as Record<string, unknown>, { admin: true }),
      );

    response.json({ data: photoMemories, meta: { limit, offset } });
  });

  app.patch("/api/v1/admin/memory-photos/:id", (request, response) => {
    const { status } = moderationSchema.parse(request.body);
    const reviewedAt = new Date().toISOString();
    const result = database
      .prepare(`
        UPDATE photo_memories
        SET status = ?, reviewed_at = ?
        WHERE id = ?
      `)
      .run(status, reviewedAt, request.params.id);

    if (result.changes === 0) {
      response.status(404).json({
        error: { code: "NOT_FOUND", message: "Photo memory not found." },
      });
      return;
    }

    response.json({ data: { id: request.params.id, status, reviewedAt } });
  });

  app.get("/api/v1/admin/memory-photo-images/:id", (request, response) => {
    const image = database
      .prepare(`
        SELECT storage_key AS storageKey, mime_type AS mimeType
        FROM photo_memories
        WHERE id = ?
      `)
      .get(request.params.id) as { storageKey: string; mimeType: string } | undefined;

    if (!image) {
      response.status(404).json({
        error: { code: "NOT_FOUND", message: "Image not found." },
      });
      return;
    }

    const imagePath = resolve(config.uploadDir, image.storageKey);
    if (!existsSync(imagePath)) {
      response.status(404).json({
        error: { code: "NOT_FOUND", message: "Image file not found." },
      });
      return;
    }

    response.type(image.mimeType).set("Cache-Control", "private, no-store").sendFile(imagePath);
  });

  app.get("/api/v1/admin/memorials/:slug/rsvps", (request, response) => {
    const memorial = findMemorial(database, request.params.slug);

    if (!memorial) {
      response.status(404).json({
        error: { code: "NOT_FOUND", message: "Memorial not found." },
      });
      return;
    }

    const { limit, offset } = paginationSchema.parse(request.query);
    const rsvps = database
      .prepare(`
        SELECT
          id, name, phone, email, attendance,
          guest_count AS guestCount, note, created_at AS createdAt
        FROM rsvps
        WHERE memorial_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(memorial.id, limit, offset);

    response.json({ data: rsvps, meta: { limit, offset } });
  });

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: "NOT_FOUND", message: "Route not found." },
    });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof multer.MulterError) {
      response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        error: {
          code: "UPLOAD_ERROR",
          message:
            error.code === "LIMIT_FILE_SIZE"
              ? "The image must be 8 MB or smaller."
              : error.message,
        },
      });
      return;
    }

    if (error instanceof Error && error.message.startsWith("Only JPEG")) {
      response.status(400).json({
        error: { code: "UNSUPPORTED_IMAGE", message: error.message },
      });
      return;
    }

    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Please check the submitted fields.",
          fields: z.flattenError(error).fieldErrors,
        },
      });
      return;
    }

    if (config.nodeEnv !== "test") {
      console.error(error);
    }

    response.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong.",
      },
    });
  };

  app.use(errorHandler);

  return app;
}
