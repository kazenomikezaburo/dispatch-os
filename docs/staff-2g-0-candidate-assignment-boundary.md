# STAFF-2G.0 — Candidate Selection / Assignment Boundary Freeze

## Status

`STAFF-2G.0: COMPLETE`

本Phaseはdomain / command / read contractのFreezeのみ。product code、DB、RLS、RPC、UIは変更していない。

Canonical flowを次へ固定する。

```text
Worker candidate
→ server-derived Candidate facts
→ explicit Assignment decision
→ canonical Assignment create / reuse
→ canonical Assignment ID
→ existing Placement editor / save command
```

Candidate PickerでWorkerを選択すること自体は、Assignment作成でも認可証明でもない。

## Existing Architecture Audit

### Assignment

`public.assignments`がWorkerとShiftの実勤務関係の正本。

既存fact:

- `shift_slot_id`
- `worker_id`
- `source = application | manager | import`
- `status = assigned | confirmed | cancelled_by_worker | cancelled_by_company | absent | no_show | completed`
- `assigned_by`
- `assigned_at`

`assignments.source = manager`は初期schemaから存在し、初期RLSにはManager / System Adminのdirect insert pathも存在した。migration `005_assignment_integrity.sql`でdirect insert policyを撤去し、現在の作成pathを`create_assignment_from_application`へ限定している。

したがって「accepted ApplicationがなければAssignmentというdomain factを表現できない」はschema上のdomain invariantではない。現在実装済みの安全な作成commandがApplication pathしかない、というimplementation boundaryである。

### Active Assignment identity

active Assignment statusは既存contractどおり:

```text
assigned
confirmed
completed
```

partial unique index `assignments_active_shift_worker_unique`が、同じWorker + Shiftにactive Assignmentを複数作れないことをDB-levelで保証する。cancelled / absent / no_show historyは残り、新しいactive Assignmentを妨げない。

### Shift Application

`public.shift_applications`はWorker + Shiftごとに最大1 row。

closed state:

```text
applied
accepted
rejected
withdrawn
```

ApplicationはWorker起点の応募factであり、Assignmentそのものではない。acceptedだけが既存`create_assignment_from_application`の作成sourceになる。Assignment作成後もApplicationはacceptedのまま保持される。

### Existing application command

`create_assignment_from_application(shift_id, application_id)`は:

- active Manager / System Adminを認可
- Shiftを`FOR UPDATE`でlock
- Shift Branch accessを再検証
- Applicationが同Shiftかつacceptedであることを確認
- active duplicateを拒否
- Shift active Assignment数が`required_workers`未満であることを確認
- `source = application`、`assigned_by = auth.uid()`で作成

する。

現在はidempotency key / receiptを持たず、同一request retryは`worker_already_assigned`になる。将来のCandidate flowではこの結果を安全なreuseへ正規化する必要がある。

### Placement

Placement readは対象Shiftのactive Assignmentを読み込む。`save_shift_placement_plan`は各segment / breakの`assignment_id`が対象Shiftに属し、許可statusであることをtransaction内で再検証する。

Placementへ渡せるidentityはcanonical Assignment IDだけ。Worker ID、candidate ID、synthetic IDは受け付けない。

## Frozen Conceptual Facts

Candidate factsへ次を明示的に分離して追加する。

```ts
type TargetShiftAssignment =
  | { state: "none"; assignmentId: null; status: null }
  | {
      state: "active_existing";
      assignmentId: string;
      status: "assigned" | "confirmed" | "completed";
    };
```

Assignment overlapは次だけを対象とする。

```text
same Worker
AND Assignment status is active
AND Assignment Shift != target Shift
AND other Shift interval overlaps target Shift interval using [start, end)
```

対象Shift自身のAssignmentは`assignment_time_conflict`に分類しない。

この分離により:

- `targetShiftAssignment`はPlacementへ既に渡せるcanonical identityを表す
- `overlapEligible`は他Shiftとの勤務競合だけを表す

となる。

## STAFF-2E / STAFF-2F Refinement

### STAFF-2E

`get_worker_shift_availability_facts(worker_id, shift_id)`のAssignment queryは、target Shift自身をconflict aggregateから除外する。

同じquery boundaryで対象Shiftのactive Assignmentを別factとして導出し、`targetShiftAssignment`を返す。

別のeligibility ruleは作らない。active status、half-open overlap、Worker / Shift authorizationは既存contractを再利用する。

### STAFF-2F

`get_worker_shift_candidate_eligibility`はrefined STAFF-2E resultをそのままcomposeする。

```text
candidateEligible =
  workerStatusEligible
  && requirementsEligible
  && availabilityEligible
  && overlapEligible
```

式は変更しない。`overlapEligible`の意味だけを「target Shift以外のactive Assignment conflictなし」へ正確化する。

`targetShiftAssignment`は独立factとして透過的に返し、`candidateEligible`へ第五の条件として混ぜない。

## Candidate Selection Meaning

Picker selectionは次だけを意味する。

```text
Admin selected Worker X as the subject of the next explicit decision.
```

selection resultに含めてよいもの:

