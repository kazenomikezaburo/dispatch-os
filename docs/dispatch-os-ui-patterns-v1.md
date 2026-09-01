# Dispatch OS UI Pattern Library v1.0

## 1. Purpose

本ドキュメントは、Dispatch OSで使用するUI Patternと、その選択・実装ルールを定義する。

目的はPatternの種類を増やすことではない。同じ仕事に同じInteractionを提供し、画面ごとに異なる操作方法が生まれることを防ぐことである。

Pattern選択では、次を優先する。

- Consistency
- Clarity
- Information Density
- Error Prevention
- Accessibility
- Responsive Behavior

本書はUI Design Dictionaryを参考にしているが、Dispatch OSの業務フロー、情報設計、Admin / Workerの利用状況、Accessibilityを優先する。

## 2. Relationship to UI/UX Guidelines

設計文書と実装の関係は次のとおりとする。

```text
docs/dispatch-os-ui-ux-v1.md
  UI/UXの原則・思想
        ↓
docs/dispatch-os-ui-patterns-v1.md
  採用Patternと使用ルール
        ↓
Components / Screens
  実装
```

本書と上位方針が矛盾する場合は、`docs/dispatch-os-ui-ux-v1.md`を優先する。UI改修を理由にDomain Rule、Migration、RLS、GRANT、DB Function、RPC、Auth、集計Rule、状態遷移を変更しない。

## 3. Pattern Status

| Status | 意味 |
| --- | --- |
| STANDARD | Dispatch OSの標準。新規実装では原則として使用する |
| CONDITIONAL | 明記した条件を満たす場合だけ使用する |
| AVOID | 原則使用しない。採用には明確な理由とReviewが必要 |

ScopeはAdmin、Worker、Bothのいずれかで示す。

## 4. Navigation Patterns

### 4.1 Sidebar Navigation

Status: STANDARD
Scope: Admin

#### Purpose

AdminのPrimary Navigationを常に把握できるようにし、業務領域間を移動しやすくする。

#### Use When

Dashboard、案件、シフト、スタッフ、取引先・勤務先、勤怠、設定のPrimary Navigationに使用する。DesktopではExpanded / Collapsedを提供する。

#### Do Not Use When

Workerの主要Navigationや、Detail内の関連データ移動には使用しない。

#### Dispatch OS Examples

`/admin`配下のAdmin Shell。ExpandedはIcon + Label、CollapsedはIconとTooltipを表示する。

#### Interaction

現在Routeを`aria-current="page"`と視覚状態で示す。Collapse操作はKeyboardで実行可能にする。

#### Responsive

Desktopは固定Sidebar、Tablet / MobileはHamburgerから開くDrawerに切り替える。

#### Accessibility

Navigation landmark、明確なLink名、Focus表示、Collapsed時のFocusでも表示されるTooltipを提供する。

#### Codex Rule

Admin Primary NavigationはSidebarへ集約し、画面独自のPrimary Navigationを増やさない。

### 4.2 Breadcrumb

Status: STANDARD
Scope: Admin

#### Purpose

Detail階層の現在位置と上位画面への経路を示す。

#### Use When

Project、Shift、AttendanceのDetailや、階層内の作成画面で使用する。

#### Do Not Use When

Dashboardや1階層の一覧、Workerの短いMobile flowでは使用しない。

#### Dispatch OS Examples

`案件管理 > Project`、`シフト管理 > Shift`、`勤怠管理 > Worker / Attendance`。

#### Interaction

上位要素だけLinkとし、現在地はTextと`aria-current="page"`で示す。

#### Responsive

Mobileでは中間階層を省略できるが、現在地と直近の戻り先は保持する。

#### Accessibility

`nav`と`aria-label="パンくず"`を使い、区切り文字を読み上げ対象にしない。

#### Codex Rule

Breadcrumbと同目的の「戻る」Linkを無秩序に併置しない。

### 4.3 Primary Object Link

Status: STANDARD
Scope: Both

#### Purpose

一覧の主対象名をDetailへの一貫した主要導線にするDispatch OS独自Pattern。

#### Use When

Project名、Shift日時・主タイトル、Attendance ListのWorker名など、行の主対象に使用する。

#### Do Not Use When

対象にDetailがない場合や、Action実行を目的とする要素には使用しない。

#### Dispatch OS Examples

Project Name → Project Detail、Worker Name → Attendance Detail、Shift日時 → Shift Detail。

#### Interaction

通常のLinkとして新しいURLへ移動する。行内ActionやCheckboxとは独立させる。

#### Responsive

Mobileでも対象名を先頭付近に置き、Touch Targetを十分に確保する。

#### Accessibility

Link単体で遷移先が理解でき、Focusが明確で、色だけでLinkを示さない。

#### Codex Rule

「詳細を見る」Buttonを追加する前に、主対象名をLinkにできるか確認する。

### 4.4 Pagination

Status: CONDITIONAL
Scope: Admin

#### Purpose

大量データを安定した単位に分け、位置と件数を把握しながら閲覧可能にする。

#### Use When

Projects、Shifts、Attendance、Workers、Clientsが1画面の適正件数を超え、Server-side paginationが必要な場合。

#### Do Not Use When

件数が少ない場合や、ページ分割で比較作業が悪化する場合。

#### Dispatch OS Examples

将来の全件Shift一覧、長期間のAttendance一覧。

#### Interaction

前後・ページ番号をLinkとして提供し、Filter条件をQueryに保持する。

#### Responsive

Mobileは前へ・次へと現在ページを中心に簡略化する。

#### Accessibility

Pagination landmark、現在ページ、無効状態を明示する。

#### Codex Rule

Paginationは実データ量とQuery設計を確認してから導入する。

### 4.5 Sticky Header / Sticky Action Area

Status: CONDITIONAL
Scope: Both

#### Purpose

長いDetailやFormで現在の文脈と主要Actionを見失わないようにする。

#### Use When

長いAttendance Detail、Project管理、長いForm、Workerの今すぐ必要なActionで使用する。

#### Do Not Use When

短い画面、Viewportを過度に圧迫する場合、複数Sticky領域が競合する場合。

#### Dispatch OS Examples

Admin DetailのAction header、Worker Assignment Detailの勤務開始・終了Action。

#### Interaction

Scroll後もActionを利用できる。状態変更後はLabelとdisabled状態を即時に更新する。

#### Responsive

Desktopは上部、Worker MobileはSafe Areaを考慮した下部Actionを選択できる。

#### Accessibility

Keyboard Focusを隠さず、拡大表示時に本文を覆わない。

#### Codex Rule

Stickyは重要Action 1領域に限定し、NavigationとActionを混ぜない。

### 4.6 Hamburger / Mobile Navigation

Status: STANDARD
Scope: Admin

#### Purpose

狭い画面でAdmin Navigationを必要時に開けるようにする。

#### Use When

固定Sidebarを表示できないTablet / Mobileで使用する。

#### Do Not Use When

Desktopで主要Navigationを隠す用途には使用しない。

#### Dispatch OS Examples

