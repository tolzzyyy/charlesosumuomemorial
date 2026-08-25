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

The production backend is configured for a free Render web service, with a
free Supabase project providing durable Postgres data and private photo
storage. SQLite and local uploads remain the defaults for local development.

1. Create a Supabase project. In **Connect**, copy the **Session pooler** URI
   (port 5432), and replace its password placeholder with your database
   password. In **Project Settings → API**, copy the project URL and the
   `service_role` key. Keep that key private; never add it to Vercel or the
   browser app.
2. Before deploying Render, optionally import the existing local testimonials
   and uploaded photos into the new, empty Supabase project. Put the three
   Supabase values in `apps/api/.env`, then run:

   ```bash
   npm run migrate:production --workspace @tribute/api
   ```

   The import refuses to run if Supabase already contains a memorial, so it
   cannot overwrite an existing production site.
3. In Render, create a **Blueprint** from this GitHub repository. Render reads
   [render.yaml](./render.yaml) and asks for `DATABASE_URL`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `WEB_ORIGINS`. Set `WEB_ORIGINS` to the
   final Vercel URL and custom domain, separated by commas and including
   `https://`.
4. Deploy the Render service. The API creates its database tables and initial
   memorial data on first startup; it creates the private `memory-photos`
   bucket on the first photo request. Copy the resulting Render URL and confirm
   that `/health` returns `status: ok`.
5. In Vercel, set `VITE_API_URL` to the Render URL (without a trailing slash),
   then redeploy the frontend. Add both the Vercel URL and custom domain to
   Render's `WEB_ORIGINS` whenever either changes.

No production secret belongs in a committed `.env` file. Render's generated
`ADMIN_API_KEY` can be copied from its environment settings when an admin tool
needs it.

On the free plans, Render sleeps after inactivity, so the first API request can
take roughly a minute. Supabase may pause a free project after a week with no
activity. Neither affects persisted testimonials, RSVPs, or photos once the
services wake again.
