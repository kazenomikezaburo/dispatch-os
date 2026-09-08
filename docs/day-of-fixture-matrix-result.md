# Phase QA-2.6A.5 実施結果

## Executive Summary
- Fixture Matrix: 9 scenarios covering 10 requested operational facts
- Setup: deterministic local-only setup, idempotent at 34 counted rows
- Cleanup: surgical exact-ID cleanup; final counted rows 0
- Browser states: all 9 scenarios PASS in actual Chrome
- Product changes: one P1 null/cardinality fix in Day-of read mapping
- DB schema: unchanged
- Remote: not accessed

## Sources
- Day-of: `docs/admin-day-of-foundation-result.md`, `lib/admin/day-of/**`
- Attendance: `deriveAdminAttendance`, `lib/admin/attendance/get-attendance.ts`, admin attendance tests
- Pre-shift: schema, RLS, worker/admin fixture and test helpers
- Placement: C1/C2 schema, rules, read-only security tests, `save_shift_placement_plan`
- Fixture helpers: `scripts/dev/setup-dev-auth.ts`, `scripts/integration/auth-fixtures.ts`

## Git State
- Branch: `small-ui-a11y-fix`
- Start: `9f551ab feat: complete placement and break management`
- Existing dirty: UI-2.6A files were preserved
- Changed: setup/test/report plus the scoped Attendance assertion and Day-of P1 fix
- Commit: none
- Push: none

## Environment Safety
- Supabase: local CLI stack only (`127.0.0.1` / `localhost`)
- Local guard: parsed URL requires HTTP and an exact loopback hostname
- `.env.local`: unchanged; its remote values were not used for fixture/dev/build
- process override: local CLI values were scoped to each process
- Remote abort: remote and lookalike host tests PASS
- Credentials logged: none

## Fixture Architecture
- Setup script: `node --experimental-strip-types scripts/dev/setup-day-of-fixtures.ts setup`
- Cleanup: `node --experimental-strip-types scripts/dev/setup-day-of-fixtures.ts cleanup`
- Status: `node --experimental-strip-types scripts/dev/setup-day-of-fixtures.ts status`
- ID strategy: dedicated deterministic `d26a...` UUID namespace and `DAYOF-QA-*` staff codes
- Parent strategy: dedicated Project, Job and Workplace under the existing local Manager A branch
- Time anchor: captured once per setup; all scenario instants derive from it
- Manifest: secret-free JSON on stdout, including scenario, date, IDs, worker, expectation and direct URL

## Scenario Matrix
| Scenario | Date | Assignment | Attendance | Pre-shift | Placement | Expected | Browser |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Scheduled | 2026-09-09 | confirmed | none; future shift | none | none | 勤務前 | PASS |
| Start Missing | 2026-09-08 | confirmed | none; started shift | none | none | 開始未報告 | PASS |
| Late | 2026-09-08 | confirmed | start_work at +15 min | none | none | 勤務中（開始 15分遅れ） | PASS |
| Working | 2026-09-08 | confirmed | start_work only | none | none | 勤務中 | PASS |
| Finished | 2026-09-08 | completed | start_work + end_work | none | none | 勤務終了 | PASS |
| Absent | 2026-09-08 | absent | none | none | none | 欠勤 | PASS |
| No Show | 2026-09-08 | no_show | none | none | none | 無断欠勤 | PASS |
| Pre-shift unavailable | 2026-09-09 | confirmed | none; future shift | can_work=false | none | 要確認：前日確認で勤務不可 | PASS |
| Placement / Break | 2026-09-08 | confirmed | start_work only | none | 受付 segment + planned break | 現在配置：受付 / 予定休憩 | PASS |

## Fixture Relationships
- Branch: existing local Manager A branch
- Project: `DAY-OF QA Matrix`
- Job: `DAY-OF QA Operations`
- Workplace: `DAY-OF QA Workplace`
- Workers / Shifts / Assignments: 9 / 9 / 9, one isolated trio per scenario
- Attendance: 5 raw events; no official record, Arrival, GPS or SOS facts
- Pre-shift: one minimal `can_work=false` response; no comment/contact/private health detail
- Placement: one Plan created through the production atomic RPC, one Position, Segment, Break and Revision

## Time Model
- Tokyo anchor: browser run used UTC `2026-09-08T14:37:33.305Z` (Tokyo 23:37); re-setup proof used `2026-09-08T14:46:42.028Z`
- Relative shift construction: future +180/+360 min; active -120/+180 min; finished -180/-60 min
- Midnight handling: dates are derived per scenario in Asia/Tokyo
- Multi-date: 2026-09-08 and 2026-09-09 in this run
- Overnight: active shifts crossed Tokyo midnight and remained assigned to their start date

## Setup Safety
- First setup: PASS, 34 counted rows
- Second setup: PASS, still 34 counted rows
- Duplicate rows: none in the dedicated namespace
- Crash recovery: setup begins with exact child-to-parent cleanup

