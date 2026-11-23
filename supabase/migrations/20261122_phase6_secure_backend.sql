-- ==============================================================================
-- Christmas Commit City — Phase 6 Secure Backend Schema, Strict RLS & Atomic RPCs
-- ==============================================================================
-- Security model:
--   1. Row Level Security enabled on ALL tables; zero direct client INSERT/UPDATE/DELETE.
--   2. Public map/profile reads use `public.public_trees` view and `get_public_tree_gift_counts()`
--      so `user_id`, `spent_commits`, `auth.users` data, and gift senders are NEVER exposed.
--   3. All user mutations go through `SECURITY DEFINER` RPCs with `auth.uid()` checks,
--      `FOR UPDATE` row locks (anti double-spend), server-side `shop_catalog` pricing,
--      and database rate limits.
--   4. Paid unlocks are restricted exclusively to `service_role` (Phase 7 webhooks).
-- ==============================================================================

-- 0. Lock down legacy Phase 4/5 draft policy if present
do $$
begin
  if to_regclass('public.user_companions') is not null then
    execute 'drop policy if exists "Users manage their own companion loadout" on public.user_companions';
    execute 'revoke insert, update, delete on public.user_companions from anon, authenticated';
  end if;
  if to_regclass('public.user_companion_unlocks') is not null then
    execute 'revoke insert, update, delete on public.user_companion_unlocks from anon, authenticated';
  end if;
end
$$;

-- 1. Server-truth Shop Catalog (6 species, 20 accessories, 8 gifts, 1 supporter bundle)
create table if not exists public.shop_catalog (
  id text primary key,
  item_type text not null check (item_type in ('companion', 'accessory', 'gift', 'bundle')),
  slot text null check (slot is null or slot in ('head', 'body', 'hand')),
  price_commits integer null check (price_commits is null or price_commits >= 0),
  price_brl_cents integer not null default 0 check (price_brl_cents >= 0),
  price_usd_cents integer not null default 0 check (price_usd_cents >= 0),
  is_free boolean not null default false,
  active boolean not null default true,
  constraint shop_catalog_accessory_slot_chk check (
    (item_type = 'accessory' and slot is not null) or
    (item_type <> 'accessory' and slot is null)
  )
);

insert into public.shop_catalog (id, item_type, slot, price_commits, price_brl_cents, price_usd_cents, is_free, active)
values
  -- 6 Companion Species
  ('frog', 'companion', null, 250, 500, 200, false, true),
  ('snake', 'companion', null, 300, 500, 200, false, true),
  ('mouse', 'companion', null, 350, 600, 250, false, true),
  ('otter', 'companion', null, 400, 600, 250, false, true),
  ('capybara', 'companion', null, 450, 700, 300, false, true),
  ('cat', 'companion', null, 500, 700, 300, false, true),

  -- 20 Companion Accessories (8 head, 6 body, 6 hand)
  ('leaf-scarf', 'accessory', 'body', 80, 200, 100, false, true),
  ('cheese-wedge', 'accessory', 'hand', 90, 200, 100, false, true),
  ('white-fish', 'accessory', 'hand', 95, 200, 100, false, true),
  ('santa-hat', 'accessory', 'head', 100, 200, 100, false, true),
  ('round-glasses', 'accessory', 'body', 120, 300, 150, false, true),
  ('strawberry-hat', 'accessory', 'head', 130, 300, 150, false, true),
  ('leaf-umbrella', 'accessory', 'head', 140, 300, 150, false, true),
  ('binary_sweater', 'accessory', 'body', 140, 300, 150, false, true),
  ('coffee-mug', 'accessory', 'hand', 150, 300, 150, false, true),
  ('rubber_duck', 'accessory', 'head', 150, 300, 150, false, true),
  ('dev_hoodie', 'accessory', 'body', 160, 300, 150, false, true),
  ('mechanical_keyboard', 'accessory', 'hand', 160, 300, 150, false, true),
  ('dev_headset', 'accessory', 'head', 170, 300, 150, false, true),
  ('mini_laptop', 'accessory', 'hand', 180, 400, 200, false, true),
  ('wizard-cloak', 'accessory', 'body', 180, 400, 200, false, true),
  ('wizard-hat', 'accessory', 'head', 200, 400, 200, false, true),
  ('golden-butterfly', 'accessory', 'head', 200, 400, 200, false, true),
  ('code_visor', 'accessory', 'body', 210, 400, 200, false, true),
  ('glow-lantern', 'accessory', 'hand', 220, 400, 200, false, true),
  ('snow_globe', 'accessory', 'head', 220, 400, 200, false, true),

  -- 8 Tree Gifts (5 free + 3 paid)
  ('gift-star', 'gift', null, null, 1000, 200, false, true),
  ('gift-baubles', 'gift', null, null, 0, 0, true, true),
  ('gift-lights', 'gift', null, null, 0, 0, true, true),
  ('gift-bell', 'gift', null, null, 0, 0, true, true),
  ('gift-snowflake', 'gift', null, null, 0, 0, true, true),
  ('gift-box', 'gift', null, null, 0, 0, true, true),
  ('gift-teddy', 'gift', null, null, 1500, 300, false, true),
  ('gift-retro-pc', 'gift', null, null, 1200, 400, false, true),

  -- Full Supporter Bundle
  ('supporter-bundle', 'bundle', null, null, 2000, 700, false, true)
