# Fikra AI

Production foundation for the Fikra AI web application.

This is the project scaffold only — no product features are implemented
yet. It establishes a clean, production-ready base to build on.

## Stack

- [Next.js 15](https://nextjs.org) — App Router
- [TypeScript](https://www.typescriptlang.org) — strict mode
- [Tailwind CSS v4](https://tailwindcss.com)
- [ESLint 9](https://eslint.org) (flat config) + [Prettier](https://prettier.io)
- [Supabase](https://supabase.com) — browser, server, and middleware clients
- Deploy target: [Vercel](https://vercel.com)

## Getting started

Requires Node.js 18.18+ and npm (or pnpm/yarn).

```bash
npm install
cp .env.example .env.local   # fill in Supabase credentials
npm run dev
```

The app runs at http://localhost:3000.

## Scripts

| Command                | Description                              |
| ----------------------- | ----------------------------------------- |
| `npm run dev`           | Start the dev server (Turbopack)          |
| `npm run build`         | Production build                          |
| `npm run start`         | Start the production server               |
| `npm run lint`          | Run ESLint                                |
| `npm run lint:fix`      | Run ESLint with autofix                   |
| `npm run format`        | Format the codebase with Prettier         |
| `npm run format:check`  | Check formatting without writing changes  |
| `npm run type-check`    | Run the TypeScript compiler with no emit  |

## Project structure

```
fikra-ai/
├── src/
│   ├── app/                  # App Router: routes, layouts, global styles
│   │   ├── layout.tsx        # Root layout (fonts, metadata, chrome)
│   │   ├── page.tsx          # Homepage
│   │   ├── not-found.tsx     # Custom 404
│   │   ├── error.tsx         # Global error boundary
│   │   └── globals.css       # Tailwind import + design tokens
│   ├── components/
│   │   └── layout/           # App chrome (header, footer, ...)
│   ├── lib/
│   │   ├── supabase/         # Browser / server / middleware clients
│   │   └── utils.ts          # Shared helpers (cn, ...)
│   └── types/                # Shared TypeScript types
├── public/                   # Static assets
├── middleware.ts             # Supabase session refresh
├── .env.example
├── eslint.config.mjs
├── .prettierrc.json
├── postcss.config.mjs
├── next.config.ts
└── tsconfig.json
```

## Environment variables

See `.env.example`. At minimum, set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`SUPABASE_SERVICE_ROLE_KEY` is server-only and should never be exposed to
the client or committed to source control.

## Deployment (Vercel)

1. Push this repository to GitHub.
2. Import the repo in [Vercel](https://vercel.com/new).
3. Add the environment variables from `.env.example` in the Vercel project
   settings.
4. Deploy — no additional configuration is required; the default build
   command (`next build`) and output are used as-is.

## Conventions

- Path alias `@/*` resolves to `src/*`.
- Components live under `src/components`, grouped by concern
  (`layout/`, and future groups like `ui/`, `features/`).
- Server-only code (Supabase server client, middleware helper) is kept
  separate from browser-safe code.
- Run `npm run lint` and `npm run format:check` before committing;
  CI should fail the build on either.

## Status

Foundation only. No product features, routes beyond the homepage, or
database schema have been added yet.
