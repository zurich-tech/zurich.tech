# zurich.tech

The website for [zurich.tech](https://zurich.tech), powered by SolidStart, Convex, and Cloudflare.

## Development

Use Bun 1.3.3 and `just`, with a separate development backend.

1. Install dependencies: `bun install --frozen-lockfile`.
2. Configure and start Convex: `bunx convex dev`.
3. Set `VITE_CONVEX_URL` in `.env.local`; for a local backend, also set `VITE_CONVEX_SITE_URL` to its HTTP endpoint.
4. Set backend `SITE_URL` to the frontend origin, normally `http://localhost:3000`.
5. Start the website in another terminal: `just dev`.

Configure services as needed:

- **Sign-in:** Google or GitHub OAuth credentials on the backend.
- **Content:** managed through the site's editors, stored in Convex.
- **Email and payments:** separate provider credentials; review [email controls](convex/mail/README.md) before enabling delivery.
- **Private records and credentials:** never copy production material into the repository.

## Checks

Run checks before submitting changes:

- `just test`: tests.
- `just check`: formatting, type checking and production build.
- [AGENTS.md](AGENTS.md): code conventions.
- [Deployment](scripts/deployment/README.md): release procedures; GitHub Actions deploys `main` after checks pass.
