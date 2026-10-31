export function signupValidationMessage(displayName: string, password: string, confirmation: string): string | null {
  if (!displayName.trim() || password.length < 8) return "表示名と8文字以上のパスワードを入力してください。";
  if (password !== confirmation) return "パスワードが一致していません。確認用に同じパスワードを入力してください。";
  return null;
}
