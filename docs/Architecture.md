# Architecture

## Stack

- Framework: Next.js App Router
- Language: TypeScript
- Styling: Tailwind CSS
- Database target: PostgreSQL
- ORM target: Prisma
- Media storage target: Cloudflare R2 or S3-compatible storage
- AI target: OpenAI API
- Hosting target: Cloudflare Workers (`travelos2.chao-jason.workers.dev`) as the public storefront origin; Vercel (`travelos2-63r3`) remains a cold spare. See `docs/cloudflare-hosting.md`.

## Boundaries

- `app/` contains routes and route-level UI.
- `components/` contains reusable UI components.
- `lib/` contains data access, formatting, validation, and service helpers.
- `prisma/` will contain schema and migrations once database work begins.
- `docs/` is the source of truth for product, architecture, tasks, and rules.

## Strategy

Start with typed local seed data for UI work. Introduce database, authentication, media storage, and AI only when tasks call for them.
