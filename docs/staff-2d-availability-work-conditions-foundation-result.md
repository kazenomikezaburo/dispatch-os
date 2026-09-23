# STAFF-2D — Availability & Work Conditions Foundation

## Status

`STAFF-2D: COMPLETE`

本Phaseはdomain / schema / read contractのFreezeのみ。migration、RLS、RPC、UI、Assignment / Placement behaviorは変更していない。

## Executive Summary

AvailabilityとWork Conditionsは別domainとする。

```text
Availability
= 特定の実時間帯について、勤務可能 / 相談可能 / 勤務不可である事実

Work Conditions
= Workerの曜日・時間等の非blockingな希望
```

Availabilityの`unavailable`だけが初期contractのhard restrictionである。Work Conditionsは候補理由として説明するが、候補除外には使わない。

Candidate判定では次を独立したfactとして返す。

```text
workerStatusEligible
availabilityEligible
overlapEligible
requirementsEligible  // STAFF-2C、独立した既存fact
preferenceMatches     // informational only
```

これらを一つのopaque scoreや`placementEligible`へ集約しない。

## Existing Architecture Audit

### Reusable canonical facts

- Worker identity / lifecycle: `public.workers`
  - `status = active | inactive | suspended`
- target interval: `public.shift_slots.starts_at / ends_at`
- actual staffing commitment: `public.assignments`
- Skill / Qualification facts: STAFF-2C `get_worker_shift_requirement_facts`
- Branch authorization: existing Project / Shift / Worker Branch helpers

### Missing facts

現行schemaに以下は存在しない。

- Workerの明示的available / unavailable interval
- recurring weekly availability rule
- Workerの曜日・時間希望
- structured area preference
- structured work-category preference
- Candidate用の別Shift時間重複reader

既存`assignments_active_shift_worker_unique`は同一Worker / 同一Shiftのactive Assignment重複だけを防ぐ。別Shift間の時間重複は保存時にもread時にも判定していないため、既存constraintをAvailabilityの代用にしてはならない。

### Figma audit

Figma `1073:4420`（スタッフ詳細｜勤務条件）は以下の概念を持つ。

- 週単位の勤務可能日
- `○ 働ける / △ 相談できる / × 勤務不可`
- 希望エリア、希望業務、希望時間、交通手段
- 配置候補では勤務可能時間と他Shift重複を必須、希望条件を参考として表示
- 勤務可能日・希望条件はWorker本人が更新する想定

Figmaの表示項目をそのまま一つのgeneric tableやJSONへ保存しない。現行DBにはarea / work-category taxonomyがないため、それらを文字列一致でhard判定することも禁止する。

## Domain Split

### 1. Availability

特定のabsolute intervalに対するWorker-owned fact。

Closed kind:

```text
available
consultable
unavailable
```

- `available`: positive confirmation
- `consultable`: 候補除外しないが本人確認を推奨
- `unavailable`: Shiftと少しでも重なればhard restriction
- recordなし: unknown。unavailableとはみなさない

### 2. Work Conditions

Workerの非blocking preference。

初期のmachine-readable対象:

- preferred ISO weekdays
- preferred local start / end time

初期のinformational-only対象:

- preferred area
- preferred work category
- transport preference

areaは`workplaces.address`、categoryは`jobs.work_type`という自由記述しか存在しない。taxonomyがFreezeされるまでexact / substring matchingを行わない。

### 3. Assignment overlap

Availability tableへ複製しない。`assignments -> shift_slots`から都度導出する別fact。

commitment statusは既存active Assignment conventionを再利用する。

```text
assigned
confirmed
completed
```

`cancelled_by_worker`、`cancelled_by_company`、`absent`、`no_show`は新しい時間拘束として扱わない。`completed`は通常pastだが、既存active conventionとの不整合を避けるためintervalが重なる場合はconflictとして返す。

## Frozen Persistence Contract

本Phaseでは作成しない。次Persistence Phaseの最小候補を以下へFreezeする。

### `worker_availability_intervals`

```text
id uuid PK
worker_id uuid NOT NULL FK workers ON DELETE RESTRICT
kind text NOT NULL CHECK available | consultable | unavailable
starts_at timestamptz NOT NULL
ends_at timestamptz NOT NULL
created_by_profile_id uuid NOT NULL FK profiles ON DELETE RESTRICT
created_at timestamptz NOT NULL
retired_at timestamptz NULL

CHECK ends_at > starts_at
```

Contract:

- active factは`retired_at IS NULL`。
- interval / kind / worker identityは作成後immutable。
- correctionは旧rowをretireし、新rowを作るnarrow commandで行う。
- hard deleteは通常操作に使用しない。
- 同一Workerのactive interval同士はkindを問わずoverlap禁止。
- adjacent intervalは許可。
- DB exclusion identityは半開区間`[starts_at, ends_at)`。
- same-kind duplicateもopposite-kind conflictもDB-levelで拒否する。
- `created_by_profile_id`はclientから信頼せず、`auth.uid()`から導出する。

