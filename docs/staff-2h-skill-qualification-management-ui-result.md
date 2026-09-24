# STAFF-2H — Skill / Qualification Management UI Result

## Status

`STAFF-2H: COMPLETE`

## Existing Contract Audit

- `skills`, `qualifications`, `worker_skills`, `worker_qualifications` remain the canonical sources.
- All six STAFF-2B mutation RPCs are reused. Product UI performs no direct table insert/update/delete.
- Master and holding reads use the existing authenticated SELECT grants and RLS.
- System Admin is re-authorized in Server Actions before every RPC; the database RPC performs the canonical authorization again.
- Manager receives existing own-Branch RLS reads only and no holding mutation controls.

## Implemented Surfaces

### Skill / Qualification Master

- Added `/admin/staff-credentials` and the canonical Admin master navigation entry.
- System Admin-only page with Skill / Qualification tabs, code/name/description search, active totals, active/inactive presentation, create and metadata/lifecycle edit.
- Master code is disabled after creation and is never sent to update RPCs.
- Qualification expiry policy supports `none`, `optional`, and `required` through the canonical RPC.
- No hard delete was added.

### Staff Holdings

- Added `スキル・資格` to the existing Staff detail tabs.
- System Admin can add/update/deactivate Skill holdings and add/update/revoke Qualification holdings through STAFF-2B RPCs.
- Manager can read authorized own-Branch holdings but receives no mutation controls.
- Inactive masters remain visible for historical holdings and are excluded from new-holding selectors.
- Qualification presentation derives the closed UI states `有効`, `開始前`, `期限切れ`, `失効`, and `Master無効` from canonical facts using the Asia/Tokyo calendar date. Candidate/Shift eligibility remains target-Shift based and unchanged.
- Credential numbers are neither read nor displayed by these surfaces.

## Security

- Client input contains only the canonical RPC parameters required by STAFF-2B.
- Role, Branch access, active-master eligibility, and qualification policy are not trusted from the client.
- No service-role browser/product path, RLS change, schema change, or direct holding write was added.
- Foreign-Branch isolation continues to be enforced by existing RLS.

## Browser Verification

- Normal local System Admin password login: PASS after repository local fixture recovery.
- Master navigation, list, type tabs, search, Skill create/edit/deactivate, Qualification create and expiry-policy presentation: PASS.
- Staff detail Skill/Qualification tab and inactive-master new-assignment exclusion: PASS.
- Drawer close and focus contract use the existing shared `Drawer`; keyboard/Escape behavior is unchanged.
- Browser console application/React/hydration errors: 0.
- Browser fixture cleanup: 0.

The browser control surface did not apply its requested viewport override (the reported document viewport remained unchanged), so exact 1440/1280/390 pixel evidence was not treated as authoritative. The implemented layouts use the existing responsive Admin primitives, wrapping grids, and full-width mobile Drawer. Production build includes both new dynamic routes.

## Verification

- focused ESLint: PASS
- `npx tsc --noEmit`: PASS
- production build: PASS
- STAFF-2B persistence/security: `38/38 PASS`
- STAFF-2C requirements: `33/33 PASS`
- Candidate Assignment handoff: `13/13 PASS`
- `git diff --check`: PASS
- local-only STAFF-2H fixture cleanup: `0`

## Job Requirement UI

Structured Job requirement editing was intentionally left unchanged. Adding it safely requires extending the current Job editor/read model and is a distinct follow-up slice; STAFF-2C commands and `jobs.requirements` remain unchanged.

## Files Changed

- `app/actions/staff-credentials.ts`
- `app/admin/staff-credentials/page.tsx`
- `app/admin/workers/[workerId]/page.tsx`
- `components/admin/admin-breadcrumb.tsx`
- `components/admin/admin-nav.ts`
- `components/admin/staff-credentials/credential-master-workspace.tsx`
- `components/admin/workers/worker-credentials.tsx`
- `components/admin/workers/worker-detail-view.tsx`
- `lib/admin/staff-credentials/get-staff-credential-masters.ts`
- `lib/admin/staff-credentials/types.ts`
- `lib/admin/workers/get-worker-detail.ts`
- `lib/admin/workers/worker-rules.ts`
- `lib/admin/workers/worker-types.ts`
- `docs/staff-2h-skill-qualification-management-ui-result.md`

## Explicit Non-Changes

- Skill / Qualification schema and domain rules
- STAFF-2C requirement semantics and `jobs.requirements`
- Candidate eligibility, Assignment, Placement, and Application behavior
- Auth architecture, RLS, grants, and packages
- Remote Supabase
- commit / push
- existing uncommitted work

`STAFF-2H: COMPLETE`
