import { expect, it, vi } from "vitest";
import type { ShoppingSnapshot } from "../mobile/src/shopping";

const storage = vi.hoisted(() => ({ setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn() }));
vi.mock("../mobile/node_modules/@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("../mobile/node_modules/@aparajita/capacitor-secure-storage/dist/esm/index.js", () => ({ SecureStorage: storage }));
vi.mock("../mobile/src/secureStorage", () => ({ installationStorageKey: () => "test-shopping" }));
import { clearShoppingCache, saveShoppingCache } from "../mobile/src/shoppingCache";

it("家族切り替え時の消去は以前の書き込みの完了を待つ", async () => {
  let finish!: () => void;
  storage.setItem.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const save = saveShoppingCache("user", {} as ShoppingSnapshot);
  await vi.waitFor(() => expect(storage.setItem).toHaveBeenCalledOnce());
  const clear = clearShoppingCache();
  await Promise.resolve();
  expect(storage.removeItem).not.toHaveBeenCalled();
  finish();
  await Promise.all([save, clear]);
  expect(storage.removeItem).toHaveBeenCalledWith("test-shopping");
});
