# Data API security integration tests

These tests are **local Supabase only**. They exercise the real path:

`supabase-js → Auth JWT → http://127.0.0.1:54321 → PostgREST → GRANT → RLS → constraints`

They do not connect to a remote project and must never be pointed at one.

## Auth fixtures

`supabase/seed.sql` creates fixed `auth.users` rows for PostgreSQL RLS tests,
but its placeholder password hash cannot be used with `signInWithPassword`.
`auth-fixtures.ts` therefore uses the local service-role key only during setup
to call `auth.admin.updateUserById` and set the fictional password
`TestPassword123!`. The fixed UUIDs remain unchanged and continue to match
`public.profiles` and `public.workers`.

Before that Admin API call, the fixture runs `psql` inside the fixed local
Docker container `supabase_db_dispatch-os` to normalize nullable GoTrue token
columns to empty strings for these five IDs only. GoTrue v2.195.0 cannot load
the minimal seed rows while those token columns are NULL. This local-only
normalization is deliberately kept out of `seed.sql` and production migrations.

The service-role client is discarded after fixture preparation. Worker,
Manager, System Admin, and anon test operations all use the anon key. Each
authenticated actor calls `signInWithPassword` and uses its returned session
JWT. The URL guard refuses anything other than localhost/127.0.0.1.

## Run

PowerShell, from the repository root:

```powershell
npx supabase start
npx supabase db reset

$status = npx supabase status -o env
$env:SUPABASE_URL = "http://127.0.0.1:54321"
$env:SUPABASE_ANON_KEY = (($status | Select-String '^ANON_KEY=').Line -replace '^ANON_KEY="?','' -replace '"$','')
$env:SUPABASE_SERVICE_ROLE_KEY = (($status | Select-String '^SERVICE_ROLE_KEY=').Line -replace '^SERVICE_ROLE_KEY="?','' -replace '"$','')

node --experimental-strip-types scripts/integration/api-security-test.ts

# Successful Data API mutations are intentionally cleaned up here.
npx supabase db reset
```

No npm package is added. Node.js 22+ executes the erasable TypeScript syntax
with `--experimental-strip-types`.

## Data isolation

The suite starts from `db reset`, uses unique UUIDs for successful inserts,
and requires a final `db reset`. Data API operations cannot share the SQL
rollback strategy used by `supabase/tests`, so the final reset is mandatory.

Errors record HTTP status, PostgREST/PostgreSQL code, message, row count, and a
best-effort layer classification (`AUTH`, `GRANT`, `RLS`, or `CONSTRAINT`). A
constraint error never counts as a successful security denial. Any failed test
sets a non-zero process exit code.
