# Tribute memorial

Responsive React/Tailwind memorial website and API. It presents Charles'
life timeline, favourites, funeral information and photographs, alongside a
community Memory Wall with moderated testimonials and photos.

## Run locally

Requirements: Node.js 24+ and npm.

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev
```

The website starts at `http://localhost:5173` and the API at
`http://localhost:4100`. The default memorial slug is `memorial`.

Before using any admin route, replace `ADMIN_API_KEY` with a long, random
secret. Admin requests send the secret in the `x-admin-key` header. Never put
that key in the public React application; use it only in a protected admin
tool or server-side environment.

Testimonials and community photo memories publish immediately by default. Set
`MODERATE_TRIBUTES=true` if the family prefers to review submissions first;
the admin routes can then approve or reject each pending entry.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/memorials/memorial` | Memorial, timeline, favourites, funeral, and media |
| `GET` | `/api/v1/memorials/memorial/tributes` | Approved public tributes |
| `POST` | `/api/v1/memorials/memorial/tributes` | Submit a text-only testimonial |
| `GET` | `/api/v1/memorials/memorial/memory-photos` | Approved community Memory Wall photos |
| `POST` | `/api/v1/memorials/memorial/memory-photos` | Submit a community photo memory |
| `GET` | `/api/v1/memory-photo-images/:id` | View an approved Memory Wall photo |
| `POST` | `/api/v1/memorials/memorial/rsvps` | Submit a private RSVP |
| `GET` | `/api/v1/admin/memorials/memorial/tributes` | Review all tributes |
| `PATCH` | `/api/v1/admin/tributes/:id` | Approve or reject a tribute |
| `GET` | `/api/v1/admin/memorials/memorial/memory-photos` | Review all photo memories |
| `PATCH` | `/api/v1/admin/memory-photos/:id` | Approve or reject a photo memory |
| `GET` | `/api/v1/admin/memory-photo-images/:id` | Privately preview a pending photo |
| `GET` | `/api/v1/admin/memorials/memorial/rsvps` | View private RSVPs |

Pagination endpoints accept `limit` and `offset`. The admin tribute and photo
memory endpoints also accept `status=pending`, `status=approved`, or
`status=rejected`.

Testimonial submissions are JSON and accept `name`, `relationship`, `message`,
and optional `email`; they do not accept images. Photo-memory submissions use
`multipart/form-data` with required fields `contributorName` and `image`, plus
an optional `caption`. JPEG, PNG, WebP, and GIF files up to 8 MB are accepted.
Pending photos cannot be viewed through the public image route.

## Draft data

Only details explicitly supplied by the client were seeded. These items still
need confirmation before publication:

- Preferred name
- Exact date of birth and date of passing
- Exact opening memorial statement
- Funeral time
- Thanksgiving time and venue
- Reception details
- Funeral programme, flyer, and livestream files/links
- Whether “Burial Ankara” is the intended dress-code wording

The supplied PDF's 17 photographs are optimized into the web gallery. The
supplied Word document is an information request template, not completed
memorial content.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

## Production deployment

The React site is configured for Vercel from the repository root. Set
`VITE_API_URL` in the Vercel project to the public URL of the API before the
production build.

The API currently uses SQLite and local disk uploads. Deploy it to a host with
persistent storage, or migrate the database and photo uploads to managed
storage before using the public submission forms in production. Do not deploy
the writable SQLite database or upload directory inside a Vercel Function;
those files would not be durable across function instances.
