import { ShoppingCart } from "lucide-react";
import { ShoppingList, type ShoppingListGroup } from "@/components/features/shopping/ShoppingList";
import { formatFamilyLabel, formatShoppingDay, scaleQuantityText } from "@/lib/family/servings";
import { getCurrentHouseholdPreferences } from "@/lib/family/server";
import { menuData } from "@/lib/menuData";
import { buildShoppingItemKey, getShoppingCycle, orderShoppingEntries } from "@/lib/services/shoppingService";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function ShoppingPage() {
  const today = new Date();
  const preferences = await getCurrentHouseholdPreferences();
  const { weekIndex, weekStart } = getShoppingCycle(menuData, preferences.shoppingDay, today);
  const savedState = await getSavedShoppingState(weekStart);
  const familySize = { adultCount: preferences.adultCount, childCount: preferences.childCount };
  const week = menuData.weeks[weekIndex];
  const groups: ShoppingListGroup[] = orderShoppingEntries(week.shopping).map(([category, items]) => ({
    category,
    items: items.map((name, position) => ({
      category,
      name,
      position,
      label: scaleQuantityText(name, familySize),
    })),
  }));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[640px] px-4 pb-28 pt-5">
      <header className="border-b-2 border-kondate-ink pb-5">
        <p className="flex items-center gap-2 text-sm font-black text-kondate-accent"><ShoppingCart size={18} aria-hidden="true" />SHOPPING LIST</p>
        <h1 className="font-mincho mt-2 text-3xl font-black">基本の買い物リスト</h1>
        <p className="mt-2 text-sm font-bold text-kondate-muted">{formatShoppingDay(preferences.shoppingDay)}曜向け・{week.label}・{formatFamilyLabel(familySize)}</p>
      </header>
      <div className="mt-5">
        <ShoppingList
          groups={groups}
          initialManualItems={savedState.manualItems}
          initialCheckedKeys={savedState.checkedKeys}
          listId={savedState.listId}
          weekIndex={weekIndex}
          weekStart={weekStart}
          loadError={savedState.loadError}
        />
      </div>
    </main>
  );
}

type SavedShoppingState = {
  checkedKeys: string[];
  manualItems: Array<{ id: string; category: string; name: string; position: number; checked: boolean; source: "manual" }>;
  listId: string | null;
  loadError: boolean;
};

async function getSavedShoppingState(weekStart: string): Promise<SavedShoppingState> {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { checkedKeys: [], manualItems: [], listId: null, loadError: true };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();
  if (profileError || !profile?.household_id) return { checkedKeys: [], manualItems: [], listId: null, loadError: true };

  const { data: list, error: listError } = await supabase
    .from("shopping_lists")
    .upsert(
      { household_id: profile.household_id, week_start: weekStart },
      { onConflict: "household_id,week_start" },
    )
    .select("id")
    .single();

  if (listError || !list) return { checkedKeys: [], manualItems: [], listId: null, loadError: true };

  const { data: items, error: itemsError } = await supabase
    .from("shopping_items")
    .select("id, category, name, position, checked, source")
    .eq("list_id", list.id);

  if (itemsError) return { checkedKeys: [], manualItems: [], listId: list.id, loadError: true };
  return {
    checkedKeys: (items ?? []).filter((item) => item.checked).map((item) => buildShoppingItemKey(item.category, item.name)),
    manualItems: (items ?? []).filter((item) => item.source === "manual").map((item) => ({ ...item, source: "manual" as const })),
    listId: list.id,
    loadError: false,
  };
}
