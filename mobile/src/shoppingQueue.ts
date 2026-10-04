import { ShoppingAccessError, ShoppingSessionError, ShoppingConflictError, withShoppingItemChecked,
  type ShoppingItem, type ShoppingSnapshot } from "./shopping";

export type ShoppingChange = { kind: "check"; item: ShoppingItem; checked: boolean }
  | { kind: "add"; item: ShoppingItem }
  | { kind: "delete"; id: string }
  | { kind: "dismiss"; item: ShoppingItem };

export function applyShoppingChange(snapshot: ShoppingSnapshot, change: ShoppingChange): ShoppingSnapshot {
  if (change.kind === "add") return { ...snapshot, manualItems: [...snapshot.manualItems, change.item] };
  if (change.kind === "check") return withShoppingItemChecked(snapshot, change.item, change.checked);
  if (change.kind === "delete") return { ...snapshot, manualItems: snapshot.manualItems.filter((item) => item.id !== change.id) };
  return { ...snapshot, hasDismissedSeasonings: true, groups: snapshot.groups.map((group) => ({ ...group,
    items: group.items.filter((item) => !(item.source === "auto" && item.category === change.item.category
      && item.name === change.item.name && item.position === change.item.position)) })) };
}

function sameScope(left: ShoppingSnapshot, right: ShoppingSnapshot) {
  return left.householdId === right.householdId && JSON.stringify(left.period) === JSON.stringify(right.period);
}

type Handlers = {
  execute: (snapshot: ShoppingSnapshot, change: ShoppingChange) => Promise<ShoppingSnapshot>;
  reload: () => Promise<ShoppingSnapshot>;
  onState: (snapshot: ShoppingSnapshot, pending: number) => void;
  onConfirmed: (snapshot: ShoppingSnapshot) => void;
  onError: (error: unknown) => void;
};

// 通信は直列、画面は未保存の操作を重ねて表示し、古い応答で後続操作を消さない。
export class ShoppingMutationQueue {
  private changes: ShoppingChange[] = [];
  private running = false;
  private cancelled = false;
  constructor(private confirmed: ShoppingSnapshot, private handlers: Handlers) {}
  get pending() { return this.changes.length > 0; }
  enqueue(change: ShoppingChange) {
    if (this.cancelled) return;
    this.changes.push(change);
    this.publish();
    if (!this.running) void this.drain();
  }
  cancel() { this.cancelled = true; this.changes = []; }
  private publish() {
    if (!this.cancelled) this.handlers.onState(this.changes.reduce(applyShoppingChange, this.confirmed), this.changes.length);
  }
  private async drain() {
    this.running = true;
    while (this.changes.length && !this.cancelled) {
      const change = this.changes[0];
      try {
        const saved = await this.handlers.execute(this.confirmed, change);
        if (this.cancelled) break;
        const scopeChanged = !sameScope(this.confirmed, saved);
        this.confirmed = saved;
        this.changes.shift();
        if (scopeChanged) {
          this.changes = [];
          this.handlers.onConfirmed(saved);
          this.handlers.onError(new ShoppingConflictError("買い物期間が変わりました。最新の内容を確認してください。"));
          this.publish();
          break;
        }
        this.handlers.onConfirmed(saved);
      } catch (error) {
        if (this.cancelled) break;
        this.changes.shift();
        if (error instanceof ShoppingAccessError || error instanceof ShoppingSessionError) {
          this.cancel();
          this.handlers.onError(error);
          break;
        }
        // 保存結果が不明な操作は再送せず、サーバーの実状態を確認する。
        try {
          const latest = await this.handlers.reload();
          if (this.cancelled) break;
          const scopeChanged = !sameScope(this.confirmed, latest);
          this.confirmed = latest;
          if (error instanceof ShoppingConflictError || scopeChanged) this.changes = [];
          this.handlers.onConfirmed(latest);
        } catch {
          if (this.cancelled) break;
          this.changes = [];
          this.handlers.onError(new Error("保存結果を確認できませんでした。未保存の変更を戻しました。接続してリストを更新してください。"));
          this.publish();
          break;
        }
        this.handlers.onError(error);
      }
      this.publish();
    }
    this.running = false;
  }
}
