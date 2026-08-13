alter table public.plan_entries
  add column if not exists locked boolean not null default false;

create temporary table nutrition_catalog_seed (
  catalog_key text primary key,
  recipe_name text not null,
  side_name text not null,
  cook_minutes int not null,
  protein_source text not null
);

insert into nutrition_catalog_seed (catalog_key, recipe_name, side_name, cook_minutes, protein_source) values
  ('salmon', '鮭の塩焼き', '具だくさん味噌汁', 15, 'fish'),
  ('chicken-teriyaki', '鶏の照り焼き', 'キャベツと豆腐の味噌汁', 20, 'meat'),
  ('tofu-mapo', '豆腐たっぷり麻婆豆腐', '小松菜のナムル', 20, 'soy'),
  ('mackerel-miso', 'さばの味噌煮', '大根とわかめのすまし汁', 25, 'fish'),
  ('pork-ginger', '豚のしょうが焼き', '千切りキャベツとトマト', 18, 'meat'),
  ('soy-hamburg', '豆腐ハンバーグ', '根菜のコンソメスープ', 28, 'soy'),
  ('oyakodon', '野菜たっぷり親子丼', 'きのこの味噌汁', 20, 'egg'),
  ('cod-steam', 'たらと野菜の包み蒸し', 'かぼちゃの煮物', 25, 'fish'),
  ('pork-soup', '豚汁と焼きおにぎり', 'ほうれん草のごま和え', 25, 'meat'),
  ('chicken-tomato', '鶏と豆のトマト煮', 'ブロッコリーサラダ', 30, 'meat'),
  ('sardine-bowl', 'いわしの蒲焼き丼', '白菜の浅漬け', 22, 'fish'),
  ('tofu-curry', '豆と野菜のキーマカレー', 'ヨーグルトサラダ', 30, 'soy'),
  ('udon', '鶏と野菜の煮込みうどん', '冷ややっこ', 20, 'noodle'),
  ('beef-burdock', '牛肉とごぼうのしぐれ煮', '豆腐とねぎの味噌汁', 25, 'meat'),
  ('asari-cabbage', 'あさりと春キャベツの酒蒸し', '新じゃがのそぼろ煮', 22, 'fish'),
  ('sawara-saikyo', 'さわらの西京焼き', '菜の花のおひたし', 25, 'fish'),
  ('takenoko-chicken-rice', 'たけのこと鶏の炊き込みご飯', '豆腐のすまし汁', 30, 'meat'),
  ('spring-cabbage-pork', '春キャベツと豚肉の重ね蒸し', 'わかめと新玉ねぎのスープ', 25, 'meat'),
  ('nanohana-chicken', '鶏むね肉と菜の花の粒マスタード炒め', 'にんじんのポタージュ', 25, 'meat'),
  ('new-potato-soboro', '新じゃがの鶏そぼろあん', '春野菜の味噌汁', 25, 'meat'),
  ('snappea-champuru', 'スナップえんどうの豆腐チャンプルー', 'あさりの味噌汁', 20, 'soy'),
  ('greenpea-omelet', 'グリーンピースと新玉ねぎのオムレツ', '春キャベツのミネストローネ', 25, 'egg'),
  ('takenoko-tofu', 'たけのこと厚揚げのうま煮', '豆苗のごま和え', 25, 'soy'),
  ('first-katsuo', '初がつおのたたき', '新玉ねぎとわかめのサラダ', 20, 'fish'),
  ('aji-nanban', 'あじの南蛮漬け', 'そら豆ご飯', 30, 'fish'),
  ('fresh-onion-chicken', '新玉ねぎと蒸し鶏の香味だれ', 'アスパラの卵スープ', 20, 'meat'),
  ('cold-pork-tomato', '冷しゃぶとトマトの香味サラダ', 'とうもろこしご飯', 20, 'meat'),
  ('aji-herb-grill', 'あじの香草パン粉焼き', '夏野菜のスープ', 25, 'fish'),
  ('eggplant-miso-pork', 'なすと豚肉の味噌炒め', 'きゅうりとわかめの酢の物', 20, 'meat'),
  ('goya-champuru', 'ゴーヤと豆腐のチャンプルー', 'もずくのすまし汁', 20, 'soy'),
  ('corn-chicken-rice', 'とうもろこしと鶏肉の炊き込みご飯', 'トマトと卵のスープ', 30, 'meat'),
  ('okra-plum-chicken', '鶏むね肉とオクラの梅だれ', 'かぼちゃの味噌汁', 20, 'meat'),
  ('summer-veg-whitefish', '白身魚と夏野菜のラタトゥイユ', '豆のコンソメスープ', 30, 'fish'),
  ('sesame-chicken-noodles', '蒸し鶏の冷やしごまだれ麺', '枝豆とトマトのサラダ', 20, 'noodle'),
  ('taco-rice', '野菜たっぷりタコライス', 'オクラのコンソメスープ', 25, 'meat'),
  ('spicy-hiyayakko', '香味野菜のピリ辛冷ややっこ', '鶏ととうもろこしの混ぜご飯', 20, 'soy'),
  ('unagi-bowl', 'うなぎと夏野菜のちらし丼', '冬瓜のすまし汁', 25, 'fish'),
  ('pumpkin-chicken-curry', 'かぼちゃと鶏肉の夏カレー', 'きゅうりのヨーグルトサラダ', 30, 'meat'),
  ('sanma', 'さんまの塩焼き', 'きのこと小松菜のおろし和え', 20, 'fish'),
  ('salmon-mushroom', '鮭ときのこのホイル焼き', 'さつまいもの味噌汁', 25, 'fish'),
  ('sweetpotato-chicken', '鶏肉とさつまいもの甘辛煮', 'れんこんのごま酢和え', 25, 'meat'),
  ('mushroom-tofu-hamburg', 'きのこあんの豆腐ハンバーグ', 'かぶの豆乳スープ', 30, 'soy'),
  ('chestnut-chicken-rice', '栗と鶏肉の炊き込みご飯', '秋なすの味噌汁', 30, 'meat'),
  ('autumn-eggplant-tuna', '秋なすとまぐろの味噌炒め', 'きのこのすまし汁', 20, 'fish'),
  ('lotus-chicken-balls', 'れんこん入り鶏つくね', '里芋とねぎの味噌汁', 25, 'meat'),
  ('taro-chicken', '里芋と鶏肉の含め煮', '春菊の白和え', 30, 'meat'),
  ('oyster-rice', '牡蠣とごぼうの炊き込みご飯', '白菜の豆乳スープ', 30, 'fish'),
  ('returning-katsuo', '戻りがつおのしょうが焼き', '里芋のごま味噌和え', 20, 'fish'),
  ('mushroom-beef-rice', 'きのこと牛肉の混ぜご飯', 'かぶと油揚げの味噌汁', 25, 'meat'),
  ('buri-daikon', 'ぶり大根', 'ほうれん草の白和え', 30, 'fish'),
  ('cod-hotpot', 'たらと白菜の寄せ鍋', 'さつまいもの塩きんぴら', 30, 'fish'),
  ('chicken-mizutaki', '鶏と冬野菜の水炊き', 'ひじきの混ぜご飯', 30, 'meat'),
  ('cabbage-millefeuille', '白菜と豚肉のミルフィーユ蒸し', 'れんこんのきんぴら', 25, 'meat'),
  ('spinach-cream-chicken', 'ほうれん草と鶏肉のクリーム煮', 'にんじんと豆のサラダ', 30, 'meat'),
  ('daikon-pork', '大根と豚肉のこっくり煮', '小松菜としめじのおひたし', 30, 'meat'),
  ('napa-tofu', '白菜と厚揚げのうま煮', 'ごぼうとにんじんのサラダ', 25, 'soy'),
  ('oden', '野菜たっぷりおでん', '鮭と枝豆の混ぜご飯', 30, 'egg'),
  ('cauliflower-salmon', '鮭とカリフラワーのグラタン', '白菜と豆のスープ', 30, 'fish'),
  ('yuzu-chicken', '鶏肉と大根の柚子煮', '春菊と豆腐のごま和え', 30, 'meat'),
  ('leek-sukiyaki', '長ねぎと牛肉のすき煮', 'かぶの甘酢漬け', 25, 'meat');

