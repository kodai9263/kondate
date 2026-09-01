alter table public.household_settings
  add column if not exists adult_count integer not null default 2,
  add column if not exists child_count integer not null default 3,
  add column if not exists shopping_day integer not null default 6;

alter table public.household_settings
  drop constraint if exists household_settings_adult_count_check,
  drop constraint if exists household_settings_child_count_check,
  drop constraint if exists household_settings_shopping_day_check;

alter table public.household_settings
  add constraint household_settings_adult_count_check
    check (adult_count between 1 and 10),
  add constraint household_settings_child_count_check
    check (child_count between 0 and 10),
  add constraint household_settings_shopping_day_check
    check (shopping_day between 0 and 6);

comment on column public.household_settings.adult_count
  is '献立と買い物の分量計算に使う大人の人数';
comment on column public.household_settings.child_count
  is '献立と買い物の分量計算に使う子どもの人数';
comment on column public.household_settings.shopping_day
  is '0を日曜、6を土曜とするまとめ買いの曜日';