on conflict (id) do update set
  item_type = excluded.item_type,
  slot = excluded.slot,
  price_commits = excluded.price_commits,
  price_brl_cents = excluded.price_brl_cents,
  price_usd_cents = excluded.price_usd_cents,
  is_free = excluded.is_free,
  active = excluded.active;

-- 2. Trees (one per authenticated developer, atomic plot allocation)
create sequence if not exists public.trees_plot_index_seq
  as integer
  start with 0
  increment by 1
  minvalue 0;

create table if not exists public.trees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  github_username text not null unique,
  display_name text not null,
  avatar_url text not null,
  total_commits integer not null default 0 check (total_commits >= 0),
  spent_commits integer not null default 0 check (spent_commits >= 0 and spent_commits <= total_commits),
  contribution_calendar jsonb not null default '[]'::jsonb,
  plot_index integer not null unique default nextval('public.trees_plot_index_seq'),
  active_companion_id text null references public.shop_catalog (id),
  companion_custom_name text null check (
    companion_custom_name is null or char_length(companion_custom_name) <= 20
  ),
  equipped_head_id text null references public.shop_catalog (id),
  equipped_body_id text null references public.shop_catalog (id),
  equipped_hand_id text null references public.shop_catalog (id),
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trees_github_username_lower_idx
  on public.trees (lower(github_username));

create or replace function public.set_trees_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_trees_updated_at on public.trees;
create trigger trg_trees_updated_at
  before update on public.trees
  for each row
  execute function public.set_trees_updated_at();

-- 3. User Unlocks (species, accessories, bundle)
create table if not exists public.user_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null references public.shop_catalog (id),
  unlock_source text not null check (unlock_source in ('commits', 'pix', 'international', 'bundle')),
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists user_unlocks_user_id_idx
  on public.user_unlocks (user_id);

-- 4. Tree Gifts (sender identity visible ONLY to recipient owner)
create table if not exists public.tree_gifts (
  id uuid primary key default gen_random_uuid(),
  recipient_tree_id uuid not null references public.trees (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  sender_user_id uuid null references auth.users (id) on delete set null,
  sender_username text not null,
  gift_id text not null references public.shop_catalog (id),
  source text not null check (source in ('free', 'pix', 'international')),
  created_at timestamptz not null default now()
);

create index if not exists tree_gifts_recipient_idx
  on public.tree_gifts (recipient_tree_id, gift_id);

create index if not exists tree_gifts_sender_rate_idx
  on public.tree_gifts (sender_user_id, created_at desc);

-- 5. Payment Orders (prepared for Phase 7 Pix + International webhooks)
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid null references auth.users (id) on delete set null,
  target_tree_id uuid null references public.trees (id) on delete set null,
  item_id text null references public.shop_catalog (id),
  provider text not null check (provider in ('pix', 'stripe', 'international')),
  currency text not null check (currency in ('BRL', 'USD')),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  external_reference text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz null
);