## Browser QA
- Scheduled: direct 9/9 Drawer showed `勤務前`
- Start Missing: direct 9/8 Drawer showed `開始未報告`
- Late: direct 9/8 Drawer showed `勤務中（開始 15分遅れ）`
- Working: direct 9/8 Drawer showed `勤務中`
- Finished: direct 9/8 Drawer showed both start/end facts and `勤務終了`
- Absent: direct 9/8 Drawer showed `欠勤`
- No-show: direct 9/8 Drawer showed `無断欠勤`
- Pre-shift unavailable: direct 9/9 Drawer showed submitted/unavailable and attention
- Placement / Break: direct 9/8 Drawer showed current `受付` and the planned break interval

## Filter QA
- Attention: PASS; four 9/8 attention rows, finished excluded
- Scheduled: covered by direct 9/9 state and rule test
- Working: covered by working/late/placement rows and rule test
- Finished: covered by direct state and rule test
- Search / Project / empty result: PASS

## Drawer QA
- Open / State / Placement / Break / Pre-shift: PASS
- Back/Forward: PASS; assignment URL state restored across two scenarios
- Canonical links: Attendance, Placement, Pre-shift, Staff and Shift destinations verified in Drawer accessibility state

## Data Verification
- DB facts: setup/status reported 9 workers, 9 shifts, 9 assignments, 5 events, 1 pre-shift and 1 Plan
- Day-of: all routes returned HTTP 200 and derived existing domain states
- Match: 9/9 expected states matched UI after the P1 mapping fix

## Chrome
- Auth: existing local `TEST Manager A`
- 1440: PASS
- 390: PASS, Placement Drawer readable and actionable
- Console: 0 new warnings/errors during the post-fix scenario tour (development info/HMR logs excluded)
- Network: all visited Day-of requests HTTP 200; no 500 and no client N+1 request burst
- Screenshots: transient desktop/mobile evidence was captured by the browser harness and not retained in the repository

## Attendance 39/40 Investigation
- Existing failure: static query-count assertion expected two `.from()` calls
- Root cause: current intended implementation performs one bounded Assignment query plus three parallel ID-batched Attendance queries
- Production query issue: none; no per-row/N+1 query exists
- Test issue: stale total-count assertion
- Changed: assertion now verifies all three fact tables and their exact `.in("assignment_id", ids)` batching contract
- Final result: 40/40 PASS

## Cleanup
- Command: `node --experimental-strip-types scripts/dev/setup-day-of-fixtures.ts cleanup`
- Removed: exact fixture Plan graph/revision, event/pre-shift facts, assignments, shifts, workers and dedicated parents
- Remaining Fixture Plan / Workers / Shifts / Assignments / Events / Pre-shift: 0 / 0 / 0 / 0 / 0 / 0
- Remaining Placement / Revision: 0 for the dedicated fixture Plan (exact Plan-derived deletion completed)
- Total fixture rows remaining: 0
- Re-setup proof: cleanup 0 -> setup 34 -> cleanup 0 -> status 0

## Tests
- Fixture: 12/12 PASS
- Day-of: 17/17 PASS
- Attendance: 40/40 PASS
- Pre-shift: 20/20 PASS
- Placement: rules 39/39, editor 13/13, atomic command 20/20 PASS
- Security: Placement read-only 28/28 PASS
- Navigation: 24/24 PASS
- Supplemental pre-existing local-data failures: full Data API security run had 106/108 due two duplicate fixture primary keys; Placement core schema helper also met one pre-existing Plan unique collision. No QA-2.6A.5 IDs were involved and no broad reset was performed.

## Validation
- TypeScript: PASS (`npx tsc --noEmit`)
- Build: PASS with process-local Supabase override
- scoped ESLint: PASS
- git diff --check: PASS (existing Windows line-ending notices only)

## Product / Domain Changes
- Day-of product code: minimal P1 fix normalizes nullable/single/array nested pre-shift responses; no domain rule changed
- Attendance product code: unchanged
- Migration / RLS / GRANT / RPC / Auth / Package: unchanged
- Remote: no access, push or mutation

## Actual Browser State Coverage
- Scheduled / Start Missing / Late / Working / Finished / Absent / No-show / Pre-shift unavailable / Placement + planned Break: all PASS

## Remaining Rule-only States
- None among the requested state matrix.

## Limitations
- Arrival, GPS and SOS were intentionally not fabricated because no corresponding product domain exists.
- Full-suite helpers that assume a freshly reset shared local fixture DB can collide with unrelated prior test rows; the prohibited `db reset` was not used.

## Documentation
- `docs/day-of-fixture-matrix-result.md`

## Next Phase
UI-2.6B Day-of Visual Polish / Final QA

QA-2.6A.5: COMPLETE
