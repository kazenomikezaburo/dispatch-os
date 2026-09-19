# ADMIN-DATA-3.0B-6B Project History Foundation

## Status

`ADMIN-DATA-3.0B-6B: COMPLETE`

`ADMIN-UI-3.0B-6C: READY`

The Project History foundation is implemented and its focused suite passes 36/36. ADMIN-QA-3.0B-6B.1 reconciled the two pre-existing test-baseline failures without changing product code, Project History, or database behavior; the full required regression gate is now green.

## Goal

Provide durable, append-only, business-facing Project configuration history for Project, Job, and Shift mutations, together with an authorized stable read contract. No History UI is included.

## Persistence Design

`public.project_history_events` stores events recorded after migration installation. Project/Job/Shift `AFTER INSERT OR UPDATE` triggers emit history in the same transaction as the business mutation. There is no historical backfill and no generic client-write function.

## Table

- Identity: generated `bigint id`.
- Scope: required `project_id`, with `ON DELETE RESTRICT` to retain history and match the absence of a Project physical-delete workflow.
- Time: `created_at`, defaulting to `statement_timestamp()`.
- Actor: nullable retained profile reference plus required display-name snapshot.
- Event/target: checked finite `event_type`, checked `target_type`, UUID target ID, label snapshot, and event/target compatibility constraint.
- Payload: required JSON object with event-specific allowlisted keys.
- Read index: `(project_id, created_at DESC, id DESC)`.
- Immutability: direct grants are absent and unconditional UPDATE/DELETE guard triggers reject mutation.

Target IDs intentionally have no Job/Shift foreign keys, so later target removal does not erase history. Actor profile deletion uses `ON DELETE SET NULL`; the display snapshot remains.

## Event Types

- Project: `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_STATUS_CHANGED`
- Job: `JOB_CREATED`, `JOB_UPDATED`, `JOB_STATUS_CHANGED`, `JOB_WORKPLACE_CHANGED`
- Shift: `SHIFT_CREATED`, `SHIFT_UPDATED`, `SHIFT_STATUS_CHANGED`

Pure status changes create one status event. A status change mixed with another tracked field creates one `*_UPDATED` event whose `changed_fields` includes `status`. Pure Workplace reassociation creates `JOB_WORKPLACE_CHANGED`; a mixed Job update creates one `JOB_UPDATED` event.

## Project Events

Project creation snapshots label, status, and date range. Updates track name, Client relation, Project type, lifecycle/status, recruitment range, Project date range, and description. Free text is never copied; only its field name is recorded. Timestamp-only/no-op updates produce no event.

## Job Events

Job creation records its safe label, status, and linked Workplace ID/label. Updates use an explicit field allowlist. Free-form description, clothing, belongings, access, meeting, lodging, requirements, recruitment, meal, and manual content is not copied. The Project ID comes from the Job row.

## Shift Events

Shift creation records safe schedule, Job, and Workplace context. Updates track the explicit Shift configuration allowlist. The exact Project is derived inside the trigger through `Shift → Job → Project`; no client Project ID is accepted.

No DELETE trigger or new delete action was added because the current business model exposes no general Job/Shift physical-delete workflow. Existing cancellation is captured as a status transition.

## Workplace Attribution Policy

There is no trigger on `workplaces`. Shared Workplace updates never fan out to all referencing Projects. Project History records Job creation with its Workplace context and explicit Job→Workplace association changes. Inline Workplace creation before Project/Job success creates no Project History event.

## Actor Model

The trigger derives `auth.uid()` and the current `profiles.display_name` in trusted database context. The client cannot supply either value. A database/service maintenance mutation without an Auth user uses explicit `システム` semantics with a null actor reference; an unknown non-null Auth identity is rejected rather than accepted as a client-provided unknown user. Email, phone, credentials, JWT data, and secrets are not stored.

## Payload Policy

Payload is event-specific and allowlisted. Safe status/date/time/entity-label context may be stored. Large or sensitive free text is represented only in `changed_fields`. The migration contains no `to_jsonb(OLD)` or `to_jsonb(NEW)` raw-row dump.

