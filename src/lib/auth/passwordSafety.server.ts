import "server-only";
import { createHash } from "node:crypto";

export type PasswordSafety = "safe" | "pwned" | "unavailable";
// SHA-1は漏洩一覧との照合専用。パスワード保存には使用しない。
// 平文・完全なハッシュ・照合結果をログやキャッシュに残さない。
export async function checkPasswordSafety(password: string): Promise<PasswordSafety> {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Kondate-Password-Safety" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return "unavailable";
    const body = await response.text();
    const rows = body.trim().split(/\r?\n/);
    if (!rows.length || rows.some(row => !/^[A-F0-9]{35}:\d+$/.test(row))) return "unavailable";
    return rows.some(row => {
      const [suffix, count] = row.split(":");
      return suffix === hash.slice(5) && Number(count) > 0;
    }) ? "pwned" : "safe";
  } catch {
    return "unavailable";
  }
}