- Worker ID
- target Shift ID
- current presentation group
- current explanatory facts
- current targetShiftAssignment fact

selection resultに認可効力、予約、capacity hold、eligibility lockはない。表示後にsource factsが変わり得るため、Assignment commandが全factを再読する。

## Existing Target-Shift Assignment

`targetShiftAssignment.state = active_existing`の場合:

1. 新しいAssignmentを作らない。
2. 既存canonical Assignment IDをreuseする。
3. duplicate / capacity checkより先にexisting identityを解決する。
4. Placementへ渡す前に、現在actorが対象Shiftへアクセス可能か再認可する。
5. `assigned` / `confirmed`は通常Placement flowへ渡せる。
6. `completed`は既存Placement correction lifecycleに従い、通常editへ格上げしない。

既存AssignmentのreuseはCandidate resultを認可証明にすることではない。serverがAssignmentとShift scopeを再読して返す。

Workerが後からinactiveになった場合も既存Assignment historyは消さない。新規Assignment eligibilityはfalseになるが、既存Assignmentの表示・既存許可範囲でのPlacement correctionは別のlifecycleとして維持する。

## No Target-Shift Assignment

Assignment作成はPicker selectionとは別の明示操作にする。

UI概念:

```text
候補を選択
→ current factsを確認
→ 「Assignmentを作成して配置へ進む」を明示実行
→ server command
→ success時だけcanonical Assignment IDでPlacementへ戻る
```

## Application Decision

accepted Applicationは全Assignmentに必須ではない。direct Admin Assignmentをcanonical sourceとしてsupportする。

ただし既存Applicationがある場合、そのlifecycleを暗黙に上書きしない。

| Existing Application | Allowed path | Result |
| --- | --- | --- |
| none | `direct_admin` | eligibility再確認後、`source=manager`で作成可能 |
| accepted | `accepted_application` | `source=application`で作成。既存Application command semanticsを継承 |
| accepted + direct requested | none | `accepted_application_available`。application pathを明示選択させる |
| applied | none | `application_decision_required`。先にaccept / reject |
| rejected | none | `application_rejected`。暗黙overrideなし |
| withdrawn | none | `application_withdrawn`。Worker意思を暗黙overrideしない |

rejected / withdrawnをoverrideする必要が将来生じた場合は、理由・権限・通知・監査を持つ別contractとする。initial direct assignmentへ混ぜない。

## Frozen Assignment Command

Implementation phaseでは、以下相当のnarrow commandを追加する。

```text
ensure_candidate_assignment(
  shift_id,
  worker_id,
  assignment_path,   // accepted_application | direct_admin
  idempotency_key
)
```

clientから受け取らない:

- Branch
- actor / role
- Application ID
- Assignment ID
- Worker status
- candidateEligible
- requirement / Availability / overlap result
- capacity count
- source provenance fields

ApplicationはShift + Workerのunique identityからserver-sideで導出する。

### Authorization

- authenticated active Manager: ShiftとWorkerの双方がown-Branch scope
- authenticated active System Admin: organization scope
- Worker / inactive profile / anon: unavailable or execute denied
- foreign / missing Worker・Shiftの差は過剰に開示しない

### Execution-time validation

同一transaction内で最低限:

1. actorを`auth.uid()`から導出し認可
2. Shiftをlockし、Branch / lifecycle / capacity sourceを取得
3. Workerをlockし、Branch / active statusを確認
4. target Shift active Assignmentを再確認
5. existingならcanonical IDをreuseして終了
6. Application stateとrequested pathを照合
7. refined STAFF-2F hard factsをserver-sideで再評価
8. Skill / Qualificationをtarget Shift start dateで再評価
9. unavailable overlapを再評価
10. other active Shift Assignment overlapを再評価
11. current active Assignment countを確認
12. canonical Assignmentをinsert
13. command receiptへresultを保存

Picker snapshotをvalidation inputに使用しない。

### Shift lifecycle

新規Assignment作成を許可するShift state:

```text
recruiting
closed
confirmed
in_progress
```

`draft`、`completed`、`cancelled`は拒否する。`in_progress`はday-of補充を許容するが、既存Placementへ入った後の編集はPlacement correction contractに従う。

### Capacity

initial contractは既存commandと同じhard cap:

```text
active Assignment count < shift.required_workers
```

新規作成によるoverstaffingは許可しない。overrideは追加しない。

existing target Assignmentのreuseは新規席を消費しないため、現在countがcapacity以上でも`existing_assignment`を返せる。

### Provenance

- accepted Application path: `assignments.source = application`
- no-Application direct path: `assignments.source = manager`
- `assigned_by = auth.uid()`
- `assigned_at` / created timestampsはserver time

initial scopeでは新しいprovenance columnを追加しない。既存`source`、`assigned_by`、`assigned_at`でcanonical originを表せる。

### Idempotency

private command receiptを使用する。

Identity:

```text
actor_profile_id + idempotency_key
```

Fingerprint:

```text
shift_id + worker_id + assignment_path
```

- same key + same fingerprint: original resultをreplay
- same key + different fingerprint: `IDEMPOTENCY_CONFLICT`
- idempotency keyはexplicit UI actionごとに生成
- receiptはData APIへ公開しない

