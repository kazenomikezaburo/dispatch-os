# RLS automated tests

> **LOCAL/TEST ENVIRONMENT ONLY.** Never run `supabase/seed.sql` or this test
> suite against a production Supabase project. Every identity and business
> record is fictional and uses a fixed test UUID.

## What this suite does

The suite applies real PostgreSQL RLS by switching to `authenticated` or
`anon` and setting `request.jwt.claims` for Worker A/B/C, Manager A, System
Admin, and anon. Assertions never use `service_role` to decide outcomes.

Successful mutation assertions deliberately raise and catch a private test
exception, which rolls the mutation back before recording the result. This
keeps the fixed seed reusable. A denied mutation passes only when PostgreSQL
returns `42501` or RLS makes it affect zero rows; unrelated constraint and SQL
errors fail the test.

`setup.sql` creates a temporary-purpose `test_rls` schema in the local test
database. The runner drops it after a successful run. If a test fails, the
schema remains so `test_rls.results` can be inspected.

The setup also grants table-level DML privileges to `authenticated` and `anon`
inside the disposable test database. This is deliberate: without those grants,
a SQL permission error could be mistaken for an RLS denial. RLS remains enabled
and every allow/deny result is still decided by the policies. These grants are
test setup, not a production migration.

## Prerequisites

- Docker Desktop (or another Docker-compatible engine) running
- Supabase CLI
- A PostgreSQL `psql` client for the command below

Do not install these automatically as part of the project. No npm package is
required by the test suite.

## Run locally

From the repository root:

```powershell
supabase start
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" `
  -v ON_ERROR_STOP=1 `
  -f "supabase/tests/run_rls_tests.sql"
```

`supabase db reset` applies `001_initial_schema.sql`, then
`002_rls_policies.sql`, and finally the local-only `supabase/seed.sql`.

The runner prints every Test ID with Actor, Action, Target, Expected, Actual,
and PASS/FAIL, followed by an aggregate `RLS TEST RESULT`. Any failure raises a
PostgreSQL exception, so the process exits non-zero.

## Test-only Auth users

`supabase/seed.sql` directly inserts minimal rows into `auth.users`. This is
appropriate only for the local/test database because tests simulate JWT
claims and do not perform password login. Production or shared test systems
that need real login flows should create users with the Supabase Auth Admin
API instead, using credentials scoped exclusively to that non-production
environment.

## Safety

- No production migration contains test data.
- No real name, phone number, LINE ID, or staff number is used.
- Fixed IDs and `TEST_` names make test records recognizable.
- The suite does not disable RLS or add policies.
- It never runs `db push` or contacts a remote Supabase project.
