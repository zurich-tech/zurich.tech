# zurich.tech

The zurich.tech website.

## Stack

- SolidStart for the web app
- Convex for product state and backend functions
- Tailwind CSS for styling
- Cloudflare Workers for deployment
- Cloudflare R2 for public media

## Commands

```sh
just dev
just check
```

## Convex

The website reads from Convex. There is no frontend seed module.

```sh
bunx convex dev
bunx convex run seed:run
```

Set `VITE_CONVEX_URL` for local development.
The deployment workflow receives the production URL from Convex while building the site.
Missing Convex configuration fails loudly.

The archive import is explicit and idempotent.
Run it once against production after deploying the schema:

```sh
bunx convex run --prod seed:run
```

## Photos

The reviewed event photo selections live in `scripts/photos.ts`.
The importer reads Apple Photos or attributed public sources, strips metadata, and writes WebP images under `/tmp/zurich-tech-photos`.
Full images are bounded to 1600 pixels and grid thumbnails to 800 pixels.

```sh
just photos --export-only
just photos --upload-only
just photos --upload-only --prod
```

Uploads require ImageMagick and an authenticated Wrangler session.
R2 serves immutable objects from `media.zurich.tech`, while Convex stores event ownership, order, dimensions, alternative text, and captions.

## Model

Routes: events, members, news, and settings.

The backend model is scoped to the event site: accounts, members, handles, links, events, venues, RSVPs, attendance, check-ins, feedback, media, notifications, email, subscriptions, tags, and articles.
