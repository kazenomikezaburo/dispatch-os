# Phase UI-2.7D 実装結果

## Executive Summary

- Worker Help Request: Assignment 詳細に create / current status / terminal history / open retract を実装。
- Entry: `/worker/assignments/[assignmentId]` の「困ったとき」。新規 route なし。
- Mobile: 390×844 を中心に実 Chrome で確認。
- DB changes: 0。DB-2.7C の migration / RLS / GRANT / RPC は変更なし。
- Admin / Notification: 意図どおり未実装。

## Sources

- DOMAIN-2.7B: `docs/operational-incident-domain-design-v1.md`
- DB-2.7C: `docs/operational-incident-persistence-result.md` と `supabase/migrations/20260909071755_operational_incident_persistence.sql`
- Worker Figma: file `Pmb52CO7UgsQDA5tvoqUjF`、page `3:5`（04 Worker）
- UI: `docs/dispatch-os-ui-ux-v1.md`、`docs/dispatch-os-ui-patterns-v1.md`、`docs/dispatch-os-design-foundation-v1.md`

## Route / IA / Figma

- Canonical route: `/worker/assignments/[assignmentId]`
- Entry surface: Assignment 詳細の勤怠直後。
- Figma nodes: Assignment detail Hub `188:52`、既存 support link `336:97`（text `336:98`）、future SOS / inquiry page `229:84`、Support quick entry `338:63`。
- Adapted: contextual entry と mobile-first compact dialog。
- Omitted: SOS severity、notification、generic inquiry、Admin operations。

## Worker Eligibility

| Assignment / Shift | Create CTA |
| --- | --- |
| assigned / confirmed + non-cancelled Shift | 表示 |
| completed / cancelled_by_worker / cancelled_by_company / absent / no_show | 非表示 |
| cancelled Shift | 非表示 |
| open / acknowledged incident exists | CTA を current status card に置換 |

Inactive Assignment の直リンクでも own historical root は表示する。最終 enforcement は create RPC。

## Read Model / Security

- `operational_incidents` root の必要最小 10 fields のみを server-side batch read。
- Assignment IDs に対する `.in()` で N+1 を回避。
- active は open / acknowledged、terminal は resolved / retracted。
- event table、manager actor、request snapshot は Worker から読まない。
- signed-in Worker client と既存 RLS を使用。service role、direct DML、actor / branch payload はなし。

## Create UX / Message

- CTA: 「助けを求める」。dialog に勤務日時・勤務先・Job context を表示。
- Exact categories: `site_access`、`assignment_instruction`、`schedule_transport`、`health_safety`、`other`。
- Category は required selectable cards。message は optional textarea、max 500、counter 付き。
- 空白のみは RPC が null に正規化。privacy helper は医療詳細・電話・住所・password・不要な位置情報を収集しない旨を短く表示。
- pending 中は操作を無効化。client UUID は intentional mutation ごとに生成し、成功で破棄、transport 結果不明時は同一 key を保持。

## Server Action / Error Mapping

- File: `app/actions/operational-incidents.ts`
- Zod server validation 後、create は `create_operational_incident`、retract は `retract_operational_incident` のみを実行。
- ACTIVE_INCIDENT_EXISTS、ASSIGNMENT_NOT_ELIGIBLE、SHIFT_CANCELLED、VERSION_CONFLICT、STATE_CONFLICT は安全な copy と latest refresh に変換。
- INVALID_INPUT / INVALID_CATEGORY と generic failure も SQLSTATE、constraint、PostgREST detail を画面へ出さない。

## Status / Retraction

- open: 「管理者の確認待ち」、送信日時、open のみ「取り下げる」。
- acknowledged: 「対応中」、確認日時、retract なし。
- resolved: 「解決済み」、解決日時、terminal history。
- retracted: 「取り下げ済み」、取り下げ日時、terminal history。
- retract confirmation は expected version と client idempotency key を使い、RPC-only。race conflict は latest refresh。

## Responsive / Accessibility / Browser QA

- Chrome local Worker sessionを使用。Auth mutation なし。
- 390×844: form、open、acknowledged、resolved、retract confirm、validation error を確認。dialog 内 scroll で submit 到達可能。horizontal overflow 0。
- 1280×800: acknowledged card、horizontal overflow 0。
- 1440×900: layout、horizontal overflow 0。
- Keyboard: dialog 初期 focus、Escape close、trigger への focus restore を確認。
- Labels / required error / visible status copy / 44px 以上の主要 target を確認。
- Console warning / error: 0。
- W1 assigned create（空白 message）: 1 root / 1 created event。rapid double action でも 1件。
- W2 confirmed: CTA。W3 open: retract 成功。W4 acknowledged: retract なし。W5 resolved: history + new CTA。W6 retracted: history。W7 completed: history、CTA なし。W8 cancelled Shift: history、CTA なし。

## Fixture

- `scripts/dev/setup-worker-help-request-fixtures.mjs` を追加。
- 固定 RFC UUID、local Docker container のみ。W1〜W8 parent setup 後、lifecycle は authenticated Worker / Manager RPC で作成。
- Auth user は既存 local fixture を再利用し、Auth 変更なし。
- QA 後 `--cleanup` を実行し、root / events / assignments / shifts を exact prefix cleanup。残存 0。

## Regression / Validation

- Worker Help Request UI rules: 18/18 PASS。
- Operational Incident DB: 47/47 PASS。
- Day-of rules: 17/17 PASS。
- Attendance UI rules: PASS。
- Pre-shift rules: 20/20 PASS。
- Placement rules: 39/39 PASS。
- Placement editor rules: 13/13 PASS。
- TypeScript: PASS。
- Next.js production build: PASS。
- Scoped ESLint: PASS。
- `git diff --check`: PASS。

## DB / Domain Changes

- Migration / Schema / RLS / GRANT / RPC / Function / Trigger / Auth / Package / Remote: 0。
- `db reset` / `db push` / commit / push: 未実行。

## Intentional Deferrals

- Admin acknowledge / resolve、Day-of Incident attention、notification、realtime、Arrival、GPS、severity / escalation は次 Phase 以降。

## Next Phase Recommendation

UI-2.7E Admin Incident Operations / Day-of Integration。

UI-2.7D: COMPLETE WITH ADMIN LIFECYCLE UI DEFERRED
