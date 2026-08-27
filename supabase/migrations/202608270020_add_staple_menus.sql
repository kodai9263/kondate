create temporary table staple_menu_seed (
  catalog_key text primary key,
  recipe_name text not null,
  side_name text not null,
  cook_minutes int not null,
  protein_source text not null,
  energy_kcal numeric not null,
  protein_g numeric not null,
  fat_g numeric not null,
  carbs_g numeric not null,
  fiber_g numeric not null,
  salt_g numeric not null,
  vegetables_g numeric not null,
  ingredients_text text not null,
  steps_text text not null
);

insert into staple_menu_seed values
  (
    'nikujaga', '肉じゃが', 'ほうれん草のおひたし', 30, 'meat',
    648, 25, 18, 95, 8.5, 2.2, 180,
    $ingredients$牛こま切れ肉 300g
じゃがいも 4個
玉ねぎ 1個
にんじん 1本
しらたき 200g
だし汁 400ml
醤油 大さじ3
みりん 大さじ2
砂糖 大さじ2
酒 大さじ2
油 大さじ1$ingredients$,
    $steps$じゃがいも、玉ねぎ、にんじんを食べやすく切る
鍋で牛肉と野菜を油で炒める
だし汁と調味料、しらたきを加えて落としぶたをする
弱めの中火で20分ほど煮る$steps$
  ),
  (
    'omelet-rice', 'ふわとろオムライス', '野菜コンソメスープ', 25, 'egg',
    690, 25, 24, 91, 6.5, 2.1, 150,
    $ingredients$温かいごはん 600g
鶏もも肉 200g
玉ねぎ 1個
卵 6個
牛乳 100ml
ケチャップ 大さじ6
バター 20g
塩 小さじ1/2
こしょう 少々
油 大さじ1$ingredients$,
    $steps$鶏肉と玉ねぎを小さく切って炒める
ごはんとケチャップを加えて炒め、器に盛る
卵と牛乳を混ぜ、半熟になるまで焼く
ケチャップライスに卵をのせる$steps$
  ),
  (
    'vegetable-yakisoba', '野菜たっぷり焼きそば', 'わかめスープ', 20, 'noodle',
    630, 24, 18, 92, 9.0, 2.3, 220,
    $ingredients$蒸し中華麺 4玉
豚こま切れ肉 250g
キャベツ 1/4個
にんじん 1本
もやし 1袋
ピーマン 2個
中濃ソース 大さじ5
醤油 大さじ1
酒 大さじ2
油 大さじ1$ingredients$,
    $steps$肉と野菜を食べやすく切る
フライパンで豚肉と野菜を炒める
麺と酒を加えてほぐしながら炒める
ソースと醤油を加えて全体を混ぜる$steps$
  ),
  (
    'salmon-chan-chan', '鮭のちゃんちゃん焼き', 'じゃがいものすまし汁', 25, 'fish',
    620, 34, 19, 76, 9.0, 2.1, 240,
    $ingredients$生鮭 4切れ
キャベツ 1/4個
玉ねぎ 1個
にんじん 1本
しめじ 1袋
味噌 大さじ3
みりん 大さじ2
酒 大さじ2
砂糖 大さじ1
バター 15g$ingredients$,
    $steps$野菜としめじを食べやすく切る
味噌、みりん、酒、砂糖を混ぜる
フライパンに野菜と鮭を重ね、合わせ調味料をかける
ふたをして蒸し焼きにし、仕上げにバターを加える$steps$
  ),
  (
    'three-color-soboro-bowl', '鶏そぼろ三色丼', '豆腐とねぎの味噌汁', 20, 'meat',
    670, 29, 20, 94, 6.8, 2.2, 150,
    $ingredients$温かいごはん 700g
鶏ひき肉 300g
卵 4個
小松菜 1束
醤油 大さじ3
みりん 大さじ2
砂糖 大さじ2
酒 大さじ2
塩 少々
油 小さじ2$ingredients$,
    $steps$鶏ひき肉を醤油、みりん、砂糖、酒で炒り煮にする
卵に塩を加えて細かいいり卵を作る
小松菜をゆでて食べやすく切る
ごはんに3色の具を盛り付ける$steps$
  ),
  (
    'pork-kimchi', '豚キムチ炒め', 'もやしとわかめのスープ', 15, 'meat',
    650, 30, 22, 78, 7.5, 2.4, 180,
    $ingredients$豚こま切れ肉 350g
白菜キムチ 250g
玉ねぎ 1個
にら 1束
もやし 1袋
醤油 大さじ1
酒 大さじ1
ごま油 大さじ1
白ごま 大さじ1$ingredients$,
    $steps$玉ねぎとにらを食べやすく切る
ごま油で豚肉と玉ねぎを炒める
キムチ、もやし、にらを加えて手早く炒める
醤油と酒で味を整え、白ごまを振る$steps$
  ),
  (
    'mushroom-cream-stew', 'きのこクリームシチュー', 'グリーンサラダ', 30, 'meat',
    680, 29, 25, 82, 9.0, 2.0, 230,
    $ingredients$鶏もも肉 300g
玉ねぎ 1個
じゃがいも 3個
にんじん 1本
しめじ 1袋
まいたけ 1袋
牛乳 500ml
小麦粉 大さじ4
バター 30g
コンソメ 小さじ2
塩 小さじ1/2
こしょう 少々$ingredients$,
    $steps$鶏肉、野菜、きのこを食べやすく切る
鍋にバターを溶かし、鶏肉と野菜を炒める
小麦粉を振り入れて粉気がなくなるまで混ぜる
牛乳を少しずつ加え、コンソメと一緒に煮込む$steps$
  ),
  (
    'atsuage-sweet-savory', '厚揚げとひき肉の甘辛炒め', 'かきたま汁', 20, 'soy',
    610, 27, 19, 80, 9.5, 2.0, 200,
    $ingredients$厚揚げ 2枚
豚ひき肉 250g
小松菜 1束
長ねぎ 1本
にんじん 1/2本
醤油 大さじ2
みりん 大さじ2
砂糖 大さじ1
酒 大さじ1
おろし生姜 小さじ1
ごま油 大さじ1$ingredients$,
    $steps$厚揚げと野菜を食べやすく切る
ごま油でひき肉と生姜を炒める
野菜と厚揚げを加えて炒める
醤油、みりん、砂糖、酒を加えて汁気が少なくなるまで炒める$steps$
  );

