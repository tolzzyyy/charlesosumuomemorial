export type Memorial = {
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

export type TimelineEvent = {
  id: string;
  eventYear: number | null;
  eventDate: string | null;
  title: string;
  location: string | null;
  description: string;
  sortOrder: number;
};

export type Favourite = {
  id: string;
  category: string;
  value: string;
  sortOrder: number;
};

export type Funeral = {
  funeralDate: string | null;
  funeralTime: string | null;
  venue: string | null;
  churchVenue: string | null;
  burialLocation: string | null;
  wakeDetails: string | null;
  thanksgivingDate: string | null;
  thanksgivingTime: string | null;
  thanksgivingVenue: string | null;
  receptionDetails: string | null;
  dressCode: string | null;
  programmeUrl: string | null;
  flyerUrl: string | null;
  livestreamUrl: string | null;
  rsvpPhone: string | null;
};

export type MemorialMedia = {
  id: string;
  mediaType: "image" | "video" | "document";
  url: string;
  altText: string | null;
  caption: string | null;
  isFeatured: boolean;
  sortOrder: number;
};

export type Tribute = {
  id: string;
  name: string;
  relationship: string;
  message: string;
  createdAt: string;
};

export type MemoryPhoto = {
  id: string;
  contributorName: string;
  caption: string | null;
  createdAt: string;
  image: {
    id: string;
    url: string;
    altText: string | null;
  };
};

export type MemorialData = {
  memorial: Memorial;
  timeline: TimelineEvent[];
  favourites: Favourite[];
  funeral: Funeral | null;
  media: MemorialMedia[];
  missingFields: string[];
};

const apiOrigin = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export function apiUrl(path: string): string {
  return `${apiOrigin}${path}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(body.error?.message ?? "The request could not be completed.");
  }

  return body;
}

export async function getMemorial(signal?: AbortSignal): Promise<MemorialData> {
  const response = await fetch(apiUrl("/api/v1/memorials/memorial"), { signal });
  const body = await parseResponse<{ data: MemorialData }>(response);
  return body.data;
}

export async function getTributes(signal?: AbortSignal): Promise<Tribute[]> {
  const response = await fetch(
    apiUrl("/api/v1/memorials/memorial/tributes?limit=100"),
    { signal },
  );
  const body = await parseResponse<{ data: Tribute[] }>(response);
  return body.data;
}

export type TributeReceipt = {
  id: string;
  status: "pending" | "approved";
  createdAt: string;
};

export type TributeSubmission = {
  name: string;
  relationship: string;
  email?: string;
  message: string;
  website?: string;
};

export async function submitTribute(submission: TributeSubmission): Promise<TributeReceipt> {
  const response = await fetch(apiUrl("/api/v1/memorials/memorial/tributes"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  const body = await parseResponse<{ data: TributeReceipt }>(response);
  return body.data;
}

export type MemoryPhotoReceipt = {
  id: string;
  status: "pending" | "approved";
  createdAt: string;
  photo: MemoryPhoto | null;
};

export async function getMemoryPhotos(signal?: AbortSignal): Promise<MemoryPhoto[]> {
  const response = await fetch(
    apiUrl("/api/v1/memorials/memorial/memory-photos?limit=100"),
    { signal },
  );
  const body = await parseResponse<{ data: MemoryPhoto[] }>(response);
  return body.data;
}

export async function submitMemoryPhoto(formData: FormData): Promise<MemoryPhotoReceipt> {
  const response = await fetch(apiUrl("/api/v1/memorials/memorial/memory-photos"), {
    method: "POST",
    body: formData,
  });
  const body = await parseResponse<{ data: MemoryPhotoReceipt }>(response);
  return body.data;
}
