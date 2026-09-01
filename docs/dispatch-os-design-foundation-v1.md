# Dispatch OS Design Foundation v1.0

## 1. Purpose

本書はDispatch OSのVisual Source of Truthである。UI/IAの正本である画面構成台帳 v2.1、画面構成Markdown v2.1、Figma、既存UI Patternを変更せず、今後の画面が同じ視覚言語で実装されるための基盤を定義する。

優先順位は、UI/IA＝台帳・Markdown・Figma、Visual＝本書、Security＝DB・GRANT・RLS・Domain Ruleとする。Reference Libraryは判断材料であり正本ではない。

## 2. Design Principles

1. Operational: 次の仕事と状態を最短で判別できる。
2. Calm: 色・影・装飾を抑え、長時間利用で疲れにくい。
3. Precise: 4px基準、限定したradius、1px borderで秩序を作る。
4. Dense but readable: Adminは比較可能な密度、Workerは44px以上の操作性を守る。
5. Semantic first: 見た目の色名ではなく役割でtokenを選ぶ。
6. Progressive migration: 全画面一括置換をせず、共通部品と作業中の画面から移行する。

## 3. Reference Analysis

`docs/ui_reference/**`内の各Referenceについて、DESIGN、tokens、variables、themeを確認した。名称が同じtokenでも意味と値が異なるため直接mergeしない。

| Reference | Strength | Weakness for Dispatch OS | Dispatch OS Adoption |
| --- | --- | --- | --- |
| Cal.com | monochrome、明確なCTA階層、compact control、1200px container | marketing scale、pill CTA、shadow中心のcard、custom font | near-black CTA、neutral canvas、compact densityを採用。pill buttonとfontは不採用 |
| Linear | 精密なspacing、6px control、hairline border、低いfont weight、minimal shadow | dark theme、acid-lime、0.5px border、開発者向けの極端な密度 | border-first、限定radius、抑制したweightを採用。dark/accent/fontは不採用 |
| Notion | warm light canvas、読みやすさ、white surface、12px card、200ms motion | editorial/marketing typography、装飾色のcard、独自font | わずかに温かいcanvas、flat surface、motionを一部採用。装飾色は不採用 |
| ClickUp | working-software density、structured list、status pill、4px grid | 大見出し、全面pill、紫・gradient・強いbrand表現 | list/status/densityを選択採用。gradient、巨大type、brand accentは不採用 |

## 4. Adopt / Adapt / Reject

Adopt: 4px spacing基準、near-black primary、blue link/focus、border-first、white surface、semantic status、product UI density。

Adapt: warm canvasは業務画面向けにごく弱くする。card radiusは12px、controlは8px、motionは150–200ms。Linearのhairlineは安定した1pxへ変換する。

Reject: Reference CSS/JSONのruntime利用、custom font、dark theme、gradient、glassmorphism、neon、marketing heading、全面pill button、過剰shadow、装飾目的のstatus色。

## 5. Color System

- Page background: `#f7f7f5`
- Surface: `#ffffff`
- Foreground: `#18181b`
- Secondary / muted: `#3f3f46` / `#71717a`
- Border: `#e4e4e7`; strong `#d4d4d8`
- Primary: near-black `#18181b`
- Link / focus: blue系統のみ
- Status: green / amber / red / blue / neutralを意味専用で使用

## 6. Semantic Tokens

canonical sourceは`app/globals.css`の`:root`。Tailwind v4の`@theme inline`はその値を参照するmappingであり、別themeではない。

| Family | Tokens |
| --- | --- |
| Canvas / Surface | `--background`, `--surface`, `--surface-subtle`, `--surface-muted`, `--surface-hover`, `--surface-selected`, `--surface-overlay` |
| Text | `--foreground`, `--foreground-secondary`, `--foreground-muted`, `--foreground-disabled`, `--foreground-inverse` |
| Structure | `--border`, `--border-strong`, `--border-subtle` |
| Actions | `--primary*`, `--secondary*`, `--link*`, `--focus-ring` |
| Status | `--success*`, `--warning*`, `--danger*`, `--info*` |
| Shape / Elevation | `--radius-control`, `--radius-card`, `--radius-panel`, `--radius-pill`, `--shadow-overlay` |

Raw paletteは現時点では設けない。Semantic値を変更する必要が生じた時点で、複数themeの実需要がある場合のみ追加する。

