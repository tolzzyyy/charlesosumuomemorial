import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import {
  migrateDatabase,
  openDatabase,
  type TributeDatabase,
} from "../src/database.js";
import { seedDatabase } from "../src/seed.js";

const adminApiKey = "test-admin-key-that-is-long-enough";

describe("Tribute API", () => {
  let app: Express;
  let database: TributeDatabase;
  let uploadDir: string;

  before(() => {
    uploadDir = mkdtempSync(join(tmpdir(), "tribute-api-test-"));
    const config: AppConfig = {
      port: 4100,
      databasePath: ":memory:",
      uploadDir,
      webOrigins: ["http://localhost:5173"],
      adminApiKey,
      moderateTributes: true,
      nodeEnv: "test",
    };

    database = openDatabase(":memory:");
    migrateDatabase(database);
    seedDatabase(database);
    app = createApp({ database, config });
  });

  after(() => {
    database.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  it("reports its health", async () => {
    const response = await request(app).get("/health").expect(200);
    assert.equal(response.body.data.status, "ok");
  });

  it("returns seeded memorial, timeline, favourites, and funeral details", async () => {
    const response = await request(app)
      .get("/api/v1/memorials/memorial")
      .expect(200);

    assert.equal(response.body.data.memorial.birthYear, 1962);
    assert.equal(response.body.data.memorial.fullName, "Osumuo Chidiebere Charles");
    assert.equal(response.body.data.timeline.length, 3);
    assert.equal(response.body.data.favourites.length, 6);
    assert.equal(response.body.data.funeral.funeralDate, "2026-10-30");
    assert.equal(response.body.data.media.length, 17);
    assert.ok(!response.body.data.missingFields.includes("fullName"));
  });

  it("moves legacy tribute photos into photo memories without changing static media", () => {
    const memorial = database
      .prepare("SELECT id FROM memorials WHERE slug = ?")
      .get("memorial") as { id: string };
    const staticMediaBefore = database
      .prepare("SELECT COUNT(*) AS total FROM media WHERE memorial_id = ?")
      .get(memorial.id) as { total: number };

    database
      .prepare(`
        INSERT INTO tributes (
          id, memorial_id, name, relationship, message, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        "legacy-tribute",
        memorial.id,
        "Legacy Contributor",
        "Friend",
        "A testimonial submitted through the former combined form.",
        "rejected",
        "2026-01-01T00:00:00.000Z",
      );
    database
      .prepare(`
        INSERT INTO tribute_media (
          id, tribute_id, storage_key, original_name, mime_type,
          size_bytes, alt_text, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        "legacy-photo",
        "legacy-tribute",
        "legacy-photo.jpg",
        "family-day.jpg",
        "image/jpeg",
        4,
        "A family day",
        "2026-01-01T00:00:00.000Z",
      );

    migrateDatabase(database);

    const migrated = database
      .prepare(`
        SELECT contributor_name AS contributorName, caption, status
        FROM photo_memories
        WHERE id = ?
      `)
      .get("legacy-photo") as {
      contributorName: string;
      caption: string;
      status: string;
    };
    const staticMediaAfter = database
      .prepare("SELECT COUNT(*) AS total FROM media WHERE memorial_id = ?")
      .get(memorial.id) as { total: number };

    assert.deepEqual({ ...migrated }, {
      contributorName: "Legacy Contributor",
      caption: "A family day",
      status: "rejected",
    });
    assert.equal(staticMediaAfter.total, staticMediaBefore.total);
  });

  it("keeps new tributes private until an admin approves them", async () => {
    const submission = await request(app)
      .post("/api/v1/memorials/memorial/tributes")
      .send({
        name: "Ada Okafor",
        relationship: "Family friend",
        message: "He made everyone around him feel welcome.",
        email: "ada@example.com",
      })
      .expect(201);

    const beforeApproval = await request(app)
      .get("/api/v1/memorials/memorial/tributes")
      .expect(200);
    assert.equal(beforeApproval.body.meta.total, 0);

    await request(app)
      .patch(`/api/v1/admin/tributes/${submission.body.data.id}`)
      .set("x-admin-key", adminApiKey)
      .send({ status: "approved" })
      .expect(200);

    const afterApproval = await request(app)
      .get("/api/v1/memorials/memorial/tributes")
      .expect(200);
    assert.equal(afterApproval.body.meta.total, 1);
    assert.equal(afterApproval.body.data[0].name, "Ada Okafor");
    assert.equal(afterApproval.body.data[0].email, undefined);
    assert.equal(afterApproval.body.data[0].image, undefined);
  });

  it("keeps testimonials text-only", async () => {
    const response = await request(app)
      .post("/api/v1/memorials/memorial/tributes")
      .send({
        name: "Ngozi Eze",
        relationship: "Friend",
        message: "This photograph reminds us of his warmth and kindness.",
        imageAlt: "A field that belonged to the former combined form",
      })
      .expect(400);

    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  });

  it("publishes a separately submitted photo memory only after moderation", async () => {
    const submission = await request(app)
      .post("/api/v1/memorials/memorial/memory-photos")
      .field("contributorName", "Ngozi Eze")
      .field("caption", "A fond memory of him with friends")
      .attach("image", Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: "memory.png",
        contentType: "image/png",
      })
      .expect(201);

    assert.equal(submission.body.data.status, "pending");

    const beforeApproval = await request(app)
      .get("/api/v1/memorials/memorial/memory-photos")
      .expect(200);
    assert.equal(beforeApproval.body.meta.total, 0);

    await request(app)
      .get("/api/v1/admin/memorials/memorial/memory-photos?status=pending")
      .expect(401);

    const pending = await request(app)
      .get("/api/v1/admin/memorials/memorial/memory-photos?status=pending")
      .set("x-admin-key", adminApiKey)
      .expect(200);
    const photoMemory = pending.body.data.find(
      (item: { id: string }) => item.id === submission.body.data.id,
    );
    assert.equal(photoMemory.contributorName, "Ngozi Eze");
    assert.equal(photoMemory.caption, "A fond memory of him with friends");
    assert.equal(
      photoMemory.image.url,
      `/api/v1/admin/memory-photo-images/${submission.body.data.id}`,
    );

    await request(app)
      .get(`/api/v1/memory-photo-images/${submission.body.data.id}`)
      .expect(404);
    await request(app)
      .get(photoMemory.image.url)
      .set("x-admin-key", adminApiKey)
      .expect("Content-Type", /image\/png/)
      .expect(200);

    await request(app)
      .patch(`/api/v1/admin/memory-photos/${submission.body.data.id}`)
      .set("x-admin-key", adminApiKey)
      .send({ status: "approved" })
      .expect(200);

    const afterApproval = await request(app)
      .get("/api/v1/memorials/memorial/memory-photos")
      .expect(200);
    const publishedPhoto = afterApproval.body.data.find(
      (item: { id: string }) => item.id === submission.body.data.id,
    );
    assert.equal(publishedPhoto.contributorName, "Ngozi Eze");
    assert.equal(
      publishedPhoto.image.url,
      `/api/v1/memory-photo-images/${submission.body.data.id}`,
    );

    await request(app)
      .get(publishedPhoto.image.url)
      .expect("Content-Type", /image\/png/)
      .expect(200);
  });

  it("requires a supported image for a photo memory", async () => {
    const missingImage = await request(app)
      .post("/api/v1/memorials/memorial/memory-photos")
      .field("contributorName", "Ifeoma Obi")
      .field("caption", "A memory without its photo")
      .expect(400);
    assert.deepEqual(missingImage.body.error.fields.image, ["A photo is required."]);

    const unsupportedImage = await request(app)
      .post("/api/v1/memorials/memorial/memory-photos")
      .field("contributorName", "Ifeoma Obi")
      .attach("image", Buffer.from("not an image"), {
        filename: "memory.txt",
        contentType: "text/plain",
      })
      .expect(400);
    assert.equal(unsupportedImage.body.error.code, "UNSUPPORTED_IMAGE");
  });

  it("can publish a new testimonial immediately when moderation is disabled", async () => {
    const immediateApp = createApp({
      database,
      config: {
        port: 4100,
        databasePath: ":memory:",
        uploadDir,
        webOrigins: ["http://localhost:5173"],
        adminApiKey,
        moderateTributes: false,
        nodeEnv: "test",
      },
    });

    const submission = await request(immediateApp)
      .post("/api/v1/memorials/memorial/tributes")
      .send({
        name: "Emeka Obi",
        relationship: "Neighbour",
        message: "He always greeted everyone with warmth and genuine kindness.",
      })
      .expect(201);

    assert.equal(submission.body.data.status, "approved");

    const publicWall = await request(immediateApp)
      .get("/api/v1/memorials/memorial/tributes")
      .expect(200);
    assert.ok(
      publicWall.body.data.some(
        (tribute: { name: string }) => tribute.name === "Emeka Obi",
      ),
    );
  });

  it("can publish a new photo memory immediately when moderation is disabled", async () => {
    const immediateApp = createApp({
      database,
      config: {
        port: 4100,
        databasePath: ":memory:",
        uploadDir,
        webOrigins: ["http://localhost:5173"],
        adminApiKey,
        moderateTributes: false,
        nodeEnv: "test",
      },
    });

    const submission = await request(immediateApp)
      .post("/api/v1/memorials/memorial/memory-photos")
      .field("contributorName", "Chika Nwosu")
      .attach("image", Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: "memory.jpg",
        contentType: "image/jpeg",
      })
      .expect(201);

    assert.equal(submission.body.data.status, "approved");
    assert.equal(submission.body.data.photo.contributorName, "Chika Nwosu");
    assert.equal(
      submission.body.data.photo.image.url,
      `/api/v1/memory-photo-images/${submission.body.data.id}`,
    );

    const publicWall = await request(immediateApp)
      .get("/api/v1/memorials/memorial/memory-photos")
      .expect(200);
    assert.ok(
      publicWall.body.data.some(
        (photoMemory: { contributorName: string }) =>
          photoMemory.contributorName === "Chika Nwosu",
      ),
    );
  });

  it("stores RSVPs and protects their contact details", async () => {
    await request(app)
      .post("/api/v1/memorials/memorial/rsvps")
      .send({
        name: "Chidi Osakwe",
        phone: "08030000000",
        attendance: "attending",
        guestCount: 2,
      })
      .expect(201);

    await request(app)
      .get("/api/v1/admin/memorials/memorial/rsvps")
      .expect(401);

    const adminResponse = await request(app)
      .get("/api/v1/admin/memorials/memorial/rsvps")
      .set("x-admin-key", adminApiKey)
      .expect(200);

    assert.equal(adminResponse.body.data[0].phone, "08030000000");
    assert.equal(adminResponse.body.data[0].guestCount, 2);
  });

  it("rejects incomplete tribute submissions", async () => {
    const response = await request(app)
      .post("/api/v1/memorials/memorial/tributes")
      .send({ name: "A", relationship: "Friend", message: "Too short" })
      .expect(400);

    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  });
});
