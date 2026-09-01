# Dispatch OS UI/UX改善方針 v1.0

## 1. 目的

本ドキュメントは、Dispatch OSにおけるAdmin / Worker UIの設計・改修基準を定義する。

今後のUI/UX実装では、画面単位で局所的にデザインを変更するのではなく、本基準に沿って以下を統一する。

- Information Architecture
- Navigation
- Layout
- Spacing
- Typography
- Button
- Badge
- Card
- Form
- Filter
- Empty State
- Feedback
- Responsive Design

既存の業務ロジック、認可、RLS、DB整合性を維持しながら、UI/UXを段階的に改善する。

---

# 2. 基本原則

Dispatch OSは業務管理システムである。

Admin UIでは装飾性より、

- 情報を素早く把握できる
- 状態を比較できる
- 次に行う操作が分かる
- 誤操作しにくい
- 画面間で操作方法が一貫している

ことを優先する。

Worker UIでは、

- Mobile First
- 今やるべきことが分かる
- 操作数が少ない
- 出勤・退勤など重要操作を迷わない

ことを優先する。

---

# 3. Admin Information Architecture

Admin機能は以下の責務で整理する。

## Dashboard

目的：

全体状況・異常・今日対応すべき事項を把握する。

扱うもの：

- 本日の稼働
- 正常Worker
- Alert
- 人員不足
- 前日確認未提出
- 勤務開始未報告

## 案件管理

目的：

案件を作成・設計・編集する。

Project-centricな画面とする。

扱うもの：

- Project
- Client
- Job
- Workplace
- Shift設計
- 募集条件
- 案件単位の配置状況

基本的な問い：

「この案件をどう組み立てるか？」

## シフト管理

目的：

日付軸で日々のシフト運用を確認する。

Time-centricな画面とする。

扱うもの：

- 今日
- 明日
- 今週
- 指定期間
- 募集状態
- 必要人数
- 応募人数
- 配置人数
- 不足人数

基本的な問い：

「この日・この期間の現場はどうなっているか？」

将来的に、

- List View
- Calendar View

の切替を検討する。

## スタッフ管理

目的：

Workerそのものを管理する。

扱うもの：

- Worker基本情報
- 稼働状態
- 所属・属性
- 将来の勤務履歴等

## 取引先・勤務先

目的：

Master Dataを管理する。

案件内でClient / Workplaceを設定することと、
Client / Workplaceそのものを管理することを分離する。

## 勤怠管理

目的：

実際に行われた勤務を管理する。

扱うもの：

- Worker打刻
- 欠勤
- 無断欠勤
- 勤怠確定
- 勤怠訂正
- 訂正履歴

---

# 4. 案件管理とシフト管理の責務分離

案件管理とシフト管理で同じ情報を表示すること自体は禁止しない。

ただし目的を明確に分ける。

案件管理：

Project-centric

Project
→ Job
→ Workplace
→ Shift

という構造を設計・編集する。

シフト管理：

Time-centric

Date
→ Shift
→ Staffing

という構造で日々の運用状況を見る。

---

# 5. Route / Page削減方針

作成・編集のためだけにPageを細分化しすぎない。

基本構造：

一覧
↓
詳細・管理

とする。

## Project

Project List

→ Project Detail / Management Hub

Project Detailでは、

- 基本情報
- Job
- Workplace
- Shift
- Staffing Summary

を管理できる構造を目指す。

## 作成操作

以下は専用Pageではなく、

- Drawer
- Dialog
- Inline Edit

への移行を検討する。

- Job追加
- Job編集
- Shift追加
- Shift編集
- 複数Shift追加

ただし複雑な入力で専用Pageの方がUX上明確な場合は、無理にDrawer化しない。

---

# 6. Create / Edit Form共通化

CreateとEditで同じ入力項目を持つ場合、UIを別実装しない。

例：

`<ProjectForm />`
`<JobForm />`
`<ShiftForm />`

Create：

initialValues = empty

Edit：

initialValues = existing data

Validation Schemaも可能な限り共通化する。

---

# 7. 一覧 → 詳細 Navigation

一覧画面では主対象名を詳細Routeへの主要導線とする。

例：

案件名
→ Project Detail

Worker名（勤怠一覧）
→ Attendance Detail

Shift日時 / Shift名称
→ Shift Detail

Client名
→ Client Detail

Workplace名
→ Workplace Detail

