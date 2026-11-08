\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000041',false);
select public.save_household_recipe_editor('20000000-0000-4000-8000-000000000043','30000000-0000-4000-8000-000000000043',null,
'{"name":"取り込み検証","side":"","cookMinutes":30,"servings":2,"proteinSource":"egg","ingredients":"大根 1/2本\n卵 2個","steps":"切る\n加熱する","morning":"","sourceUrl":"https://cookpad.com/jp/recipes/123456"}');
do $$ begin
 if not exists(select 1 from public.recipes where id='20000000-0000-4000-8000-000000000043' and household_id=public.current_household_id() and servings_base=2 and meta->>'source_url'='https://cookpad.com/jp/recipes/123456' and meta->>'ingredients_text'=E'大根 1/2本\n卵 2個') then raise exception 'import_not_saved'; end if;
 if (select count(*) from public.recipe_steps where recipe_id='20000000-0000-4000-8000-000000000043')<>4 then raise exception 'steps_missing'; end if;
 if exists(select 1 from public.recipe_nutrition where recipe_id='20000000-0000-4000-8000-000000000043') then raise exception 'invented_nutrition'; end if;
 begin
 perform public.save_household_recipe_editor('20000000-0000-4000-8000-000000000044','30000000-0000-4000-8000-000000000044',null,'{"sourceUrl":"https://cookpad.com.evil.test/recipe"}');
 raise exception 'bad_url_accepted';
 exception when others then if sqlerrm<>'invalid_source_url' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000042',false);
do $$ begin
 if exists(select 1 from public.recipes where id='20000000-0000-4000-8000-000000000043') then raise exception 'other_family_read'; end if;
 begin
 perform public.save_household_recipe_editor('20000000-0000-4000-8000-000000000043','30000000-0000-4000-8000-000000000044',null,'{"sourceUrl":"https://cookpad.com/jp/recipes/123456"}');
 raise exception 'other_family_write';
 exception when others then if sqlerrm<>'recipe_not_found' then raise; end if; end;
end $$;
reset role;
select '家族内保存・出典・材料工程・栄養未登録・別家族拒否: 成功' as result;
