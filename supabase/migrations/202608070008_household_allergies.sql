alter table public.household_settings
  add column if not exists allergies text[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'household_settings_allergies_count_check'
      and conrelid = 'public.household_settings'::regclass
  ) then
    alter table public.household_settings
      add constraint household_settings_allergies_count_check
      check (cardinality(allergies) <= 30);
  end if;
end $$;

comment on column public.household_settings.allergies is '献立候補との照合に使う家族共通のアレルギー食材。自動判定は補助用途';