insert into public.recipes (
  household_id, name, category, servings_base, cook_minutes,
  image_url, protein_source, tags, meta
)
select
  null,
  seed.recipe_name,
  'main',
  4,
  seed.cook_minutes,
  '/images/family-dinner.png',
  seed.protein_source,
  array['定番'],
  jsonb_build_object(
    'nutrition_catalog_id', seed.catalog_key,
    'side', seed.side_name,
    'ingredients_text', seed.ingredients_text,
    'steps_text', seed.steps_text
  )
from staple_menu_seed seed
where not exists (
  select 1
  from public.recipes r
  where r.household_id is null
    and (r.meta ->> 'nutrition_catalog_id' = seed.catalog_key or r.name = seed.recipe_name)
);

update public.recipes r
set
  cook_minutes = seed.cook_minutes,
  protein_source = seed.protein_source,
  tags = array['定番'],
  meta = r.meta || jsonb_build_object(
    'nutrition_catalog_id', seed.catalog_key,
    'side', seed.side_name,
    'ingredients_text', seed.ingredients_text,
    'steps_text', seed.steps_text
  )
from staple_menu_seed seed
where r.household_id is null
  and (r.meta ->> 'nutrition_catalog_id' = seed.catalog_key or r.name = seed.recipe_name);

insert into public.recipe_nutrition (
  recipe_id, energy_kcal, protein_g, fat_g, carbs_g,
  fiber_g, salt_g, vegetables_g, source
)
select
  r.id,
  seed.energy_kcal,
  seed.protein_g,
  seed.fat_g,
  seed.carbs_g,
  seed.fiber_g,
  seed.salt_g,
  seed.vegetables_g,
  'official'
from staple_menu_seed seed
join public.recipes r
  on r.household_id is null
  and r.meta ->> 'nutrition_catalog_id' = seed.catalog_key
on conflict (recipe_id) do update set
  energy_kcal = excluded.energy_kcal,
  protein_g = excluded.protein_g,
  fat_g = excluded.fat_g,
  carbs_g = excluded.carbs_g,
  fiber_g = excluded.fiber_g,
  salt_g = excluded.salt_g,
  vegetables_g = excluded.vegetables_g,
  source = excluded.source,
  updated_at = now();

insert into public.recipe_steps (recipe_id, phase, position, text)
select
  r.id,
  'seasoning',
  line.position::int - 1,
  trim(line.text)
from staple_menu_seed seed
join public.recipes r
  on r.household_id is null
  and r.meta ->> 'nutrition_catalog_id' = seed.catalog_key
cross join lateral regexp_split_to_table(seed.ingredients_text, E'\\r?\\n')
  with ordinality as line(text, position)
where trim(line.text) <> ''
on conflict (recipe_id, phase, position) do update set text = excluded.text;

insert into public.recipe_steps (recipe_id, phase, position, text)
select
  r.id,
  'evening',
  line.position::int - 1,
  trim(line.text)
from staple_menu_seed seed
join public.recipes r
  on r.household_id is null
  and r.meta ->> 'nutrition_catalog_id' = seed.catalog_key
cross join lateral regexp_split_to_table(seed.steps_text, E'\\r?\\n')
  with ordinality as line(text, position)
where trim(line.text) <> ''
on conflict (recipe_id, phase, position) do update set text = excluded.text;

drop table staple_menu_seed;
