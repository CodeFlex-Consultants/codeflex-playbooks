---
name: codeflex-nextjs
version: 1.0.0
last_reviewed: 2026-09-17
description: >
  CodeFlex engineering standards for Next.js applications.
  Use when building with Next.js, including App Router, data fetching,
  server components, API routes, optimization, and deployment.
---
# Next.js

These rules are mandatory whenever this Skill applies. They express
CodeFlex's baseline expectations for Next.js code. Where a configured
client or repository standard explicitly supersedes one of these rules,
the resolved override takes precedence; rules marked non-overridable
must not be bypassed automatically.

## NEXT-001 — App Router for new projects

Use the App Router (`app/` directory) for all new Next.js projects. The
Pages Router (`pages/` directory) is legacy. Migrate existing Pages
Router projects to App Router when practical.

## NEXT-002 — Server Components by default

All components in `app/` are Server Components by default. Use Client
Components (`'use client'`) only when you need interactivity, browser
APIs, or React hooks. Keep the client boundary as low as possible.

## NEXT-003 — Data fetching in Server Components

Fetch data in Server Components using `async/await` directly. Do not use
`useEffect` or client-side fetching for initial page data. Use
`fetch()` with caching options or direct database queries.

## NEXT-004 — Route Handlers for API routes

Use Route Handlers (`route.ts`) in the `app/` directory for API
endpoints. Export HTTP method functions: `GET`, `POST`, `PUT`, `DELETE`.
Use `NextRequest` and `NextResponse` for type-safe request/response
handling.

## NEXT-005 — Static generation for static content

Use `generateStaticParams` for dynamic routes with known params at build
time. Use `export const dynamic = 'force-static'` for fully static
pages. Prefer static generation over server-side rendering for
content that doesn't change per request.

## NEXT-006 — Image optimization with next/image

Always use `next/image` instead of `<img>`. Specify `width` and `height`
or use `fill` with a sized parent. Configure `domains` or `remotePatterns`
in `next.config.js` for external images. Use `priority` for above-the-fold
images.

## NEXT-007 — Link component for navigation

Use `next/link` for all internal navigation. Use `prefetch` for
frequently accessed routes. Avoid `<a>` tags for internal links. Use
`useRouter` for programmatic navigation in Client Components.

## NEXT-008 — Error boundaries and loading states

Implement `error.tsx` for error boundaries and `loading.tsx` for loading
states in route segments. Use `global-error.tsx` for root-level errors.
Provide meaningful fallback UI and recovery options.

## NEXT-009 — Metadata for SEO

Use the `metadata` API or `generateMetadata` function for SEO. Define
`title`, `description`, `openGraph`, and `twitter` metadata. Use
`robots`, `sitemap`, and `manifest` files for crawlers.

## NEXT-010 — Environment variables

Use `NEXT_PUBLIC_` prefix for client-accessible environment variables.
Server-side environment variables are private by default. Use
`env.mjs` or `env.ts` with validation (e.g., `@t3-oss/env-nextjs`).

## Additional guidance

For App Router patterns, layouts, parallel routes, and intercepting
routes, read: `references/app-router-patterns.md`

For data fetching, caching, revalidation, and server actions, read:
`references/data-fetching.md`

For optimization, image optimization, font optimization, and bundle
analysis, read: `references/optimization-and-performance.md`

## Canonical numbers and sources of truth

- **Router** — App Router for new projects (`NEXT-001`).
- **Components** — Server Components by default (`NEXT-002`).
- **Data fetching** — Server-side in Server Components (`NEXT-003`).
- **API routes** — Route Handlers in `app/` (`NEXT-004`).
- **Images** — Always use `next/image` (`NEXT-006`).
- **Navigation** — Always use `next/link` (`NEXT-007`).
