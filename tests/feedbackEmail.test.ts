import { describe, expect, it } from "vitest";
import { buildFeedbackEmail } from "@/lib/notifications/feedbackEmail";

describe("buildFeedbackEmail", () => {
  it("種類と本文を通知用テキストへ変換する", () => {
    expect(buildFeedbackEmail({ category: "bug", message: "保存ボタンが反応しません" })).toEqual({
      subject: "【きょうのごはん】不具合のフィードバック",
      text: "種類: 不具合\n\n内容:\n保存ボタンが反応しません",
    });
  });

  it("改善要望の表示名を日本語にする", () => {
    expect(buildFeedbackEmail({ category: "improvement", message: "並び替えたい" }).subject).toContain("改善してほしい");
  });
});
