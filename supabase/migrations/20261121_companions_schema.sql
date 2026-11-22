-- ==============================================================================
-- Christmas Commit City — Companions, Modular Accessories & Dual Payment Schema
-- Keeps `profiles.contribution_count` & GitHub rankings completely untouched.
-- ==============================================================================

create table if not exists public.user_companions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_species text check (active_species in ('frog', 'snake', 'mouse', 'otter', 'capybara', 'cat')),
  custom_name text check (custom_name is null or char_length(custom_name) <= 20),
  equipped_head text check (equipped_head in ('wizard-hat', 'strawberry-hat', 'leaf-umbrella', 'santa-hat', 'golden-butterfly', 'snow_globe', 'dev_headset', 'rubber_duck')),
  equipped_body text check (equipped_body in ('wizard-cloak', 'round-glasses', 'leaf-scarf', 'dev_hoodie', 'code_visor', 'binary_sweater')),
  equipped_hand text check (equipped_hand in ('glow-lantern', 'coffee-mug', 'cheese-wedge', 'white-fish', 'mini_laptop', 'mechanical_keyboard')),
  spent_commits integer not null default 0 check (spent_commits >= 0),
  supporter_bundle_unlocked boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_companion_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_type text not null check (item_type in ('species', 'accessory', 'supporter_bundle')),
  item_id text not null,
  provider text not null check (provider in ('commits', 'pix', 'international')),
  currency text not null check (currency in ('COMMITS', 'BRL', 'USD')),
  amount numeric(10, 2) not null default 0 check (amount >= 0),
  status text not null default 'paid' check (status in ('pending', 'paid')),
  external_reference text,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

alter table public.user_companions enable row level security;
alter table public.user_companion_unlocks enable row level security;

create policy "Anyone can view active tree companions"
  on public.user_companions for select
  using (true);

create policy "Users manage their own companion loadout"
  on public.user_companions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users view their own companion unlocks"
  on public.user_companion_unlocks for select
  using (auth.uid() = user_id);
