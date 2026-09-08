# Phase DB-2.5C1 実装結果

最終検証日：2026-09-08（Asia/Tokyo）。対象はローカルSupabaseのみです。

## Executive Summary

- Migration: `supabase/migrations/20260908062451_placement_core.sql`
- Placement Plan: Shiftごとに最大1件、独立した正の`version`を持つrootを追加。
- Position: Shift Plan所有のfree-text Position、任意の必要人数、表示順、退役時刻を追加。
- Placement Segment: 既存Assignmentが同一Shift内のPositionを担当する半開区間を追加。
- RLS: Managerは既存のShift branch access経由、System Adminは全支店、Worker/anonは新tableを読めない。
- GRANT: authenticatedはSELECTのみ。通常のINSERT/UPDATE/DELETEは許可していない。
- Existing data: backfillなし。既存Shift/AssignmentにPlan/Position/Segmentが0件でも正常。
- Remote: 接続・書込み・`db push`なし。

## Sources

- Domain Design: `docs/placement-break-domain-design-v1.md`
- Placement Foundation: `docs/admin-placement-foundation-result.md`
- Existing Schema/RLS/GRANT: migrations `001`–`012`、ローカルread-only introspection。
- Existing assignment lifecycle: accepted applicationからの既存RPC、Assignment status/partial unique indexを維持。
- Local setup: `supabase/config.toml`。APIは `http://127.0.0.1:54321`、新規public entity auto exposureは未設定（既定でauto-exposeしない）。

## Git State

- Branch: `small-ui-a11y-fix`
- Start status: UI-2.5Aの未コミット変更が既存。revert/reset/cleanなし。
- This phase changed: Migration、transactional schema/security test、本書。
- Commit / Push: なし。

## Physical Naming Decision

| Concept | Physical name | Reason |
| --- | --- | --- |
| Placement Plan | `shift_placement_plans` | Shiftに1:0..1で従属し、独立した編集aggregateを明示する。 |
| Position | `shift_positions` | Job/Workplace masterではなく、Shift instanceであることを表す。 |
| Placement Segment | `assignment_placement_segments` | AssignmentがいつどのPositionを担うかを表す。 |

## Migration

- File: `20260908062451_placement_core.sql`
- Applied locally: `supabase migration up --local`で増分適用。
- DB reset: なし。既存fixtureを保持。
- db push: なし。
- Extension: `btree_gist`を`extensions` schemaへ追加。GiST exclusion constraintでUUID equalityと`tstzrange` overlapをDB保証するために必要。

## Placement Plan Schema

- Primary key: DB生成UUID `id`。
- Shift relation: `shift_slot_id` → `shift_slots(id)`、`ON DELETE RESTRICT`。
- Version: `bigint NOT NULL DEFAULT 1`、`version >= 1`。更新commandはC2まで未実装。
- Timestamps: `created_at`/`updated_at`は既存`now()`/`public.set_updated_at()` trigger pattern。
- Unique: `shift_slot_id` unique（1 Shift : 0..1 Plan）、およびSegmentの複合FK用`(id, shift_slot_id)`。
- RLS: 有効。

## Position Schema

- Primary key: DB生成UUID。
- Parent: `plan_id` → `shift_placement_plans(id)`、`RESTRICT`。
- Label: nonblank free text。enumやmasterは導入していない。
- Required count: nullable、非負。NULLは未定義、0は明示的0。
- Display order: 非負、同一Planでunique。
- Retirement: `retired_at timestamptz`。通常のUI削除commandは未実装。
- Historical safety: 参照済みPositionを物理削除するCASCADEは採用しない。

## Placement Segment Schema

- Primary key: DB生成UUID。
- Plan/Shift scope: `(plan_id, shift_slot_id)` → Planの複合unique key。
- Assignment scope: `(assignment_id, shift_slot_id)` → `assignments(id, shift_slot_id)`。
- Position scope: `(position_id, plan_id)` → Positionの複合unique key。
- Start/end: `timestamptz`、`end_at > start_at`。
- Time semantics: `[start_at, end_at)`。隣接区間は重複しない。
- Delete policy: 全親FKは`RESTRICT`。authenticatedに直接DELETEは付与しない。

## Relationship Safety

- Plan ↔ Shift: Planのunique Shift FK。
- Assignment ↔ Shift: Segmentの複合FK。既存`assignments`にはこの参照先のためだけに`UNIQUE(id, shift_slot_id)`を最小追加した。既存row/lifecycle/RPCは変更していない。
- Position ↔ Plan: Segmentの複合FK。
- Cross-shift/cross-plan injection: 3本のFKを同時に満たす必要があるためDBで拒否される。RLSだけには依存しない。

## Overlap Enforcement

- Strategy: `EXCLUDE USING gist (assignment_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)`。
- PostgreSQL feature: range + GiST exclusion constraint。
- Extension: `btree_gist`。
- Adjacent ranges: accepted。
- Overlapping ranges: rejected in DB。
- DB guaranteed: 同一AssignmentのPlacement Segment時間重複。

## Constraints

