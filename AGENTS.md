<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Dispatch OS Rules

- Stack: Next.js 16 App Router + TypeScript + Tailwind + Supabase/PostgreSQL/Auth.
- Default to Server Components; use `"use client"` only when interaction or browser APIs require it.
- Put reads/data access in `lib/*`, writes in Server Actions, and keep business logic out of UI components.
- Never bypass RLS, expose `service_role`/secrets, trust client-side roles, or weaken security tests.
- `public.profiles.account_type` is the source of truth for roles; enforce route guards server-side and security with RLS.
- Use new migrations for DB changes; never rewrite applied migrations or modify remote Supabase without explicit instruction.
- For UI work, consult only relevant sections of `docs/dispatch-os-ui-ux-v1.md` and `docs/dispatch-os-ui-patterns-v1.md`; do not change DB/domain/security rules.
- Prefer the smallest scoped change; avoid unrelated refactors, file moves, dependencies, or feature additions.
- Use Zod/server-side validation, avoid `any`, preserve existing behavior, and prevent N+1 queries.
- Run only checks relevant to changed code plus `git diff --check`; avoid full test/build runs unless necessary. Report changed files, verification, and blockers concisely.