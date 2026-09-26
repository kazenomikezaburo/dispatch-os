# STAFF-2I — Availability & Work Conditions UI Result

## Status

`STAFF-2I: COMPLETE`

STAFF-2D / STAFF-2Eのcanonical Availability / Work Conditionsを、Worker本人が通常UIから更新し、Adminが同じ事実をread-onlyで確認できるようにした。新しいdomain rule、schema、RLS、RPC、Candidate eligibility ruleは追加していない。

## Existing Contract Audit

- Availability source: `worker_availability_intervals`
- Work Conditions source: `worker_work_conditions`
- Worker commands:
  - `create_own_availability_interval`
  - `retire_own_availability_interval`
  - `correct_own_availability_interval`
  - `set_own_work_conditions`
- Authorization: Worker own mutation; Manager own-Branch read; System Admin organization read; Admin overrideなし
- Candidate consumption: existing STAFF-2E / STAFF-2F readers

Supabase changelog was reviewed before implementation. No current breaking change affected the existing PostgREST/RPC/RLS product path used by this phase.

## Figma Alignment

Figma `1073:4420` was used as the visual and information-hierarchy reference:

- `○ 勤務可能 / △ 相談可能 / × 勤務不可`
- Availability and preferences are separate sections
- no record is shown as unknown, not available
- preference information is visibly nonblocking
- Admin view identifies the Worker as the owner of the information

The weekly-looking Figma presentation was implemented over explicit dated intervals only. No recurring Availability persistence or recurrence inference was introduced.

## Worker UI

Added `/worker/availability` and a 44px Worker-header entry.

Availability supports:

- explicit Tokyo-local start/end input
- available / consultable / unavailable
- create
- retire
- atomic correction through the existing RPC
- active interval list
- overlap-specific feedback
- adjacent intervals
- overnight/date-crossing intervals
- no-record unknown state

Work Conditions supports:

- preferred ISO weekdays
- preferred local start/end
- overnight preference
- preferred area note
- preferred work category note
- transport preference note

The UI labels all Work Conditions as reference preferences and does not present them as hard eligibility.

## Admin Staff Detail

Added a `勤務条件` tab to the canonical Admin Staff detail.

- active Availability intervals are shown separately from preferences
- available / consultable / unavailable are presented with symbol and text
- missing Availability is shown as `登録なし（不明）`
- Work Conditions remain informational
- no Admin create/edit/retire controls are rendered
- Manager/System Admin reads continue through existing table RLS

## Security

- Worker identity is derived from auth/RLS and never accepted from client input
- Branch, actor, Worker, or eligibility result are not client inputs
- all mutation uses the existing Worker-owned RPCs
- no direct table mutation was added
- no service-role runtime path was added
- no Admin override was added
- foreign Worker and Branch behavior remains governed by STAFF-2E RLS

## Browser Verification

Normal authenticated System Admin and Worker sessions were exercised locally.

Worker:

- available create: PASS
- consultable create: PASS
- unavailable overnight interval create: PASS
- overlap rejection with explicit feedback: PASS
- adjacent interval acceptance: PASS
- correction: PASS
- retire behavior and foreign-retire denial: STAFF-2E integration PASS
- weekday/time/overnight preference save: PASS
- informational notes save: PASS

Admin:

- Worker updates visible after refresh: PASS
- Availability / preference separation: PASS
- read-only; Admin mutation controls absent: PASS
- unknown state: PASS

Responsive matrix for both Worker and Admin surfaces:

- 1440x900: horizontal overflow `0`
- 1280x900: horizontal overflow `0`
- 390x844: horizontal overflow `0`
- application / React / hydration console warnings and errors: `0`
- server exceptions in exercised flow: `0`

The new surface uses native labelled date/time/select/checkbox controls, visible focus styles, and 44px action targets. No Drawer/Dialog was introduced, so Escape/focus-restoration behavior is not applicable to this slice.

## Regression Verification

- STAFF-2E Availability / Work Conditions: `41/41 PASS`
- STAFF-2F Candidate Eligibility: `22/22 PASS`
- STAFF-2G.3 Candidate Picker read model: `15/15 PASS`
- Candidate facts continue to consume canonical Availability and Work Conditions without UI-side eligibility logic

## Static Verification

- focused ESLint: `PASS`
- `npx tsc --noEmit`: `PASS`
- production build: `PASS`
  - initial sandbox run could not fetch Google Fonts
  - identical approved network-enabled rerun passed
- `git diff --check`: `PASS` (line-ending notices only; no whitespace errors)

## Fixture Cleanup

The STAFF-2E regression suite cleaned its dedicated fixtures. Browser QA used only Worker A, exact 2098-01-01–02 intervals, and uniquely identifiable preference notes. Final targeted cleanup query confirmed remaining dedicated rows: `0`.

## Files Changed

- `app/actions/worker-availability.ts`
- `app/worker/availability/page.tsx`
- `app/worker/layout.tsx`
- `components/worker/availability/worker-availability-workspace.tsx`
- `lib/worker/availability/get-worker-availability.ts`
- `lib/worker/availability/types.ts`
- `app/admin/workers/[workerId]/page.tsx`
- `components/admin/workers/worker-availability-readonly.tsx`
- `components/admin/workers/worker-detail-view.tsx`
- `lib/admin/workers/worker-rules.ts`
- `docs/staff-2i-availability-work-conditions-ui-result.md`

## Explicit Non-Changes

- STAFF-2D / STAFF-2E domain contract: unchanged
- DB schema / migration / RLS / RPC: unchanged
- recurring Availability: not added
- Admin override: not added
- Candidate eligibility: unchanged
- Assignment / Placement behavior: unchanged
- preference hard filtering: not added
- ranking / AI / travel / GPS / Open Shift: not added
- packages: unchanged
- remote Supabase: unchanged
- commit / push: not performed
- existing uncommitted work: preserved

`STAFF-2I: COMPLETE`
