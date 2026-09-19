# Phase ADMIN-UI-3.0B-5D — Unified Master Data Workspace Result

## Status

```text
ADMIN-UI-3.0B-5D: COMPLETE
ADMIN-UI-3.0B-5E: READY
```

Client と Workplace の canonical routes、Domain、CRUD contractを維持したまま、両画面を一つの「マスタ」workspaceとして統一した。Local / LANの実ブラウザQA、focused regression、repository-wide static verificationはすべてPASSした。

## Existing Master Architecture

- `/admin/clients` と `/admin/workplaces` は独立したServer Component route。
- Client / Workplaceは別entityで、既存Data Access、schema、Server Actionも分離されている。
- 一覧、検索、状態filter、KPI、pagination、empty stateは既存実装済み。
- create / editは共通 `MasterEditor` と `Drawer` を利用し、一覧を離れず保存する。
- Sidebarは既に「マスタ」group配下へ「取引先」「勤務先」を配置していた。
- 旧画面にも相互navigationはあったが、workspace titleとdomain content titleが分離されていなかった。

## Unified Workspace

両routeへ共通 `MasterWorkspaceHeader` を配置した。画面階層は以下で統一した。

1. Workspace title: マスタ
2. Description: 案件で利用する取引先・勤務先を管理します。
3. Domain tabs: 取引先 / 勤務先
4. Content heading: 取引先一覧 / 勤務先一覧
5. Current-domain action、KPI、filter、list、pagination

新しい `/admin/master` routeは作らず、既存deep linkとCRUD architectureを維持した。

## Navigation

- 取引先は `/admin/clients`、勤務先は `/admin/workplaces` のreal Link。
- active stateはClient Component内の `usePathname()` とrouteの完全一致から導出。
- local stateをnavigation source of truthにしていない。
- active tabはfont weight、text tone、underlineで非color-onlyに表現。
- tab containerは狭い画面でhorizontal overflowを内包する。
- Collection Workflow Tabsとは別のnarrow Master workspace componentとして維持した。

## Client

- search、status filter、KPI、responsive list、paginationを維持。
- 現在Domainのactionとして「取引先を追加」のみ表示。
- rowごとの既存edit actionとClient statusを維持。
- empty stateではClient固有文言とClient create actionを表示。
- Server Action、validation、conflict handling、branch scopeは変更していない。

## Workplace

- search、status filter、KPI、responsive list、paginationを維持。
- 現在Domainのactionとして「勤務先を追加」のみ表示。
- rowごとの既存edit action、住所、利用業務件数、statusを維持。
- empty stateではWorkplace固有文言とWorkplace create actionを表示。
- Server Action、validation、conflict handling、branch scopeは変更していない。

## Editors

共通 `MasterEditor` / `Drawer` architectureを維持した。Client formとWorkplace formは統合していない。両Editorのwidth、header、close、section spacing、footer actions、overlay、responsive behaviorは既に同じ共通componentで揃っていたため、CRUD内部の変更は不要だった。

実ブラウザでClient create editorとWorkplace create editorを開閉し、dialog semantics、Escape close、focus restoreを確認した。保存操作やbusiness fixture作成は行っていない。

## Sidebar

既存Sidebarの「マスタ」groupを維持し、その配下の「取引先」「勤務先」を使用した。新しいcollapse、dropdown、mega-menu architectureは追加していない。Desktop collapse stateのreload後保持と、Mobile navigation内のMaster group表示を確認した。

## Breadcrumb

- Client: `マスタ / 取引先`
- Workplace: `マスタ / 勤務先`

既存 `AdminBreadcrumb` の自動解決へ、この2つのexact routeだけをnarrow extensionした。他routeのbreadcrumb contractは変更していない。

## Responsive

- 1440x900: workspace hierarchy、tabs、current action、KPI、filter、table/list、Editorを確認。
- 1280x900: tabs、list、current action、Sidebarを確認。
- 390x844: workspace / content heading、tabs、KPI、filter、mobile menuを確認。
- page-level horizontal overflow: 0。
- temporary browser viewport overrideはQA終了時にresetした。

