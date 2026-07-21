# zurich.tech

The zurich.tech website.

## Stack

- SolidStart for the web app
- Convex for product state and backend functions
- Tailwind CSS for styling
- Cloudflare Workers for deployment

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

## Model

Routes: events, series details, members, news, and settings.

The backend model is scoped to the event site: accounts, members, handles, links, events, series, recurrence, venues, RSVPs, attendance, check-ins, feedback, media, notifications, email, subscriptions, tags, and articles.
