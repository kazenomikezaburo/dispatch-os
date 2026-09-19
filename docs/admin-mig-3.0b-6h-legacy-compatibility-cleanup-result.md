# ADMIN-MIG-3.0B-6H — Legacy Compatibility & Cleanup

## Status

`ADMIN-MIG-3.0B-6H: COMPLETE`

## Classification

| Legacy surface | Classification | Result |
| --- | --- | --- |
| `/admin/pre-shift` | Safe redirect | Parses and allowlists the legacy query, then redirects to `/admin/shifts/pre-shift`. |
| `/admin/day-of` | Safe redirect | Parses and allowlists the legacy query, then redirects to `/admin/shifts/day-of`. |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/new` | Safe redirect | Validates the explicit UUID route parameters and redirects to `/admin/shifts/new?projectId=...&jobId=...`. The canonical page remains responsible for authorization and project/job relationship validation. |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new` | Safe redirect | Uses the same validated canonical create URL; no duplicate editor remains. |
| Shift detail `tab=assignments` / `tab=confirmations` | Retained compatibility | Existing authorized canonicalization remains in the Shift Detail route. |
| Project detail `tab=jobs` | Retained compatibility | Existing authorized canonicalization remains in the Project Detail route. |
| `/admin/placement` | Retained compatibility | It is a date-wide workspace. Without an explicit Shift, redirecting to one Shift Detail would guess domain context. Exact-Shift links emitted by current UI now use Shift Detail placement directly. |
| `/admin/workplaces` | Retained compatibility | It remains the shared master-data CRUD surface. A Project-scoped destination cannot be derived safely. |
| `projectWorkflowHrefs` / legacy active-route branches | Retired | The unused project-context legacy route builder and old pathname active checks were removed. |

## Navigation Cleanup

- The canonical shell and workflow tabs contain no links to `/admin/pre-shift` or `/admin/day-of`.
- Exact Shift context now links to Shift Detail placement or the explicit confirmation phase.
- Day-of and Incident drawers retain the exact Shift and assignment IDs when opening canonical detail.
- Shared monitor defaults now use canonical cross-shift paths.
- Incident cache invalidation targets `/admin/shifts/day-of`.

## Context Safety

- No redirect chooses a first, recent, or otherwise inferred Project, Job, or Shift.
- Nested create redirects forward only route-provided, UUID-validated IDs.
- The canonical create page continues to verify that the Job belongs to the selected Project.
- Invalid old route IDs still produce the existing safe not-found behavior.

## Browser Check

The local server was started and an unauthenticated legacy deep link was opened. The existing route guard safely sent it to `/login`. No credentials were entered during this phase. Authenticated redirect behavior is covered by the route-level compatibility test and existing canonical route regressions.

## Verification

- `node scripts/integration/admin-legacy-compatibility-cleanup-test.mjs` — PASS (25 assertions)
- `node scripts/integration/admin-canonical-project-ia-test.mjs` — PASS (36 assertions)
- `node scripts/integration/admin-detail-workflow-tabs-test.mjs` — PASS (24 assertions)
- `node scripts/integration/admin-operation-screen-unification-test.mjs` — PASS (43 assertions)
- `node scripts/integration/admin-canonical-shift-operations-test.mjs` — PASS (32 assertions)
- `node scripts/integration/admin-canonical-shift-detail-placement-test.mjs` — PASS (37 assertions)
- `node scripts/integration/admin-canonical-single-shift-confirmation-test.mjs` — PASS (55 assertions)
- `node scripts/integration/placement-rules-test.mjs` — PASS (39 assertions)
- Scoped ESLint — PASS (0 findings)
- `npx tsc --noEmit` — PASS
- `git diff --check` — PASS (line-ending warnings only)

## Explicit Non-Changes

- Project, Shift, placement, confirmation, DB, RLS, RPC, and Auth behavior were not changed.
- `/admin/placement` and `/admin/workplaces` were not redirected because doing so would require domain-context inference.
- No packages, remote state, commits, or pushes were changed.
- Existing staged, unstaged, and untracked work was preserved.
