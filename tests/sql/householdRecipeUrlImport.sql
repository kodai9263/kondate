\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000041',false);
do $$ begin
 begin
 perform public.save_household_recipe_editor('20000000-0000-4000-8000-000000000043','30000000-0000-4000-8000-000000000043',null,
 '{"name":"取り込み検証","side":"","cookMinutes":30,"servings":2,"proteinSource":"egg","ingredients":"卵 2個","steps":"加熱する","sourceUrl":"https://cookpad.com/jp/recipes/123456"}');
 raise exception 'import_accepted';
 exception when others then if sqlerrm <> 'recipe_import_paused' then raise; end if; end;
 if exists(select 1 from public.recipes where id='20000000-0000-4000-8000-000000000043') then raise exception 'partial_save'; end if;
end $$;
select public.save_household_recipe_editor('20000000-0000-4000-8000-000000000043','30000000-0000-4000-8000-000000000043',null,
'{"name":"取り込み検証","side":"","cookMinutes":30,"servings":2,"proteinSource":"egg","ingredients":"大根 1/2本\n卵 2個","steps":"2cm角に切る\n中火で3分加熱し、沸いたら弱火にする","morning":"","sourceUrl":"https://www.kikkoman.co.jp/homecook/search/recipe/00002478/","sourceServingsText":"3〜4人分","importConfirmed":"yes"}');
do $$ begin
 if not exists(select 1 from public.recipes where id='20000000-0000-4000-8000-000000000043' and household_id=public.current_household_id() and servings_base=2 and meta->>'source_url'='https://www.kikkoman.co.jp/homecook/search/recipe/00002478/' and meta->>'source_servings_text'='3〜4人分' and meta->>'import_visibility'='household' and meta->>'ingredients_text'=E'大根 1/2本\n卵 2個') then raise exception 'import_not_saved'; end if;
 if (select count(*) from public.recipe_steps where recipe_id='20000000-0000-4000-8000-000000000043')<>4 then raise exception 'steps_missing'; end if;
 if exists(select 1 from public.recipe_nutrition where recipe_id='20000000-0000-4000-8000-000000000043') then raise exception 'invented_nutrition'; end if;
 begin
 perform public.save_household_recipe_editor('20000000-0000-4000-8000-000000000044','30000000-0000-4000-8000-000000000044',null,'{"sourceUrl":"https://cookpad.com.evil.test/recipe"}');
 raise exception 'bad_url_accepted';
 exception when others then if sqlerrm<>'recipe_import_paused' then raise; end if; end;
end $$;
do $$ declare saved jsonb; begin
 saved:=public.household_recipe_editor('20000000-0000-4000-8000-000000000043');
 if saved->'fields'->>'steps' <> E'2cm角に切る\n中火で3分加熱し、沸いたら弱火にする' then raise exception 'reload_changed_steps'; end if;
 -- 同じ保存IDで再送しても本文の差し替えや重複保存をしない。
 perform public.save_household_recipe_editor('20000000-0000-4000-8000-000000000043','30000000-0000-4000-8000-000000000043',null,'{}');
 if public.household_recipe_editor('20000000-0000-4000-8000-000000000043') is distinct from saved then raise exception 'retry_changed_recipe'; end if;
 -- 新しい保存では版を検証し、出典を指定しない編集でも保持する。
 perform public.save_household_recipe_editor('20000000-0000-4000-8000-000000000043',gen_random_uuid(),saved->>'revision',jsonb_strip_nulls(saved->'fields') || '{"name":"編集後の料理"}'::jsonb);
 if not exists(select 1 from public.recipes where id='20000000-0000-4000-8000-000000000043' and meta->>'source_name'='キッコーマン') then raise exception 'source_lost_on_edit'; end if;
 if not public.reserve_household_recipe_import() then raise exception 'first_request_rejected'; end if;
 if public.reserve_household_recipe_import() then raise exception 'rate_limit_missing'; end if;
 begin perform public.save_household_recipe_editor('20000000-0000-4000-8000-000000000045',gen_random_uuid(),null,'{"sourceUrl":"https://www.kikkoman.co.jp/homecook/search/recipe/00002478/","sourceServingsText":"3〜4人分"}');raise exception 'confirmation_missing';exception when others then if sqlerrm<>'recipe_import_paused' then raise; end if;end;
end $$;
select public.configure_first_week('2026-11-28',2,0,array[]::text[]);
insert into public.plan_entries(household_id,date,meal_type,recipe_id,servings)
values(public.current_household_id(),'2026-11-28','dinner','20000000-0000-4000-8000-000000000043',4);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000042',false);
do $$ begin
 if exists(select 1 from public.recipes where id='20000000-0000-4000-8000-000000000043') then raise exception 'other_family_read'; end if;
 begin
 perform public.save_household_recipe_editor('20000000-0000-4000-8000-000000000043','30000000-0000-4000-8000-000000000044',null,'{"sourceUrl":"https://cookpad.com/jp/recipes/123456"}');
 raise exception 'other_family_write';
 exception when others then if sqlerrm<>'recipe_not_found' then raise; end if; end;
end $$;
reset role;
set role anon;
do $$ begin if exists(select 1 from public.recipes where id='20000000-0000-4000-8000-000000000043') or exists(select 1 from public.recipe_steps where recipe_id='20000000-0000-4000-8000-000000000043') then raise exception 'anonymous_read'; end if; end $$;
reset role;
select '対応URL保存・再読込・編集時の出典保持・再試行・献立保存・連続取得制限・別家族と匿名の拒否: 成功' as result;
