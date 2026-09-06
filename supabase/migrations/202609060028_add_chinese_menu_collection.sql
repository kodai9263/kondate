-- 写真で共有された中華メニュー16品を公式カタログへ追加する。
-- 材料・工程は後続の 202609060029_refresh_official_recipe_details.sql で同期する。
create temporary table chinese_menu_collection_seed (
  catalog_key text primary key,
  recipe_name text not null,
  side_name text not null,
  cook_minutes int not null,
  protein_source text not null,
  energy_kcal numeric not null, protein_g numeric not null, fat_g numeric not null,
  carbs_g numeric not null, fiber_g numeric not null, salt_g numeric not null, vegetables_g numeric not null
) on commit drop;

insert into chinese_menu_collection_seed values
  ('shrimp-mayo-fried-rice','エビマヨチャーハン','中華風コーンスープ',20,'egg',704,25,25,92,4.8,2.5,105),
  ('napa-cabbage-fried-rice','白菜チャーハン','わかめスープ',18,'egg',655,23,20,94,5.9,2.3,175),
  ('yurinchi-fried-rice','油淋鶏チャーハン','青菜の中華スープ',30,'meat',735,32,27,91,5.6,2.6,160),
  ('chinese-bowl','中華丼','中華風たまごスープ',25,'meat',684,27,19,98,8.2,2.5,245),
  ('black-fried-rice','ブラックチャーハン','もやしと卵のスープ',18,'egg',677,24,22,93,5.1,2.7,135),
  ('mapo-fried-rice','麻婆チャーハン','中華風わかめスープ',25,'meat',720,29,24,94,6.4,2.8,180),
  ('pork-ginger-bowl','豚肉生姜焼き丼','キャベツと豆腐の味噌汁',20,'meat',728,30,24,101,6.8,2.5,170),
  ('tenshin-bowl','天津丼','小松菜ときのこの中華スープ',25,'egg',676,25,19,102,5.2,2.6,155),
  ('liver-chive-stir-fry','レバニラ炒め','ごはんと中華スープ',20,'meat',650,29,21,88,6.7,2.5,235),
  ('pork-vegetable-stir-fry','肉野菜炒め','ごはんとわかめスープ',20,'meat',665,28,21,91,8.8,2.4,275),
  ('restaurant-hoikoro','ホイコーロー','ごはんと卵スープ',20,'meat',690,29,24,92,7.8,2.6,260),
  ('mapo-bowl','麻婆丼','もやしとわかめの中華スープ',20,'meat',704,28,23,96,6.1,2.8,175),
  ('pork-wood-ear-egg','豚肉・きくらげと卵炒め','ごはんと中華スープ',20,'meat',679,30,24,89,6.5,2.5,205),
  ('fried-chicken-black-vinegar','鶏唐揚げ黒酢あんかけ','ごはんと中華スープ',30,'meat',738,33,28,95,6.9,2.7,225),
  ('chinjao-rosu','チンジャオロース','ごはんと中華スープ',20,'meat',672,29,21,92,7.2,2.5,245),
  ('beef-pepper-rice','ビーフペッパーライス','コーンと卵のスープ',20,'meat',748,29,28,97,4.9,2.6,125);

insert into public.recipes (household_id, name, category, servings_base, cook_minutes, image_url, protein_source, tags, meta)
select null, seed.recipe_name, 'main', 4, seed.cook_minutes,
  case seed.protein_source when 'egg' then '/images/tofu-hamburg.png' else '/images/chicken-teriyaki.png' end,
  seed.protein_source, array['定番'], jsonb_build_object('nutrition_catalog_id', seed.catalog_key, 'side', seed.side_name)
from chinese_menu_collection_seed seed
where not exists (
  select 1 from public.recipes recipe
  where recipe.household_id is null
    and (recipe.meta ->> 'nutrition_catalog_id' = seed.catalog_key or recipe.name = seed.recipe_name)
);

update public.recipes recipe
set cook_minutes = seed.cook_minutes, protein_source = seed.protein_source, tags = array['定番'],
  meta = recipe.meta || jsonb_build_object('nutrition_catalog_id', seed.catalog_key, 'side', seed.side_name)
from chinese_menu_collection_seed seed
where recipe.household_id is null
  and (recipe.meta ->> 'nutrition_catalog_id' = seed.catalog_key or recipe.name = seed.recipe_name);

insert into public.recipe_nutrition (recipe_id, energy_kcal, protein_g, fat_g, carbs_g, fiber_g, salt_g, vegetables_g, source)
select recipe.id, seed.energy_kcal, seed.protein_g, seed.fat_g, seed.carbs_g, seed.fiber_g, seed.salt_g, seed.vegetables_g, 'official'
from chinese_menu_collection_seed seed
join public.recipes recipe on recipe.household_id is null and recipe.meta ->> 'nutrition_catalog_id' = seed.catalog_key
on conflict (recipe_id) do update set
  energy_kcal = excluded.energy_kcal, protein_g = excluded.protein_g, fat_g = excluded.fat_g, carbs_g = excluded.carbs_g,
  fiber_g = excluded.fiber_g, salt_g = excluded.salt_g, vegetables_g = excluded.vegetables_g, source = excluded.source, updated_at = now();
