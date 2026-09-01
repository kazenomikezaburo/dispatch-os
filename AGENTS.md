<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Dispatch OS Project Guide

## Project Overview

このプロジェクトは、派遣会社向けの業務管理OSです。

主なユーザー：

- Worker
- Manager
- System Admin

主なドメイン：

- Projects
- Jobs
- Workplaces
- Shift Slots
- Applications
- Assignments
- Attendance
- Workers
- Clients

## Tech Stack

Frontend：

- Next.js 16
- TypeScript
- App Router
- Tailwind CSS

Backend：

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Data API

Libraries：

- `@supabase/supabase-js`
- `@supabase/ssr`
- `zod`
- `react-hook-form`
- `@hookform/resolvers`
- `lucide-react`
- `clsx`
- `tailwind-merge`
- `date-fns`

## Architecture

基本構造：

```text
UI
↓
Server Component / Server Action
↓
Supabase Data API
↓
PostgreSQL GRANT
↓
RLS
↓
Database Constraints
```

SecurityをUIだけで実装しないでください。

## Server Component Rules

Server Componentをデフォルトとします。`"use client"`は必要な場合だけ使用してください。

Client Componentの対象例：

- Drawer
- Dropdown
- Form Interaction
- Browser API
- `usePathname`
- local UI state

Page全体を不用意にClient Component化しないでください。

## Data Access Rules

SELECTは`lib/*`にData Access Functionを作成します。

例：`lib/admin/projects/get-projects.ts`

INSERT / UPDATEはServer Actionを基本とします。

例：`app/actions/projects.ts`

UI Componentから直接複雑なSupabase Queryを書かず、N+1 Queryを避けてください。Page Componentへ大量のQuery、Validation、業務ルール、複雑な集計、巨大なForm処理を詰め込まないでください。

## Folder Responsibilities

- `app/`：Routing、Page、Layout、Server Action、Route Handler
- `components/`：UI表示、再利用Component。業務ロジックは極力持たない
- `lib/`：Data Access、Business Rules、Validation、Utilities、Supabase / Auth Helper
- `app/actions/`：DB書き込みを行うServer Action
- `lib/admin/`：Admin側Data取得、業務判定
- `lib/worker/`：Worker側Data取得、業務判定
- `components/admin/`：Admin UI
- `components/worker/`：Worker UI
- `supabase/`：Schema、Migration、RLS、SQL Test
- `scripts/`：開発用処理、Test、Fixture、CI補助

存在しない機能の空ファイルや大量の`.gitkeep`を作らず、必要になった時点でディレクトリを追加してください。構成を整える目的だけで、動作中のファイルを移動しないでください。

## Supabase Rules

通常のアプリ処理では、絶対に`service_role`を使用しないでください。

`service_role`を使用できる範囲：

- ローカルFixture
- テスト準備
- 明示的に管理されたBackend処理

Browserへ`service_role`やsecretを渡さないでください。

## RLS Rules

RLSはSecurityの最終防御です。UIで非表示にしただけではSecurityになりません。既存RLSを迂回しないでください。

Policy変更時は必ず以下を考慮してください。

- Worker
- Manager
- System Admin
- anon
- IDOR
- Privilege Escalation

## Migration Rules

既存Migration：

- `001_initial_schema.sql`
- `002_rls_policies.sql`
- `003_api_grants.sql`

これらは過去Migrationとして扱います。一度remoteへ適用したMigrationを理由なく書き換えないでください。Schema変更は`004_xxx.sql`のような新しいMigrationで行います。

Codexはremoteへの`db push`を勝手に行いません。

## Remote Supabase Rules

明示的な指示がない限り、remote Supabaseへ以下を行わないでください。

- db push
- Seed投入
- User作成
- Auth変更
- Data削除
- Schema変更

ローカル開発で接続可能なホストは`127.0.0.1`または`localhost`だけです。テストScriptではremote URLを拒否してください。

## Auth Rules

Roleの正本は`public.profiles.account_type`です。

Roles：

- `worker`
- `manager`
- `system_admin`

Client側Roleを信用せず、localStorageへRoleを保存しないでください。Route GuardはServer-side、DBの最終防御はRLSとします。

