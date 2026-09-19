# ADMIN-UI-3.0B-3 Unified Editors Result

## Status

`ADMIN-UI-3.0B-3: COMPLETE`

`ADMIN-UI-3.0B-4: READY`

## Existing Editor Audit

### Project

- Create は `/admin/projects/new` の page editor、Edit は Project detail 上の right drawer だった。
- Create/Edit は既に `ProjectForm` と create/update action、Zod schemaを共有していたが、header、section、footer、navigation surfaceが一致していなかった。
- Edit は authorized Project detail と form options、`expectedUpdatedAt` を既に利用していた。支店は作成後変更不可である。

### Shift

- Create は page型のmulti-date editor、Edit は detail上のright drawerと単一Shift formだった。
- Createのmulti-date生成、個別override、preview、bulk create contractはproduction固有機能として維持が必要だった。
- Edit は応募・Assignment・勤怠・開始時刻に応じた予定時刻lock、Assignment存在時の休憩lock、配置済み人数による必要人数下限、`expectedUpdatedAt` conflict controlを持っていた。
- drawer内にTokyo日時変換とform options変換が重複していた。

## Figma Comparison

実Figma file `Pmb52CO7UgsQDA5tvoqUjF` の次のnodeをread-onlyで比較した。

- Project Create `489:310`: 基本情報、期間、footerのpage editor。
- Project Edit `492:6`: Createと同じpage幅・section hierarchy・action位置。
- Shift Create `501:2821`: 基本情報、日程、勤務条件、確認のUnified Dates editor。
- Shift Edit `823:218`: Createと同じ基本情報、日程、勤務条件のeditor family。

Production fieldを正本とし、Figma-onlyのカテゴリ、担当管理者、future設定は追加していない。

## Unified Architecture

- `AdminEditorSection` がsection card、semantic heading、説明、spacingを統一する。
- `AdminEditorFooter` がCancel/primary action、pending/disabled、sticky placement、44px targetを統一する。
- `admin-editor-contract.ts` がProject/Shiftのsection order、URL-backed edit href、edit query判定を一元化する。
- `admin-editor-values.ts` がauthorized detailからEdit初期値へ変換し、Project nullable値とShift Tokyo date/timeを保持する。
- Business actionは統合せず、create/updateを別actionのまま再利用する。

## Project Editor

### Shared Sections

1. 基本情報
2. 期間
3. 説明・補足

Create/Editとも同じ `ProjectForm`、field、label、error presentation、footerを利用する。

### Create Mode

- route: `/admin/projects/new`
- empty/default values、作成label、既存create actionとdetail redirectを維持。
- Productionに存在する案件名、支店、取引先、状態、期間、説明のみを表示する。

### Edit Mode

- route: `/admin/projects/[projectId]?edit=1`
- authorized detailからcurrent valuesを設定し、支店はdisabled + 理由表示とした。
- update action、`expectedUpdatedAt`、conflict reloadを維持する。
- 保存成功、Cancelともcanonical Project detailへ戻る。

## Shift Editor

### Shared Sections

1. 基本情報
2. 日程
3. 勤務条件

Createのみ4番目に「作成内容の確認」を持つ。Create/Editは同じsection component、label hierarchy、field grouping、footer languageを使う。

### Create Mode

- route: `/admin/projects/[projectId]/jobs/[jobId]/shifts/new`
- existing bulk create action、date generation、common values、per-date overrideを維持する。

### Edit Mode

- route: `/admin/shifts/[shiftId]?edit=1`
- authorized Shift detailをTokyo date/time form valuesへ変換する。
- 1 Shiftだけを対象とし、update action、nullable break/deadline、status、required workers、`expectedUpdatedAt`を維持する。
- PostgreSQL timestamp text表現の違いで同一時刻を変更扱いにしないよう、既存update coreの比較をinstant単位に正規化した。制約判定やpayloadの意味は変更していない。

### Multi-date Handling

- multi-date追加、期間・曜日生成、共通設定、個別override、preview、bulk submitはCreate専用として保持した。
- Editへmulti-date操作を持ち込まず、選択した単一Shiftのみを編集する。

### Edit Constraints

- planned time lock、break lock、minimum required workersを保持した。
- disabledだけでなく、各lock理由をテキストとerror associationで表示する。
- 制約付き既存Shiftの未変更保存がsafe no-changeとしてdetailへ戻ることをChromeで確認した。

## Route / Navigation Strategy

- 既存dynamic detail route上の `?edit=1` を採用し、route増加を避けた。
- detailのEdit triggerは実Linkであり、URL、reload、browser historyで状態が再現される。
- Editor中はCollection Workflow TabsとDetail contextual tabsを表示せずtask-focused surfaceにした。
- 保存、Cancel、browser backはentityのcanonical detailへ戻る。

## Validation