## Accessibility

- tabsはsemantic `nav` とreal `Link`。
- active routeは `aria-current="page"`。
- active stateはunderlineとfont weightを併用。
- tab、create、edit、closeは44px target baselineを維持。
- focus-visible treatmentを維持。
- Editorは既存dialog label、focus trap、Escape、focus restoreを維持。
- Mobile navigationはlabelled control、Escape closeを維持。

## Project Setup Regression

`/admin/projects/new` を実ブラウザで開き、Client / Workplace options、Client existing/new mode、Workplace existing/new modeが引き続き表示されることを確認した。`saveClient`、`saveWorkplace`、Project Setup schema/action contractは変更していない。新しいbusiness fixtureは作成していない。

## Local Browser QA

- `/admin/clients`: PASS
- Client → Workplace tab: PASS
- Workplace → Client tab: PASS
- browser back: PASS
- browser forward: PASS
- reload後のactive state: PASS
- Client editor open / Escape close: PASS
- Workplace editor open / Escape close / focus restore: PASS
- Desktop Sidebar、Mobile menu: PASS
- Project Setup regression: PASS
- console errors: 0
- React warnings: 0
- hydration warnings: 0

## Network Browser QA

実行時に取得したLAN originを使用し、IPをapplication codeへhardcodeしていない。

- Client page: PASS
- Workplace page: PASS
- real-link tab transition: PASS
- reload後のactive state: PASS
- Sidebar collapse / reload persistence: PASS
- Workplace representative editor: PASS
- page-level horizontal overflow: 0
- console / React / hydration warning: 0

## Tests

- Admin Master Workspace: 36 / 36 PASS
- Project Setup: 35 / 35 PASS
- Project Management Hub: 31 / 31 PASS
- Admin Shell Workflow Tabs: 11 / 11 PASS
- Admin Visual Consistency: 35 / 35 PASS

既存Visual Consistency testは、直接 `AdminPageHeader` を使う画面と、共有 `MasterWorkspaceHeader` 内で同headerを使うMaster画面の双方を同じshared-header gateとして検証するよう更新した。検証範囲の弱体化ではない。

## Static Verification

- repository-wide ESLint (`npm run lint`): PASS
- TypeScript (`npx tsc --noEmit`): PASS
- production build (`npm run build`): PASS
- `git diff --check`: PASS（既存line-ending noticeのみ）

Buildの初回sandbox実行はGoogle Fontsへのnetwork accessで失敗した。コードerrorではなく、同一内容を許可済みnetwork環境で再実行してPASSした。package変更はない。

## Files Changed

- `app/admin/clients/page.tsx`
- `app/admin/workplaces/page.tsx`
- `components/admin/masters/master-workspace-header.tsx`
- `components/admin/admin-breadcrumb.tsx`
- `scripts/integration/admin-master-workspace-test.mjs`
- `scripts/integration/admin-visual-consistency-test.mjs`
- `docs/admin-ui-3.0b-5d-master-workspace-result.md`

既存 staged / unstaged / untracked workは保持した。

## Explicit Non-Changes

- Client / Workplace Domain and direct relationship: unchanged
- Client / Workplace CRUD, lifecycle, validation, Data Access: unchanged
- Project Setup action / schema contract: unchanged
- Project Detail, Shift, Placement, Pre-shift, Day-of, Attendance: unchanged
- Communication / Incident / Announcement: unchanged
- Worker: unchanged
- DB schema / migrations / RLS / RPC / GRANT: unchanged
- Auth architecture and fixture data: unchanged
- Packages / lockfile: unchanged
- Figma: read-only reference; changed nodes 0
- Remote Supabase / production / staging: unchanged
- Commit / push: 0
- Existing uncommitted work: preserved

```text
ADMIN-UI-3.0B-5D: COMPLETE
ADMIN-UI-3.0B-5E: READY
```