## Form Rules

入力ValidationはZodを基本とします。Browser Validationだけに依存せず、Server側でもValidationしてください。重要な業務状態値はClient入力をそのまま信用しないでください。

## TypeScript Rules

`any`を原則使用せず、Domain Typeを定義してください。状態値やRoleは可能な限りUnion Typeで表現します。

```ts
type AccountType = "worker" | "manager" | "system_admin";
```

## UI Rules

業務システムとして以下を優先します。

- 高い視認性
- 適度な情報密度
- 大きめのクリック領域
- Desktop / Mobile Responsive

避けるもの：

- 過剰なGradient
- Glassmorphism
- 大量のShadow
- 極端なBorder Radius
- AI SaaS Template風デザイン
- 機能しないButton
- 飾りだけのNotification

## Admin / Worker Rules

- Admin：Desktop first。ただしMobileでも操作可能にする
- Worker：Mobile first。Desktopでも破綻させない

## Testing Rules

現在の重要Test：

- RLS：148 / 148
- Data API Security：105 / 105
- Auth：18 / 18
- Dashboard：12 / 12

既存TestをPASSさせるためにSecurity仕様を弱めないでください。FAILした場合は、期待値を書き換える前に原因を報告してください。

## Local Development

```powershell
npx supabase start
npx supabase db reset
node --experimental-strip-types scripts/dev/setup-dev-auth.ts
npm run dev
```

ローカル開発時は、`.env.local`のremote Supabaseへ誤接続しないよう注意してください。ローカル用ScriptはSupabase CLIから接続情報を取得し、remote URLを拒否します。

## Prohibited Actions

明示指示なしに以下を行わないでください。

- remote db push
- remote Seed
- RLS Disable
- GRANT ALL
- anonへの業務Data権限付与
- DELETE権限追加
- service_roleのBrowser使用
- Migration履歴書き換え
- Security Test弱体化
- 新規npm packageの大量追加
- 大規模Refactor
- unrelated file変更

## Implementation Style

1機能を小さなPhaseに分けて実装します。

例：Projects

- Phase A：一覧
- Phase B：詳細
- Phase C：作成
- Phase D：編集

一度に巨大機能を実装しないでください。

## Completion Checklist

各作業後に最低限確認してください。

- `npm run build`
- TypeScript
- ESLint（変更範囲）
- `git diff --check`
- Securityへの影響
- Migration変更有無
- package追加有無

## Dispatch OS UI/UX Guidelines

UI/UXに関する実装・変更・新規画面追加を行う場合は、必ず以下を参照すること。

- `docs/dispatch-os-ui-ux-v1.md`
- UI ComponentやInteraction Patternを新規実装・変更する場合は、`docs/dispatch-os-ui-patterns-v1.md`

UI実装では、個別画面だけを局所的に最適化せず、同ドキュメントで定義された以下の方針を優先する。

- Information Architecture
- Route / Page削減
- Navigation
- Admin / Workerの責務分離
- Sidebar / Layout
- Content Width
- Spacing
- Typography
- Button Hierarchy
- Status Badge
- Card
- Form
- Filter
- Empty State
- Feedback
- Breadcrumb
- Date / Time Format
- Responsive Design
- Accessibility

特に、新しい作成・編集Routeを追加する前に、既存Detail画面、Drawer、Dialog、Inline Editへ自然に統合できないか検討すること。

一覧画面では原則として主対象名を詳細画面への主要Navigationとし、「詳細を見る」Buttonの乱立を避ける。

UI/UX改善のみを目的とする作業では、既存のDomain Rule、Migration、RLS、GRANT、DB Function、RPC、Auth、集計Rule、状態遷移を変更しない。

UI変更にDB・Security・Domain変更が必要だと判断した場合は、独断で変更せず、別Phaseとして提案・報告すること。

UI/UX改修は原則として以下の順序で進める。

1. IA / Route
2. Layout / Shell
3. Navigation
4. Design Foundation
5. Individual Screens
6. Visual Polish

後続Phaseで削除・統合予定の画面を先に大規模リデザインしないこと。