## 7. Typography

Font stackは既存Geist Sansを先頭に、`Yu Gothic UI`, `Hiragino Sans`, Meiryo, system-ui, sans-serif。新規font file、Reference font、packageは導入しない。

| Role | Size | Line height | Weight |
| --- | ---: | ---: | ---: |
| Caption | 12px | 1.4–1.5 | 400–500 |
| Body small | 14px | 1.5 | 400 |
| Body | 16px | 1.5 | 400 |
| Subheading | 16–18px | 1.4 | 500–600 |
| Heading small | 20px | 1.3 | 600 |
| Heading | 24–28px | 1.2–1.3 | 600 |
| Page heading | 最大32px | 1.2 | 600 |

700以上と48px以上は通常Admin UIで使用しない。日本語本文へ過剰なnegative trackingを適用しない。

## 8. Spacing

標準scaleは4, 8, 12, 16, 20, 24, 32, 40, 48px。28pxはPage heading等、6pxはcompact inlineに限定する。

- Admin form gap: 16–20px
- Admin section gap: 24–32px
- Worker section gap: 28–32px
- Inline gap: 8–12px

## 9. Radius

- Small: 4px（micro elementのみ）
- Control: 8px
- Card / panel: 12px
- Pill: 9999px（badge/tagのみ）

buttonをpill化しない。1画面内で独自radiusを増やさない。

## 10. Borders / Elevation

Defaultは1px `border`。重要なcontrol境界は`border-strong`、内部dividerは`border-subtle`。Cardは原則shadowなし。Popoverはsubtle shadow、Drawer/Dialogは`shadow-overlay`を許可する。構造をshadowだけに依存させない。

## 11. Layout

- General content: max-width 1200px
- Form: max-width 768px
- Wide form: max-width 896px
- Shell padding: desktop 32px、tablet 24px、mobile 16px
- Desktop sidebar: expanded 240–248px、collapsed 64–72px
- Top bar: Figma基準68px

Page-level horizontal overflowは禁止。局所的なtableのみ明示したscroll containerを使用する。

## 12. Buttons

- Primary: near-black、white text、control radius。1 viewに原則1つ。
- Secondary: white surface、strong border、neutral text。
- Ghost: transparent、hover surface。低優先度に限定。
- Danger: destructive actionのみdanger色。
- Icon: 44px touch target、`aria-label`必須。

Labelは14px / 500–600。hover、active、focus-visible、disabledを必ず持つ。

## 13. Form Controls

Adminは44px、Workerは44–48px。8px radius、1px strong border、white surface。Label gapは6px、helper/error gapは6px、field gapは16–20px。

Focusはblue border + 2px subtle ring。Errorはdanger textと必要に応じdanger border。Disabledはmuted surface、disabled text、not-allowed cursor、理由helperを併記する。opacityだけに依存しない。

## 14. Badge / Status

Badgeはcompact pill、12px / 500、text + dotまたは明示的labelで示す。neutral、success、warning、danger、infoのみ。Domain enumは変更せず、色だけで意味を伝えない。

## 15. Card / Surface

Cardはsummaryまたは意味のあるgroupに限定する。Surface階層はPage → Surface → Subtle/Muted → Hover/Selected → Overlay。単なる余白目的でcardを追加しない。

## 16. Structured List

- Admin row: 52–60pxを基準。複数行meta時は内容に応じて伸長。
- Vertical padding: 12–16px
- Divider: 1px border-subtle
- Primary object: text link。full-row clickは禁止。
- Secondary meta: 12–14px muted
- Status / actions: 右端、action target 44px
- Hover: surface-hover、selected: surface-selected。両者を同じ見た目にしない。
- Focus: primary link/actionに明示ring

## 17. Table

比較が主要目的の一覧だけで使用する。Headerは12px / 500、muted surface、44px。Rowは44–52px、hoverを持つ。sortable headerはbuttonとして実装し状態を読み上げる。Action列は末尾。狭幅は列削減または局所horizontal scrollを選ぶ。

## 18. Page Header

Breadcrumb → title / status → description → actionの順。Desktopはtitleとactionを上端合わせ、Mobileはaction wrapを許可する。Page独自marginは持たず共通Page containerのrhythmを使う。

## 19. Section Header

Title、optional description、optional actionで構成。Titleは18–20px / 600。Section間24–32px、headerとcontent間12–16px。

