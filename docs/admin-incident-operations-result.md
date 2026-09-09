# Phase UI-2.7E 実装結果

## Executive Summary

- Admin Incident Operations: WorkerのHelp Requestを発見・確認・対応開始・解決できるcanonical owner surfaceを追加した。
- Canonical route: `/admin/incidents`
- Navigation: 「連絡」配下の「ヘルプリクエスト」。Generic Inquiryの完成を示さない名称とした。
- Acknowledge / Resolve: signed-in Supabase clientから既存RPCのみを呼ぶServer Action。direct DMLはない。
- Audit: 選択中Incidentだけをbounded readし、actorとversion遷移を表示する。request snapshotとidempotency keyは表示しない。
- Day-of: unresolved IncidentをAttendanceとは独立したattention facetとして追加した。
- Worker E2E: create → Admin open → acknowledge → Worker acknowledged → resolve → Worker resolvedを実Chromeで確認した。
- DB changes / Notification / Realtime: 0。

## Sources / IA

- DOMAIN-2.7B、DB-2.7C、UI-2.7D、実migration/RPC/RLS、Day-of実装、共通Drawer、UI/UXガイドを確認した。
- Figma: Incident intent `109:2`, `110:2`、関連Future `116:2`, `117:2`, `117:233`, `118:2`, `119:2`、Day-of `523:257`, `525:229`、Admin navigation `602:86`。
- Figmaの「問い合わせ・SOS」は、問い合わせ、担当、優先度、通知、電話、LINEまで実装済みと誤認させるため採用しなかった。
- Query state: `state`, `category`, `q`, `page`, `incident`。Drawerは`incident=<id>`でBack close / Forward reopenに対応する。

## Read Model / Main UI

- Root: `operational_incidents`をRLS-backed server read。
- Assignment context: AssignmentからWorker、Shift、Project、Job、Workplaceをrelation readする。
- Events: 詳細選択時のみ最大20件を読む。一覧でevent N+1は発生しない。
- Default: unresolved。openをacknowledgedより先、同stateは`created_at ASC`。terminal historyは新しい順。
- Summary: 未対応、対応中、本日解決。Filter: state / category / search。Search対象はWorker名、staff code、Project、Job、Workplaceで、messageは対象外。
- Pagination: 20件。Main messageはbounded preview、全文はDrawer内だけに表示する。
- State: open「未対応」→対応開始、acknowledged「対応中」→確認付き解決、resolved「解決済み」read-only、retracted「取り下げ」read-only。
- Empty state、文字付きstatus、関連するWorker / Shift / Attendance / Day-ofリンクを実装した。

## Commands / Error Handling

- Acknowledge: `acknowledge_operational_incident`
- Resolve: `resolve_operational_incident`
- Payload: incident id、expected version、client-generated UUID idempotency keyのみ。actor / branchは送らない。
- Pending中は多重送信を抑止し、成功後は関連routeをrevalidateする。
- `VERSION_CONFLICT` / `STATE_CONFLICT`: 最新状態の再読込を案内する。
- `INVALID_INPUT`, `NOT_FOUND`, `FORBIDDEN`, `IDEMPOTENCY_CONFLICT`: raw DB errorを露出せず安全な日本語へ変換する。
- openからresolveするUI、Admin create/retract、任意編集は存在しない。

## Day-of Integration

- 既存の日付bounded Assignment取得後、Assignment IDsに対するunresolved root queryを1回追加した。
- `incidentAttention`はAttendance stateを置換しない独立facet。open / acknowledgedだけを表示し、resolved / retractedは除外する。
- 既存attention reasonは保持し、同時に読める。要確認summary/filterへ統合した。
- 優先順: open Incident、no_show、absent、start_missing、acknowledged Incident、late、early leave、pre-shift unavailable。
- Staff rowとDay-of Drawerからcanonical Incident Drawerへ移動できる。Day-ofにmutationやaudit複製はない。

## Security / Privacy

- Manager: own branch root/audit/read/action。Foreign branchはRLSで不可。
- System Admin: cross-branch read/action。WorkerはAdmin routeへ入れず、eventも読めない。
- direct root/event DML権限は追加していない。通常アプリでservice roleは使用していない。
- Health categoryにもseverityを推測せず、連絡先・位置情報・医療詳細・request snapshotを追加表示しない。

## Chrome E2E / Responsive / Accessibility

- 実Chrome: Worker create、Admin open、Admin acknowledge、Worker「対応中」、Admin resolve、Worker「解決済み」、3段階auditを確認した。
- Day-of: open/acknowledgedの独立表示とcanonical linkを確認した。terminal後はattentionから除外される。
- 1440×900、1280×800のdesktop layoutと390×844のmobile cards/Drawerを確認した。390pxでdocument overflowは0。
- Drawer focus trap、Escape close、起点「詳細」へのfocus restore、44px級操作領域、非color-only status、解決確認を確認した。
- Browser console warning/error 0、確認中のHTTP 500 0。Realtime/notificationなしでnavigation refreshにより反映した。

## Fixture / Regression

- Local-only fixtureは固定prefix/UUID、local Docker psql guard付き。lifecycleは認証済みRPCで作成し、exact cleanup済み。残存0。
- Operational Incident DB: 47/47 PASS
- Worker Help Request UI: 18/18 PASS
- Admin Incident UI: 19/19 PASS
- Day-of: 17/17 PASS（Incident batch/facetはAdmin 19 testsとChromeで補完）
- Attendance UI rules: PASS
- Pre-shift monitor: PASS
- Placement: 39/39 PASS
- Placement editor: 13/13 PASS
- Placement security: 28/28 PASS
- TypeScript: PASS
- Build: PASS（`/admin/incidents`を含む）
- scoped ESLint: PASS
- `git diff --check`: PASS（既存のLF/CRLF noticeのみ）

## Git / Environment / Boundaries

- Branch: `small-ui-a11y-fix`
- 既存のDOMAIN-2.7A / DOMAIN-2.7B / DB-2.7C / UI-2.7Dおよび無関係なstaged `my-video/`は保持した。
- Commit / Push: 0。Remote / db reset / db push: 0。
- Migration / Schema / RLS / GRANT / RPC / Function / Trigger / Auth / Package changes: 0。

## Figma Alignment / Deferrals

- Implemented: compact queue、filter、structured rows、detail Drawer、audit、Day-of incident cue。
- Adapted: Communications画面の視覚意図を既存Admin shell/patternへ合わせ、DB-2.7C vocabularyに限定した。
- Omitted intentionally: Generic Inquiry、assignee、priority/severity、notification、phone、LINE、SLA、arrival、GPS、escalation、resolution note、Realtime。

## End-to-End Freeze

- Worker Help Request lifecycle v1はcreate / discover / acknowledge / Worker status / resolve / Worker history / Day-of attention / audit / securityまでPASS。
- Remaining P0: なし。
- Remaining P1: なし。
- 次Phaseでは通知などを混在させず、必要性を別Domain phaseで評価する。

UI-2.7E: COMPLETE
