import { randomUUID } from "node:crypto";
import type { TributeDatabase } from "./database.js";

type TimelineSeed = {
  year: number;
  title: string;
  location: string;
  description: string;
};

const timeline: TimelineSeed[] = [
  {
    year: 1962,
    title: "Born",
    location: "Cross River, Nigeria",
    description: "Born in Cross River, Nigeria.",
  },
  {
    year: 1998,
    title: "Marriage",
    location: "Lagos, Nigeria",
    description: "Married Mrs Clementina Osumuo in Lagos.",
  },
  {
    year: 1998,
    title: "Birth of First Child",
    location: "",
    description: "Welcomed first daughter, Osumuo Amanda Adaeze.",
  },
];

const favourites = [
  ["Favourite drink", "Green tea"],
  ["Favourite colour", "Blue and grey"],
  ["Favourite football team", "Chelsea"],
  ["Favourite books", "Life-help books"],
  ["Favourite place", "His home"],
  ["Favourite hobby", "Trying out new recipes"],
] as const;

const memorialImages = Array.from({ length: 17 }, (_, index) => ({
  url: `/images/memories/charles-${String(index + 1).padStart(2, "0")}.jpg`,
  altText: `A photograph from Chief Charles Osumuo's life, ${index + 1} of 17`,
  isFeatured: index === 10,
}));

export async function seedDatabase(database: TributeDatabase): Promise<void> {
  const existingMemorial = await database.get("SELECT id FROM memorials LIMIT 1");

  if (existingMemorial) return;

  const memorialId = randomUUID();
  const now = new Date().toISOString();

  await database.transaction(async (transaction) => {
    await transaction.run(
      `
        INSERT INTO memorials (
          id, slug, full_name, preferred_name, title, birth_year, birth_date,
          death_date, birth_place, place_of_passing, last_residence,
          opening_statement, hero_media_url, content_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      memorialId,
      "memorial",
      "Osumuo Chidiebere Charles",
      null,
      "In Loving Memory",
      1962,
      null,
      null,
      "Cross River, Nigeria",
      null,
      null,
      null,
      "/images/memories/charles-11.jpg",
      "draft",
      now,
      now,
    );

    for (const [index, event] of timeline.entries()) {
      await transaction.run(
        `
          INSERT INTO timeline_events (
            id, memorial_id, event_year, event_date, title, location,
            description, sort_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        randomUUID(),
        memorialId,
        event.year,
        null,
        event.title,
        event.location || null,
        event.description,
        (index + 1) * 10,
        now,
      );
    }

    for (const [index, [category, value]] of favourites.entries()) {
      await transaction.run(
        `
          INSERT INTO favourites (id, memorial_id, category, value, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `,
        randomUUID(),
        memorialId,
        category,
        value,
        (index + 1) * 10,
      );
    }

    for (const [index, image] of memorialImages.entries()) {
      await transaction.run(
        `
          INSERT INTO media (
            id, memorial_id, media_type, url, alt_text, caption,
            is_featured, sort_order, created_at
          ) VALUES (?, ?, 'image', ?, ?, ?, ?, ?, ?)
        `,
        randomUUID(),
        memorialId,
        image.url,
        image.altText,
        null,
        image.isFeatured ? 1 : 0,
        (index + 1) * 10,
        now,
      );
    }

    await transaction.run(
      `
        INSERT INTO funeral_information (
          id, memorial_id, funeral_date, funeral_time, venue, church_venue,
          burial_location, wake_details, thanksgiving_date,
          thanksgiving_time, thanksgiving_venue, reception_details,
          dress_code, programme_url, flyer_url, livestream_url,
          rsvp_phone, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      randomUUID(),
      memorialId,
      "2026-10-30",
      null,
      "Family compound, Otolo, Nnewi",
      "Catholic Church of the Holy Spirit, Omole Phase 1",
      "Family compound, Nnewi",
      "Wake and lying-in-state will take place on the day of the burial.",
      "2026-11-01",
      null,
      null,
      null,
      "Burial Ankara",
      null,
      null,
      null,
      "08061176503",
      now,
    );
  });
}
