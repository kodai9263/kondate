alter table public.household_settings
  add column if not exists shopping_day integer not null default 6;

alter table public.household_settings
  drop constraint if exists household_settings_shopping_day_check;

alter table public.household_settings
  add constraint household_settings_shopping_day_check check (shopping_day between 0 and 6);

comment on column public.household_settings.shopping_day is '0を日曜、6を土曜とするまとめ買いの曜日';
