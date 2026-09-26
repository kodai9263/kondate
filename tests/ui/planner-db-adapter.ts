// 献立の保存・再読込テスト専用。一時Postgresに authenticated ロールで接続する。
import { execFileSync } from "node:child_process";
const tables = new Set(["profiles", "household_settings", "shopping_lists", "shopping_items", "recipes", "plan_entries", "household_recipe_exclusions", "meal_preferences", "household_breakfast_versions", "side_dishes"]);
const userId = "10000000-0000-4000-8000-000000000021";
const quote = (value: unknown) => value === null ? "null" : `'${String(value).replace(/'/g, "''")}'`;
const ident = (name: string) => { if (!/^[a-z_]+$/.test(name)) throw new Error("invalid identifier"); return `"${name}"`; };
export function query(statement: string) {
  if (!process.env.SHOPPING_TEST_SOCKET?.includes("kondate-planner.")) throw new Error("temporary database required");
  const output = execFileSync("psql", ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-h", process.env.SHOPPING_TEST_SOCKET!, "-d", "postgres", "-c", `set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false); ${statement}`], { encoding: "utf8" });
  return JSON.parse(output.trim().split("\n").at(-1)!);
}
export async function getSupabaseServer() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from: (table: string) => {
      if (!tables.has(table)) throw new Error("unexpected table");
      const clauses: string[] = [];
      let single = false;
      let order = "";
      let limit = "";
      let columns = "";
      const builder = {
        select: (value: string) => { columns = value; return builder; },
        eq: (key: string, value: unknown) => { clauses.push(`t.${ident(key)} = ${quote(value)}`); return builder; },
        in: (key: string, values: unknown[]) => { clauses.push(`t.${ident(key)} in (${values.map(quote).join(",")})`); return builder; },
        neq: (key: string, value: unknown) => { clauses.push(`t.${ident(key)} <> ${quote(value)}`); return builder; },
        gte: (key: string, value: unknown) => { clauses.push(`t.${ident(key)} >= ${quote(value)}`); return builder; },
        lte: (key: string, value: unknown) => { clauses.push(`t.${ident(key)} <= ${quote(value)}`); return builder; },
        is: (key: string, value: null) => { clauses.push(`t.${ident(key)} is ${quote(value)}`); return builder; },
        not: (key: string, operator: string, value: null) => { if (operator !== "is") throw new Error("unsupported operator"); clauses.push(`t.${ident(key)} is not ${quote(value)}`); return builder; },
        order: (key: string, options?: { ascending?: boolean }) => { order = `order by t.${ident(key)} ${options?.ascending === false ? "desc" : "asc"}`; return builder; },
        limit: (count: number) => { limit = `limit ${Math.floor(count)}`; return builder; },
        single: () => { single = true; return builder; },
        maybeSingle: () => { single = true; return builder; },
        upsert: async (rows: Record<string, unknown>[], options: { onConflict: string }) => {
          if (table !== "plan_entries" || options.onConflict !== "household_id,date,meal_type") throw new Error("unexpected write");
          const fields = ["household_id", "date", "meal_type", "recipe_id", "servings", "status", "locked", "side_mode", "side_dish_id"];
          const values = rows.map((row) => `(${fields.map((field) => quote(row[field])).join(",")})`).join(",");
          try {
            query(`insert into plan_entries (${fields.map(ident).join(",")}) values ${values} on conflict (household_id,date,meal_type) do update set recipe_id=excluded.recipe_id, servings=excluded.servings, status=excluded.status, locked=excluded.locked, side_mode=excluded.side_mode, side_dish_id=excluded.side_dish_id; select 'true'::json`);
            return { error: null };
          } catch { return { error: { message: "fixture write error" } }; }
        },
        then: (resolve: (result: unknown) => unknown) => {
          try {
            const extra = columns.includes("recipe_nutrition(") ? " || jsonb_build_object('recipe_nutrition', (select to_jsonb(n) from recipe_nutrition n where n.recipe_id=t.id))" : "";
            const result = query(`select coalesce(jsonb_agg(row), '[]'::jsonb) from (select to_jsonb(t)${extra} as row from ${ident(table)} t ${clauses.length ? `where ${clauses.join(" and ")}` : ""} ${order} ${limit}) q`);
            return Promise.resolve(resolve({ data: single ? result[0] ?? null : result, error: null }));
          } catch { return Promise.resolve(resolve({ data: null, error: { message: "fixture query error" } })); }
        },
      };
      return builder;
    },
  };
}
