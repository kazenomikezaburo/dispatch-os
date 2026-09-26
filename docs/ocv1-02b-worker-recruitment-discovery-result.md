# OCV1-02B — Worker Recruitment Discovery & Detail Result

`OCV1-02B: COMPLETE`

## Delivered

- Added `/worker/recruitment` and `/worker/recruitment/[shiftId]` as authenticated Worker-only, server-rendered read surfaces.
- Added the bounded `get_own_recruitment_shifts` projection. It derives the Worker from `auth.uid()` / `private.current_worker_id()`, accepts no Worker or Branch identity, and serves each list or detail request with one RPC call.
- Publication follows OCV1-02A: same-Branch Worker, Project and Shift `recruiting`, pre-start, and no active own Assignment. Deadline, canonical active-Assignment capacity, own Application state, structured requirements, own Availability, preferences, and own cross-Shift conflict facts are evaluated server-side.
- Cards and detail expose only the authorized schedule, workplace, preparation, conditions/pay, safe requirements, deadline, remaining Assignment-capacity snapshot, Application state, and controlled eligibility reasons.
- The application CTA is disabled and non-mutating. No Application or Assignment write path was introduced.

## DB / RLS verification

The local migration chain through `20260926174808_fix_ocv1_worker_recruitment_pagination_order.sql` is applied. The dedicated local projection suite passed **26/26**, including its cleanup assertion.

| Area | Evidence |
| --- | --- |
| Publication and isolation | Same-Branch recruiting Shift visible; Project/Shift lifecycle gates, started Shift, closed Project, and foreign Branch excluded. |
| Availability | Explicit available is actionable; unknown and consultable are warnings; explicit unavailable blocks with a safe reason; preference mismatch remains a non-blocking warning. |
| Requirements | Missing Skill, missing Qualification, and inactive requirement master block without exposing credential details. |
| Conflict | Other-Shift Assignment conflict blocks with only `other_scheduled_shift_overlaps`; the conflicting Shift and Assignment are not returned. |
| Application | `none`, `applied`, `accepted`, `rejected`, and `withdrawn` project to the frozen states. Multiple Applications do not consume capacity. |
| Capacity | Full Shift remains visible as `capacity_full` with remaining capacity 0. Capacity is derived only from canonical active Assignments. |
| Assignment | An active own Assignment excludes the Shift from discovery and direct recruitment detail returns a safe not-found result. |
| Deadline | A passed application deadline remains visible as `deadline_passed`. |
| Security | Anonymous execution denied; Manager and System Admin receive no Worker projection; missing/foreign detail is an indistinguishable empty result. |
| Redaction | No other Worker data, conflicting Assignment detail/ID, credential number, raw Admin Candidate payload, Worker/Branch ID, authorization internals, or Placement/Admin-only fields were present. |

`npx supabase db lint --local --schema public,private --level warning` returned no schema errors. `npx supabase db advisors --local --type security` returned no issues.

## Authenticated browser verification

Authenticated Chrome QA used the existing local Worker test convention and dedicated OCV1 fixtures.

| Surface | 1440 × 900 | 1280 × 900 | 390 × 844 |
| --- | --- | --- | --- |
| `/worker/recruitment` | PASS, overflow 0 | PASS, overflow 0 | PASS, overflow 0 |
| `/worker/recruitment/[shiftId]` | PASS, overflow 0 | PASS, overflow 0 | PASS, overflow 0 |

Verified in the rendered Worker UI:

- eligible and warning listings;
- explicit unavailable, missing requirement, and conflict explanations;
- `applied`, `accepted_waiting_assignment`, `rejected`, and `withdrawn` states;
- full capacity, deadline passed, and preference warning;
- already-assigned exclusion;
- foreign Branch and no-longer-published direct URLs returning safe not-found output without resource leakage;
- pay, transport, work/preparation information, safe manual/map links, deadline, and remaining capacity on detail;
- disabled, non-mutating application CTA;
- keyboard focus advances through navigation controls;
- browser console, React, and hydration errors: **0** after the scoped fixes.

The list returns at most 24 items, exposes `hasMore`, and uses deterministic `(starts_at, id)` pagination. List and detail each perform one bounded RPC read; no per-Shift query loop is present.

## Regression and static verification

| Check | Result |
| --- | --- |
| STAFF-2F Candidate Eligibility | PASS, 22/22 |
| Availability / Work Conditions | PASS, 41/41 |
| Structured Job requirements | PASS, 33/33 |
| Candidate Assignment | PASS, 31/31 |
| OCV1 Worker recruitment DB/RLS | PASS, 26/26 |
| Focused ESLint | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS; 31 static pages generated and both recruitment routes included |
| `git diff --check` | PASS |

The older all-in-one RLS harness reached **145/148** on the shared non-reset local database. Its three failures were pre-existing fixture collisions/count assumptions (`RLS-PJ-005`, duplicate Application in `RLS-APP-003`, and duplicate pre-shift confirmation in `RLS-PSC-001`), not OCV1 authorization failures. The temporary test schema was removed. The focused Worker projection/RLS suite, authenticated Worker browser session, schema lint, and security advisor all passed.

## Scoped defects fixed during QA

1. The original RPC attempted to read `candidate` outside its CTE statement. The pagination metadata is now computed inside the same statement.
2. Canonical preference mismatch was not surfaced as the required non-blocking warning. It now produces `available_with_warning` with the controlled `preference_not_matched` reason.
3. The bounded page applied `LIMIT` without ordering the final shaped rows, which could hide a full Shift and overlap pages. The final page is now ordered by `(starts_at, id)` before `LIMIT`.
4. Nullable wage/transport keys omitted by the JSON projection reached the UI as `undefined`; display formatting now treats both `null` and `undefined` as unconfigured.

These are projection/read-presentation corrections only. They do not change OCV1-02A, STAFF-2F, Application, or Assignment semantics.

## Fixture cleanup

Dedicated `b26*` browser/DB fixtures were removed after QA. A direct count across their Shift, Assignment, Application, Availability, Job, Project, Workplace, Skill, and Qualification identifiers returned **0 remaining rows**. Existing business fixtures were preserved.

## Explicit non-changes

- No `db reset`, `db push`, `--linked`, or remote Supabase operation.
- No package, font configuration, schema-object rename, or existing migration rewrite.
- No RLS/grant weakening and no service-role application path.
- No Application mutation, Assignment mutation, reservation/hold, Notification, LINE, ranking/AI, or Open Shift second model.
- No change to OCV1-02A, completed STAFF/Application/Assignment contracts, or canonical capacity ownership.
- No commit or push.
- `.tmp-notif-2c-local.*` was not touched.