## 詳細Button

「詳細を見る」Buttonは原則削減する。

右端の領域は、

- 編集
- 配置
- 欠勤
- 取消
- その他Action

など操作用に使用する。

## Row Click

行全体クリックは原則使用しない。

理由：

- Button
- Checkbox
- Select
- Link

などと競合しやすいため。

主対象名・タイトルを明確なLinkにする。

---

# 8. Sidebar

Desktop Sidebarは、

Expanded
Collapsed

を切り替え可能にする。

Expanded：

Icon + Label

Collapsed：

Icon only

Collapsed時はTooltip等により項目名を確認可能にする。

## State

Sidebar状態の保持を検討する。

例：

localStorage

## Mobile / Tablet

固定SidebarではなくDrawerを基本とする。

---

# 9. Content Width

画面全体を無制限に広げない。

目安：

一覧：
1440〜1600px

詳細：
1200〜1400px

Form：
760〜900px

実装時は既存Layoutとの整合を確認して最終値を決定する。

---

# 10. Spacing

Spacingを画面ごとに独自設定しない。

以下を共通化する。

- Page Padding
- Section Gap
- Card Padding
- Form Gap
- Inline Gap

情報量が少ない画面で巨大な余白を作らない。

Admin画面では適度な情報密度を維持する。

---

# 11. Typography

情報階層を明確にする。

目安：

Page Title：
28〜32px

Section Title：
18〜20px

Card Title：
16〜18px

Body：
14〜16px

Caption：
12〜13px

文字サイズだけでなく、

- Weight
- Text Color
- Spacing

も組み合わせて階層を表現する。

---

# 12. Card

Cardを単なる余白Containerとして乱用しない。

関連情報を意味単位でまとめる。

情報量が少ない場合、巨大なCardを作らない。

例：

予定勤務
2026/08/22(土)
09:00〜18:00
休憩60分

のように関連情報をコンパクトにまとめる。

---

# 13. Button Hierarchy

Buttonは役割を統一する。

## Primary

その画面の主要Action。

例：

- 保存
- 作成
- 確定

Primary Buttonを同一領域に乱立させない。

## Secondary

補助Action。

例：

- 編集
- 追加

## Ghost / Link

Navigationや低優先度操作。

例：

- 戻る
- 補助リンク

## Danger

破壊的・重大な状態変更。

例：

- 削除
- 配置解除
- 欠勤
- 無断欠勤

---

# 14. Status Badge

状態表示の意味を可能な限り統一する。

基本方針：

Blue：
進行中 / 募集中

Green：
完了 / 配置完了 / 確認済み

Yellow：
要確認 / 注意

Red：
不足 / Error / Critical

Gray：
終了 / 無効 / 未設定

ただし既存業務状態との意味衝突がある場合は、
状態の意味を優先する。

Badgeは基本的に状態表示専用とし、
Navigation用途には使用しない。

---

# 15. Form Design

長いFormは意味単位でSection分割する。

例：

基本情報

募集情報

勤務条件

補足情報

必須 / 任意表示を統一する。

## Long Form

項目数が多い場合、

- Section
- Accordion
- Drawer

等を検討する。

---

# 16. Detail Page Structure

詳細画面は原則として以下の順序を使用する。

1. Page Title / Status
2. Important Summary
3. Primary Actions
4. Detail Information
5. Related Data
6. History

例：Attendance Detail

Worker / Status

↓
勤務Summary

↓
Worker打刻

↓
確定勤務実績

↓
訂正

↓
訂正履歴

---

# 17. Filter / Search

Filterを大量に横並びにしない。

常時表示：

- Date
- Status
- Search

など使用頻度の高いもの。

低頻度Filterは、

「詳細条件」

などへの収納を検討する。

Quick Filter：

- 今日
- 明日
- 今週
- 来週

等も利用する。

---

# 18. Empty State

単純な「0件」表示だけで終わらせない。

Empty Stateでは、

1. 何もない理由
2. 次にできる操作

を提示する。

例：

シフトがありません。

この案件にはまだシフトが登録されていません。

[シフトを追加]

検索結果0件の場合：

- Filterを変更
- Filterをリセット

などを提示する。

---

# 19. Feedback

Create / Update / Confirmなどの操作結果を明確にする。

成功例：

案件を更新しました。

シフトを追加しました。

勤怠を確定しました。

Errorも共通Component / Patternを使用する。

