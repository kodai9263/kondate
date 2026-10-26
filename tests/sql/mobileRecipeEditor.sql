\set ON_ERROR_STOP on
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000031','menu-one@example.test'),('10000000-0000-4000-8000-000000000032','menu-two@example.test');
grant select,insert,update,delete on all tables in schema public to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000031',false);
do $$
declare f jsonb := '{"name":"動作確認カレー","side":"サラダ","cookMinutes":30,"servings":4,"proteinSource":"meat","ingredients":"玉ねぎ 1個\n肉 300g","morning":"切る","steps":"炒める\n煮る","energyKcal":500,"proteinG":20,"fatG":15,"carbsG":60,"fiberG":4,"saltG":2,"vegetablesG":120}';
 id uuid := '20000000-0000-4000-8000-000000000031'; v jsonb; rev text;
begin
 perform public.save_household_recipe_editor(id,'30000000-0000-4000-8000-000000000031',null,f);
 perform public.save_household_recipe_editor(id,'30000000-0000-4000-8000-000000000031',null,f);
 if (select count(*) from public.recipes where name='動作確認カレー') <> 1 then raise exception 'duplicate'; end if;
 v := public.household_recipe_editor(id); rev:=v->>'revision';
 if v->'fields'->>'ingredients' <> E'玉ねぎ 1個\n肉 300g' then raise exception 'ingredients mismatch'; end if;
 f:=jsonb_set(f,'{name}','"変更後カレー"');
 perform public.save_household_recipe_editor(id,'30000000-0000-4000-8000-000000000032',rev,f);
 if public.household_recipe_editor(id)->'fields'->>'name' <> '変更後カレー' then raise exception 'not saved'; end if;
 begin
  perform public.save_household_recipe_editor(id,'30000000-0000-4000-8000-000000000033',rev,f);
  raise exception 'stale was accepted';
 exception when others then if sqlerrm <> 'recipe_changed' then raise; end if; end;
 begin
  perform public.save_household_recipe_editor(id,'30000000-0000-4000-8000-000000000034',public.household_recipe_editor(id)->>'revision',jsonb_set(f,'{steps}','""'));
  raise exception 'invalid accepted';
 exception when others then if sqlerrm <> 'invalid_recipe' then raise; end if; end;
 if public.household_recipe_editor(id)->'fields'->>'steps' <> E'炒める\n煮る' then raise exception 'rollback failed'; end if;
end $$;
do $$
declare id uuid := '20000000-0000-4000-8000-000000000031'; f jsonb; rev text;
begin
 f := (public.household_recipe_editor(id)->'fields') - array['energyKcal','proteinG','fatG','carbsG','fiberG','saltG','vegetablesG'];
 rev := public.household_recipe_editor(id)->>'revision';
 perform public.save_household_recipe_editor(id,gen_random_uuid(),rev,f);
 if (select energy_kcal from public.recipe_nutrition where recipe_id=id) <> 500 then raise exception 'existing nutrition lost'; end if;
 id := '20000000-0000-4000-8000-000000000035';
 perform public.save_household_recipe_editor(id,gen_random_uuid(),null,f);
 if exists(select 1 from public.recipe_nutrition where recipe_id=id) then raise exception 'unknown nutrition fabricated'; end if;
 rev := public.household_recipe_editor(id)->>'revision';
 perform public.save_household_recipe_editor(id,gen_random_uuid(),rev,jsonb_set(f,'{name}','"栄養なし編集"'));
 if public.household_recipe_editor(id)->'fields'->>'name' <> '栄養なし編集' then raise exception 'unknown edit failed'; end if;
end $$;
reset role;
update public.household_subscriptions set status='active',current_period_end=now()+interval '1 day' where household_id=(select household_id from public.profiles where id='10000000-0000-4000-8000-000000000031');
set role authenticated;
do $$
declare rid uuid := '20000000-0000-4000-8000-000000000035'; h uuid := public.current_household_id();
begin
 insert into public.plan_entries(household_id,date,meal_type,recipe_id,servings) values(h,'2026-10-01','dinner',rid,4);
 update public.recipes set archived_at=now() where id=rid and household_id=h;
 if not exists(select 1 from public.plan_entries where recipe_id=rid) then raise exception 'saved plan lost'; end if;
 if not exists(select 1 from public.recipe_steps where recipe_id=rid) then raise exception 'recipe detail lost'; end if;
 if exists(select 1 from public.recipes where id=rid and archived_at is null) then raise exception 'still active'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000032',false);
do $$ begin
 begin perform public.household_recipe_editor('20000000-0000-4000-8000-000000000031');raise exception 'other household read';exception when others then if sqlerrm <> 'recipe_not_found' then raise;end if;end;
 begin perform public.save_household_recipe_editor('20000000-0000-4000-8000-000000000031','30000000-0000-4000-8000-000000000031',null,'{}');raise exception 'other household write';exception when others then if sqlerrm <> 'recipe_not_found' then raise;end if;end;
end $$;
reset role;
select '登録、再試行、編集、古い画面の拒否、不正入力のロールバック、別家族の拒否: 成功' as result;
update public.household_subscriptions set status='free',current_period_end=null;
-- 同じ家族でも利用権限のない追加メンバーは関数を直接呼べない。
select set_config('app.allow_household_transfer','on',false);
update public.profiles set household_id=(select household_id from public.profiles where id='10000000-0000-4000-8000-000000000031'),created_at=now()+interval '1 minute' where id='10000000-0000-4000-8000-000000000032';
select set_config('app.allow_household_transfer','off',false);
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000032',false);
do $$ begin
 begin perform public.household_recipe_editor('20000000-0000-4000-8000-000000000031');raise exception 'unpaid member accepted';exception when others then if sqlerrm <> 'family_access_required' then raise;end if;end;
end $$;
reset role;
select '利用権限のない家族メンバーの直接呼び出し拒否: 成功' as result;