## Atomicity

History is emitted by row-level database triggers within the business INSERT/UPDATE transaction. A failed business mutation creates no event; a transaction rollback removes both mutation and event. Focused verification confirmed `0|0` after rollback. Event count follows committed business mutations; no independent history-side guessing/deduplication is performed.

## Trigger Strategy

- `private.emit_project_history_from_project()` on Projects.
- `private.emit_project_history_from_job()` on Jobs.
- `private.emit_project_history_from_shift()` on Shift Slots.
- Relevant-field comparisons use `IS DISTINCT FROM`.
- `updated_at` alone is ignored.
- Trigger functions use `SECURITY DEFINER`, `search_path = ''`, schema-qualified relations, no dynamic SQL, and revoked direct execution.

`SECURITY DEFINER` is required only so triggers can write the protected history table without granting product roles direct INSERT. Existing business-table RLS remains unchanged.

## RLS

RLS is enabled on the history table. Its defense-in-depth SELECT policy requires an active `manager` or `system_admin` profile and current access to the referenced Project branch. No Worker policy exists. The supported product read path is the narrower RPC, not direct table access.

## Grants / Revokes

- Table privileges: revoked from `PUBLIC`, `anon`, and `authenticated`.
- Identity sequence privileges: revoked from the same roles.
- Trigger/helper execution: revoked from `PUBLIC`, `anon`, and `authenticated`.
- Read RPC: revoked from `PUBLIC` and `anon`; granted only to `authenticated`.
- No INSERT, UPDATE, or DELETE grant and no generic history-write RPC exists.

## Read Contract

`public.list_project_history_events(project_id, limit, before_created_at, before_id)` returns only a safe JSON DTO:

- `id`
- `created_at`
- `actor_display_name`
- `event_type`
- `target_type`
- `target_id`
- `target_label`
- allowlisted `payload`
- `next_cursor`

The RPC is `STABLE SECURITY DEFINER`, pins `search_path = ''`, revalidates active admin identity and Project branch access, and exposes no actor user ID or internal authorization fields. `lib/admin/projects/get-project-history.ts` maps this contract to camel-case server-side types for 6C.

## Pagination

Keyset pagination uses `created_at DESC, id DESC`, default 20 and maximum 50. Both cursor fields are required together. The RPC reads one extra row to determine `next_cursor`; focused verification confirmed ordered, non-overlapping pages.

## Non-disclosure

An inaccessible Project and a nonexistent Project both return the same empty page. Manager foreign-branch access produced zero items; Worker access produced zero items; System Admin retained the existing cross-branch scope. Exact Project attribution and Shift→Job→Project attribution passed.

## Existing Project / No Backfill Policy

The migration performs no INSERT-from-existing-data operation. Existing Project rows receive no fabricated `PROJECT_CREATED` event. Focused verification confirmed zero created events for pre-existing seed Projects. History begins only with real post-migration mutations.

## Project Setup Partial Failure

Verified behavior:

- Project succeeds and optional Job fails: only `PROJECT_CREATED` remains.
- Retrying the Job successfully: exactly one `JOB_CREATED` is added.
- Workplace creation by itself produces no Project event.

Existing Project Setup sequencing, partial-failure behavior, and redirects were not changed.

## Security Review

- Read authorization follows active Admin identity plus existing Project branch scope.
- Manager own branch: PASS; foreign branch: safe empty.
- System Admin cross-branch: PASS.
- Worker: safe empty; no direct table grant.
- Direct authenticated INSERT/UPDATE/DELETE: denied with `42501`.
- Trigger writes are definer-only, fixed-search-path, relation-derived, and not client-callable.
- Actor is server-derived and snapshot-retained.
- Payload excludes raw rows and sensitive/free-form values.
- Unauthorized and nonexistent Project IDs are indistinguishable.
- Existing Project/Job/Workplace/Shift RLS and grants were not relaxed.

