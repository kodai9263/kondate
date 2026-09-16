-- 本番と同じRPC・RLS・献立ビューで保存後の読み込みを検証する。
create function pg_temp.check_true(value boolean, label text) returns void language plpgsql as $$ begin if value is not true then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %',label; end; $$;
insert into auth.users(id,email) values ('44444444-4444-4444-8444-444444444444','other-recipe-audit@example.test');
select id as source_id, meta->>'ingredients_text' as source_ingredients from recipes where household_id is null and meta->>'nutrition_catalog_id'='salmon' \gset
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select save_recipe_step_customization(:'source_id', E'材料を量る\r\n野菜を洗う', E'魚を焼く\n中心を確認する\n皿に盛る') as custom_id \gset
select pg_temp.check_true(:'custom_id' <> :'source_id', '保存で家庭用の別レシピを作成');
select pg_temp.check_true((select array_agg(text order by position)=array['材料を量る','野菜を洗う'] from recipe_steps where recipe_id=:'custom_id' and phase='morning'), '改行した朝工程を別々に保存');
select pg_temp.check_true((select array_agg(text order by position)=array['魚を焼く','中心を確認する','皿に盛る'] from recipe_steps where recipe_id=:'custom_id' and phase='evening'), '改行した夜工程を別々に保存');
select pg_temp.check_true((select meta->>'ingredients_text'=:'source_ingredients' and servings_base=4 from recipes where id=:'custom_id'), '工程を編集しても材料と基準人数を維持');
select pg_temp.check_true((select bool_and(recipe_id=:'custom_id') from v_daily_plan where date>=(timezone('Asia/Tokyo',now()))::date), '保存後に献立ビューを再取得して今日以降のアレンジを確認');
select pg_temp.check_true((select bool_and(recipe_id=:'source_id') from v_daily_plan where date<(timezone('Asia/Tokyo',now()))::date), 'アレンジ保存で過去の献立の参照先を変えない');
select pg_temp.check_true((select bool_and((select count(*)=3 from jsonb_array_elements(v.steps) step where step->>'phase'='evening')) from v_daily_plan v where date>=(timezone('Asia/Tokyo',now()))::date), '再取得した献立に夜工程3件を表示');
select pg_temp.check_true(save_recipe_step_customization(:'source_id', '', E'再編集した工程1\n再編集した工程2')=:'custom_id', '再保存でアレンジが重複しない');
select pg_temp.check_true((select count(*)=0 from recipe_steps where recipe_id=:'custom_id' and phase='morning') and (select count(*)=2 from recipe_steps where recipe_id=:'custom_id' and phase='evening'), '再編集で不要な工程を残さない');
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
select pg_temp.check_true((select count(*)=0 from recipes where id=:'custom_id'), '別の家庭からアレンジを読めない');
select set_config('test.custom_recipe_id',:'custom_id',false);
do $$
begin
  begin
    perform save_recipe_step_customization(current_setting('test.custom_recipe_id')::uuid, '', '他の家庭からの変更');
    raise exception 'FAIL: 別の家庭から保存できてしまった';
  exception when raise_exception then
    if sqlerrm <> 'recipe not found' then raise; end if;
    raise notice 'PASS: 別の家庭からアレンジを変更できない';
  end;
end;
$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.check_true(reset_recipe_step_customization(:'source_id'), '元のレシピへ戻せる');
select pg_temp.check_true((select bool_and(recipe_id=:'source_id') from v_daily_plan), '戻した後の献立ビューが公式レシピを参照');
select pg_temp.check_true((select archived_at is not null from recipes where id=:'custom_id'), '解除したアレンジを非表示にする');
select pg_temp.check_true(not reset_recipe_step_customization(:'source_id'), '二重解除でも正常に終了');
reset role;