内部DB Error、SQLSTATE等はUIへ露出しない。

---

# 20. Breadcrumb

階層が深い画面ではBreadcrumbを使用する。

例：

案件管理
> TEST Project N1
> TEST Job N1
> Shift

Breadcrumbと「戻る」Linkを無秩序に併用しない。

---

# 21. Date / Time Format

日時表示を用途別に統一する。

一覧：

8/22(土)
09:00〜18:00

詳細：

2026/08/22(土)
09:00〜18:00

履歴：

2026/08/22 17:22

秒は業務上必要な画面のみ表示する。

Timezoneは既存仕様どおりAsia/Tokyoを明示する。

---

# 22. Admin Responsive Policy

AdminはDesktop Firstとする。

優先：

- 情報密度
- 比較性
- 一覧性

Tablet / Mobileでは、

- Horizontal Scroll
- Card Layout
- Drawer

などを適切に使用する。

---

# 23. Worker Responsive Policy

Worker UIはMobile Firstとする。

最優先情報：

- 次の勤務
- 前日確認
- 勤務開始
- 勤務終了

重要Actionは視認しやすく、
十分なTouch Targetを確保する。

---

# 24. Accessibility

最低限以下を維持する。

- semantic HTML
- label
- fieldset / legend
- aria-invalid
- keyboard navigation
- focus state
- 44px程度以上の重要Touch Target
- 色だけに依存しない状態表示

---

# 25. UI変更と業務ロジックの分離

UI/UX改善のために以下を安易に変更してはならない。

- Domain Rule
- RLS
- GRANT
- Migration
- DB Function
- RPC
- Auth
- 集計Rule
- Assignment State Transition
- Attendance Rule

変更が必要な場合は、
UI改修とは別Phaseとして設計する。

---

# 26. 改修Phase

UI/UX改修は以下の順番を基本とする。

Phase UI-1
Admin IA / Route再編

Phase UI-2
Admin Shell

- Sidebar
- Header
- Content Width
- Responsive Layout

Phase UI-3
Navigation統一

- Primary Link
- Breadcrumb
- Action Placement

Phase UI-4
Design Foundation

- Typography
- Spacing
- Button
- Badge
- Card
- Form
- Empty State
- Feedback

Phase UI-5
Admin List Screens

- Projects
- Shifts
- Attendance
- Staff
- Clients / Workplaces

Phase UI-6
Admin Detail Screens

- Project
- Shift
- Attendance

Phase UI-7
Worker Mobile UX

- Worker Home
- Assignment Detail
- Pre Shift Confirmation
- Attendance Actions

---

# 27. 改修優先順位

構造変更をVisual変更より先に行う。

優先：

IA
↓
Layout
↓
Navigation
↓
Design Foundation
↓
Individual Screen
↓
Visual Polish

後で削除・統合する画面を先に磨き込まない。

---

# 28. Existing Behavior Preservation

UI改修では既存機能のRegressionを避ける。

最低限、

- TypeScript
- Build
- ESLint
- `git diff --check`

を確認する。

関連Integration Testが存在する場合は実行する。

既存Testが失敗した場合、
UI変更に合わせて安易に期待値を書き換えない。

---

# 29. Security

UI変更によってSecurity境界を弱めない。

既存の、

Cookie Session
→ Server
→ Supabase
→ GRANT
→ RLS

または既存RPC境界を維持する。

Clientへ不要な権限情報やDB内部情報を露出しない。

---

# 30. Final Principle

Dispatch OSのUIは、

「画面を増やす」

より、

「同じ場所で自然に次の仕事へ進める」

ことを優先する。

機能追加時も新Routeを作る前に、

- Existing Detail
- Drawer
- Dialog
- Inline Action

で自然に統合できないか検討する。

## UI Pattern Reference

UI ComponentやInteraction Patternを新規設計する場合、
以下を参考資料として利用する。

- UI Design Dictionary

ただし、掲載パターンをそのまま採用するのではなく、
Dispatch OSの業務フロー、情報密度、Accessibility、
Desktop / Mobile方針に適合する場合のみ採用する。

特に以下を標準候補とする。

- Sidebar Navigation
- Drawer
- Breadcrumb
- Sticky Header
- Pagination
- Hamburger Menu

既存のDesign Systemまたは共通Componentで表現できる場合、
独自UI Patternを新規作成する前に既存Componentの再利用を優先する。