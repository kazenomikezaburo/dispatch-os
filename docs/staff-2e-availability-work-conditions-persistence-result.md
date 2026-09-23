# STAFF-2E — Availability & Work Conditions Persistence

## Status

`STAFF-2E: COMPLETE`

STAFF-2DでFreezeしたAvailability / Work Conditions contractをlocal PostgreSQLへ実装した。Candidate Picker、Assignment blocking、final placement eligibilityは追加していない。

## Existing Architecture Reuse

- Worker identity / lifecycle: `public.workers`
- Shift interval: `public.shift_slots.starts_at / ends_at`
- Assignment conflict source: `public.assignments -> public.shift_slots`
- Branch authorization: existing `private.has_branch_access`
- Worker identity: existing `private.current_worker_id()`
- Worker Shift visibility: existing `private.worker_can_view_shift_slot()`
- STAFF-2C requirement facts: unchanged and別readerのまま
- interval exclusion: existing `extensions.btree_gist`

## Persistence

### `public.worker_availability_intervals`

- `kind = available | consultable | unavailable`
- absolute `timestamptz` start/end
- half-open `[starts_at, ends_at)`
- active fact: `retired_at IS NULL`
- Worker、kind、interval、creator、created timeは作成後immutable
- retire後のunretire / retirement timestamp変更は禁止
- same Worker active interval overlapをGiST exclusion constraintで拒否
- adjacent intervalを許可
- hard delete commandなし

### `public.worker_work_conditions`

- one current row per Worker (`worker_id` primary key)
- preferred ISO weekdays
- preferred local start/end time
- overnight preference
- area / work category / transport informational notes
- active / inactive lifecycle
- weekdayを1〜7へ限定し、重複をsort/deduplicate
- blank notesをNULLへ正規化
- start/end pair、overnight/non-overnight time shapeをDB constraintで保証

PreferencesはCandidate factでinformationalのまま。area/category string matchingやhard filteringは行わない。

## Worker-owned Commands

追加:

- `create_own_availability_interval(kind, starts_at, ends_at)`
- `retire_own_availability_interval(interval_id)`
- `correct_own_availability_interval(interval_id, kind, starts_at, ends_at)`
- `set_own_work_conditions(...)`

全commandはWorker IDとactorを`auth.uid()` / `private.current_worker_id()`から導出する。Worker ID、Branch、actorはclient inputにしない。

correctionは対象active rowをlockし、同一transaction内でretireしてreplacementを作る。replacement validation / overlapが失敗した場合はretirementもrollbackする。

Manager / System Adminにはoverride mutationを追加していない。

## Candidate Fact Reader

追加:

- `get_worker_shift_availability_facts(worker_id, shift_id)`

返却:

- `workerStatusEligible`
- closed Worker status reasons
- `availabilityEligible`
- `availabilityState`
- `availabilityCoverage`
- closed Availability reasons
- `overlapEligible`
- conflicting active Assignments
- nonblocking `preferenceMatches`

Availability:

- no record: `unknown`, eligible
- available full coverage: `explicitly_available`
- available / consultable full coverage: `consultation_required`
- partial positive coverage: `partially_available`, eligible
- any unavailable overlap: `explicitly_unavailable`, ineligible

Assignment overlapは既存AssignmentとShift intervalから都度導出する。statusは既存active conventionの`assigned / confirmed / completed`。touching intervalsはhalf-open semanticsによりconflictにならない。

PreferenceはShiftをAsia/Tokyo calendarへ変換し、前日開始のovernight windowも含めてrange unionを評価する。

STAFF-2C `requirementsEligible`と`placementEligible`は返さない。初回migrationのsafe unavailable shapeに残ったnull fieldを検証で検出したため、適用済みmigrationを変更せずfollow-up migrationでinternal readerを非公開化し、公開wrapperから完全に除外した。

## Authorization and RLS

Table read:

- Worker: own rows
- Manager: own-Branch Worker rows
- System Admin: organization rows
- anon: none

Mutation:

- Worker: own commandのみ
- Manager / System Admin: overrideなし
- authenticated direct table write: privilegeなし
- anon: table / RPC accessなし

全public tableでRLSを有効化し、Data API privilegeはauthenticated SELECTだけを明示grantした。mutationとreaderはowner `postgres`、`SECURITY DEFINER`、`search_path = ''`、schema qualification、explicit source authorization、PUBLIC / anon / service_role revokeを使用する。公開readerのinternal implementationはauthenticatedからもexecute不可。

## Verification

### STAFF-2E Integration

`scripts/integration/staff-availability-work-conditions-test.mjs`: `41/41 PASS`

Covered:

- available / consultable / unavailable
- no record unknown
- full / partial coverage
- partial unavailable ineligible
- adjacent accepted / active overlap rejected
- immutable identity
- retire history
- atomic correct and rollback on invalid replacement
- Shift crossing midnight
- Tokyo boundary and previous-day overnight preference
- preference matched / partial / not matched / not configured
- inactive / suspended Worker
- active Assignment overlap / touching non-conflict
- Worker own read / mutation
- Manager own-Branch read / foreign isolation
- System Admin organization read
- Worker foreign mutation/read denial
- Admin override absence
- anon denial / direct write denial
- requirement / placement eligibility separation
- fixture cleanup 0

### Existing Regressions

- STAFF-2B persistence: `38/38 PASS`
- STAFF-2C requirements: `33/33 PASS`
- Assignment integrity: `25/25 PASS`
- Placement rules: `39/39 PASS`
- Placement editor rules: `13/13 PASS`
- Time-band coverage: `8/8 PASS`
- Placement core schema/security: `26/26 PASS`
- Placement Break atomic command: `20/20 PASS`

Assignment suiteは既存test designによりfixtureを残すため、suite前後に明示的な`ASSIGN-*` / exact 2035 test intervalだけをlocal DBから清掃した。

### Database / Static

- local DB lint (`warning`): PASS, findings 0
- local DB advisors: STAFF-2E object由来のfinding 0
- advisorsには既存tableのmultiple permissive policy performance warningsが残るが、本Phase起因ではなくscope外
- `npx tsc --noEmit`: PASS
- focused ESLint: PASS
- `git diff --check`: PASS
- local migration history: STAFF-2E base + follow-up applied
- fixture remaining: 0

## Files Changed

- `supabase/migrations/20260921152821_availability_work_conditions.sql`
- `supabase/migrations/20260921153531_separate_availability_requirement_facts.sql`
- `scripts/integration/staff-availability-work-conditions-test.mjs`
- `docs/staff-2e-availability-work-conditions-persistence-result.md`

## Explicit Non-Changes

- recurring Availability: not added
- Candidate Picker UI: not added
- final `placementEligible`: not added
- automatic Assignment blocking: not added
- Assignment / Placement semantics: unchanged
- STAFF-2C requirement contract: unchanged
- preference hard filtering: not added
- area/category matching: not added
- travel time / ranking / scoring / AI / Open Shift: not added
- Admin override mutation: not added
- Auth architecture / packages: unchanged
- remote Supabase: unchanged
- commit / push: not performed
- existing staged, unstaged, and untracked work: preserved

`STAFF-2E: COMPLETE`