Admin HeaderからSidebar内容をDrawerとして開く。

#### Interaction

ButtonでOpen / Closeし、Escape、Backdrop、選択後に閉じる。

#### Responsive

Sidebar breakpoint未満でのみ表示する。

#### Accessibility

`aria-expanded`、`aria-controls`、Focus trap、Close後のFocus復帰を実装する。

#### Codex Rule

Mobile Drawerの項目とDesktop Sidebarの情報構造を一致させる。

## 5. Overlay / Editing Patterns

### 5.1 Drawer

Status: STANDARD
Scope: Admin

#### Purpose

親Detailの文脈を維持したまま、中程度の作成・編集・詳細Filterを完了する。

#### Use When

Job Create / Edit、Shift Create / Edit、Advanced Filterに使用する。

#### Do Not Use When

入力が非常に長い、複数Step、比較対象を常時参照できない、または別Drawer上から開く場合。

#### Dispatch OS Examples

Project DetailからJob追加、Job配下のShift追加、Shift Listの詳細条件。

#### Interaction

Triggerから開き、保存成功で閉じて親データを更新する。未保存変更があるCloseは確認する。

#### Responsive

Desktopは右側Panel、MobileはFull-screen sheet相当へ広げる。

#### Accessibility

Dialog semantics、Focus trap、Escape、Title、Close Button、Focus復帰を提供する。

#### Codex Rule

Drawer内から別Overlayを開かず、複雑化したらDedicated Pageを選ぶ。

### 5.2 Dialog / Modal

Status: STANDARD
Scope: Both

#### Purpose

短い確認や重大な状態変更に注意を集中させる。

#### Use When

削除確認、配置解除、欠勤、無断欠勤、短い確認に使用する。

#### Do Not Use When

長いForm、閲覧だけの情報、頻繁な軽微操作には使用しない。

#### Dispatch OS Examples

Assignment配置解除、Attendanceの欠勤・無断欠勤確認。

#### Interaction

明確なCancelと実行Buttonを示し、Destructive Actionでは影響対象を本文に書く。

#### Responsive

Mobileは画面幅に収め、Actionを押しやすく縦配置できる。

#### Accessibility

`role="dialog"`または`alertdialog`、名前、説明、Focus trap、Escape、Focus復帰を実装する。

#### Codex Rule

Dialogは短い判断に限定し、Nested Modalを作らない。

### 5.3 Dedicated Page

Status: CONDITIONAL
Scope: Admin

#### Purpose

複雑な入力や集中が必要な作業へ十分な空間と明確なURLを提供する。

#### Use When

Project Create、Bulk Shift Create、複数Section・複数日・確認工程を持つ入力で使用する。

#### Do Not Use When

親Detail内で短時間に完了する単純な追加・編集。

#### Dispatch OS Examples

`/admin/projects/new`、複数日一括Shift作成。

#### Interaction

Breadcrumb、Cancel、保存、Server validation、離脱時の扱いを明確にする。

#### Responsive

Form幅を制限し、Mobileは1カラムにする。

#### Accessibility

Page Title、Section heading、Error Summary、Focus移動を提供する。

#### Codex Rule

Create / Edit Route追加前にDetail、Drawer、Dialog、Inline Editへの統合を検討する。

### 5.4 Inline Edit

Status: CONDITIONAL
Scope: Admin

#### Purpose

Detailの単純な属性を文脈を失わず編集する。

#### Use When

Project基本情報など、少数Fieldを独立して安全に更新できる場合。

#### Do Not Use When

複数Entityを更新する、重大な状態遷移、複雑なValidation、一覧の多数Cellを同時編集する場合。

#### Dispatch OS Examples

将来のProject説明・補足情報の編集候補。

#### Interaction

明示的な編集開始、保存、Cancelを提供し、閲覧状態と編集状態を区別する。

#### Responsive

MobileではFieldが多ければDrawerへ切り替える。

#### Accessibility

編集開始時にFieldへFocusし、Errorと保存結果を通知する。

#### Codex Rule

Text clickだけを編集開始手段にせず、Label付き編集Buttonを提供する。

### 5.5 Nested Modal

Status: AVOID
Scope: Both

#### Purpose

採用しない。Focus、Close、文脈、Back操作が曖昧になるため。

#### Use When

原則なし。避けられない場合はInteraction設計Reviewを必須とする。

#### Do Not Use When

DrawerまたはDialogが既に開いているすべての通常ケース。

#### Dispatch OS Examples

Job Drawer内からShift Dialogを開く構造は禁止する。

#### Interaction

親Overlayを閉じるか、同一Overlay内でStepを切り替える。

#### Responsive

Mobileでは特に禁止する。

#### Accessibility

複数Focus trapを作らない。

#### Codex Rule

Overlayは同時に1層だけ表示する。

## 6. Layout Patterns

### 6.1 Content Container

Status: STANDARD
Scope: Both

#### Purpose

読みやすさと比較性を維持し、画面幅の無制限な拡大を防ぐ。

#### Use When

すべてのPage contentに使用する。List、Detail、Formで適切な最大幅を変える。

#### Do Not Use When

背景やShellまで不必要に狭める用途には使用しない。

#### Dispatch OS Examples

Admin Listは広め、Detailは中程度、FormとWorker画面は狭めにする。

#### Interaction

なし。

#### Responsive

小画面では適切なPage paddingを残して全幅を使う。

#### Accessibility

200% zoomでも横方向の読みにくさを増やさない。

#### Codex Rule

画面ごとに無関係な最大幅を追加せず、用途別Containerを使う。

### 6.2 Section

Status: STANDARD
Scope: Both

#### Purpose

関連情報を意味単位でまとめ、Heading hierarchyを作る。

#### Use When

Detail、Form、Dashboardの情報群に使用する。

#### Do Not Use When

単なる余白やBorderを追加するためだけに使用しない。

#### Dispatch OS Examples

Project基本情報、配置サマリー、Worker打刻、確定勤務実績、訂正履歴。

#### Interaction

必要に応じてSection単位のActionをHeading横へ置く。

#### Responsive

Mobileは縦積みし、HeadingとActionが衝突すればActionを次行へ送る。

#### Accessibility

`section`と関連Headingを使用する。

#### Codex Rule

Sectionの境界は意味で決め、Cardの見た目で決めない。

### 6.3 Card

Status: CONDITIONAL
Scope: Both

#### Purpose

独立性がある関連情報を1つの認知単位としてまとめる。

#### Use When

Dashboard Summary、Workerの次の勤務、Mobile card listなど独立性が高い情報に使用する。

#### Do Not Use When

余白目的、Sectionの多重囲い、Tableの各Cellには使用しない。

#### Dispatch OS Examples

本日の稼働KPI、Worker HomeのAssignment、Project staffing summary。

#### Interaction

Card全体をClick対象にしない。LinkとActionを個別に配置する。

#### Responsive

Gridから1カラムへ変化する。巨大な空白を作らない。

#### Accessibility

Heading hierarchyと明確なLink / Buttonを持つ。