## 20. Drawer

既存`components/admin/drawer.tsx`を使用する。Desktop最大幅768px、右origin、1px left border、overlay shadow。Headerはsticky、body 16px mobile / 24px desktop、form footerは明確なdividerを持つ。Mobileは100%幅、100dvh、内部縦scroll。Escape、backdrop close、focus restore、pending中close抑止を維持する。

## 21. Dialog

短い判断・確認専用。multi-field editはDrawer。DialogとDrawerの同時nestは禁止。Dialogは中央配置、contentに応じた幅、明確なPrimary/Cancelを持つ。

## 22. Sidebar

UI-2.1Bの構造を維持する。Activeはselected surface + foreground、hoverはhover surface。Iconとlabelの意味を一致させる。Collapsedではtooltip/accessible nameを維持。今回Navigation構造は変更しない。

## 23. Mobile Navigation

現行挙動を維持し、最終仕様はsmartphoneでleft-origin `100vw × 100dvh`。Focus trap、Escape、focus restore、body scroll lock、44px targetを必須とする。全面化の実装は別Phase。

## 24. Admin Density

List row 52–60px、form gap 16px、section gap 24–32px、control 44px、table row 44–52px。情報をcardへ分断しすぎず、比較可能性を優先する。

## 25. Worker Density

Row 56–64px、section gap 28–32px、control 44–48px、touch target最低44px。TokenはAdminと共通にし、spacingとcontrol sizingでcomfortable densityを作る。

## 26. Responsive Rules

- 1440: 1200px contentとexpanded/collapsed sidebarの両方で呼吸を確保。
- 1280: action/filterのwrapを許可し、contentを圧迫しない。
- 390: single column、16px padding、44px target、Drawerは内部scroll、page overflowなし。
- Tableは必要な場合のみ局所overflow。Structured listはstackして維持する。

## 27. Accessibility

WCAG AAを基準とする。focus-visibleを消さない。状態はtextを併用。Icon actionにaria-label。semantic HTML、label、fieldset/legend、aria-invalidを使う。Mobile targetは44px以上。disabled理由をhelperで説明する。motionは150–200msで、`prefers-reduced-motion`を尊重する。

## 28. Do / Don't

Do: semantic token、border-first、単一CTA、object-name link、段階移行、keyboard QA。

Don't: Reference import/copy、独自gray、arbitrary hex/spacing/radiusの追加、gradient、glass、neon、card乱用、status色の装飾利用、full-row click、nested modal。

Empty / Loading / Error / Forbidden / Not Found / Conflict / Offline / Successは同じsurface・type・action hierarchyを使用する。Conflictはwarning surface + message + reload actionとしbehaviorを変えない。

## 29. Migration Strategy

1. `app/globals.css`のsemantic tokenをcanonical sourceとする。
2. Page Header、Drawer、Button/Form、Badgeなど共通面から置換する。
3. UI-2.3E以降は新規UIでsemantic utilityを必須とする。
4. 既存画面は作業Phaseまたは不具合修正時に段階移行する。
5. hardcoded Tailwind paletteは直ちにdeprecated扱いにはせず、役割が確定した箇所から置換する。
6. token追加時は既存roleで表現できない理由を文書化する。

今回の代表適用はAdmin Page Header、Dashboard summary、Project filter/status、Project/Job form、Project/Job edit Drawer、共通Drawer surface。IA、route、Server Action、Domain behaviorは変更しない。

## 30. Future Dark Mode Considerations

Dark modeは未実装。将来は`:root`と同じsemantic nameをtheme scope内で再定義し、component側は変更しない構造を採る。raw Reference dark tokenを取り込まず、contrast、status、overlay、native form controlを別途QAしてから有効化する。OS preferenceによる暗黙切替は行わない。

## Source of Truth

- UI / IA: `Dispatch_OS_画面構成台帳.xlsx`（内容はv2.1）、`Dispatch_OS_画面構成_完成版.md`（v2.1）、Figma Dispatch OS — Product Design
- Interaction: `docs/dispatch-os-ui-patterns-v1.md`
- Visual: 本書と`app/globals.css`のsemantic tokens
- Security: PostgreSQL constraints、GRANT、RLS、Domain rules、Server authorization

UI-2.3E以降、新しいcolor、spacing、radiusを画面ごとに発明せず、本書のroleとscaleを先に選ぶ。
