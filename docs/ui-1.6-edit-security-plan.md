# UI-1.6 Edit Security / Concurrency Foundation

## Scope

Project、Job、Shiftの後続Edit実装で共通利用するSecurityと楽観的競合制御の基準を定義する。Edit UI、編集項目、状態遷移、Delete、ArchiveはこのPhaseに含めない。

## Required server flow

1. Entity IDと`expectedUpdatedAt`をZodで検証する。
2. Cookie SessionからCurrent Profileを取得し、ManagerまたはSystem Adminだけを通す。
3. Supabase Server ClientでCurrent RowをRLS経由で再取得する。
4. 再取得した行から支店、親子関係、現在状態、現在値を解決する。Client由来のbranchやparentを認可根拠にしない。
5. Entity固有Ruleを最新DB状態に対して検証する。
6. 入力値と現在値が同じならUPDATEせず`no_change`を返す。
7. `id = entityId AND updated_at = expectedUpdatedAt`を条件にUPDATEする。
8. 更新行を`.select("id, updated_at")`で受け取り、1行なら`updated`、0行なら`conflict`、複数行またはDB Errorなら一般化Errorとする。
9. Success時だけEntityごとのPathをrevalidateする。

`expectedUpdatedAt`は認可情報ではなく不透明なConcurrency Tokenとして扱う。`Date`へ変換せず、Data APIから受け取ったISO timestamptz文字列をそのまま往復させる。PostgreSQL側の`timestamptz`比較が同じ時点を比較するため、offset表現差にも依存しない。

## Actor and tenant boundary

| Actor | Project / Job / Shift edit |
| --- | --- |
| anon | 拒否 |
| inactive profile | 拒否 |
| Worker | 拒否 |
| Manager | `manager_branch_access`で許可された支店だけ許可 |
| System Admin | 全支店を許可 |

Managerの支店境界は既存RLS Helperで強制する。Projectは`branch_id`、Jobは`job -> project -> branch`、Shiftは`shift -> job -> project -> branch`をDBのCurrent Rowから解決する。

## Immutable relations

- Project: `branch_id`
- Job: `project_id`
- Shift: `job_id`

これらは後続Update DTOの`values`に含めない。

## Entity-specific update cores

巨大な汎用`updateEntityCore()`は作らない。後続Phaseでは`updateProjectCore()`、`updateJobCore()`、`updateShiftCore()`を個別に実装し、共通Result、Token Schema、Actor Helperだけを共有する。

### Project

- Client変更先はProjectと同じBranchに限定する。
- Project期間は既存の全Shiftを内包する。
- status遷移をServer側の最新状態で検証する。
- Revalidate: `/admin`、`/admin/projects`、`/admin/projects/[projectId]`。

### Job

- Workplace変更はShiftが0件の場合だけ許可する。
- wage / transport変更はAssignment状況を考慮する。
- status遷移をServer側の最新状態で検証する。
- Revalidate: `/admin`、`/admin/projects`、`/admin/projects/[projectId]`、`/admin/shifts`。

### Shift

- start/end、required workers、break、deadline、statusの各Ruleを最新状態で検証する。
- Application、Assignment、attendance events、attendance record、`now >= starts_at`を考慮する。
- 原子的な状態遷移が必要になった場合はUI-1.6Dで別途DB設計を判断する。
- Revalidate: `/admin`、`/admin/projects`、`/admin/projects/[projectId]`、`/admin/shifts`、`/admin/shifts/[shiftId]`、`/admin/attendance`。

## Capability design

UIのdisabled表示用にはEntity固有のDerived CapabilityをServer/Domain層で返す。例として`canEditWorkplace`と`workplaceReason`を対にする。ただし、Capabilityは表示補助であり、Submit時にも同じRuleをCurrent Rowへ再評価する。

## Safe results

`EditActionResult`は`updated`、`no_change`、`validation`、`conflict`、`forbidden`、`error`を区別する。ClientへSQLSTATE、Policy名、Constraint名、Table名、内部Errorを返さない。

UPDATE後の行は既存SELECT Policyも満たすActorに限り`.select("id, updated_at")`で取得できる。PKとConcurrency Tokenで絞るため返却は最大1行であり、配列長を更新件数として扱う。0件は不存在・不可視・状態変化・競合を推測で細分化せず、事前認可を通過した通常フローでは安全なConflictとして扱う。
