-- ==============================================================================
-- Add Pix/Money-Only Exclusive Supporter Items (not unlockable with commits):
--   Companions:  clawd_cafe (Claude), leaf_kitty (Gato Alien)
--   Apparel:     programmer_tshirt (Jaqueta Cyber Dev Neon)
--   Space Props: gift-retro-rocket, gift-lilac-ufo
-- Existing commit-based items & prices remain 100% intact.
-- ==============================================================================

insert into public.shop_catalog (
  id,
  item_type,
  slot,
  price_commits,
  price_brl_cents,
  price_usd_cents,
  is_free,
  active
)
values
  ('clawd_cafe', 'companion', null, null, 800, 350, false, true),
  ('leaf_kitty', 'companion', null, null, 800, 350, false, true),
  ('programmer_tshirt', 'accessory', 'body', null, 500, 250, false, true),
  ('gift-retro-rocket', 'gift', null, null, 600, 300, false, true),
  ('gift-lilac-ufo', 'gift', null, null, 700, 350, false, true)
on conflict (id) do update set
  item_type = excluded.item_type,
  slot = excluded.slot,
  price_commits = null,
  price_brl_cents = excluded.price_brl_cents,
  price_usd_cents = excluded.price_usd_cents,
  is_free = excluded.is_free,
  active = excluded.active;

-- Retire retired items if they were ever seeded locally
update public.shop_catalog
   set active = false
 where id in ('gift-retro-camera', 'brazil_shirt');

-- Keep legacy `user_companions` check constraints in sync if that table still exists
do $$
begin
  if to_regclass('public.user_companions') is not null then
    execute 'alter table public.user_companions drop constraint if exists user_companions_active_species_check';
    execute 'alter table public.user_companions add constraint user_companions_active_species_check check (active_species in (''frog'', ''snake'', ''mouse'', ''otter'', ''capybara'', ''cat'', ''clawd_cafe'', ''leaf_kitty''))';
    execute 'alter table public.user_companions drop constraint if exists user_companions_equipped_body_check';
    execute 'alter table public.user_companions add constraint user_companions_equipped_body_check check (equipped_body in (''wizard-cloak'', ''round-glasses'', ''leaf-scarf'', ''dev_hoodie'', ''code_visor'', ''binary_sweater'', ''programmer_tshirt''))';
  end if;
end
$$;

-- Enforce that pixOnly items (price_commits is null) require explicit per-item unlock even if supporter-bundle exists
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
  v_item public.shop_catalog%rowtype;
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
    select *
      into v_item
      from public.shop_catalog
     where id = p_companion_id and item_type = 'companion' and active = true;
    if not found then
      raise exception 'INVALID_COMPANION';
    end if;

    if not ((v_has_bundle and v_item.price_commits is not null) or exists (
      select 1 from public.user_unlocks
       where user_id = v_user_id and item_id = p_companion_id
    )) then
      raise exception 'COMPANION_NOT_UNLOCKED';
    end if;
  end if;

  if p_head_id is not null then
    select *
      into v_item
      from public.shop_catalog
     where id = p_head_id and item_type = 'accessory' and slot = 'head' and active = true;
    if not found then
      raise exception 'INVALID_HEAD_ACCESSORY';
    end if;

    if not ((v_has_bundle and v_item.price_commits is not null) or exists (
      select 1 from public.user_unlocks
       where user_id = v_user_id and item_id = p_head_id
    )) then
      raise exception 'HEAD_ACCESSORY_NOT_UNLOCKED';
    end if;
  end if;

  if p_body_id is not null then
    select *
      into v_item
      from public.shop_catalog
     where id = p_body_id and item_type = 'accessory' and slot = 'body' and active = true;
    if not found then
      raise exception 'INVALID_BODY_ACCESSORY';
    end if;

    if not ((v_has_bundle and v_item.price_commits is not null) or exists (
      select 1 from public.user_unlocks
       where user_id = v_user_id and item_id = p_body_id
    )) then
      raise exception 'BODY_ACCESSORY_NOT_UNLOCKED';
    end if;
  end if;

  if p_hand_id is not null then
    select *
      into v_item
      from public.shop_catalog
     where id = p_hand_id and item_type = 'accessory' and slot = 'hand' and active = true;
    if not found then
      raise exception 'INVALID_HAND_ACCESSORY';
    end if;

    if not ((v_has_bundle and v_item.price_commits is not null) or exists (
      select 1 from public.user_unlocks
       where user_id = v_user_id and item_id = p_hand_id
    )) then
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

notify pgrst, 'reload schema';