### Concurrency

deterministic lock order:

```text
Shift
→ Worker
→ existing target Assignment / Application
→ command receipt
```

Shift row lockがcapacity check + insertを直列化する。DB partial unique indexが同じWorker + Shiftのactive duplicateを最終防御する。

- concurrent same key: one execution、one replay
- concurrent different keys / same Worker + Shift: one create、他方はcreated rowを再読して`existing_assignment`
- concurrent different Workers at last capacity: one create、他方は`capacity_reached`

application-side SELECT-before-INSERTだけへ依存しない。

## Result Contract

成功:

```ts
type CandidateAssignmentSuccess = {
  ok: true;
  outcome: "assignment_created" | "existing_assignment";
  assignmentId: string;
  source: "application" | "manager";
  replayed: boolean;
};
```

controlled non-success:

```text
unavailable
not_eligible
shift_state_unavailable
capacity_reached
accepted_application_available
application_decision_required
application_rejected
application_withdrawn
IDEMPOTENCY_CONFLICT
```

`not_eligible`はauthorized contextでのみcurrent closed blocking reason codesを返せる。foreign / missing scopeはreasonを返さず`unavailable`へ収束する。

unexpected DB failureはtransaction全体をrollbackし、Assignment / Application / receiptのpartial stateを残さない。

## Relationship to Existing Command

`create_assignment_from_application`は既存UI / API compatibilityのためsignatureと結果を維持する。

Implementation phaseではduplicate logicを避けるため、既存commandと新commandが同じprivate locked coreを利用する構成を第一候補とする。ただし既存commandのobservable errors、capacity、source、authorizationを回帰させない。

新Candidate commandのaccepted Application pathは、client-supplied Application IDを受けず、Shift + WorkerからApplicationを導出する。

## Placement Boundary

Assignment command success後だけ:

```text
assignmentId from server result
→ refresh canonical PlacementPlan
→ confirm Assignment appears in plan.assignments
→ add Placement Segment using that canonical assignmentId
→ save_shift_placement_plan
```

Placement saveは引き続き:

- Assignmentがtarget Shift所属か
- statusが許可されるか
- Position / interval / plan scope
- optimistic version / idempotency

を独自に再検証する。Candidate / Assignment command successもPlacement authorizationの代わりにはならない。

## Scenario Verification Matrix

| Scenario | Frozen behavior |
| --- | --- |
| eligible unassigned Worker / no Application | explicit `direct_admin` action後に再評価し、`source=manager` Assignmentを作成 |
| already assigned to target Shift | self-conflictにしない。既存Assignment IDをreuse、duplicateなし |
| Assignment on overlapping other Shift | `assignment_time_conflict`、new Assignment不可 |
| concurrent duplicate attempts | Shift lock + partial uniqueでone Assignmentへ収束 |
| accepted Application exists | explicit `accepted_application` path、`source=application` |
| no Application exists | direct Admin pathを許可。Applicationを捏造しない |
| applied Application exists | accept / reject decisionを先に要求 |
| rejected / withdrawn Application | implicit overrideせずcontrolled outcome |
| Worker becomes unavailable after render | execution-time factsで`not_eligible` |
| Qualification expires / is revoked | target Shift dateで再評価し`not_eligible` |
| Manager foreign Branch | nondisclosing `unavailable` |
| System Admin organization scope | Worker / Shift organization scope内なら認可 |
| capacity boundary | existing reuseは成功、新規作成は`capacity_reached` |
| same-key retry | original result replay、duplicateなし |
| same key / different request | `IDEMPOTENCY_CONFLICT` |
| Placement handoff | server resultのcanonical Assignment IDだけを使用 |

## Security Boundary

- Candidate list / detailはread-only explanation。
- commandはactor、Branch、Worker、Shift、Application、eligibility、capacityをDB内で再導出。
- direct table insert privilegeをruntime roleへ戻さない。
- SECURITY DEFINERを採用する場合はowner `postgres`、`search_path = ''`、全object schema-qualified、explicit auth、PUBLIC / anon revoke。
- private receipt / internal locks / authorization detailsをData APIへ公開しない。
- service_role product pathを追加しない。

## Explicit Non-Changes

- product code / UI: unchanged
- DB schema / migration: unchanged
- RLS / RPC: unchanged
- Assignment / Placement runtime behavior: unchanged
- Candidate Eligibility persistence: not added
- ranking / scoring / AI: not added
- travel / area-category matching: not added
- Open Shift: not added
- packages / Auth architecture: unchanged
- remote Supabase: unchanged
- commit / push: not performed
- existing uncommitted work: preserved

## Implementation Readiness

Recommended implementation order:

1. STAFF-2E overlap refinement + targetShiftAssignment fact
2. STAFF-2F composer regression / result extension
3. idempotent candidate Assignment command + private receipt
4. Assignment / capacity / concurrency integration suite
5. Candidate Picker UI
6. explicit Assignment confirmation and canonical Placement handoff

This contract makes the flow from Worker candidate to Placement unambiguous without treating a UI selection as a write or authorization proof.

`STAFF-2G.0: COMPLETE`