このnon-overlap ruleによりprecedenceを不要にする。例えば「一日availableだが昼だけunavailable」は、available intervalを昼の前後へ分割し、昼をunavailableとして保存する。

### `worker_work_conditions`

```text
worker_id uuid PK FK workers ON DELETE RESTRICT
preferred_iso_weekdays smallint[] NULL
preferred_start_local time NULL
preferred_end_local time NULL
preferred_ends_next_day boolean NOT NULL DEFAULT false
preferred_area_note text NULL
preferred_work_category_note text NULL
transport_preference_note text NULL
is_active boolean NOT NULL DEFAULT true
updated_by_profile_id uuid NOT NULL FK profiles ON DELETE RESTRICT
created_at timestamptz NOT NULL
updated_at timestamptz NOT NULL
```

Contract:

- 1 Workerにつきcurrent conditionは1 row。
- `preferred_iso_weekdays`はISO 1（月）〜7（日）、重複なし。NULLは曜日希望なし。
- non-NULL arrayは1件以上必須。空arrayへ「勤務希望日なし」というhard意味を持たせない。
- start/endは両方NULLまたは両方non-NULL。
- `preferred_ends_next_day = true`でovernight preferenceを表す。
- start/endがNULLなら`preferred_ends_next_day = false`。non-overnightはend > start、overnightはend <= startを満たす。
- preference rowの不存在または`is_active = false`は`not_configured`。
- notesはtrim後blank禁止。
- area/category/transport notesは表示専用で、candidate matchやhard restrictionに使用しない。
- current preferenceだけを扱う。effective future version / preference historyは初期scope外。

### Why not one generic table

Availabilityはabsolute interval、Work Conditionsはcurrent recurring preferenceであり、identity、overlap、lifecycle、判定方法が異なる。`kind + jsonb payload`のgeneric tableへ統合するとDB constraintと説明可能性が失われるため採用しない。

## Recurrence Decision

初期Availabilityにrecurring weekly ruleは追加しない。

理由:

1. Figmaは週単位のdate-specific inputであり、無期限recurrenceを要求していない。
2. recurrenceには開始日、終了日、祝日、date-specific exception、overnight、precedenceが必要になる。
3. exact intervalだけでShift候補判定に必要な事実を表現できる。

将来recurrenceが必要になった場合は`worker_weekly_availability_rules`を別domainとして設計する。その時点でdate-specific intervalをexceptionとして優先し、同priorityのconflictを禁止する。初期schemaへ未使用recurrence columnsを予約しない。

Work Conditionsのpreferred weekday/timeはavailability recurrenceではない。常にnonblocking preferenceである。

## Time and Overlap Semantics

- canonical storage: `timestamptz`
- user-facing calendar zone: IANA `Asia/Tokyo`
- interval: half-open `[start, end)`
- overlap formula: `a.start < b.end AND b.start < a.end`
- Shift ending exactly when別intervalが始まる場合はoverlapなし
- partial overlap / full overlapの両方を検出
- Shift crossing midnightもabsolute intervalで判定
- local date / weekday / preferred timeはShift intervalをAsia/Tokyoへ変換して評価
- server / browser timezoneや現在時刻へ依存しない

Overnight preferenceは、Shift全体を各Tokyo calendar dayへ分割し、該当曜日のpreferred window unionでcoverageを評価する。Shift開始曜日だけで判定してはならない。

## Candidate Fact Contract

概念read:

```ts
type CandidateAvailabilityFacts = {
  workerId: string;
  shiftId: string;
  evaluatedInterval: {
    startsAt: string;
    endsAt: string;
    timeZone: "Asia/Tokyo";
  };

  workerStatus: "active" | "inactive" | "suspended";
  workerStatusEligible: boolean;
  workerStatusReasonCodes: Array<"worker_inactive" | "worker_suspended">;

  availabilityEligible: boolean;
  availabilityState:
    | "explicitly_available"
    | "consultation_required"
    | "partially_available"
    | "explicitly_unavailable"
    | "unknown";
  availabilityCoverage: "full" | "partial" | "none";
  availabilityReasonCodes: Array<
    | "availability_confirmed"
    | "availability_consultation_required"
    | "availability_partially_confirmed"
    | "availability_unavailable"
    | "availability_unknown"
  >;

  overlapEligible: boolean;
  overlapReasonCodes: Array<"assignment_time_conflict">;
  conflictingAssignments: Array<{
    assignmentId: string;
    shiftId: string;
    startsAt: string;
    endsAt: string;
  }>;

  preferenceMatches: {
    preferredSchedule: "matched" | "partially_matched" | "not_matched" | "not_configured";
    preferredArea: "informational_only" | "not_configured";
    preferredWorkCategory: "informational_only" | "not_configured";
    transport: "informational_only" | "not_configured";
  };
};
```

`requirementsEligible`はSTAFF-2C readerの独立結果としてcomposeする。このread shapeへcopy / persistしない。

## Availability Evaluation

優先順ではなく、overlap禁止により一意に評価する。