create index if not exists payment_orders_buyer_idx
  on public.payment_orders (buyer_user_id, created_at desc);

-- ==============================================================================
-- 6. Strict Row Level Security & Least-Privilege Grants
-- ==============================================================================

alter table public.shop_catalog enable row level security;
alter table public.trees enable row level security;
alter table public.user_unlocks enable row level security;
alter table public.tree_gifts enable row level security;
alter table public.payment_orders enable row level security;

revoke all on public.shop_catalog from anon, authenticated;
revoke all on public.trees from anon, authenticated;
revoke all on public.user_unlocks from anon, authenticated;
revoke all on public.tree_gifts from anon, authenticated;
revoke all on public.payment_orders from anon, authenticated;

grant select on public.shop_catalog to anon, authenticated;
grant select on public.trees to authenticated;
grant select on public.user_unlocks to authenticated;
grant select on public.tree_gifts to authenticated;
grant select on public.payment_orders to authenticated;

-- Backend Edge Functions & webhooks authenticate with `service_role`; grant explicitly so
-- restrictive SQL-Editor default table ACLs never block server-side tree sync or webhooks.
grant all privileges on table public.shop_catalog to service_role;
grant all privileges on table public.trees to service_role;
grant all privileges on table public.user_unlocks to service_role;
grant all privileges on table public.tree_gifts to service_role;
grant all privileges on table public.payment_orders to service_role;
grant usage, select on sequence public.trees_plot_index_seq to service_role;

drop policy if exists "Public reads active shop catalog" on public.shop_catalog;
create policy "Public reads active shop catalog"
  on public.shop_catalog for select
  to anon, authenticated
  using (active = true);

drop policy if exists "Owner reads own tree" on public.trees;
create policy "Owner reads own tree"
  on public.trees for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Owner reads own unlocks" on public.user_unlocks;
create policy "Owner reads own unlocks"
  on public.user_unlocks for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Recipient owner reads gift senders" on public.tree_gifts;
create policy "Recipient owner reads gift senders"
  on public.tree_gifts for select
  to authenticated
  using (auth.uid() = recipient_user_id);

drop policy if exists "Buyer reads own payment orders" on public.payment_orders;
create policy "Buyer reads own payment orders"
  on public.payment_orders for select
  to authenticated
  using (auth.uid() = buyer_user_id);

-- ==============================================================================
-- 7. Safe Public Read View & Aggregated Gift Counts RPC
-- ==============================================================================

create or replace view public.public_trees as
select
  t.id,
  t.github_username,
  t.display_name,
  t.avatar_url,
  t.total_commits,
  t.contribution_calendar,
  t.plot_index,
  t.active_companion_id,
  t.companion_custom_name,
  t.equipped_head_id,
  t.equipped_body_id,
  t.equipped_hand_id,
  t.last_synced_at
from public.trees t;

alter view public.public_trees set (security_invoker = false);
revoke all on public.public_trees from public;
grant select on public.public_trees to anon, authenticated, service_role;

