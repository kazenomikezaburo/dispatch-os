# Phase UI-2.5A 実装結果

最終検証日：2026-09-08（Asia/Tokyo）。実装開始：2026-09-05。

## Executive Summary

- Route: `/admin/placement`。
- Navigation: 配置・休憩回しをimplementedへ変更。
- Placement mode: 日付別・シフト単位のread-only Operational Board。
- Assignment editing: Placement内ではDeferred。既存Shift Hubの応募・配置操作へリンクする。
- Staff Picker: 未実装。任意Workerを直接配置する既存Actionは存在しない。
- Future omitted: position、time segment、スタッフ別休憩、rotation、coverage、multi-venue。

## Sources

- Figma Main: `515:2`、Drawer: `515:431`、Picker: `517:14`。実装開始時にget_design_contextと画像を直接確認。
- 関連Figma: Shift `496:3034`、Staff `544:2` / `544:271`、Pre-shift `523:2`。
- [Figma Main](https://www.figma.com/design/Pmb52CO7UgsQDA5tvoqUjF/Dispatch-OS?node-id=515-2)。再開日はFigmaを再取得していない。
- Final Audit: `docs/admin-final-alignment-audit-v1.md`。
- Staff / Shift: `docs/admin-staff-basic-recovery-result.md`、`docs/admin-shift-views-result.md`。
- Foundation / Interaction: `docs/dispatch-os-design-foundation-v1.md`、`docs/dispatch-os-ui-ux-v1.md`、`docs/dispatch-os-ui-patterns-v1.md`。
- Security: `docs/ui-1.6-edit-security-plan.md`、既存Assignment/Application actions、migration001〜009の関係箇所。
- API: インストール済みNext16.3.1のpage/errorドキュメント（error boundaryは`retry`）。[Supabase range](https://supabase.com/docs/reference/javascript/using-modifiers-range)も確認。
- Figmaスキルに沿い、既存semantic tokenと部品に適合。Figmaの保存できない入力は再現しない。React品質チェックではServer主体、不要なclient fetch/effectなし、安定key、batch lookupを確認。

## Git State

- Branch: `small-ui-a11y-fix`。
- Start clean: Yes。開始HEAD `8652454`。
- Existing staged / unstaged / untracked: 開始時すべて0。
- 再開時の差分は本Phaseの途中実装。保持して検証を続行。
- Commit / push: なし。

## Assignment Domain Inventory

- Table: `public.assignments`。
- Fields: id、shift_slot_id、worker_id、source、status、assigned_by、assigned_at、confirmed_at、取消日時・理由、timestamps。
- Status: assigned / confirmed / completed / cancelled_by_worker / cancelled_by_company / absent / no_show。
- Active definition: shared `ACTIVE_ASSIGNMENT_STATUSES`のassigned / confirmed / completed。
- Cancelled definition: 両cancelled statusとabsent / no_showは今回の配置数・スタッフ一覧から除外。
- Worker relation: workersへのFK。スタッフ情報はRLSで別途不可視になり得るためnullable left relation。
- Shift relation: shift_slotsへのFK。required_workersを必要人数に使用。
- Existing actions: `assignWorkerToShift(shiftId, applicationId)`、`cancelAssignmentByCompany`。欠勤系はAttendance責務として今回使わない。

## Application Domain Inventory

- Table: `public.shift_applications`。
- Status: applied / accepted / rejected / withdrawn。
- Assignment transition: 応募承認と配置作成は別操作。accepted applicationからRPCが配置作成。
- Existing actions: accept/rejectは`app/actions/shift-applications.ts`、配置作成は`app/actions/assignments.ts`。
- applied状態条件と更新件数で応募判断の競合を検出。

## Placement Boundary

### Existing Domain Supports

- シフト単位の必要人数・配置人数・不足・配置スタッフ・状態・共通予定休憩。
- 承認済み応募からの配置、開始前assigned/confirmedの会社都合取消。
- 取消は安全な既存処理がある。未実装の理由を「Backend非対応」とは扱わない。横断一覧では編集を複製せず、既存Hubに集約した。

### Not Supported

- position、effective time segment、break start/end、break rotation、coverage timeline、multi-venue placement。

## Route Architecture

- Main: Server Component `/admin/placement`。alias、API、作成・編集routeは追加なし。
- Query: date / q / project / staffing / shift / page。
- Default: Tokyoの今日、staffing=all、page=1。
- Invalid fallback: abc、2026-02-30等はTokyo今日。ID不正は一致なしにし、条件を勝手に広げない。
- 1日のシフトを取得後に検索・絞り込み、表示は20シフト単位。

## Navigation

- Before: future / hidden。
- After: implemented / clickable。
- Desktop / Mobile: 共通`admin-nav.ts`から生成。
- Active: `/admin/placement`のpathnameに一致。query付きでも維持。
- Shift Hub: 「配置一覧で確認」→対象開始日＋shift。
- Project Hub: 運用sectionからproject filter付きで今日を表示。

## Date Navigation

- Previous / Today / Next: civil date helper再利用。q/project/staffing保持、shiftとpageをリセット。
- 日付入力: GETフォーム。実在日付のserver検証あり。
- Back / Forward: 1/15→1/16→Back→ForwardをChromeで確認。フィルター履歴も確認。
- 年境界・Tokyo午前0時・うるう日：pure tests。

## Summary

- Shifts / Required / Assigned / Shortage / Filled / Shortage shiftsの6項目。
- 集計は絞り込み後の全結果。ページ単位ではない。
- 人数はシフト単位の延べ人数。ユニークスタッフ数と誤認しない注記。
- shortageは既存`buildShiftList`のmax(required-active,0)を再利用。

## Filters

- Search: Project / Job / Workplace、100文字、対象日データ上でcase-insensitive。
- Project: 対象日のRLS可視候補のみ。
- Staffing: all / shortage（未配置含む）/ filled。
- Shift: Hubから指定可能。不存在・他支店は同じ安全なNot Found。
- URL preservation: GET送信、日付移動、reset、paginationを共通helperで構成。フォームkeyはURL条件に追従。

## Placement List

- Grouping: Shift。Ordering: startsAtの実時刻、同時刻はShift ID。
- Shift: 時間＋Job名を主要link。Project名もHubへlink。
- Job / Workplace / Required / Assigned / Shortage: 既存事実を表示。
- Planned break: `break_minutes`のみread-only。NULLは未設定、0は0分。旧planned_break_minutesへの勝手なfallbackなし。

## Assigned Staff

- Fields: display_name、staff_code、Assignment status。
- Staff link: `/admin/workers/[workerId]`。
- Assignment status: 既存AssignmentStatusBadgeを再利用。
- Worker不可視: 配置数は維持し、名前・ID・リンクを出さず汎用案内。
- Remove/cancel: Placement内なし。「シフトで配置を管理」へ。

## Staff Picker

- Implemented: No。
- Reason: 安全な任意Worker-ID直接配置Actionなし。
- Candidate rule / Search / Pagination / Duplicate handling / Mobile: Pickerとしては対象外。
- Availability: 推定なし。勤務可能・おすすめ・配置不可などの新ルールなし。

## Assignment Mutation

- Existing action reused: 既存Hubへの導線を利用。Placementから直接action呼出なし。
- New mutation logic: 0。既存action変更0。
- Authorization / RLS: active profile、manager/system_admin、既存branch policy。
- Validation: 既存UUID/対象照合。配置RPCはaccepted応募、容量、同一Shift/Worker重複を検証。
- Concurrency: 配置はShift lock＋partial unique index。取消はAssignment lock＋現在status検証。
- Restrictions: 取消はassigned/confirmedかつ開始前。完了は対象外。
- 配置作成RPCにはcross-shift overlap、Worker active、Shift開始時刻・statusの追加制限は見つからない。UIで発明しない。
- Feedback: 既存Hub側を維持。新しい成功・取消通知は追加しない。
- Mutation QA / cleanup: read-only modeのため実施なし。fixture変更・残置なし。

## Figma Features Omitted

- Position / Time segment / Break rotation / Timeline / Coverage / Drag-drop: 全て省略。
- Reason: 保存Domainがない。見かけだけの入力やfake persistenceは禁止。
- Drawerは時間帯等の編集が中心のため省略。Future CTAも追加なし。

## Data Access

- Shift query: 1日のstarts_at gte/lt。Job/Project join、nullable Workplace。
- Assignment query: 対象Shift IDを100件単位にbatch、shared active statusesで限定。
- Worker query: Assignmentのleft relation。全スタッフ一覧は取得しない。
- Date bound: Tokyo開始日00:00以上・翌日00:00未満。夜勤は開始日のみ。
- Pagination: DBは既存readAllPagesで500行単位、exact count、安定order。低いAPI上限でも続き取得、不完全結果はError。
- UIは20シフト。全日データを集計するため極端な大量日次件数の性能は別途実測が必要。
- N+1: シフト・スタッフ個別queryなし。
- Branch scope: requireAdminとCookie SSR client＋RLS。service_roleなし。

## Responsive

### 1440

- Layout / Density: 横型3領域のstructured board、6項目summary。
- Overflow: document scrollWidth=clientWidth=1425（scrollbar除外）。

### 1280

- Layout: filter/controls保持、3領域の配置行を確認。
- Overflow: 1265=1265。

### 390×844

- Layout: summary2列、filters縦積み、Shift stack card。
- Staff list: 名前・ID・状態を可読表示。
- Picker: 対象外。
- Navigation: 全画面ナビ、Shift+Tab循環、Escape、triggerへのfocus restore、body scroll lockを確認。
- Overflow: 375=375。表示中mainのlink/button/input/selectは44px未満0。
- viewport一時変更は検証後reset。

## Chrome QA

- Default: `/admin/placement`で2026-09-08。
- Direct date: 2099-01-15。
- Prev / Next / Today / 日付入力: 実操作PASS。
- Filters: Job検索＋Project＋不足→1件、充足→0件。
- History: 日付Back/Forward、検索条件付き履歴確認。読み込み中は結果と扱わず完了後確認。
- Shift link / Staff link / Project link: 実遷移PASS。Shift→Placementの対象指定、Project→Placementのproject保持PASS。
- Assignment operation: 未実施、Placement内に操作なし。
- Mobile: stack、タッチ領域、ナビkeyboard確認。
- 不正日付fallback、他支店ShiftのNot Found、0件、未配置staff emptyも確認。

## Data Verification

ローカルDBのBEGIN READ ONLYで照合。以下3行のDB/UIが一致。

| Shift | Tokyo日付 | Required | Active assigned | Shortage | Planned break |
| --- | --- | ---: | ---: | ---: | --- |
| 20000000-0000-0000-0000-000000000001 | 2099-01-15 | 3 | 1 | 2 | NULL / 未設定 |
| 20000000-0000-0000-0000-000000000005 | 2099-01-16 | 1 | 1 | 0 | NULL / 未設定 |
| 69200903-191c-4db2-be3b-c0cc917387c0 | 2099-01-27 | 2 | 0 | 2 | NULL / 未設定 |

- 最初のShift: TEST Worker B、confirmed→確認済み。
- NULL休憩に「分」だけ残る新規UI不具合をChromeで検出し修正、再検証済み。
- ローカル既存Shiftにbreak_minutes非NULLのfixtureはなし。0/60分の保持はpure test、実DBブラウザー検証は未実施。

## Security

- Manager: 自支店可視、他支店Project/Shift/Assignment/Worker非表示をread-only検証。
- System Admin: 両支店可視をread-only role claimsで検証。
- Worker: own Assignmentのみ、他staff/branch非表示、manager entitlementなしを検証。Admin routeは既存requireAdminでredirect（コード確認）。
- RLS / GRANT: 有効、anon SELECTなし、authenticated Assignment INSERT/UPDATE/DELETEなし。
- ロール別Chrome再ログインは未実施。Manager Aの既存sessionで操作。

## DB

- Migration / RLS / GRANT / RPC / Function / Trigger / Seed / Auth: 変更なし。
- Remote: 接続・write・db pushなし。
- Local: `http://127.0.0.1:54321`を確認しdev/buildプロセス環境だけ上書き。
- `.env.local`、package、lockfile変更なし。直接SQL mutationなし。

## Regression

- Project Hub: 既存内容表示、運用link実操作。
- Shift List: 11件・必要30/配置3/不足27の表示。
- Week / Calendar: 今日の週・月の表示切替、空状態。
- Shift Hub: 応募section・配置導線を確認。既存mutationは実行なし。
- Pre-shift / Attendance: 今日付近の空状態・filters表示。
- Staff: Worker B Hubの実データ表示。
- Navigation: Desktop表示、Mobile active/focus/close。
- 既存全画面の全操作を網羅した回帰試験ではない。

## Console

- 確認したChromeタブのwarn/errorログ: 0。
- React / Hydration / Runtime: 観測エラーなし。
- Network: 観測したconsole errorなし。全HAR監査は未実施。
- CSS: 3幅overflowなし。最初のviewport screenshot縮尺不整合はreset後に再撮影。
- A11y: 永続label、文字付きstatus、44px、keyboard確認。自動WCAG監査なし。

## Tests

- Placement rules: 39/39 PASS。Date、不足、Assignment exclusions、filter、URL、sort、missing relation、pagination/error等。
- Placement security read-only: 28/28 PASS。
- Shift views: 33/33 PASS。
- Admin UI alignment: 24/24 PASS。
- Picker / Mutation tests: 対象外。
- 既存Assignment統合suiteはAuth/SQL fixture作成を含むため実行しない。既存Security期待値は変更なし。

## Validation

- TypeScript: `npx tsc --noEmit` PASS。
- Build: `npm run build` PASS、`/admin/placement` dynamic route生成。
- scoped ESLint: PASS。
- git diff --check: PASS。環境のLF→CRLF通知のみ。

## Future Placement Domain Requirements

### Facts that need persistence

- Position: 配置先・役割の識別とShiftとの関係。
- Time range: Assignment内の有効時間帯。
- Break interval: スタッフ別休憩の開始・終了。
- Coverage: 順序、代替担当、時間帯別必要人数と充足の事実。

### Figma features blocked by missing Domain

- 複数配置segment、スタッフ別休憩、交代・coverage timeline、multi-venue。

### Recommendation

- 次Phaseで事実・権限・競合・時間重複・状態遷移を設計し、承認後に永続化を別実装。table名・columnをSOTとして確定しない。

## Limitations

- Placement内編集は意図的にDeferred。取消Backendは存在するが、今回のboardに複製しない。
- 同日大量シフト・スタッフの性能測定、21件以上の実ブラウザーpagination、意図的DB障害時のretryは未実施。
- Loadingは実遷移で確認、Errorは共通部品とreadAllPages failure test。障害を起こすDB変更は行っていない。
- Figmaとの完全pixel parityではなく、ユーザー指定のExisting Domain Foundation。

## Next Phase Recommendation

- Recommended: Placement編集範囲の決定、またはFuture Placement Domainの概念設計。
- Reason: 現行の応募→承認→配置と任意スタッフ直接配置を区別する必要がある。
- Domain blocker: position/time range/break/coverageの保存・整合性。安全な取消のみのUI追加は新Domainなしで可能だが別途QAが必要。

UI-2.5A: COMPLETE WITH READ-ONLY PLACEMENT
