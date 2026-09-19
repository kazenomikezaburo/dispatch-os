# ADMIN-QA-3.0B-6G.1 Browser Evidence Closure

## Status

`ADMIN-QA-3.0B-6G.1: COMPLETE`

`ADMIN-UI-3.0B-6G: COMPLETE`

`ADMIN-MIG-3.0B-6H: READY`

## Initial Evidence Gap

6G Product implementationとdesktop interactionは完了済みだったが、exact 1440x900 / 1280x900 / 390x844、browser console、LAN originの証跡が不足していた。

## Browser Tooling

- Existing Chrome executableとNode.js標準WebSocketのみを使用した。
- Chrome DevTools Protocolで`Emulation.setDeviceMetricsOverride`、`Runtime`、`Log`、`Page`を使用した。
- 新規package、extension、repository browser dependencyは追加していない。
- `--disable-extensions`と専用一時user-data-dirを使用し、通常Chrome profileを変更していない。

## Authentication Safety

- Local / LANとも通常のSystem Admin loginを使用した。
- password、cookie、tokenをscript、result document、screenshotへ保存していない。
- Auth bypass、service role browser使用、cookie/security relaxationは行っていない。

## Exact Viewport Method

CDPでlayout metricsをoverrideし、各routeで`window.innerWidth`、`window.innerHeight`、`document.documentElement.clientWidth`、`scrollWidth`を取得した。縦scrollbar分だけclientWidthはviewportより15px小さいが、全件で`scrollWidth === clientWidth`でありdocument horizontal overflowは0。

## 1440x900

- requested / actual: 1440x900 / 1440x900
- clientWidth / scrollWidth: 1425 / 1425
- Project Overview、Project Edit、Client Master、legacy Workplace: PASS
- Project Edit screenshot: `docs/evidence/admin-6g/1440x900-project-edit.png`

## 1280x900

- requested / actual: 1280x900 / 1280x900
- clientWidth / scrollWidth: 1265 / 1265
- Project Overview、Project Edit、Client Master、legacy Workplace: PASS
- Project Edit screenshot: `docs/evidence/admin-6g/1280x900-project-edit.png`

## 390x844

- requested / actual: 390x844 / 390x844
- clientWidth / scrollWidth: 375 / 375
- Project Overview、Project Edit、Client Master、legacy Workplace: PASS
- Project Edit screenshot: `docs/evidence/admin-6g/390x844-project-edit.png`
- shared editor warning、labels、own scroll、body scroll lock、Escape、focus restore: PASS
- Initial evidence: close buttonは24.27x44pxで44x44px gateを満たさなかった。
- ADMIN-FIX-3.0B-6G.2 closure: `shrink-0`によりcomputed targetは44x44pxとなり、exact 390x844でPASS。

## Horizontal Overflow

Local 12 checksとLAN 3 checksの全件で`scrollWidth <= clientWidth`。document-level horizontal overflowは0。

## Project Overview

Local 3 viewportとLAN 1280x900でauthenticated render、reload、overflow 0、console gateを確認した。

## Project Edit

全Job explicit rendering、current Workplace、selector、new Workplace control、shared edit actionを全viewportで確認した。save mutationは実施していない。

## Shared Workplace Editor

- 390x844でviewport内表示、共有master警告、利用件数5、Job label `TEST Job N1`、field labelsを確認。
- body overflowは`hidden`、editor scroll containerは`scrollHeight 1203 / clientHeight 844 / overflow-y auto`。
- Escape後にtrigger `勤務先・会場情報を編集`へfocus restore。
- Initial evidenceではclose button heightは44pxだがwidthは24.27pxだった。6G.2で44x44pxへ修正しPASS。
- screenshot: `docs/evidence/admin-6g/390x844-shared-workplace-editor.png`

## Client Master

Local 3 viewportとLAN 1280x900で到達・表示・overflow 0・console gateを確認した。

## Browser Console Collection

CDPの`Runtime.consoleAPICalled`、`Runtime.exceptionThrown`、`Log.entryAdded`をroute navigationごとに収集した。

## Console Classification

- PRODUCT application errors: 0
- React warnings: 0
- hydration warnings: 0
- uncaught exceptions: 0
- unhandled rejections: 0
- KNOWN DEV TOOL NOISE: React DevTools案内とTurbopack HMR connectedのみ
- BROWSER/EXTENSION、NETWORK/ENVIRONMENT error: 0

## Local QA

`http://localhost:3000`でlogin、Project Overview、Project Edit、Client Master、legacy Workplaceを確認した。

## LAN Origin Resolution

Next runtimeは`0.0.0.0:3000`をadvertiseし、active Wi-Fi IPv4から到達可能originを`http://192.168.11.64:3000`として解決した。IPはsource codeへ保存していない。

## LAN QA

LAN originで通常login、Project Overview、Project Edit、Client Master、reloadを確認した。モバイルSidebarは44x44px triggerでopenし、Escape後にtriggerへfocus restore。document overflowとbrowser console gateはPASS。

## Hydration / React Verification

Local / LANの全代表routeでReact warning 0、hydration warning 0。console filteringでProduct errorを除外していない。

## Focus / Escape Verification

- shared Workplace editor Escape: PASS
- shared Workplace trigger focus restore: PASS
- LAN mobile Sidebar Escape / focus restore: PASS
- close target 44x44: PASS（6G.2後の実測44x44px）

## Screenshots / Evidence

- `docs/evidence/admin-6g/1440x900-project-edit.png`
- `docs/evidence/admin-6g/1280x900-project-edit.png`
- `docs/evidence/admin-6g/390x844-project-edit.png`
- `docs/evidence/admin-6g/390x844-shared-workplace-editor.png`

## Focused Regression

6G focused integration: 37 / 37 PASS。専用fixture cleanupもPASS。

## Static Verification

- TypeScript: PASS
- `git diff --check`: PASS（既存LF/CRLF noticeのみ）
- repo-wide ESLint: PASS。6G.2で`lib/admin/projects/get-project-detail.ts:24`の`prefer-const`をコード修正し、suppressionは追加していない。
- Production build: PASS（6G.2後に再実行）

## Product Files Changed

6G.1でProduct implementation変更0。追加・更新はresult documentsとbrowser evidence screenshotsのみ。

## Explicit Non-Changes

- UI / Product implementation: unchanged
- DB schema / migration / RLS / RPC / GRANT: unchanged
- Auth architecture: unchanged
- packages / lockfile: unchanged
- Figma: unchanged
- remote / staging / production: unchanged
- commit / push: 0
- existing staged / unstaged / untracked work: preserved

## Remaining Blocker

Initial BLOCKED reasonは6G.2で解消した。close targetはexact 390x844で44x44px、repo-wide ESLintは0 errors / 0 warnings。remaining blockerはない。
