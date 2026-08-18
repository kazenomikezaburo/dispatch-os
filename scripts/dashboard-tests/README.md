# Dashboard regression tests

`DASH-001`〜`DASH-012`を、ローカルSupabase、実際のSupabase Auth、Data API、RLS、Next.js Server Action、Cookie Sessionを使用して検証します。

## 安全策

- 接続情報は`.env.local`から読みません。
- `npx supabase status -o json`が返すローカル接続情報だけを使用します。
- URLが`http://127.0.0.1`または`http://localhost`で始まらない場合は即時終了します。
- service roleはローカルAuth Fixture準備だけに使用します。
- Dashboard取得はManager/System Admin本人のCookie SessionとRLSを通します。
- 開始時と終了時に`npx supabase db reset`を実行します。

## 実行方法

リポジトリルートから実行します。

```powershell
npx supabase start
node --experimental-strip-types scripts/dashboard-tests/dashboard-test.ts
```

テストランナーが以下を自動実行します。

1. ローカル接続ガード
2. `npx supabase db reset`
3. `TEST_`識別子を持つDashboard Fixture投入
4. 既存Auth Fixtureによるローカルテストパスワード設定
5. ローカルSupabase URL/Keyを明示した`npm run build`
6. ポート3101でNext.jsを一時起動
7. DASH-001〜012実行
8. Next.js停止
9. 最終`npx supabase db reset`

1件でもFAILした場合、終了コードは非0になります。

## 注意

テスト中にローカルDBはresetされます。ローカル環境に保持したい開発データがある場合は、先に退避してください。remote Supabaseへの`db push`やAuth操作は行いません。
