create temporary table easy_staple_menu_seed (
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
) on commit drop;

insert into easy_staple_menu_seed values
  (
    'basic-curry', 'カレーライス', 'グリーンサラダ', 30, 'meat',
    702, 24, 22, 101, 8.2, 2.3, 190,
    $ingredients$【カレー】温かいごはん 800g・豚こま肉 350g・じゃがいも 3個
【カレー】玉ねぎ 2個・にんじん 1本・カレールウ 4皿分
【カレー】水 700ml・油 大さじ1
【サラダ】レタス 1/2玉・きゅうり 1本・ミニトマト 12個・ドレッシング 大さじ4$ingredients$,
    $steps$豚肉とじゃがいもを一口大、玉ねぎをくし切り、にんじんを乱切りにする
鍋に油を中火で熱し、豚肉を3分、玉ねぎとにんじんを4分炒める
じゃがいもと水を加え、沸騰したらあくを取り、弱めの中火で15分煮る
火を止めてカレールウを溶かし、弱火で5分混ぜながら煮る
野菜を切ってサラダにし、ごはんにカレーをかけて一緒に盛る$steps$
  ),
  (
    'hamburg', 'ハンバーグ', 'ブロッコリーとコーンのサラダ', 30, 'meat',
    688, 31, 25, 83, 7.6, 2.2, 180,
    $ingredients$【主菜】合いびき肉 500g・玉ねぎ 1個・卵 1個・パン粉 1/2カップ・牛乳 大さじ3
【主菜】塩 小さじ1/2・こしょう 少々・油 大さじ1
【ソース】ケチャップ 大さじ4・中濃ソース 大さじ3・水 大さじ2
【サラダ】ブロッコリー 1株・コーン 100g・マヨネーズ 大さじ2$ingredients$,
    $steps$玉ねぎをみじん切りにして600Wで3分加熱し、冷ます。ブロッコリーは小房にする
ひき肉・玉ねぎ・卵・パン粉・牛乳・塩こしょうをこね、4個の小判形にする
ブロッコリーを600Wで4分加熱し、コーンとマヨネーズで和える
フライパンに油を中火で熱し、ハンバーグを3分焼き、返してふたをし弱火で8分焼く
中央まで火が通ったらソース材料を加えて1分煮絡め、サラダと盛る$steps$
  ),
  (
    'gyudon', '牛丼', '豆腐とわかめの味噌汁', 15, 'meat',
    716, 28, 23, 98, 6.1, 2.5, 120,
    $ingredients$【牛丼】温かいごはん 800g・牛こま肉 400g・玉ねぎ 2個・紅生姜 適量
【煮汁】水 300ml・醤油 大さじ4・みりん 大さじ3・酒 大さじ2・砂糖 大さじ2・顆粒だし 小さじ1
【味噌汁】豆腐 1丁・乾燥わかめ 4g・水 800ml・だし 小さじ1・味噌 大さじ3$ingredients$,
    $steps$玉ねぎを薄切りにし、豆腐を角切りにする
フライパンに煮汁と玉ねぎを入れ、中火で5分煮る
牛肉をほぐして加え、あくを取りながら中火で4分煮る
別鍋で水・だし・豆腐を中火で2分温め、わかめを加えて火を止め、味噌を溶く
ごはんに牛肉と玉ねぎをのせ、紅生姜と味噌汁を添える$steps$
  ),
  (
    'fried-chicken', '鶏のから揚げ', '千切りキャベツ', 25, 'meat',
    695, 33, 27, 78, 5.8, 2.1, 140,
    $ingredients$【主菜】鶏もも肉 600g・片栗粉 大さじ6・油 大さじ5
【下味】醤油 大さじ3・酒 大さじ2・おろし生姜 小さじ2・おろしにんにく 小さじ1
【付け合わせ】キャベツ 1/4個・レモン 1個$ingredients$,
    $steps$鶏肉を一口大に切り、下味をもみ込んで10分置く。キャベツは千切りにする
鶏肉の汁気を軽く切り、片栗粉を全体にまぶす
フライパンに油を入れて中火で熱し、鶏肉を皮目から4分揚げ焼きにする
返して弱めの中火で4分、最後に強めの中火で1分焼いて表面をカリッとさせる
鶏肉の中心まで火が通ったら油を切り、キャベツとレモンを添える$steps$
  ),
  (
    'hoikoro', '豚肉とキャベツの回鍋肉', 'わかめと卵のスープ', 20, 'meat',
    662, 28, 23, 82, 8.4, 2.4, 240,
    $ingredients$【主菜】豚こま肉 400g・キャベツ 1/3個・ピーマン 3個・長ねぎ 1本・油 大さじ1
【合わせ調味料】味噌 大さじ2・醤油 大さじ1・砂糖 大さじ1・酒 大さじ1・おろしにんにく 小さじ1
【スープ】卵 2個・乾燥わかめ 4g・水 800ml・鶏がら 小さじ2・醤油 小さじ1$ingredients$,
    $steps$キャベツをざく切り、ピーマンを一口大、ねぎを斜め切りにし、合わせ調味料を混ぜる
鍋に水・鶏がらを中火で沸かし、わかめと醤油を加え、溶き卵を流して1分煮る
フライパンに油を中火で熱し、豚肉を4分炒める
キャベツ・ピーマン・ねぎを加えて強めの中火で3分炒め、合わせ調味料を加えて1分絡める
豚肉の火通りを確認し、回鍋肉をスープと盛る$steps$
  ),
  (
    'vegetable-stir-fry', '野菜炒め', '豆腐の味噌汁', 15, 'meat',
    618, 27, 19, 81, 9.1, 2.2, 250,
    $ingredients$【主菜】豚こま肉 350g・キャベツ 1/4個・もやし 1袋・にんじん 1/2本・ピーマン 2個
【味付け】鶏がら 小さじ2・醤油 大さじ1・酒 大さじ1・塩/こしょう 少々・油 大さじ1
【味噌汁】豆腐 1丁・長ねぎ 1/2本・水 800ml・だし 小さじ1・味噌 大さじ3$ingredients$,
    $steps$キャベツとピーマンを一口大、にんじんを短冊切り、ねぎを小口切りにする
鍋に水・だし・豆腐を入れて中火で3分温め、火を止めて味噌を溶き、ねぎを加える
フライパンに油を強めの中火で熱し、豚肉を3分炒める
にんじん・キャベツ・ピーマンを3分、もやしを加えて1分炒め、調味料を絡める
野菜の食感が残るうちに火を止め、味噌汁と盛る$steps$
  ),
  (
    'fried-rice', 'チャーハン', 'わかめスープ', 15, 'egg',
    671, 24, 22, 91, 5.7, 2.4, 110,
    $ingredients$【主菜】温かいごはん 800g・卵 4個・焼き豚 200g・長ねぎ 1本
【主菜】鶏がら 小さじ2・醤油 大さじ1・塩/こしょう 少々・油 大さじ2
【スープ】乾燥わかめ 4g・長ねぎ 1/2本・水 800ml・鶏がら 小さじ2・ごま油 小さじ1$ingredients$,
    $steps$焼き豚を1cm角、ねぎをみじん切りにし、卵を溶く
鍋に水・鶏がらを中火で沸かし、わかめとスープ用ねぎを2分煮て、ごま油を加える
フライパンに油を強めの中火で熱し、卵を入れて大きく混ぜ、半熟でごはんを加える
焼き豚とねぎを加えて3分炒め、鶏がら・塩こしょう・醤油を加えて1分炒める
ごはんがほぐれたら火を止め、わかめスープと盛る$steps$
  ),
  (
    'napolitan', 'ナポリタン', 'コーンスープ', 20, 'noodle',
    654, 22, 18, 100, 7.3, 2.3, 170,
    $ingredients$【主菜】スパゲティ 400g・ウインナー 8本・玉ねぎ 1個・ピーマン 3個・しめじ 1袋
【主菜】ケチャップ 大さじ8・中濃ソース 大さじ1・バター 20g・塩/こしょう 少々
【スープ】クリームコーン缶 1缶・牛乳 500ml・水 200ml・コンソメ 小さじ2$ingredients$,
    $steps$玉ねぎとピーマンを薄切り、ウインナーを斜め切りにし、しめじをほぐす
鍋にコーン缶・牛乳・水・コンソメを入れ、弱火で5分温める
スパゲティを表示時間どおりゆでる。フライパンでバターを中火で溶かし、具を5分炒める
ケチャップと中濃ソースを加えて中火で1分炒め、湯切りした麺を加えて2分絡める
塩こしょうで味を整え、コーンスープと盛る$steps$
  ),
  (
    'yaki-udon', '焼きうどん', '冷ややっこ', 20, 'noodle',
    625, 26, 17, 91, 7.8, 2.4, 190,
    $ingredients$【主菜】ゆでうどん 4玉・豚こま肉 300g・キャベツ 1/4個・玉ねぎ 1個・にんじん 1/2本
【味付け】醤油 大さじ2・みりん 大さじ2・顆粒だし 小さじ2・油 大さじ1・かつお節 2袋
【冷ややっこ】絹ごし豆腐 1丁・小ねぎ 適量・おろし生姜 小さじ1・醤油 適量$ingredients$,
    $steps$豚肉と野菜を食べやすく切り、うどんは袋に切れ目を入れて600Wで2分温める
豆腐を4等分して器に盛り、小ねぎ・生姜・醤油をかける
フライパンに油を中火で熱し、豚肉を3分、野菜を4分炒める
うどんと水大さじ2を加えて2分ほぐし、醤油・みりん・だしを加えて強めの中火で2分炒める
汁気がなくなったらかつお節を混ぜ、冷ややっこと盛る$steps$
  ),
  (
    'salt-grilled-mackerel', 'さばの塩焼き', '大根おろしと豆腐の味噌汁', 15, 'fish',
    638, 32, 22, 76, 6.7, 2.2, 145,
    $ingredients$【主菜】さば切り身 4切れ・塩 小さじ1・大根 10cm
【味噌汁】豆腐 1丁・乾燥わかめ 4g・長ねぎ 1/2本
【味噌汁】水 800ml・顆粒だし 小さじ1・味噌 大さじ3$ingredients$,
    $steps$さばの水気を拭き、両面に塩を振って10分置く。大根をおろし、ねぎを小口切りにする
鍋に水・だしを中火で沸かし、豆腐を加えて2分温める
さばの表面に出た水気を拭き、グリル中火で皮目を上にして5分焼く
返して4〜5分焼き、中心まで火が通ったことを確認する
味噌汁の火を止めて味噌・わかめ・ねぎを加え、さばに大根おろしを添えて一緒に盛る$steps$
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
  case seed.protein_source
    when 'meat' then '/images/chicken-teriyaki.png'
    when 'egg' then '/images/tofu-hamburg.png'
    when 'noodle' then '/images/udon.png'
    else '/images/family-dinner.png'
  end,
  seed.protein_source,
  array['定番'],
  jsonb_build_object(
    'nutrition_catalog_id', seed.catalog_key,
    'side', seed.side_name,
    'ingredients_text', seed.ingredients_text,
    'steps_text', seed.steps_text
  )
from easy_staple_menu_seed seed
where not exists (
  select 1
  from public.recipes recipe
  where recipe.household_id is null
    and (
      recipe.meta ->> 'nutrition_catalog_id' = seed.catalog_key
      or recipe.name = seed.recipe_name
    )
);

update public.recipes recipe
set
  cook_minutes = seed.cook_minutes,
  protein_source = seed.protein_source,
  tags = array['定番'],
  meta = recipe.meta || jsonb_build_object(
    'nutrition_catalog_id', seed.catalog_key,
    'side', seed.side_name,
    'ingredients_text', seed.ingredients_text,
    'steps_text', seed.steps_text
  )
from easy_staple_menu_seed seed
where recipe.household_id is null
  and (
    recipe.meta ->> 'nutrition_catalog_id' = seed.catalog_key
    or recipe.name = seed.recipe_name
  );

insert into public.recipe_nutrition (
  recipe_id, energy_kcal, protein_g, fat_g, carbs_g,
  fiber_g, salt_g, vegetables_g, source
)
select
  recipe.id,
  seed.energy_kcal,
  seed.protein_g,
  seed.fat_g,
  seed.carbs_g,
  seed.fiber_g,
  seed.salt_g,
  seed.vegetables_g,
  'official'
from easy_staple_menu_seed seed
join public.recipes recipe
  on recipe.household_id is null
  and recipe.meta ->> 'nutrition_catalog_id' = seed.catalog_key
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
select recipe.id, 'seasoning', line.position::int - 1, trim(line.text)
from easy_staple_menu_seed seed
join public.recipes recipe
  on recipe.household_id is null
  and recipe.meta ->> 'nutrition_catalog_id' = seed.catalog_key
cross join lateral regexp_split_to_table(seed.ingredients_text, E'\r?\n')
  with ordinality as line(text, position)
where trim(line.text) <> ''
on conflict (recipe_id, phase, position) do update set text = excluded.text;

insert into public.recipe_steps (recipe_id, phase, position, text)
select recipe.id, 'evening', line.position::int - 1, trim(line.text)
from easy_staple_menu_seed seed
join public.recipes recipe
  on recipe.household_id is null
  and recipe.meta ->> 'nutrition_catalog_id' = seed.catalog_key
cross join lateral regexp_split_to_table(seed.steps_text, E'\r?\n')
  with ordinality as line(text, position)
where trim(line.text) <> ''
on conflict (recipe_id, phase, position) do update set text = excluded.text;