#### Codex Rule

Card追加前にSectionまたはStructured Listで十分か確認する。

### 6.4 Split Layout / Master Detail

Status: CONDITIONAL
Scope: Admin

#### Purpose

選択対象と詳細を並べ、比較しながら連続処理する。

#### Use When

将来の高頻度Attendance reviewなど、一覧と詳細を反復するDesktop作業で有効な場合。

#### Do Not Use When

URL共有、Mobile操作、Detailの情報量が多い場合。

#### Dispatch OS Examples

将来のAttendance triage候補。v1の標準Route構造には直ちに導入しない。

#### Interaction

選択状態とURLまたはHistoryを同期し、Keyboard移動を検討する。

#### Responsive

Tablet / Mobileは一覧 → Detailの通常Navigationへ戻す。

#### Accessibility

選択中の行と詳細Headingの関係を明示する。

#### Codex Rule

Master Detailは実際の反復業務が確認できた場合だけ導入する。

### 6.5 Tabs / Accordion

Status: CONDITIONAL
Scope: Both

#### Purpose

関連する大きな情報群を切り替える、または低優先情報を段階開示する。

#### Use When

Tabsは同格の2〜5領域、Accordionは長いFormや補足情報に使用する。

#### Do Not Use When

重要情報やCritical Actionを隠す、Sectionが少ない、深いNested構造になる場合。

#### Dispatch OS Examples

将来のProject Detailで基本情報 / Staffing / Historyが十分大きい場合。Workerの今やるActionには使用しない。

#### Interaction

TabsはArrow key、AccordionはButtonで展開し状態を示す。

#### Responsive

Tabsが横Overflowする場合はSectionまたはSelectへ再設計する。

#### Accessibility

ARIA tab patternまたは`button` + `aria-expanded`を正しく実装する。

#### Codex Rule

情報を隠すためだけにTabs / Accordionを追加しない。

### 6.6 Responsive Stack

Status: STANDARD
Scope: Both

#### Purpose

Desktopの比較性とMobileの読みやすさを両立する。

#### Use When

Summary、Form field group、Action group、List itemで使用する。

#### Do Not Use When

順序変更により意味やKeyboard順序が破綻する場合。

#### Dispatch OS Examples

Project list item、Shift summary、Worker Assignment detail。

#### Interaction

DOM順はMobileの読み順を基準にする。

#### Responsive

Mobile 1カラム、必要に応じてTablet / DesktopでGridまたは横並びにする。

#### Accessibility

Visual orderとDOM / Focus orderを一致させる。

#### Codex Rule

CSSで見た目だけ順序を入れ替えない。

## 7. Data Display Patterns

### 7.1 Structured List / Responsive Card List

Status: STANDARD
Scope: Both

#### Purpose

主対象、主要状態、補足情報、Actionを一貫した順序で表示する。

#### Use When

情報量が中程度のProjects、Shifts、Worker Assignmentsに使用する。

#### Do Not Use When

列同士の厳密比較が主目的ならTableを使用する。

#### Dispatch OS Examples

Project List、Shift List、Worker Homeの次の勤務。

#### Interaction

Primary Object Linkと独立したActionを使い、Full Row Clickを避ける。

#### Responsive

Desktopは列を揃え、MobileはLabel付きStackまたはCardへ変化する。

#### Accessibility

`ul` / `li`または適切なTable semanticsを使用し、視覚位置だけで意味を伝えない。

#### Codex Rule

同じ一覧内の情報順序とAction位置を統一する。

### 7.2 Table

Status: CONDITIONAL
Scope: Admin

#### Purpose

多数のRecordを共通列で比較する。

#### Use When

Attendance、Workers、Clientsなど列比較と走査が主目的の場合。

#### Do Not Use When

各Recordの情報構造が異なる、Mobileが主利用、列が過剰な場合。

#### Dispatch OS Examples

Attendance ListのWorker、勤務日時、状態、要確認、確定状況。

#### Interaction

Header sortingは実装されている場合だけ操作可能表示にする。行全体Clickは禁止する。

#### Responsive

優先列を残して横Scroll、またはResponsive Card Listへ切り替える。

#### Accessibility

Caption、Header scope、状態Text、Keyboard操作可能なLink / Buttonを提供する。

#### Codex Rule

比較が必要な情報だけを列にし、Action列をNavigation列にしない。

### 7.3 Summary Card / Metric / KPI

Status: STANDARD
Scope: Admin

#### Purpose

重要な数値と異常を短時間で把握可能にする。

#### Use When

Dashboard、Project staffing、Attendance summaryに使用する。

#### Do Not Use When

単なる件数を装飾するだけ、指標の定義が不明、Actionへ誤認される場合。

#### Dispatch OS Examples

本日の稼働、正常、要確認、必要人数、配置人数、不足人数。

#### Interaction

Navigationする場合のみLinkであることを明示する。通常は表示専用。

#### Responsive

Desktop grid、Mobile 2列または1列。数値と単位を分離する。

#### Accessibility

数値だけでなくLabelと単位を読み上げ可能にする。

#### Codex Rule

KPIは業務判断に必要な指標だけに限定する。

### 7.4 Status Badge

Status: STANDARD
Scope: Both

#### Purpose

状態を短いTextと一貫したToneで識別する。

#### Use When

Project、Shift、Application、Assignment、Pre-shift、Attendance状態に使用する。

#### Do Not Use When

Navigation、長文説明、単独でActionを実行する要素には使用しない。

#### Dispatch OS Examples

募集中、配置済み、未確認、確認済み、勤務中、欠勤、確定済み。

#### Interaction

表示専用。Filter chipと混同しない。

#### Responsive

折返しを抑え、必要ならLabelを簡潔にする。

#### Accessibility

色だけでなくTextまたはIcon + accessible labelで状態を示す。

#### Codex Rule

同じDomain stateには全画面で同じLabelとToneを使う。

### 7.5 Progress / Staffing Summary

Status: CONDITIONAL
Scope: Admin

#### Purpose

必要人数に対する配置状況を比率と実数で把握可能にする。

#### Use When

Project / Shift staffingに明確な分母と分子がある場合。

#### Do Not Use When

進捗の意味が曖昧、分母が0、正確な数値表示がない場合。

#### Dispatch OS Examples

配置人数 / 必要人数、不足人数、配置率。

#### Interaction

原則表示専用。関連一覧へ進む場合は別Linkを使う。

#### Responsive

Barと実数を同時に表示し、小画面でも数値を省略しない。

#### Accessibility

`progressbar` semanticsとTextによる実数を提供する。

#### Codex Rule

Progress bar単独で状態を伝えない。

### 7.6 Description List

Status: STANDARD
Scope: Both

#### Purpose

LabelとValueの組でRecord詳細を読みやすく表示する。

#### Use When

Project、Shift、Attendance、Assignmentの基本情報に使用する。

#### Do Not Use When

複数Recordの比較や編集Formには使用しない。

#### Dispatch OS Examples

