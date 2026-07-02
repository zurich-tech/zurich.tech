# zurich.tech

The zurich.tech website.

## Stack

- SolidStart for the web app
- Convex for product state and backend functions
- Tailwind CSS for styling
- Cloudflare Workers for deployment
- Resend for email delivery

## Commands

```sh
just dev
just check
just deploy
```

## Convex

The website reads from Convex. There is no frontend seed module.

```sh
bunx convex dev
bunx convex run seed:run
```

Set `VITE_CONVEX_URL` for local development and CI/deploy environments. Without
that value, public queries return empty data and mutations throw a configuration
error.

## Model

Routes: events, series, members, blog, settings, staff.

The backend model is scoped to the event site: accounts, members, handles, links,
events, series, recurrence, venues, RSVPs, attendance, check-ins, feedback, media,
notifications, email, subscriptions, tags, and posts.
