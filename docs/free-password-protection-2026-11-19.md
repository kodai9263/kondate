# 無料範囲のパスワード保護

- Supabase Freeを維持。課金設定・有料の漏洩パスワード保護は変更しない。
- Webの新規登録・パスワード再設定ActionでPwned Passwordsの無料range APIを照合。平文・完全ハッシュ・メールアドレスは送信せず、SHA-1先頭5桁のみ送る。Add-Paddingを指定し、ログ・キャッシュを残さない。
- 漏洩一致、5秒タイムアウト、HTTP失敗、不正応答では登録・更新を中止し再試行を案内。既存ログインは検査しない。再設定は認証確認後のみ照合。
- iOSネイティブ登録・Supabase Authへの直接リクエストは対象外。全経路の強制保護ではなく、Supabaseアドバイザーの警告も解消しない。検査サービス障害中はWebの登録・再設定が使えない。
- プライバシーポリシーに照合サービスと送信範囲を追記。
- 2026-11-19のnpm auditは開発依存を含め0件。GHSA-fc5q-39xc-vjpfは2026-11-18に撤回。依存をダウングレードしたり監査を抑制したりしていない。
- 全95ファイル1224テスト、本番ビルド成功。外部接続は公開検証用文字列のハッシュ先頭で確認。実アカウントのパスワードは使用していない。

参考: https://haveibeenpwned.com/API/v3#SearchingPwnedPasswordsByRange
参考: https://github.com/advisories/GHSA-fc5q-39xc-vjpf
