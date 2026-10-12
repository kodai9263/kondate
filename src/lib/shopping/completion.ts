import type { PlannedShoppingItem } from "./build";

// 完了履歴にはDBが受け付ける項目だけを渡し、表示用のメニュー名は含めない。
export function shoppingCompletionItem({ category, name, label, position, contributions }: PlannedShoppingItem) {
  return { source: "auto", category, name, label, position,
    contributions: contributions.map(({ key, date, meal, original, scale }) => ({ key, date, meal, original, scale })) };
}
