// ローカル画面検証専用。Authと通信層だけを差し替え、一時Postgresに接続する。
import { execFileSync } from "node:child_process";
const tables = new Set(["profiles", "household_settings", "shopping_lists", "shopping_items", "shopping_completions", "recipes", "plan_entries", "household_recipe_exclusions", "meal_preferences", "household_breakfast_versions", "side_dishes"]);
const userId = "10000000-0000-4000-8000-000000000021";
const quote = (value: unknown) => value === null ? "null" : `'${String(value).replace(/'/g, "''")}'`;
const uuidArray = (values: unknown) => `array[${(Array.isArray(values) ? values : []).map(quote).join(",")}]::uuid[]`;
const ident = (name: string) => { if (!/^[a-z_]+$/.test(name)) throw new Error("invalid identifier"); return `"${name}"`; };
export function query(statement: string) {
  const output = execFileSync("psql", ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-h", process.env.SHOPPING_TEST_SOCKET!, "-d", "postgres", "-c", `set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false); ${statement}`], { encoding: "utf8" });
  return JSON.parse(output.trim().split("\n").at(-1)!);
}
export async function getSupabaseServer() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    rpc: async (name: string, args: Record<string, unknown>) => {
      try {
        if (name === "update_planned_shopping") {
          return { data: query(`select update_planned_shopping(${quote(args.target_week_start)},${quote(args.expected_range_start)},${quote(args.expected_range_end)},${quote(args.expected_period_mode)},${quote(args.operation)},${quote(JSON.stringify(args.item))}::jsonb)`), error: null };
        }
        if (name === "complete_planned_shopping") {
          return { data: query(`select complete_planned_shopping(${quote(args.target_week_start)},${quote(args.expected_range_start)},${quote(args.expected_range_end)},${quote(args.expected_period_mode)},${quote(JSON.stringify(args.auto_items))}::jsonb,${uuidArray(args.manual_ids)})`), error: null };
        }
        if (name === "undo_planned_shopping_completion") {
          return { data: query(`select undo_planned_shopping_completion(${quote(args.target_completion_id)}::uuid,${quote(args.target_week_start)},${quote(args.expected_range_start)},${quote(args.expected_range_end)},${quote(args.expected_period_mode)})`), error: null };
        }
        throw new Error("unexpected rpc");
      } catch { return { data: null, error: { message: "fixture database error" } }; }
    },
    from: (table: string) => {
      if (!tables.has(table)) throw new Error("unexpected table");
      const clauses: string[] = [];
      let single = false;
      let order = "";
      let limit = "";
      let columns = "";
      let mutation = "";
      const builder = {
        in: (key: string, values: unknown[]) => { clauses.push(`t.${ident(key)} in (${values.map(quote).join(",")})`); return builder; },
        insert: (row: Record<string, unknown>) => { mutation = insertRows(table, [row]); return builder; },
        upsert: (value: Record<string, unknown> | Record<string, unknown>[], options: { onConflict: string; ignoreDuplicates?: boolean }) => {
          const rows = Array.isArray(value) ? value : [value];
          mutation = insertRows(table, rows) + ` on conflict (${options.onConflict.split(",").map(ident).join(",")}) ` + (options.ignoreDuplicates ? "do nothing" : `do update set ${Object.keys(rows[0]).map((key) => `${ident(key)} = excluded.${ident(key)}`).join(",")}`);
          return builder;
        },
        select: (value: string) => { columns = value; return builder; },
        eq: (key: string, value: unknown) => { clauses.push(`t.${ident(key)} = ${quote(value)}`); return builder; },
        neq: (key: string, value: unknown) => { clauses.push(`t.${ident(key)} <> ${quote(value)}`); return builder; },
        gte: (key: string, value: unknown) => { clauses.push(`t.${ident(key)} >= ${quote(value)}`); return builder; },
        lte: (key: string, value: unknown) => { clauses.push(`t.${ident(key)} <= ${quote(value)}`); return builder; },
        is: (key: string, value: null) => { clauses.push(`t.${ident(key)} is ${quote(value)}`); return builder; },
        not: (key: string, operator: string, value: null) => { if (operator !== "is") throw new Error("unsupported operator"); clauses.push(`t.${ident(key)} is not ${quote(value)}`); return builder; },
        order: (key: string, options?: { ascending?: boolean }) => { order = `order by t.${ident(key)} ${options?.ascending === false ? "desc" : "asc"}`; return builder; },
        limit: (count: number) => { limit = `limit ${Math.floor(count)}`; return builder; },
        single: () => { single = true; return builder; },
        maybeSingle: () => { single = true; return builder; },
        then: (resolve: (result: unknown) => unknown) => {
          try {
            if (mutation) {
              const data = query(`with changed as (${mutation} returning *) select coalesce(jsonb_agg(to_jsonb(changed)), '[]'::jsonb) from changed`);
              return Promise.resolve(resolve({ data: single ? data[0] ?? null : data, error: null }));
            }
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

function insertRows(table: string, rows: Record<string, unknown>[]) {
  if (!["side_dishes", "plan_entries"].includes(table) || !rows.length) throw new Error("unexpected mutation");
  const keys = Object.keys(rows[0]);
  return `insert into ${ident(table)} (${keys.map(ident).join(",")}) values ${rows.map((row) => `(${keys.map((key) => quote(row[key])).join(",")})`).join(",")}`;
}