The implementation follows current Supabase guidance to combine grants with RLS, pin `search_path` for definer functions, schema-qualify relations, and revoke default function execution. The 2026 Data API default-exposure change does not weaken this design because privileges are explicitly revoked and access is opt-in through the RPC.

## Local DB Verification

- Supabase CLI: local `2.115.0`; update notice to `2.117.0` was observed, with no package update performed.
- Incremental migration: applied successfully with `supabase migration up --local`.
- Local DB reset: not used.
- Migration history: `20260914055840` present locally.
- DB lint at warning level: 0 warnings/errors.
- Focused rollback/authorization/DML checks: PASS.
- Remote mutation and `supabase db push`: 0.

## Tests

New focused suite: `scripts/integration/admin-project-history-foundation-test.mjs`.

Final result: **36/36 PASS**. It covers Project/Job/Shift create/update/status, mixed-update precedence, no-op suppression, Workplace association, exact attribution, actor derivation, payload allowlist, direct-write denial, Worker denial, Manager isolation, System Admin scope, non-disclosure, stable pagination, partial failure/retry, rollback, trigger scope, no fan-out, no raw dump, no backfill, and dedicated fixture cleanup.

Dedicated 6B Project/Job/Shift/History fixture rows after cleanup: **0**.

## Existing Regression

PASS:

- Project Setup: 35 assertions.
- Project Management Hub: 31 assertions.
- Unified Editors: 33 assertions.
- Shift Views: 33/33.
- Placement core schema/security: 26/26.
- Placement editor rules: 13/13.
- Placement rules: 39/39.
- Placement atomic command: 20/20.
- Pre-shift monitor/rules/admin/RLS: PASS, 20/20, 20/20, 16/16.
- Day-of rules/matrix: 17/17, 12/12.
- Admin Attendance: 40/40.
- Attendance Confirmation: 50/50.
- Attendance Revision: 53/53.
- Operational Incident: 47/47.

The initial 6B run was blocked by a Placement test that depended on mutable shared seed rows and an Attendance static assertion coupled to an obsolete literal. ADMIN-QA-3.0B-6B.1 moved the Placement schema fixture into its existing rollback transaction and aligned the Attendance assertion with the already-canonical formal-record semantics. Both suites and all related regression suites now pass.

## Static Verification

- Repository ESLint: PASS.
- TypeScript `npx tsc --noEmit`: PASS.
- Production build: PASS. An initial concurrent invocation encountered the existing Next build lock; the standalone rerun completed successfully.
- `git diff --check`: PASS.
- DB lint: PASS, 0 warnings/errors.

## Files Changed

- `supabase/migrations/20260914055840_project_history_foundation.sql`
- `lib/admin/projects/project-history-types.ts`
- `lib/admin/projects/get-project-history.ts`
- `scripts/integration/admin-project-history-foundation-test.mjs`
- `docs/admin-data-3.0b-6b-project-history-foundation-result.md`

## Explicit Non-Changes

- Project→Job, Job→Workplace, and Job→Shift relations: unchanged.
- Workplace Master domain/table/action/RLS: unchanged.
- Project/Job/Shift business action return, redirect, and error contracts: unchanged.
- Placement, Confirmation, Attendance, and Incident semantics: unchanged and excluded from History triggers.
- Worker UI and Admin History UI: unchanged.
- Auth architecture: unchanged.
- Packages and lockfile: unchanged.
- Figma: unchanged.
- Remote database: unchanged.
- Commit/push: none.
- Existing staged, unstaged, and untracked work: preserved.

## Deferred To 6G

Project-context attribution for an explicit shared Workplace edit. No authenticated generic History-write RPC was added in 6B.

## Remaining Risks

- Maintenance/fixture writes without an Auth user intentionally produce `システム` actor events. Test suites that create Project/Job/Shift rows outside rollback transactions should own and clean their resulting history fixtures.
- 6C must validate/encode cursors at its URL boundary and render only the structured safe DTO.