- Projectは既存Project Zod schema、Shiftは既存Shift Zod schemaを再利用する。
- field-level error、root error、pending、unsaved、forbidden、conflict presentationをCreate/Editで共有する。
- create/update action、field meaning、default meaning、payload semanticsは統合・変更していない。

## Accessibility

- semantic section heading、fieldset/legend、label association、`aria-invalid`、error `aria-describedby`を維持した。
- immutable fieldには視覚表示と読み上げ可能な理由を併設した。
- Cancel/primary actionはkeyboard操作可能なLink/buttonで、44px以上のtargetとfocus-visibleを持つ。
- 390pxではtwo-column fieldがstackし、水平overflowがないことを実測した。

## Create/Edit Consistency

- Project: 同一form component、3つの同一section、同一footer。差分はmode、初期値、支店immutable、button label、update conflictだけ。
- Shift: 同一editor section vocabularyとfooter。差分はCreate固有のmulti-date/previewとEdit固有のcurrent values/lifecycle constraintsだけ。
- Project/Shiftのdrawer editorと未使用Shift create drawerを削除し、同一entityの重複surfaceを解消した。

## Local Browser QA

- Chrome、`localhost`、Manager fixtureで実施。
- Project detail → URL-backed Edit、current values、3 section、支店immutable、未変更save → detail、Create formとvalidation/cancel導線: PASS。
- Shift create context、multi-date control、preview activation、cancel: PASS。
- Shift detail → URL-backed Edit、current values、予定時刻/休憩lock理由、未変更save → detail: PASS。
- desktop 1450x917、390x844、1280x900でeditor action visibilityと水平overflowなしを確認。
- application console error 0、React warning 0、hydration warning 0。

## Network Browser QA

- dev serverが表示したLAN originをその実行時だけ使用し、codeへIPを保存していない。
- Project Edit、Shift Edit、Sidebar単一表示、Cancel、detail navigation、browser back: PASS。
- 390x844のProject/Shift editorで `scrollWidth <= viewport width`: PASS。
- 1280x900: PASS。console error/warning 0。

## Tests

- `admin-unified-editors-test.mjs`: 33/33 PASS。
- `admin-detail-workflow-tabs-test.mjs`: 29/29 PASS。
- `admin-shell-workflow-tabs-test.mjs`: 11/11 PASS。
- `bulk-shift-helpers-test.ts`: PASS。
- `shift-views-test.mjs`: 33/33 PASS。
- `placement-rules-test.mjs`: 39/39 PASS。
- `placement-editor-rules-test.mjs`: 13/13 PASS。
- `edit-concurrency-test.ts`: 4/4 PASS。
- `admin-ui-alignment-test.mjs`: 24/24 PASS。
- `admin-ui-security-readonly-test.mjs`: 7/7 PASS。

## Static Verification

- `npm run lint`: PASS。
- `npx tsc --noEmit`: PASS。
- `npm run build`: PASS。
- `git diff --check`: PASS（GitのCRLF変換予告のみ、whitespace error 0）。

## Files Changed

- `app/admin/projects/[projectId]/page.tsx`
- `app/admin/shifts/[shiftId]/page.tsx`
- `components/admin/editor/admin-editor-contract.ts`
- `components/admin/editor/admin-editor-layout.tsx`
- `components/admin/editor/admin-editor-values.ts`
- `components/admin/projects/detail/project-detail-header.tsx`
- `components/admin/projects/form/project-create-form.tsx`
- `components/admin/projects/form/project-edit-page-form.tsx`
- `components/admin/projects/shifts/form/shift-create-editor.tsx`
- `components/admin/projects/shifts/form/shift-create-form.tsx`
- `components/admin/shifts/shift-detail-header.tsx`
- `components/admin/shifts/shift-edit-page-form.tsx`
- `components/admin/projects/project-edit-drawer.tsx`（削除）
- `components/admin/projects/shifts/shift-create-drawer.tsx`（削除）
- `components/admin/shifts/shift-edit-drawer.tsx`（削除）
- `lib/admin/projects/update-shift-core.ts`
- `scripts/integration/admin-unified-editors-test.mjs`
- `docs/admin-ui-3.0b-3-unified-editors-result.md`

## Explicit Non-Changes

- Detail workflow architecture: unchanged。
- Collection workflow: unchanged。
- Placement domain: unchanged。
- Worker UI: unchanged。
- DB schema / migration / RLS / RPC / GRANT: unchanged。
- Auth architecture: unchanged（browser QA用の既存local Auth fixture準備のみ）。
- Packages: unchanged。
- Figma: read-only、変更なし。
- Remote: unchanged。
- Commit/push: 0。
- Existing staged/unstaged/untracked work: preserved。
- 新規Project/Shift fixtureは作成しておらず、cleanup対象の業務データは0件。
