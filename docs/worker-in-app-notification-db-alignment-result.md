# Phase DB-2.8C.1 実装結果

## Executive Summary

- Local drift: 再現。Local DB上の `public.project_incident_in_app_notification(uuid)` にだけ未使用 `v_outcome text` 宣言が残っていた。
- Repair: 新規forward-only migrationで同functionを `CREATE OR REPLACE`。未使用宣言だけを除去した。
- Behavior / Domain / Security: 変更 0。
- Post-apply: migration本文と `pg_proc.prosrc` が完全一致し、DB lint warning/error 0。
- Remote / reset / push / commit: すべて 0。

## Preflight / Sources

- Branch: `small-ui-a11y-fix`。
- HEAD: `3cde196 feat: add operational incident help request flow`。
- 既存未commit作業: DOMAIN-2.8A、DOMAIN-2.8B、DB-2.8C migration/test/resultを保持。既存ファイルのrestore/reset/reformatは行っていない。
- SOT: `docs/worker-in-app-notification-domain-design-v1.md`、`docs/worker-in-app-notification-persistence-result.md`、`supabase/migrations/20260910051738_worker_in_app_notification.sql`、`scripts/integration/in-app-notification-test.mjs`。
- Actual SOT: Local PostgreSQLの `pg_get_functiondef`、`pg_proc`、`pg_namespace`、function ACL、DB lint結果。

## Before Alignment

- DB lint warning count: 1。
- Schema/function: `public.project_incident_in_app_notification`。
- Exact issue: `unused variable "v_outcome"` (`sqlState 00000`)。
- Migration source: `v_outcome` 宣言なし。
- Applied DB: `v_outcome text;` 宣言あり。

## Definition Comparison

- Signature: `public.project_incident_in_app_notification(uuid)`、一致。
- Argument: `p_source_incident_event_id uuid`、一致。
- Return: `jsonb`、一致。
- Language/volatility: PL/pgSQL / VOLATILE、一致。
- Owner: `postgres`、一致。
- Security: `SECURITY DEFINER`、一致。
- Configuration: `search_path=''`、一致。
- ACL: `PUBLIC=false`、`anon=false`、`authenticated=true`、一致。
- Body: authorization、branch validation、recipient derivation、eligible event、terminal skip、receipt-first replay、locking、writes、results、exception handlingは一致。
- 唯一の差分: Local DB側の未使用local variable宣言1行。
- Behavior drift: なし。

## Forward Migration

- File: `supabase/migrations/20260910054827_notification_function_alignment.sql`。
- Creation: `npx supabase migration new notification_function_alignment`。
- Apply: `npx supabase migration up --local`。
- Scope: 対象functionの `CREATE OR REPLACE FUNCTION` と、既存owner/EXECUTE contractの再固定のみ。
- Existing migration rollback/rewrite: なし。`migration repair`、`db reset`、`db push`は未使用。
- Tables/columns/constraints/indexes/RLS: 変更 0。

## Security Contract Preservation

- `SECURITY DEFINER`: true。
- `search_path`: empty。
- References: schema-qualifiedのまま。
- Actor: `auth.uid()`由来のまま。
- Manager: source Assignment branch access必須のまま。
- System Admin: active profile validationのまま。
- Worker: projection `FORBIDDEN`のまま。
- Grants: PUBLIC/anon EXECUTEなし、authenticatedのみ。
- Recipient/type/title/summary: server-side derivationのまま。

## Post-apply Verification

- Function source comparison: `BODY_MATCH=True`。
- Unused declaration: `unused_present=false`。
- Signature: `project_incident_in_app_notification(uuid)`。
- Return: `jsonb`。
- Owner: `postgres`。
- `SECURITY DEFINER`: true。
- Volatility: VOLATILE。
- `search_path`: empty。
- ACL: PUBLIC false、anon false、authenticated true。
- DB lint: `No schema errors found`、results `[]`。warning 0 / error 0。
- Migration history: `20260910054827` がLocal側へ追加済み。

## Regression

- Notification: **40/40 PASS**。
- Operational Incident: **47/47 PASS**。
- Worker Help: **18/18 PASS**。
- Admin Incident: **19/19 PASS**。
- Day-of: **17/17 PASS**。
- Attendance: PASS。
- Pre-shift: PASS。
- Placement: **39/39 PASS**。
- Placement editor: **13/13 PASS**。
- Placement security: **28/28 PASS**。

Notification suiteにより acknowledged/resolved、created/retracted、terminal skip、later-link/reactivation非backfill、sequential/concurrent projection、first/replay/concurrent mark-read、own/foreign/admin/anon security、bounded reconciliationを再確認した。

## Validation / Cleanup

- TypeScript `npx tsc --noEmit`: PASS。
- Build `npm run build`: PASS。
- ESLint: Product/script変更なしのためDB-2.8C.1固有の実行対象なし。DB-2.8C scriptは直前PhaseでPASS済み。
- `git diff --check`: PASS。
- Dedicated Notification fixture cleanup: suite内でPASS。共有fixtureの削除なし。

## Changes

- Migration: 1件追加。
- Result documentation: 1件追加。
- Tables / columns / RLS / GRANT expansion / RPC signature / function behavior: 変更 0。
- Product `app/` / `components/` / `lib/`: 変更 0。
- UI / Incident integration / trigger / Realtime / Auth / package: 変更 0。
- Remote DB / `db push` / `db reset` / commit / push: 0。

## Remaining Decision / Next Phase

- Exact Notification/Receipt retention期間は引き続きproduction rollout前の非blocking decision。
- 次Phase: UI-2.8D Worker Notification Inbox / Unread Badge / Read / Source Navigation。

DB-2.8C.1: COMPLETE WITH NON-BLOCKING RETENTION DECISION