勤務日、時間、休憩、勤務先、住所、募集人数、確定時刻。

#### Interaction

ValueがNavigationの場合のみLinkにする。

#### Responsive

Desktopは2〜3列、Mobileは1列またはLabel / Value stack。

#### Accessibility

`dl`、`dt`、`dd`を使用する。

#### Codex Rule

Labelを省略せず、同じEntityでは表示順を統一する。

### 7.7 Timeline / Audit History

Status: STANDARD
Scope: Admin

#### Purpose

状態変更や勤怠訂正を時系列と実行者付きで追跡可能にする。

#### Use When

Attendance revision history、操作履歴など監査性が必要な場合。

#### Do Not Use When

順序が重要でない単純な関連一覧。

#### Dispatch OS Examples

Attendance Detailの訂正前後、理由、変更者、変更日時。

#### Interaction

新しい順または古い順を画面内で一貫させ、詳細展開が必要ならButtonを使う。

#### Responsive

Mobileでは縦Timelineとし、before / afterを縦積みする。

#### Accessibility

順序付きList、完全な日時、Textによる変更内容を提供する。

#### Codex Rule

Audit Historyから実行者・日時・変更内容を省略しない。

### 7.8 Empty State

Status: STANDARD
Scope: Both

#### Purpose

データがない理由と次に可能なActionを伝える。

#### Use When

初期状態、Filter結果0件、関連データ未登録に使用する。

#### Do Not Use When

Query errorやLoadingを0件として扱う場合。

#### Dispatch OS Examples

Project未登録、Shift未登録、該当Attendanceなし、次の勤務なし。

#### Interaction

可能なら作成、Filter reset、戻るなど1つの適切な次Actionを提供する。

#### Responsive

過大な高さを使わず、Mobileでも要点を先に表示する。

#### Accessibility

状態TextとAction labelを明確にし、装飾Iconだけに依存しない。

#### Codex Rule

ErrorをEmpty Stateへ変換しない。

## 8. Form Patterns

### 8.1 Sectioned Form

Status: STANDARD
Scope: Both

#### Purpose

長い入力を意味単位に分け、入力漏れと認知負荷を減らす。

#### Use When

Project、Job、Shift、Attendance correctionなど複数情報群を持つForm。

#### Do Not Use When

Fieldが1〜3個の短い確認Form。

#### Dispatch OS Examples

基本情報、募集情報、勤務条件、補足情報。

#### Interaction

Submit時はServer validationを行い、最初のErrorへFocusする。

#### Responsive

Mobileは1カラム、DesktopでもForm幅を制限する。

#### Accessibility

Section heading、fieldset / legend、Label、Error関連付けを行う。

#### Codex Rule

Create / Editで同じFieldを使う場合はFormとSchemaを共通化する。

### 8.2 Basic Inputs

Status: STANDARD
Scope: Both

#### Purpose

Text、長文、単一・複数選択、日付・時刻を予測可能な方法で入力する。

#### Use When

Text Inputは短文、Textareaは説明、Radioは少数の排他選択、Checkboxは独立booleanまたは複数選択、Date / Time / DateTime Inputは対応する値に使用する。

#### Do Not Use When

PlaceholderをLabel代わりにする、Selectを多数候補の検索に使う、Toggleを保存Buttonが必要な設定に使う場合。

#### Dispatch OS Examples

Project名、説明、can_work、health_status、勤務日、開始・終了時刻。

#### Interaction

Label clickでControlへFocusし、ValidationはblurまたはSubmit後に表示する。

#### Responsive

MobileでTouch targetとnative inputの使いやすさを優先する。

#### Accessibility

永続Label、fieldset / legend、aria-invalid、Error id、required / optional表示を使用する。

#### Codex Rule

値の型と候補数に合う最も単純なControlを選ぶ。

### 8.3 Select / Combobox

Status: STANDARD
Scope: Both

#### Purpose

既存候補から正しいEntityまたは状態を選択させる。

#### Use When

Selectは少数で安定した候補、ComboboxはClient、Workplace、Workerなど将来増加し検索が必要な候補に使用する。

#### Do Not Use When

自由入力を許す値、選択肢が2〜4個で比較が重要な場合はRadio等を検討する。

#### Dispatch OS Examples

Project statusはSelect、Client / Workplace / Worker selectionは件数増加時にCombobox。

#### Interaction

Comboboxは入力、候補移動、選択、ClearをKeyboardで完了可能にする。未選択を明確にする。

#### Responsive

Mobileでは候補PanelがViewport外へ出ない。候補が非常に多ければFull-screen sheetを検討する。

#### Accessibility

Native selectを優先し、ComboboxはARIA pattern、active descendant、状態通知を正しく実装する。

#### Codex Rule

候補増加を理由に巨大なSelectを維持せず、検索要件が確定した時点でComboboxへ移行する。

### 8.4 Inline Validation / Help Text / Labels

Status: STANDARD
Scope: Both

#### Purpose

入力条件、必須性、Errorの場所と解決方法をField近くで伝える。

#### Use When

すべてのFormに使用する。複雑な条件はHelp Textを先に表示する。

#### Do Not Use When

DB Error、SQL state code、Table名、Policy名、Stack traceを表示する場合。

#### Dispatch OS Examples

Shift時刻関係、募集人数、Attendance訂正理由、前日確認受付状態。

#### Interaction

Error発生後も入力値を保持し、修正後に該当Errorを更新する。

#### Responsive

Field直下に表示し、横並びLabelとの衝突を避ける。

#### Accessibility

`aria-describedby`、`aria-invalid`、Textによる必須 / 任意表示を使う。

#### Codex Rule

業務Messageへ変換し、内部実装情報をUIへ露出しない。

### 8.5 Form Error Summary

Status: CONDITIONAL
Scope: Both

#### Purpose

長いFormの複数Errorを送信後にまとめ、修正箇所へ導く。

#### Use When

Project Create、Bulk Shift Createなど画面外にもErrorが存在し得る場合。

#### Do Not Use When

短いFormでField Errorだけで全体を把握できる場合。

#### Dispatch OS Examples

複数日Shift作成の無効日・時刻・人数Error。

#### Interaction

Submit失敗時にSummaryへFocusし、各項目を対応FieldへLinkする。

#### Responsive

Form先頭付近に全幅で表示する。

#### Accessibility

`role="alert"`または適切なlive regionとHeadingを使う。

#### Codex Rule

Summaryを出してもField単位Errorを省略しない。

## 9. Feedback Patterns

### 9.1 Toast

Status: CONDITIONAL
Scope: Both

#### Purpose

画面の文脈を中断せず、短い操作成功を通知する。

#### Use When

保存後も同じ画面に残り、結果が画面変化だけでは分かりにくい場合。

#### Do Not Use When

重大Error、再操作が必要、内容を後から確認する必要がある場合。

#### Dispatch OS Examples

Project基本情報更新、Shift追加後の成功通知。

#### Interaction

成功Toastは自動Dismiss可。Errorは自動DismissだけにせずInline Errorを併用する。

#### Responsive