create or replace function public.get_public_tree_gift_counts()
returns table (
  recipient_tree_id uuid,
  gift_id text,
  gift_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    tg.recipient_tree_id,
    tg.gift_id,
    count(*)::bigint as gift_count
  from public.tree_gifts tg
  group by tg.recipient_tree_id, tg.gift_id;
$$;

revoke all on function public.get_public_tree_gift_counts() from public;
grant execute on function public.get_public_tree_gift_counts() to anon, authenticated;

-- ==============================================================================
-- 8. Atomic Business Logic RPCs (Anti-Cheat, Anti-Race, Rate-Limited)
-- ==============================================================================

create or replace function public.unlock_item_with_commits(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.shop_catalog%rowtype;
  v_tree public.trees%rowtype;
  v_already_unlocked boolean := false;
  v_has_bundle boolean := false;
  v_new_spent integer;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select *
    into v_item
    from public.shop_catalog
   where id = p_item_id
     and active = true
     and item_type in ('companion', 'accessory')
     and price_commits is not null;

  if not found then
    raise exception 'ITEM_NOT_UNLOCKABLE_WITH_COMMITS';
  end if;

  -- Lock user's tree row to prevent concurrent double-spend race conditions
  select *
    into v_tree
    from public.trees
   where user_id = v_user_id
   for update;

  if not found then
    raise exception 'TREE_NOT_FOUND';
  end if;

  select exists (
    select 1
      from public.user_unlocks
     where user_id = v_user_id
       and item_id = 'supporter-bundle'
  ) into v_has_bundle;

  select exists (
    select 1
      from public.user_unlocks
     where user_id = v_user_id
       and item_id = p_item_id
  ) into v_already_unlocked;

  v_new_spent := v_tree.spent_commits;

  if not v_already_unlocked and not v_has_bundle then
    if (v_tree.total_commits - v_tree.spent_commits) < v_item.price_commits then
      raise exception 'INSUFFICIENT_COMMITS';
    end if;

    insert into public.user_unlocks (user_id, item_id, unlock_source)
    values (v_user_id, p_item_id, 'commits')
    on conflict (user_id, item_id) do nothing;

    v_new_spent := v_tree.spent_commits + v_item.price_commits;
  end if;

  update public.trees
     set spent_commits = v_new_spent,
         active_companion_id = case
           when v_item.item_type = 'companion' then v_item.id
           else active_companion_id
         end,
         equipped_head_id = case
           when v_item.item_type = 'accessory' and v_item.slot = 'head' then v_item.id
           else equipped_head_id
         end,
         equipped_body_id = case
           when v_item.item_type = 'accessory' and v_item.slot = 'body' then v_item.id
           else equipped_body_id
         end,
         equipped_hand_id = case
           when v_item.item_type = 'accessory' and v_item.slot = 'hand' then v_item.id
           else equipped_hand_id
         end
   where id = v_tree.id
   returning * into v_tree;

  return jsonb_build_object(
    'tree_id', v_tree.id,
    'total_commits', v_tree.total_commits,
    'spent_commits', v_tree.spent_commits,
    'unlocked_item_id', v_item.id,
    'active_companion_id', v_tree.active_companion_id,
    'equipped_head_id', v_tree.equipped_head_id,
    'equipped_body_id', v_tree.equipped_body_id,
    'equipped_hand_id', v_tree.equipped_hand_id
  );
end;
$$;

revoke all on function public.unlock_item_with_commits(text) from public;
grant execute on function public.unlock_item_with_commits(text) to authenticated;

create or replace function public.equip_companion_loadout(
  p_companion_id text,
  p_head_id text,
  p_body_id text,
  p_hand_id text,
  p_custom_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_has_bundle boolean := false;
  v_tree public.trees%rowtype;
  v_sanitized_name text;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select *
    into v_tree
    from public.trees
   where user_id = v_user_id
   for update;

  if not found then
    raise exception 'TREE_NOT_FOUND';
  end if;

  select exists (
    select 1
      from public.user_unlocks
     where user_id = v_user_id
       and item_id = 'supporter-bundle'
  ) into v_has_bundle;

  if p_companion_id is not null then
    if not exists (
      select 1 from public.shop_catalog
       where id = p_companion_id and item_type = 'companion' and active = true
    ) then
      raise exception 'INVALID_COMPANION';
    end if;

    if not v_has_bundle and not exists (
      select 1 from public.user_unlocks
       where user_id = v_user_id and item_id = p_companion_id
    ) then
      raise exception 'COMPANION_NOT_UNLOCKED';
    end if;
  end if;

  if p_head_id is not null then
    if not exists (
      select 1 from public.shop_catalog
       where id = p_head_id and item_type = 'accessory' and slot = 'head' and active = true
    ) then
      raise exception 'INVALID_HEAD_ACCESSORY';
    end if;

    if not v_has_bundle and not exists (
      select 1 from public.user_unlocks
       where user_id = v_user_id and item_id = p_head_id
    ) then
      raise exception 'HEAD_ACCESSORY_NOT_UNLOCKED';
    end if;
  end if;

  if p_body_id is not null then
    if not exists (
      select 1 from public.shop_catalog
       where id = p_body_id and item_type = 'accessory' and slot = 'body' and active = true
    ) then
      raise exception 'INVALID_BODY_ACCESSORY';
    end if;

    if not v_has_bundle and not exists (
      select 1 from public.user_unlocks
       where user_id = v_user_id and item_id = p_body_id
    ) then
      raise exception 'BODY_ACCESSORY_NOT_UNLOCKED';
    end if;
  end if;

  if p_hand_id is not null then
    if not exists (
      select 1 from public.shop_catalog
       where id = p_hand_id and item_type = 'accessory' and slot = 'hand' and active = true
    ) then
      raise exception 'INVALID_HAND_ACCESSORY';
    end if;

    if not v_has_bundle and not exists (
      select 1 from public.user_unlocks
       where user_id = v_user_id and item_id = p_hand_id
    ) then
      raise exception 'HAND_ACCESSORY_NOT_UNLOCKED';
    end if;
  end if;

  if p_custom_name is not null then
    v_sanitized_name := regexp_replace(p_custom_name, '<[^>]*>', '', 'g');
    v_sanitized_name := regexp_replace(v_sanitized_name, E'[\\x00-\\x1F\\x7F]', '', 'g');
    v_sanitized_name := left(btrim(regexp_replace(v_sanitized_name, '\s+', ' ', 'g')), 20);
    if v_sanitized_name = '' then
      v_sanitized_name := null;
    end if;
  else
    v_sanitized_name := null;
  end if;

  update public.trees
     set active_companion_id = p_companion_id,
         equipped_head_id = p_head_id,
         equipped_body_id = p_body_id,
         equipped_hand_id = p_hand_id,
         companion_custom_name = v_sanitized_name
   where id = v_tree.id
   returning * into v_tree;

  return jsonb_build_object(
    'tree_id', v_tree.id,
    'active_companion_id', v_tree.active_companion_id,
    'companion_custom_name', v_tree.companion_custom_name,
    'equipped_head_id', v_tree.equipped_head_id,
    'equipped_body_id', v_tree.equipped_body_id,
    'equipped_hand_id', v_tree.equipped_hand_id
  );
end;
$$;

revoke all on function public.equip_companion_loadout(text, text, text, text, text) from public;
grant execute on function public.equip_companion_loadout(text, text, text, text, text) to authenticated;

create or replace function public.send_free_gift(
  p_recipient_tree_id uuid,
  p_gift_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_gift public.shop_catalog%rowtype;
  v_recipient public.trees%rowtype;
  v_sender_username text;
  v_recent_sender_count integer;
  v_daily_tree_count integer;
  v_inserted_id uuid;
  v_created_at timestamptz;
begin
  if v_sender_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select *
    into v_gift
    from public.shop_catalog
   where id = p_gift_id
     and active = true
     and item_type = 'gift'
     and is_free = true;

  if not found then
    raise exception 'GIFT_NOT_FREE_OR_INVALID';
  end if;

  select *
    into v_recipient
    from public.trees
   where id = p_recipient_tree_id;

  if not found then
    raise exception 'RECIPIENT_TREE_NOT_FOUND';
  end if;

  -- Rate limit: max 10 free gifts sent per user in any rolling 10-minute window
  select count(*)
    into v_recent_sender_count
    from public.tree_gifts
   where sender_user_id = v_sender_id
     and source = 'free'
     and created_at >= now() - interval '10 minutes';

  if v_recent_sender_count >= 10 then
    raise exception 'RATE_LIMIT_SENDER_WINDOW';
  end if;

  -- Per-tree daily cap per sender to prevent flooding a single tree
  select count(*)
    into v_daily_tree_count
    from public.tree_gifts
   where sender_user_id = v_sender_id
     and recipient_tree_id = p_recipient_tree_id
     and source = 'free'
     and created_at >= now() - interval '24 hours';

  if v_daily_tree_count >= 12 then
    raise exception 'RATE_LIMIT_TREE_DAILY';
  end if;

  -- Resolve sender username strictly on server from authenticated user's synced tree or auth metadata
  select github_username
    into v_sender_username
    from public.trees
   where user_id = v_sender_id;

  if v_sender_username is null then
    select coalesce(
      nullif(raw_user_meta_data ->> 'user_name', ''),
      nullif(raw_user_meta_data ->> 'preferred_username', ''),
      'github-dev'
    )
      into v_sender_username
      from auth.users
     where id = v_sender_id;
  end if;

  insert into public.tree_gifts (
    recipient_tree_id,
    recipient_user_id,
    sender_user_id,
    sender_username,
    gift_id,
    source
  )
  values (
    v_recipient.id,
    v_recipient.user_id,
    v_sender_id,
    coalesce(v_sender_username, 'github-dev'),
    v_gift.id,
    'free'
  )
  returning id, created_at into v_inserted_id, v_created_at;

  return jsonb_build_object(
    'id', v_inserted_id,
    'recipient_tree_id', v_recipient.id,
    'gift_id', v_gift.id,
    'created_at', v_created_at
  );
end;
$$;

revoke all on function public.send_free_gift(uuid, text) from public;
grant execute on function public.send_free_gift(uuid, text) to authenticated;

-- ==============================================================================
-- 9. Internal Paid Fulfillment Function (Service Role Only — Phase 7 Webhooks)
-- ==============================================================================

create or replace function public.grant_paid_unlock_internal(
  p_buyer_user_id uuid,
  p_target_tree_id uuid,
  p_item_id text,
  p_provider text,
  p_currency text,
  p_amount_cents integer,
  p_external_reference text,
  p_sender_username text default 'Apoiador da Comunidade'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.shop_catalog%rowtype;
  v_recipient public.trees%rowtype;
  v_order_id uuid;
begin
  select *
    into v_item
    from public.shop_catalog
   where id = p_item_id
     and active = true;

  if not found then
    raise exception 'INVALID_CATALOG_ITEM';
  end if;

  if exists (
    select 1
      from public.payment_orders
     where external_reference = p_external_reference
       and status = 'paid'
  ) then
    return jsonb_build_object('already_processed', true, 'external_reference', p_external_reference);
  end if;

  insert into public.payment_orders (
    buyer_user_id,
    target_tree_id,
    item_id,
    provider,
    currency,
    amount_cents,
    status,
    external_reference,
    paid_at
  )
  values (
    p_buyer_user_id,
    p_target_tree_id,
    v_item.id,
    p_provider,
    p_currency,
    p_amount_cents,
    'paid',
    p_external_reference,
    now()
  )
  on conflict (external_reference) do update set
    status = 'paid',
    paid_at = coalesce(public.payment_orders.paid_at, now())
  returning id into v_order_id;

  if v_item.item_type in ('companion', 'accessory', 'bundle') then
    if p_buyer_user_id is null then
      raise exception 'BUYER_REQUIRED_FOR_UNLOCK';
    end if;

    insert into public.user_unlocks (user_id, item_id, unlock_source)
    values (
      p_buyer_user_id,
      v_item.id,
      case
        when v_item.item_type = 'bundle' then 'bundle'
        when p_provider = 'pix' then 'pix'
        else 'international'
      end
    )
    on conflict (user_id, item_id) do nothing;
  elsif v_item.item_type = 'gift' then
    select *
      into v_recipient
      from public.trees
     where id = p_target_tree_id;

    if not found then
      raise exception 'RECIPIENT_TREE_NOT_FOUND';
    end if;

    insert into public.tree_gifts (
      recipient_tree_id,
      recipient_user_id,
      sender_user_id,
      sender_username,
      gift_id,
      source
    )
    values (
      v_recipient.id,
      v_recipient.user_id,
      p_buyer_user_id,
      coalesce(nullif(btrim(p_sender_username), ''), 'Apoiador da Comunidade'),
      v_item.id,
      case when p_provider = 'pix' then 'pix' else 'international' end
    );
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'item_id', v_item.id,
    'status', 'paid'
  );
end;
$$;

revoke all on function public.grant_paid_unlock_internal(uuid, uuid, text, text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.grant_paid_unlock_internal(uuid, uuid, text, text, text, integer, text, text)
  to service_role;