update public.recipes r
set meta = r.meta || jsonb_build_object(
  'nutrition_catalog_id', c.catalog_key,
  'side', coalesce(r.meta ->> 'side', c.side_name)
)
from nutrition_catalog_seed c
where r.household_id is null
  and r.name = c.recipe_name;

insert into public.recipes (
  household_id, name, category, servings_base, cook_minutes,
  image_url, protein_source, meta
)
select
  null,
  c.recipe_name,
  'main',
  4,
  c.cook_minutes,
  '/images/family-dinner.png',
  c.protein_source,
  jsonb_build_object('nutrition_catalog_id', c.catalog_key, 'side', c.side_name)
from nutrition_catalog_seed c
where not exists (
  select 1 from public.recipes r
  where r.household_id is null
    and r.meta ->> 'nutrition_catalog_id' = c.catalog_key
);

insert into public.recipe_steps (recipe_id, phase, position, text)
select r.id, 'evening', 0, r.name || 'を作る'
from public.recipes r
where r.household_id is null
  and r.meta ->> 'nutrition_catalog_id' is not null
  and not exists (select 1 from public.recipe_steps rs where rs.recipe_id = r.id);

drop table nutrition_catalog_seed;

create or replace function public.clear_plan_tasks_on_recipe_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.recipe_id is distinct from new.recipe_id then
    delete from public.task_states where plan_entry_id = old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_plan_tasks_on_recipe_change on public.plan_entries;
create trigger clear_plan_tasks_on_recipe_change
  before update of recipe_id on public.plan_entries
  for each row execute function public.clear_plan_tasks_on_recipe_change();

revoke all on function public.clear_plan_tasks_on_recipe_change() from public;

comment on column public.plan_entries.locked
  is '月間献立の再生成時に維持する固定状態';
