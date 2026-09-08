# Phase UI-2.5D 実装結果

## Executive Summary
- Route: `/admin/placement` を維持。
- Placement v2: 既存Placement Domainへ接続した選択Shift単位の実編集Drawer。
- Position: 追加、名称、nullable必要人数、上下移動、retire。
- Segment: existing Assignmentへ複数時間帯を追加・編集・削除。
- Break: 複数休憩、目標差分、配置重複の保存前検証。
- Coverage: SegmentとBreakから `[start,end)` 境界で派生。永続化しない。
- Atomic save: `save_shift_placement_plan(uuid,bigint,text,text,jsonb,jsonb,jsonb)` のみ使用。
- Conflict: version conflictを専用Feedbackと再読込操作へ変換。
- Correction: Shift開始後は理由を必須表示し、RPCも最終判定。
- Staff Picker: 対象Shiftのexisting Assignment限定。
- Direct Assignment: なし。
- Figma deviation: confirm/notification、availability、location/status/memoはDomain不在のため省略。

## Sources
- Figma Main: `515:2` design context / screenshot確認。
- Figma Drawer: `515:431` design context / screenshot確認。
- Figma Picker: `517:14` design context / screenshot確認。
- C1: `20260908062451_placement_core.sql`。
- C2/RPC: `20260908064853_placement_break_atomic_command.sql` の実定義。
- UI: Design Foundation、UI Patterns、UI/UX v1、edit security plan、Placement各result文書。

## Git State
- Branch: `small-ui-a11y-fix`。
- Start status: C1/C2、Placement Foundation、関連ナビ/Shift/Project変更が未commit。
- Existing dirty: 保持。reset/revert/clean/無関係formatなし。
- Changed by UI-2.5D: `app/actions/placement.ts`、Placement page/board/editor、placement read/rules/types、editor rule test、本書。
- Commit / Push: なし / なし。

## Architecture
- Server Page: 日付・検索・案件・配置状況・paginationを維持。
- Read model: 一覧summaryは対象日Shift IDsでbatch、詳細は選択Shiftだけをlazy read。
- Client editor: server graphを初期値にしたDraft。安定UUID、dirty比較、pending制御。
- Server Action: Zod検証、Auth確認、RPC呼び出し、エラー秘匿、revalidate。
- State ownership: DB/RPCが正本、Client DraftとCoverageは一時派生値。

## Route / URL
- Query: `date,q,project,staffing,shift,page` を維持。
- Editor state: `shift=<id>`。
- Back / Forward: Chromeでclose / reopenを確認。

## Placement Plan Read
- No plan: version 0、空Positions/Segments/Breaks。
- Existing plan: actual versionとgraphを取得。
- Assignments: assigned / confirmed / completedを1 query。Worker relationがRLSで欠けてもAssignmentは保持。
- N+1: なし。詳細graphは3 relationをparallel read。

## Editor
- Position: add/rename/requirement/order/retire。active requirement合計超過はblock。
- Staff Picker: name/staff code client検索、配置済み表示、Assignment作成なし。
- Segment: multiple、Position、start/end、overnight helper、adjacent/gap許可、overlap block。
- Break: multiple、target under/exact/over表示、Segment overlapはactionable validation。auto-splitなし。
- Coverage: Position requirementがnullならunknown。Break中は配置から除外。shortageはwarningでsave非block。
- Desktop: 最大幅3xlの右Drawer。
- Mobile: `w-full` full-screen、timelineの代わりにstacked interval editor。

## Atomic Save / Concurrency / Correction
- Expected version: no-plan 0、保存成功versionを次のtokenへ更新。
- Idempotency: Draft save attempt中は同じUUID、成功後に更新、pending中double submit不可。
- Payload: positions / placement_segments / break_intervals全graph。
- Conflict: Draftを保持し「最新の配置を読み込む」を表示。unsafe mergeなし。
- Correction: `Date.now() >= startsAt`で理由UIを表示。RPCが時刻と理由を再判定しRevisionを作成。

## Error Mapping
| RPC result | UI |
| --- | --- |
| VERSION_CONFLICT | conflict Feedback + reload |
| IDEMPOTENCY_CONFLICT | safe retry message |
| OVERLAP | overlap correction message |
| INVALID_TIME_RANGE | Shift範囲内の修正案内 |
| REQUIREMENT_EXCEEDED | requirement合計エラー |
| CORRECTION_REASON_REQUIRED | reason必須 |
| FORBIDDEN | 権限なし |
| NOT_FOUND | 対象なし |

## Chrome QA
- Auth setup: `.env.local`がremoteだったため保存を停止し、ファイル無変更の一時環境変数でlocalhostへ切替。
- Fixture: `2099-02-15`, Shift `20000000-0000-0000-0000-000000000002`。
- Main / Drawer / Picker: 表示確認。
- First / Second save: 成功。pending表示とdouble-submit disable確認。
- Position / Segment / Break: 作成・保存確認。
- Warning: Segment/Break overlapで保存disabled、修正後保存可能。
- Back/Forward / Escape: 確認。
- Overflow: 実viewport 2560で `scrollWidth === clientWidth`。
- Console: warn/error 0。
- Limitation: 使用可能なChrome制御にviewport overrideがなく、1440/1280/390実寸は未実施。CSS breakpointとmobile full-width構造はbuildで検証。

## Data Verification
- Plan version: 2。
- Active Position / Segment / Break / Revision: 1 / 1 / 1 / 2。
- DBと再読込UIの内容一致を確認。

## Security
- Manager: RLS-visible branchのみ。System Admin: RLSで全branch。Worker: `requireAdmin`でAdmin route不可。
- Direct DML: 追加なし。既存RPCのみwrite。Assignment/Attendance mutationなし。
- Migration / RLS / GRANT / RPC / package: 変更なし。

## Tests / Validation
- Placement rules: 39/39 PASS。
- Editor rules: 11/11 PASS。
- C1 schema/security: 26/26 PASS。
- C2 atomic command: 20/20 PASS。
- Placement security: 28/28 PASS。
- TypeScript: PASS。
- Build: PASS (Next.js 16.3.1)。
- scoped ESLint: PASS。
- git diff --check: PASS。
- Security Advisor: 未実施（DB変更なし、既存C1/C2/security suitesを実施）。

## Figma Alignment
### Implemented
- dense main board、右Drawer、staff grouping、interval edit、break/coverage warning、sticky save controls。

### Intentionally Adapted
- Staff Picker: existing Assignment限定。
- Direct Assignment: なし。
- Future workflow: confirm/notification/history tabなし。

### Omitted
- notifications、availability、direct worker assignment、multi-venue、管理メモ、配置status workflow。

## Limitations
- Chromeの1440/1280/390固定viewport QAとtwo-tab conflict UI QAは未実施。競合のDB原子性はC2 concurrent testで確認。
- Server Actionはbuild/type/lintと実Chrome保存で検証したが、独立mock unit suiteは未追加。

## Next Phase Recommendation
- Recommended: 固定viewportを利用できるChrome環境で3サイズ再確認し、必要なら視覚的timeline laneを別Phaseで追加。
- Reason: v2のwrite/domain boundaryは完成し、残りは実寸visual QAと高度なtimeline polish。

UI-2.5D: COMPLETE WITH AUTHENTICATED CHROME QA LIMITED