1. Shiftとactive `unavailable` intervalが少しでもoverlap:
   - `availabilityEligible = false`
   - `explicitly_unavailable`
2. unavailableなし、active `available` intervalsのunionがShift全体をcover:
   - `availabilityEligible = true`
   - `explicitly_available`
3. unavailableなし、`consultable`を含むunionがShift全体をcover:
   - `availabilityEligible = true`
   - `consultation_required`
4. unavailableなし、available / consultableがShiftの一部だけをcover:
   - `availabilityEligible = true`
   - `partially_available`
5. overlapするAvailability recordなし:
   - `availabilityEligible = true`
   - `unknown`

unknownやpartialを「勤務可能確認済み」と表示してはならない。ただし初期contractではunknownをhard exclusionにもしない。

## Hard Eligibility Boundary

### Worker status

```text
active    -> workerStatusEligible = true
inactive  -> false, worker_inactive
suspended -> false, worker_suspended
```

### Availability

`unavailable` overlapだけがfalse。他のstateはtrueだが、confirmed / consultation / unknownを別表示する。

### Assignment overlap

target Shiftと別のactive Assignment Shiftが半開区間でoverlapすれば:

```text
overlapEligible = false
reason = assignment_time_conflict
```

同じShiftの既存active Assignmentは既存duplicate identityの問題でもあるが、Candidate factでは同じreason familyでconflictとして返せる。

### Preferences

preferred weekday/time不一致、area/category/transport note不一致はhard eligibilityを変更しない。

## Closed Candidate Reason Codes

Hard:

```text
worker_inactive
worker_suspended
availability_unavailable
assignment_time_conflict
```

Nonblocking / informational:

```text
availability_confirmed
availability_consultation_required
availability_partially_confirmed
availability_unknown
preferred_time_matched
preferred_time_partially_matched
preferred_time_not_matched
preference_not_configured
```

area/category/transportの自由記述からreason codeを生成しない。

## Scenario Verification Matrix

| Scenario | Frozen result |
| --- | --- |
| explicitly available | full available coverage、eligible true、confirmed |
| explicitly unavailable | any overlapでeligible false |
| no availability record | eligible true、unknown |
| partial available overlap | eligible true、partially available、未確認扱い |
| full available overlap | eligible true、explicitly available |
| partial unavailable overlap | eligible false |
| existing Assignment conflict | overlapEligible false、assignment_time_conflict |
| recurring rule vs date exception | initial Availability recurrenceなし。曖昧なprecedenceなし |
| hard restriction vs preference | unavailable/status/Assignment conflictだけhard。希望はnonblocking |
| Shift crossing midnight | absolute interval overlap + Tokyo日別preference coverage |
| Asia/Tokyo boundary | input/output calendar変換をserver-sideで固定 |
| inactive Worker | workerStatusEligible false。Availabilityがavailableでも覆さない |
| suspended Worker | workerStatusEligible false |
| requirements satisfied but unavailable | requirementsEligible trueとavailabilityEligible falseを別々に保持 |

## Authorization Boundary for Future Persistence

- Worker: own Availability / Work Conditions read・mutation
- Manager: own-Branch Workerのread only
- System Admin: organization read
- Admin mutation / override: initial scope外。必要ならactor / reasonを持つ別commandを設計
- anon: none

Worker ID、Branch、actor、eligibility resultをclientから信頼しない。Worker self commandは`auth.uid() -> workers.auth_profile_id`、Admin readはWorker/ShiftからBranchを再導出する。

public schemaへ実装する場合はRLSとData API privilegesを別々に明示する。SECURITY DEFINERが必要なreader / commandはowner、empty search path、schema qualification、PUBLIC/anon revoke、actor/source authorizationを必須とする。

## Persistence Decision

Availabilityには新しいschemaが必要。

最小Persistence Phase:

1. `worker_availability_intervals`
2. `worker_work_conditions`
3. active interval overlap exclusion
4. Worker-owned narrow commands
5. authorized Worker + Shift fact reader
6. existing Assignment interval conflict derivation

area / work-categoryをmachine matchするには、別途canonical taxonomyとJob/Workplace側FKが必要である。STAFF-2D persistenceへ無理に含めず、notesはinformational-onlyに留める。

## Explicit Non-Changes

- migration / DB schema / RLS / RPC: unchanged
- Worker lifecycle: unchanged
- Assignment / Placement semantics: unchanged
- STAFF-2C `requirementsEligible`: unchanged and independent
- Candidate Picker: not implemented
- automatic placement / ranking / scoring / AI: not implemented
- travel time / GPS / geofence / Open Shift: not implemented
- recurring Availability: not added
- packages / Auth architecture / remote Supabase: unchanged
- commit / push: not performed
- existing uncommitted work: preserved

## Next Phase Readiness

推奨:

```text
STAFF-2E — Availability & Work Conditions Persistence
```

このPhaseは上記2 table、interval exclusion、Worker-owned commands、Branch-scoped read、Worker + Shift fact readerだけを実装し、Candidate PickerやAssignment blockingを含めない。

`STAFF-2D: COMPLETE`
