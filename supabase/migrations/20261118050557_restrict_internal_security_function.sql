-- RLS自動設定用のイベントトリガーはアプリのRPCとして呼び出す必要がない。
-- Supabase管理環境だけに存在するため、ローカルDBでは存在確認してから制限する。
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