MobileでActionやHeaderを覆わない位置に表示する。

#### Accessibility

`status` live region、十分な表示時間、Close操作を提供する。

#### Codex Rule

Toastだけを重大な業務状態の正本表示にしない。

### 9.2 Inline Success / Inline Error / Alert

Status: STANDARD
Scope: Both

#### Purpose

操作結果、継続中の注意、復旧方法を関連領域に残す。

#### Use When

Create / Update / Confirm結果、Data API error、業務上の注意に使用する。

#### Do Not Use When

装飾Notification、Errorを未登録状態に変換する場合。

#### Dispatch OS Examples

「勤怠を確定しました」「前日確認を送信できませんでした」「入力項目を取得できませんでした」。

#### Interaction

Retryや戻り先がある場合は明確なActionを付ける。

#### Responsive

関連Section内またはPage上部に配置し、長文を読みやすくする。

#### Accessibility

Errorは`role="alert"`、通常の成功は`status`を使い、色以外のIcon / Textを提供する。

#### Codex Rule

Create / Update / Confirm後は、成功または失敗を必ず知覚可能にする。

### 9.3 Loading / Disabled / Pending State

Status: STANDARD
Scope: Both

#### Purpose

処理中の二重送信を防ぎ、進行中であることを伝える。

#### Use When

Server Action、Route transition、データ再取得中に使用する。

#### Do Not Use When

全画面を無期限にblockする、Button labelが消える、LoadingをEmpty Stateとして表示する場合。

#### Dispatch OS Examples

「案件を作成中...」「前日確認を送信中...」「勤怠を確定中...」。

#### Interaction

Submitをdisabledにし、進行Labelを表示する。失敗時は再操作可能に戻す。

#### Responsive

Button幅の大幅な変化を避ける。

#### Accessibility

`aria-busy`、状態Text、Focusを維持する。disabledだけで理由を伝えない。

#### Codex Rule

非同期ActionにはPending表示と二重送信防止をセットで実装する。

### 9.4 Skeleton

Status: CONDITIONAL
Scope: Both

#### Purpose

遷移を伴わない長めのLoadingでLayout shiftを減らす。

#### Use When

実測で待ち時間があり、表示構造が安定しているClient transition。

#### Do Not Use When

Server-rendered Pageが速い、構造が複雑、Spinnerより理解しにくい場合。

#### Dispatch OS Examples

将来のFilter結果更新やMaster Detail候補。

#### Interaction

表示専用。操作可能に見せない。

#### Responsive

実際のResponsive layoutに一致させる。

#### Accessibility

読み上げ対象から除外し、別途Loading状態を通知する。

#### Codex Rule

見た目のためにSkeletonを増やさず、実測後に導入する。

## 10. Action Patterns

### 10.1 Primary / Secondary / Ghost / Link Action

Status: STANDARD
Scope: Both

#### Purpose

Actionの優先度とNavigationを視覚・意味の両方で区別する。

#### Use When

Primaryは画面の主要Action、Secondaryは補助Action、Ghostは低優先操作、LinkはNavigationに使用する。

#### Do Not Use When

同一領域に複数Primaryを置く、NavigationへButtonを乱用する場合。

#### Dispatch OS Examples

保存 / 作成 / 確定はPrimary、編集 / 追加はSecondary、Cancel / 戻るはGhostまたはLink。

#### Interaction

ButtonはAction、LinkはNavigationとして実装する。Pending時に状態を示す。

#### Responsive

MobileではPrimaryを見つけやすくし、必要なら全幅。Action順序を一貫させる。

#### Accessibility

具体的なLabel、Focus、disabled理由、44px程度の重要Touch Targetを提供する。

#### Codex Rule

1画面・1主要領域につきPrimary Actionは原則1つにする。

### 10.2 Destructive Action

Status: STANDARD
Scope: Both

#### Purpose

削除、解除、欠勤など重大な変更を通常Actionと区別し、誤操作を防ぐ。

#### Use When

破壊的または業務影響が大きい状態変更。

#### Do Not Use When

単なるCancel、Navigation、通常保存。

#### Dispatch OS Examples

配置解除、欠勤、無断欠勤、将来の削除。

#### Interaction

明確なDanger toneとConfirmation Dialogを使い、影響対象を再提示する。

#### Responsive

Primaryから距離を取り、誤Tapを防ぐ。

#### Accessibility

色だけでなく動詞と説明で重大性を示す。

#### Codex Rule

Destructive ActionはOverflowに隠すだけで安全対策としない。

### 10.3 Overflow Menu / Icon Button

Status: CONDITIONAL
Scope: Admin

#### Purpose

低頻度Actionを整理し、主要Action領域の混雑を防ぐ。

#### Use When

1対象に3個以上の低頻度Actionがあり、Label付き主要Actionを残せる場合。

#### Do Not Use When

Primary Action、Critical Action、唯一の重要導線を隠す場合。

#### Dispatch OS Examples

一覧行の将来的な追加操作、Audit export等。編集など高頻度Actionは状況に応じて外に出す。

#### Interaction

Click / Enter / Spaceで開き、Arrow / Escapeに対応する。Icon ButtonにはTooltipを付ける。

#### Responsive

MobileでMenuがViewport外へ出ない。Touch targetを確保する。

#### Accessibility

Accessible name、`aria-expanded`、Menu keyboard pattern、Focus復帰を提供する。

#### Codex Rule

Iconだけで意味が曖昧なActionを作らない。

## 11. Filter Patterns

### 11.1 Search / Quick Filter / Reset Filters

Status: STANDARD
Scope: Admin

#### Purpose

高頻度条件で一覧を素早く絞り、いつでも初期状態へ戻せるようにする。

#### Use When

Projects、Shifts、Attendance、Workers、Clientsに使用する。

#### Do Not Use When

対象が少なく絞込が不要、またはFilter結果が現在条件を表示しない場合。

#### Dispatch OS Examples

Project名検索、今日 / 明日 / 今週、状態、要確認。

#### Interaction

Query Parameterと同期し、invalid値はsafe defaultへ戻す。適用中条件があればResetを表示する。

#### Responsive

Mobileは頻出条件だけを常時表示し、縦積みまたは簡潔なControlにする。

#### Accessibility

永続Label、Submit名、結果件数または更新通知を提供する。

#### Codex Rule

検索・日付・状態など高頻度Filterだけを常時表示する。

### 11.2 Filter Chips / Segmented Control

Status: CONDITIONAL
Scope: Both

#### Purpose

少数の頻出条件を現在選択が見える形で切り替える。

#### Use When

今日 / 明日 / 今週、全件 / 要確認など2〜5個の排他的なQuick Filter。

#### Do Not Use When

候補が多い、Labelが長い、複数選択の意味が曖昧な場合。

#### Dispatch OS Examples

Shift Listの日付軸、Attendanceの要確認切替。

#### Interaction

選択状態をURLへ反映し、Back / Forwardで復元する。

#### Responsive

横Scrollへ安易に逃げず、収まらなければSelectへ切り替える。

