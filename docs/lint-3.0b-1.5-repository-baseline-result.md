# LINT-3.0B-1.5 Repository ESLint Baseline Result

## Status

`LINT-3.0B-1.5: COMPLETE`

`ADMIN-UI-3.0B-1: COMPLETE`

`ADMIN-UI-3.0B-2: READY`

## Existing Failure

The measured repository-wide ESLint baseline failed with 187 findings:

- `scripts/integration/auth-fixtures.ts`: 1
  `@typescript-eslint/ban-ts-comment` error for `@ts-ignore`.
- `supabase/.temp/start-secrets/**`: 186 findings in a generated Edge Runtime
  bootstrap source file.

The Admin UI change set itself already passed focused ESLint.

## Generated File Audit

`supabase/.temp` contains CLI-maintained local state such as CLI/service version
markers, project refs, pgdelta cache, pooler data, and `start-secrets`. The
repository's existing `supabase/.gitignore` explicitly ignores `.temp`, and
`git check-ignore` resolves files below it to that rule. No file below
`supabase/.temp` is tracked by Git.

This establishes that `supabase/.temp/start-secrets/**` is local Supabase CLI
output rather than repository-authored Edge Function source.

The directory and its contents were not edited, formatted, deleted, or used as
a disposable way to make lint pass.

## ESLint Ignore Change

The flat config's existing `globalIgnores` list now includes exactly:

```text
supabase/.temp/**
```

The ignore does not cover `supabase/**`, migrations, functions, scripts, or any
product source.

## auth-fixtures Fix

The explicit `.ts` import suffix is required by the Node native TypeScript
loader used for the integration scripts, while the repository TypeScript
configuration intentionally does not enable `allowImportingTsExtensions`.

An attempted proper compiler-option solution was rejected during verification
because it made 47 existing, intentional import-suffix `@ts-expect-error`
directives unused and broke the TypeScript baseline. The option was fully
removed.

The original one-line `@ts-ignore` was therefore replaced by a one-line
`@ts-expect-error` with its existing concrete reason. Import path, fixture data,
client construction, authentication, user updates, roles, cleanup, credentials
handling, and runtime behavior are unchanged.

## Rule Preservation

- `@typescript-eslint/ban-ts-comment` remains enabled.
- TypeScript linting remains enabled.
- Product source and all repository scripts remain linted.
- Supabase migrations and repository-authored Supabase source remain linted.
- No ESLint rule was disabled or reduced in severity.
- No broad ignore was added.

## Verification

- Repository-wide ESLint (`npm run lint`): PASS, 0 findings.
- TypeScript (`npx tsc --noEmit`): PASS.
- Production build (`npm run build`, process-only Local Supabase public env):
  PASS.
- Admin Shell focused test: PASS, 11 assertions.
- `git diff --check`: PASS.
- `supabase/.temp/**` Git status: no tracked or untracked changes reported
  because it remains the existing ignored generated directory.

## Files Changed

- `eslint.config.mjs`
- `scripts/integration/auth-fixtures.ts`
- `docs/lint-3.0b-1.5-repository-baseline-result.md`

## Explicit Non-Changes

- Admin UI unchanged
- Worker unchanged
- DB schema/RLS/RPC unchanged
- Auth architecture and runtime semantics unchanged
- Packages and lockfile unchanged
- Supabase generated files unchanged
- Remote unchanged
- Commit/push: 0
- Existing staged, unstaged, and untracked work preserved