| Constraint | DB / C2 | Result |
| --- | --- | --- |
| `end_at > start_at` | DB | CHECKで保証 |
| same Assignment overlap | DB | GiST exclusionで保証 |
| cross-shift/cross-plan Position | DB | 複合FKで保証 |
| negative Position requirement | DB | CHECKで拒否 |
| Position requirements sum <= Shift required | C2 | final-graph validationへ延期 |
| Segment inside parent Shift range | C2 | parent row比較を伴うfinal-graph validationへ延期 |

## Indexes

| Index | Purpose |
| --- | --- |
| Plan `UNIQUE(shift_slot_id)` | ShiftからPlanを一意取得 |
| Position `UNIQUE(plan_id, display_order)` | deterministic timeline orderと重複順序防止 |
| `idx_shift_positions_plan_display_order` | Plan内順序読取 |
| Segment exclusion GiST | 同一Assignment重複拒否 |
| `idx_assignment_placement_segments_plan_start` | Planの時間順読取 |
| `idx_assignment_placement_segments_position_start` | Position laneの時間順読取 |

## RLS and GRANT

Plan/Position/SegmentはRLS enabled。Manager policyは既存`private.has_shift_slot_branch_access`を再利用し、System Admin policyは既存`private.is_system_admin`を再利用する。Worker self-service policyは追加していない。

| Actor | SELECT | INSERT / UPDATE / DELETE |
| --- | --- | --- |
| Manager | accessible Shift branchだけ | なし |
| System Admin | 全branch | なし |
| Worker | なし | なし |
| anon | なし | なし |

`public` schemaがData APIのexposed schemaでも、local configのauto-exposeは未設定であり、各tableに明示したGRANTを正本とする。authenticated SELECTが可能でもRLSの行条件を通らなければ0行である。

## Existing Domain Compatibility

- Assignments: structural supporting unique key以外変更なし。既存INSERT/UPDATE/DELETE権限、status、RPC、active uniquenessを維持。
- Applications: 変更なし。accepted application → existing Assignment creation flowを維持。
- Shifts: 新Planの親だが、scheduled range/required/break/statusは引き続きShift Slot SOT。
- Workers/Attendance: 変更なし。Workerへの新table readもない。Attendance actual breakとの連携なし。
- Existing rows/backfill: なし。Placement factsがない既存Assignment/Shiftは有効。

## Test Fixtures and Results

新規 `scripts/integration/placement-core-schema-test.mjs` は既存local fixture IDsを参照し、すべて`BEGIN … ROLLBACK`で実行する。persistent QA rowは残さない。

- Placement core schema/security: **26/26 PASS**
  - Plan unique、nullable/zero/negative Position requirement、adjacent/non-overlap/overnight segment、overlap拒否、cross-plan/cross-shift injection拒否。
  - Manager own/foreign branch、System Admin、Worker、anon、authenticated direct writeを確認。
- Existing Placement rules: **39/39 PASS**。
- Existing Placement read-only security: **28/28 PASS**。
- `npx tsc --noEmit`: PASS。
- `npm run build`: PASS。
- `npx eslint scripts/integration/placement-core-schema-test.mjs`: PASS。
- `supabase db advisors --local --type security --fail-on error`: PASS（No issues found）。
- `git diff --check`: PASS（既存UI作業のLF/CRLF警告のみ）。

## Deferred to DB-2.5C2

- Break Interval / break rotation / `break_minutes` comparison。
- SegmentのShift scheduled-range final validation。
- Position requirement aggregate validation。
- Placement vs Break overlap。
- transactional batch command、idempotency、expected version compare/version increment。
- revision/audit、started/ended Shift correction lifecycle。

## Risks / Limitations

- C1はwrite commandを提供しないため、final-graph rulesを実装していない。通常authenticated direct writeを拒否しているため、C2前にこの制約を迂回するapplication pathはない。
- Cross-shift Worker double bookingは既存Assignment Domainの将来ruleであり、Placement Coreが新規に禁止していない。
- Position requirement aggregateとShift containmentをCHECK/triggerで急造していない。C2のlocked atomic commandで検証する。

## DB Changes

- New tables: `shift_placement_plans`、`shift_positions`、`assignment_placement_segments`。
- Existing structural change: `assignments`へ複合FK参照用`UNIQUE(id, shift_slot_id)`のみ。
- Existing row mutation: なし。
- RLS/GRANT: 新3tableだけ。
- Extension: `btree_gist`。
- Seed / Remote: なし。

## Current UI Regression

MigrationはUIやread queryを変更しない。`/login`はChromeで実表示し、コンソール由来の画面エラーは確認されなかった。一方、指定されたローカルManager資格情報は2026-09-08時点で`invalid_credentials`となったため、認証後の`/admin/placement`、Shift Hub、Staff Hubの実Chrome回帰は未実施である。Auth userの再作成・パスワード変更・seed/resetは本Phaseの許可範囲外のため実行していない。

## Next Phase

**DB-2.5C2 — Break / Atomic Placement Plan Command**。C1のSchema/RLS/GRANTを基盤に、Break、final-graph validation、version比較、idempotency、revisionとcorrection lifecycleを一つの安全なcommandとして設計・実装する。