#### Accessibility

Button groupまたはRadio group semantics、選択状態をText / ARIAで示す。

#### Codex Rule

Filter chipとStatus Badgeの見た目・役割を混同しない。

### 11.3 Advanced Filter / Date Range

Status: CONDITIONAL
Scope: Admin

#### Purpose

低頻度または複合条件をPrimary filter rowから分離する。

#### Use When

Shifts、Attendance、Workers、ClientsでFilter数が多くなる場合。

#### Do Not Use When

頻出条件を隠す、条件の適用状況が分からなくなる場合。

#### Dispatch OS Examples

支店、Client、Workplace、期間、複数状態をDrawer内で設定する。

#### Interaction

Apply、Cancel、Resetを提供し、適用数をTrigger近くに表示する。

#### Responsive

DesktopはDrawerまたはPopover、MobileはFull-screen sheetを使用できる。

#### Accessibility

Overlay rules、Field label、適用後の結果通知を守る。

#### Codex Rule

Filterが横1列に収まらないことだけを理由に縮小せず、詳細条件へ分離する。

### 11.4 Saved Filter

Status: CONDITIONAL
Scope: Admin

#### Purpose

高頻度の複合条件を再利用する将来Pattern。

#### Use When

実利用で同じ条件の反復が確認され、保存範囲・名称・権限が設計された場合。

#### Do Not Use When

要件、保存先、共有範囲が未確定の現在。

#### Dispatch OS Examples

将来の「本日・要確認・名古屋支店」Attendance view。

#### Interaction

保存、適用、名称変更、削除を明確にする。

#### Responsive

Mobileでは短い選択Listとして提供する。

#### Accessibility

保存済み条件の内容を名前だけでなく確認可能にする。

#### Codex Rule

Saved Filterは別PhaseのDomain / persistence設計なしに実装しない。

## 12. Mobile Patterns

### 12.1 Mobile Work Action

Status: STANDARD
Scope: Worker

#### Purpose

Workerが現在実行すべき前日確認、勤務開始、勤務終了を最優先で見つけられるようにするDispatch OS独自Pattern。

#### Use When

Worker HomeとAssignment Detailで、状態により実行可能なActionが1つに定まる場合。

#### Do Not Use When

実行不可条件をClientだけで判定する、複数のPrimary Actionを同時表示する場合。

#### Dispatch OS Examples

pending時の前日確認、開始可能時の勤務開始、勤務中の勤務終了。

#### Interaction

現在状態、受付条件、Action結果を表示し、Pending中は二重送信を防ぐ。

#### Responsive

Mobileでは本文上部またはSticky Bottom Action、Desktopでも過度に横へ広げない。

#### Accessibility

44px以上のTouch Target、明確な動詞、Focus、状態Text、色依存回避を行う。

#### Codex Rule

Worker画面では「今やるAction」を補足情報より先に配置する。

### 12.2 Mobile Cards / Progressive Disclosure

Status: STANDARD
Scope: Worker

#### Purpose

小画面で勤務情報を読みやすくまとめ、必要な詳細を段階的に見せる。

#### Use When

Worker Homeの複数Assignment、Assignment Detailの補足情報。

#### Do Not Use When

Critical Actionや受付条件をAccordion等へ隠す場合。

#### Dispatch OS Examples

次の勤務Cardに日時、勤務先、状態、Detail Linkを表示する。

#### Interaction

Card全体Clickではなく主タイトルLinkとActionを使う。

#### Responsive

1カラム中心。Desktopは適度な最大幅を維持する。

#### Accessibility

Heading、List semantics、Link / Buttonの役割を分ける。

#### Codex Rule

Worker Cardは次の判断に不要な情報を詰め込みすぎない。

### 12.3 Full Screen Sheet

Status: CONDITIONAL
Scope: Both

#### Purpose

MobileでDrawerや複雑な候補選択へ十分な操作領域を提供する。

#### Use When

Advanced Filter、検索可能なEntity selectionなど通常Drawerでは狭い場合。

#### Do Not Use When

短いConfirmationや通常Navigationで十分な場合。

#### Dispatch OS Examples

将来のWorker / Workplace Combobox候補、Admin Advanced Filter。

#### Interaction

明確なTitle、Close、Applyを持ち、Back相当操作を扱う。

#### Responsive

MobileのみFull screen、DesktopはDrawer / Popoverへ戻す。

#### Accessibility

Dialog semantics、Focus trap、Focus復帰を提供する。

#### Codex Rule

DesktopのDialogを機械的に全画面化せず、Mobile taskの長さで判断する。

## 13. Patterns to Avoid

| Pattern | Status | Dispatch OSで避ける理由 | 代替 |
| --- | --- | --- | --- |
| Full Row Click | AVOID | 行内Link、Button、Checkboxと競合し、遷移範囲が不明確 | Primary Object Link |
| Excessive Cards | AVOID | 情報密度が下がり、Section hierarchyが曖昧 | Section、Structured List |
| Excessive Primary Buttons | AVOID | 優先順位が消え、誤操作が増える | Button hierarchy |
| Nested Modal | AVOID | Focus、Close、Back、文脈が破綻 | 単一Drawer / Dialog、Dedicated Page |
| Infinite Scroll on Admin | AVOID | 件数・位置・再訪性が不明確で業務一覧に不向き | Pagination |
| Color-only Status | AVOID | 色覚や表示環境に依存 | Text + Icon + tone |
| Hidden Critical Action | AVOID | 欠勤、確定、勤務開始等を発見できない | 明示的Primary / Destructive Action |
| Hover-only Interaction | AVOID | Keyboard、Touchで利用不能 | Focus / Click対応、常時Label |
| Very Wide Unbounded Content | AVOID | 読み順と比較性が悪化 | Content Container |
| Excessive Horizontal Filter Rows | AVOID | 狭い画面で破綻し、優先条件が不明 | Quick + Advanced Filter |
| Mega Menu | AVOID | 現在のAdmin IAには過剰 | Sidebar |
| FAB / Speed Dial | AVOID | Desktop中心の管理Actionと相性が悪くActionが隠れる | Page header action |
| Swipe-only Actions | AVOID | 発見性とKeyboard互換性が低い | 可視Button / Menu |
| Masonry / Tile Grid | AVOID | 業務データ比較を妨げる | Grid、List、Table |
| Carousel / Stories | AVOID | 重要情報が隠れ、順次確認に不向き | Structured List |

## 14. Dispatch OS Specific Patterns

### 14.1 Management Hub

Status: STANDARD
Scope: Admin

Project Detailを基本情報、Job、Workplace、Shift、Staffing Summaryへ到達できる案件管理のHubとする。業務固有Page compositionであり、汎用Component名ではない。

Codex Rule: Project関連の新Route追加前にManagement Hubへ統合できるか確認する。

### 14.2 Staffing Summary

Status: STANDARD
Scope: Admin

必要人数、応募人数、配置人数、不足人数を共通順序で表示する業務固有Data Display。Summary Card、Description List、Progressを組み合わせて実装する。

