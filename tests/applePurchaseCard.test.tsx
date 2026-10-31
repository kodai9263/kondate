import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.stubGlobal("React", React);
vi.mock("../mobile/src/purchases", () => ({ purchasesAvailable: () => true }));
import { ApplePurchaseCard } from "../mobile/src/MobilePurchases";
const purchase = { products: [
  { id: "app.kyounogohan.mobile.family.monthly", name: "家族プラン（月額）", price: "¥480" },
  { id: "app.kyounogohan.mobile.family.yearly", name: "家族プラン（年額）", price: "¥4,800" },
], busy: false, message: "", error: "", act: vi.fn(), manage: vi.fn() };
describe("家族プラン購入画面", () => {
  it("Appleの価格・期間・復元・解約・規約を表示する", () => {
    const html = renderToStaticMarkup(<ApplePurchaseCard purchase={purchase} active={false} anonymous={false} online />);
    for (const text of ["月額 ¥480", "年額 ¥4,800", "1か月", "1年間", "購入を復元", "契約を管理", "自動更新", "利用規約", "プライバシーポリシー"]) expect(html).toContain(text);
    // 指定時だけ、実際のコンポーネントを画像確認用に書き出す。
    if (process.env.PURCHASE_PREVIEW_DIR) {
      mkdirSync(process.env.PURCHASE_PREVIEW_DIR, { recursive: true });
      const css = readFileSync("mobile/src/style.css", "utf8");
      writeFileSync(`${process.env.PURCHASE_PREVIEW_DIR}/index.html`, `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>購入画面の表示確認</title><style>${css}</style><body><main style="max-width:390px;margin:auto;padding:20px">${html}</main></body></html>`);
    }
  });
  it("利用中は購入ボタンを出さず復元を残す", () => {
    const html = renderToStaticMarkup(<ApplePurchaseCard purchase={purchase} active anonymous={false} online />);
    expect(html).not.toContain("で購入"); expect(html).toContain("購入を復元");
  });
  it("オフラインでは購入・復元・管理を無効にする", () => {
    const html = renderToStaticMarkup(<ApplePurchaseCard purchase={purchase} active={false} anonymous={false} online={false} />);
    expect(html.match(/disabled=""/g)).toHaveLength(4);
  });
});
