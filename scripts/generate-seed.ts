import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import rawMenuData from "../menu-data.json";
import type { MenuData } from "../src/types/domain";

const menuData = rawMenuData as MenuData;

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function jsonb(value: unknown): string {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function textArray(values: string[]): string {
  if (values.length === 0) return "'{}'::text[]";
  return `array[${values.map(sqlString).join(",")}]::text[]`;
}

function recipeIdByName(name: string): string {
  return `(select id from recipes where household_id is null and name = ${sqlString(name)} limit 1)`;
}

const recipeNames = new Set<string>();
const statements: string[] = [
  "-- Generated from menu-data.json. Do not edit by hand.",
  "insert into menu_templates (id, household_id, name, weeks, meta) values ('00000000-0000-0000-0000-000000000001', null, '基本の4週間テンプレート v1.1(夏版)', 4, " +
    jsonb({ shopping: menuData.weeks.map((week) => week.shopping), season: menuData.meta.season }) +
    ") on conflict (id) do update set meta = excluded.meta;",
];

Object.values(menuData.breakfasts).forEach((breakfast) => {
  recipeNames.add(breakfast.name);
  statements.push(
    `insert into recipes (household_id, name, category, servings_base, prep_minutes, cook_minutes, tags, meta) values (null, ${sqlString(
      breakfast.name,
    )}, 'breakfast', 5, 0, ${breakfast.minutes}, '{}', ${jsonb({ source: "menu-data.json" })}) on conflict do nothing;`,
  );
  breakfast.tasks.forEach((task, index) => {
    statements.push(
      `insert into recipe_steps (recipe_id, phase, position, text) values (${recipeIdByName(breakfast.name)}, 'morning', ${index}, ${sqlString(
        task,
      )}) on conflict do nothing;`,
    );
  });
});

menuData.weeks.forEach((week) => {
  week.days.forEach((day, dayOfWeek) => {
    if (!recipeNames.has(day.dinner)) {
      recipeNames.add(day.dinner);
      const tags = [day.fish ? "fish" : null, day.kids ? "kids" : null].filter((tag): tag is string => tag !== null);
      statements.push(
        `insert into recipes (household_id, name, category, servings_base, prep_minutes, cook_minutes, tags, meta, seasons) values (null, ${sqlString(
          day.dinner,
        )}, 'main', 5, ${day.prepMin}, ${day.cookMin}, ${textArray(tags)}, ${jsonb({
          side: day.side,
          seasonings: day.seasonings,
        })}, ${textArray(["summer"])}) on conflict do nothing;`,
      );

      day.morning.forEach((task, index) => {
        statements.push(
          `insert into recipe_steps (recipe_id, phase, position, text) values (${recipeIdByName(day.dinner)}, 'morning', ${index}, ${sqlString(
            task,
          )}) on conflict do nothing;`,
        );
      });
      day.evening.forEach((task, index) => {
        statements.push(
          `insert into recipe_steps (recipe_id, phase, position, text) values (${recipeIdByName(day.dinner)}, 'evening', ${index}, ${sqlString(
            task,
          )}) on conflict do nothing;`,
        );
      });
    }

    const dayIndex = menuData.weeks.indexOf(week) * 7 + dayOfWeek;
    const breakfastName = menuData.breakfasts[menuData.breakfastRotation[day.dow]].name;
    statements.push(
      `insert into template_entries (template_id, day_index, meal_type, recipe_id) values ('00000000-0000-0000-0000-000000000001', ${dayIndex}, 'breakfast', ${recipeIdByName(
        breakfastName,
      )}) on conflict do nothing;`,
    );
    statements.push(
      `insert into template_entries (template_id, day_index, meal_type, recipe_id) values ('00000000-0000-0000-0000-000000000001', ${dayIndex}, 'dinner', ${recipeIdByName(
        day.dinner,
      )}) on conflict do nothing;`,
    );
  });
});

const outDir = resolve("supabase/seed");
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "seed.sql"), `${statements.join("\n")}\n`);