Codex Rule: 分母・実数・不足を常にTextでも表示する。

### 14.3 Attendance State

Status: STANDARD
Scope: Both

予定、開始未報告、勤務中、終了、欠勤、無断欠勤、確定等を業務Ruleに基づき一貫して表示する業務固有状態Pattern。

Codex Rule: UI側で新しい状態判定を作らず、既存Ruleの結果を表示する。

### 14.4 Audit History

Status: STANDARD
Scope: Admin

勤怠訂正等のbefore / after、理由、実行者、日時を追跡可能にする業務固有Timeline。

Codex Rule: 履歴を現在値へ混在させず、独立Sectionで新旧を明示する。

### 14.5 Mobile Work Action

Status: STANDARD
Scope: Worker

Workerの現在状態から次の一手を1つ強調する業務固有Action composition。詳細は12.1に従う。

Codex Rule: Action可否の最終判断をUIだけに置かない。

## 15. Screen → Pattern Mapping

| Screen | STANDARD | CONDITIONAL | AVOID |
| --- | --- | --- | --- |
| Admin Dashboard | Sidebar、Content Container、Section、KPI、Structured List、Empty State、Status | Primary Object Link、Progress | Decorative cards、Hidden alerts |
| Project List | Primary Object Link、Search、Quick Filter、Reset、Structured List、Status Badge、Empty State | Pagination、Advanced Filter、Table | Full Row Click、詳細Button乱立、Infinite Scroll |
| Project Detail | Breadcrumb、Management Hub、Section、Description List、Staffing Summary、Status Badge | Drawer、Inline Edit、Tabs、Accordion、Sticky Action | Nested Modal、過剰Card |
| Project Create | Breadcrumb、Dedicated Page、Sectioned Form、Validation、Error Summary、Feedback | Combobox | Drawerへの過密化 |
| Shift List | Primary Object Link、Quick Filter、Structured List、Status Badge、Staffing Summary | Table、Pagination、Advanced Filter、Segmented Control | Infinite Scroll、横長Filter列 |
| Shift Detail | Breadcrumb、Section、Description List、Staffing Summary、Status Badge、Dialog | Drawer、Sticky Action、Timeline | Nested Modal、行全体Click |
| Bulk Shift Create | Breadcrumb、Dedicated Page、Sectioned Form、Inline Validation、Error Summary | Stepper（工程が明確に増えた場合） | 小さいDialog、Nested Modal |
| Attendance List | Primary Object Link、Table / Structured List、Search、Quick Filter、Status Badge、Summary、Empty State | Pagination、Advanced Filter、Responsive Card List | Worker名からShift Detail、別詳細Button、Infinite Scroll |
| Attendance Detail | Breadcrumb、Section、Description List、Attendance State、Audit History、Dialog、Feedback | Sticky Action | 状態の色のみ表示、履歴混在 |
| Worker Home | Mobile Cards、Primary Object Link、Mobile Work Action、Status Badge、Empty State | Sticky Bottom Action | Desktop向け巨大Table、Full Row Click |
| Worker Assignment Detail | Description List、Attendance State、Mobile Work Action、Section、Feedback | Sticky Bottom Action、Progressive Disclosure | Critical ActionのAccordion収納、複数Primary |

Clients / Workplaces、Workers、Settingsは現時点で簡易または将来機能を含む。新規CRUD時は本書のList、Primary Object Link、Sectioned Form、Entity selection rulesを適用する。

## 16. Entity → Edit Pattern Mapping

| Entity | Create | Edit | 理由・条件 |
| --- | --- | --- | --- |
| Project | Dedicated Page | Inline EditまたはSection単位Drawer | 新規作成は情報量が多い。編集はManagement Hubの文脈を維持する |
| Job | Drawer | Drawer | Project Detail内で完結し、親Projectを参照する |
| Shift | Drawer | Drawer | Job / Project文脈を維持する。単日作成に適する |
| Bulk Shift | Dedicated Page | 対象外。作成後はShift個別Drawer | 複数日・Preview・部分失敗を扱うため十分な空間が必要 |
| Client | Dedicated PageまたはDrawer | Drawer / Dedicated Page | Field量と関連データ管理の有無で決定。選択UIはCombobox候補 |
| Workplace | Client / Project文脈のDrawerまたはDedicated Page | Drawer | 住所・集合情報などField量を確認して決定 |
| Worker | Dedicated Page | Dedicated PageまたはSection単位編集 | 個人情報、状態、関連履歴を扱うため短いOverlayに限定しない |

このMappingはUI Patternの推奨であり、既存Domain RuleやDB操作を変更する許可ではない。

## 17. Core Patterns

### CORE: UI-1〜UI-4で整備する

- Sidebar Navigation
- Mobile Navigation Drawer
- Primary Object Link
- Breadcrumb
- Content Container
- Section
- Responsive Stack
- Drawer
- Dialog / Confirmation Dialog
- Button Hierarchy
- Status Badge
- Structured List
- Description List
- Sectioned Form
- Inline Validation
- Empty State
- Inline Feedback
- Loading / Pending State
- Management Hub
- Staffing Summary
- Attendance State
- Mobile Work Action

### LATER: 要件・実測後に導入する

- Pagination
- Tabs
- Accordion
- Advanced Filter
- Saved Filter
- Skeleton
- Master Detail
- Calendar View
- Combobox（候補数増加時）
- Sticky Header / Sticky Bottom Action

## 18. Current UI Gap Analysis

### 18.1 Admin Shell / Sidebar

Current:

- Admin Shell、Sidebar、Mobile Sidebar、Headerは既に分離されている。
- Sidebarは常時Expanded中心で、Collapsed stateの標準化余地がある。

Target:

- Expanded / Collapsed、Icon + Label、Collapsed Tooltip、Active State、Mobile Drawerを共通Patternとして統一する。

### 18.2 Project List

Current:

- Search、Status、Period、Reset、Empty State、Project statusが実装されている。
- List item内に主対象情報と状態がある。

Target:

- Project Nameを唯一の主要Detail導線として明確化する。
- データ増加時のみPagination / Advanced Filterを導入する。

### 18.3 Project Detail / Create flows

Current:

- Breadcrumb、Header、Status、Staffing summary、Overview、Job listがあり、Management Hubの基礎がある。
- Project、Job、Shift、Bulk ShiftのCreateはDedicated Pageへ分離されている。

Target:

- Project DetailをManagement Hubとして強化する。
- Job / single Shift Create・EditはDrawer候補とし、Project CreateとBulk ShiftはDedicated Pageを維持する。
- Project基本情報はSection単位Inline EditまたはDrawerを検討する。

### 18.4 Shift List / Detail

Current:

- 日付・状態・配置状態Filter、Summary、Detail sections、応募・配置・前日確認管理が存在する。

Target:

- Shift日時 / 主タイトルをPrimary Object Linkへ統一する。
- Staffing Summaryの項目順と状態LabelをProjectと共通化する。
- 欠勤等の短い重大ActionはDialog、編集はDrawerへ分離する。

### 18.5 Attendance List

Current:

- Summary、Filter、状態Badge、Worker・Shift情報、Attendance detail導線が存在する。
- IA調査ではWorker名からShift Detailへ進み、別途「勤怠詳細」を持つ導線が課題として確認されている。

Target:

- Worker名 → Attendance Detailを主要導線にする。
- Shift情報 → Shift Detailは補助Linkとして分離する。
- 右端Action領域へNavigation目的の詳細Buttonを置かない。

### 18.6 Attendance Detail

Current:

- Worker打刻、確定勤務、訂正、監査履歴など業務Sectionが存在する。

Target:

- `Title / Status → Summary → Worker打刻 → 確定実績 → 訂正 → Audit History`の順序へ統一する。
- Attendance StateとDestructive / Confirm ActionのToneを共通化する。

### 18.7 Worker Home / Assignment Detail

Current:

- Worker Home、Assignment Detail、前日確認、勤務開始・終了Actionが実装されている。
- 状態ごとの表示とActionはComponent分割されている。

Target:

- 複数Assignmentを開始日時順のMobile Cardで表示する。
- 「今やるAction」を最上位にし、not_open / pending / confirmed / attendance stateを同じPatternで示す。
- Critical Actionを補足情報の下やAccordion内へ隠さない。

### 18.8 Clients / Workplaces / Workers / Settings

Current:

- Routeは存在するが、本格的な一覧・CRUD Patternは後続Phaseの対象。

Target:

- ListはPrimary Object Link、検索、Empty Stateを標準とする。
- 候補数増加時のEntity selectionはComboboxへ移行する。
- CRUDはEntity → Edit Mappingを確認してからRouteを増やす。

## 19. Adoption Rules

### 19.1 Pattern selection order

新規UIまたは改修では次の順で判断する。

1. 上位のIA / Route方針を確認する
2. 本書のScreen / Entity Mappingを確認する
3. STANDARD Patternで解決できるか確認する
4. CONDITIONALの採用条件を満たすか確認する
5. AVOIDしか選べない場合は理由と代替案をReviewする
6. ResponsiveとAccessibilityを実装前に定義する

### 19.2 UI phaseへの反映

#### UI-1: IA / Route

- Project DetailをManagement Hubとする。
- Job / single Shift Create・EditをDrawer候補にする。
- Project CreateとBulk Shift CreateはDedicated Pageを維持する。
- Attendance ListのWorker名をAttendance DetailへのPrimary Object Linkにする。
- 新規Create / Edit Route追加前にEntity Mappingを確認する。

#### UI-2: Admin Shell

- SidebarのExpanded / Collapsed、Active State、Tooltipを標準化する。
- Tablet / MobileをNavigation Drawerへ切り替える。
- List / Detail / Form別のContent Containerを整備する。
- Header、Sidebar、Contentの責務を分離する。

#### UI-3: Navigation

- Primary Object LinkとBreadcrumbを全対象画面へ統一する。
- Navigationと右端Action領域を分ける。
- 「詳細を見る」ButtonとFull Row Clickを削減する。
- WorkerのMobile Work Actionを最優先導線にする。

#### UI-4: Design Foundation

- Button hierarchy、Status Badge、Section、Card、Form、Empty State、Feedbackを共通化する。
- Statusを色だけで示さず、LabelとIcon / toneを組み合わせる。
- Pending、Error、Success、Focus、Touch Targetを共通仕様にする。
- 具体的なColor、Spacing、Typography tokenはUI-4で決定する。

### 19.3 General implementation rules

- Patternは一般的なInteraction、業務固有Componentはその組合せとして区別する。
- Server ComponentをDefaultとし、Drawer、Dialog、local interaction等に必要な範囲だけClient Component化する。
- ButtonはAction、LinkはNavigationとして実装する。
- UIで隠すことを認可や業務Ruleの代替にしない。
- Query error、Loading、Emptyを別の状態として扱う。
- 新しいPatternを追加する場合は、既存Patternで解決できない理由をDocumentへ追記する。

## 20. Pattern Classification Summary

### STANDARD

- Sidebar Navigation
- Breadcrumb
- Primary Object Link
- Hamburger / Mobile Navigation
- Drawer
- Dialog / Modal
- Content Container
- Section
- Responsive Stack
- Structured List / Responsive Card List
- Summary Card / Metric / KPI
- Status Badge
- Description List
- Timeline / Audit History
- Empty State
- Sectioned Form
- Basic Inputs
- Select / Combobox（候補数による使い分け）
- Inline Validation / Help Text / Labels
- Inline Success / Inline Error / Alert
- Loading / Disabled / Pending State
- Button Hierarchy
- Destructive Action
- Search / Quick Filter / Reset
- Mobile Work Action
- Mobile Cards / Progressive Disclosure
- Management Hub
- Staffing Summary
- Attendance State

### CONDITIONAL

- Pagination
- Sticky Header / Sticky Action Area
- Dedicated Page
- Inline Edit
- Card
- Split Layout / Master Detail
- Tabs / Accordion
- Table
- Progress
- Form Error Summary
- Toast
- Skeleton
- Overflow Menu / Icon Button
- Filter Chips / Segmented Control
- Advanced Filter / Date Range
- Saved Filter
- Full Screen Sheet

### AVOID

- Full Row Click
- Excessive Cards
- Excessive Primary Buttons
- Nested Modal
- Infinite Scroll on Admin
- Color-only Status
- Hidden Critical Action
- Hover-only Interaction
- Very Wide Unbounded Content
- Excessive Horizontal Filter Rows
- Mega Menu
- FAB / Speed Dial
- Swipe-only Actions
- Masonry / Tile Grid
- Carousel / Stories

## 21. References

### External

- [UI Design Dictionary](https://ui-design-dictionary.pages.dev/)
  - 2026-08-23にNavigation、Layout、Forms & Input、Data Display、Feedback、Content、Actions、Mobile、Social & Communication、Onboarding & Guidance、Media、Commerce、Advanced Patterns、Authentication、Error & Systemを確認した。
  - Pattern名・概念・用途のみを参考にし、本文はDispatch OS向けに再構成した。

### Internal

- `AGENTS.md`
- `docs/dispatch-os-ui-ux-v1.md`
- `docs/ui-1-admin-ia-route-plan.md`
- `app/admin/`配下のDashboard、Projects、Shifts、Attendance、Clients、Workers、Settings routes
- `app/worker/`配下のWorker Home、Assignment Detail routes
- `components/admin/`配下のShell、Navigation、Breadcrumb、Dashboard、Projects、Shifts、Attendance components
- `components/worker/`配下のAssignment Detail、Pre-shift Confirmation、Attendance Action components

## 22. Final Principle

UI Design DictionaryにPatternが存在することは、Dispatch OSで採用する理由にならない。

同じ目的には同じInteractionを提供し、利用者が画面ごとの操作方法を学び直さなくてよい状態を作る。Pattern追加より、既存Patternの一貫した適用を優先する。
