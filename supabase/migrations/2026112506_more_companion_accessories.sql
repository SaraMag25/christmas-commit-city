-- ==============================================================================
-- Add 9 new companion accessories & outfits (3 head, 3 body/face, 3 hand):
--   Commit / Supporter Bundle: candy_cane, reindeer_antlers, pixel_sunglasses,
--     bubble_tea, santa_coat, halo_crown
--   Pix-only exclusives (price_commits = null): astronaut_helmet, angel_wings,
--     pixel_sword
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
  ('candy_cane', 'accessory', 'hand', 85, 150, 100, false, true),
  ('reindeer_antlers', 'accessory', 'head', 115, 150, 100, false, true),
  ('pixel_sunglasses', 'accessory', 'body', 135, 200, 150, false, true),
  ('bubble_tea', 'accessory', 'hand', 145, 200, 150, false, true),
  ('santa_coat', 'accessory', 'body', 170, 200, 150, false, true),
  ('halo_crown', 'accessory', 'head', 190, 300, 200, false, true),
  ('astronaut_helmet', 'accessory', 'head', null, 450, 250, false, true),
  ('angel_wings', 'accessory', 'body', null, 450, 250, false, true),
  ('pixel_sword', 'accessory', 'hand', null, 400, 200, false, true)
on conflict (id) do update set
  item_type = excluded.item_type,
  slot = excluded.slot,
  price_commits = excluded.price_commits,
  price_brl_cents = excluded.price_brl_cents,
  price_usd_cents = excluded.price_usd_cents,
  is_free = excluded.is_free,
  active = excluded.active;

-- Keep legacy `user_companions` check constraints in sync if that table exists
do $$
begin
  if to_regclass('public.user_companions') is not null then
    execute 'alter table public.user_companions drop constraint if exists user_companions_equipped_head_check';
    execute 'alter table public.user_companions add constraint user_companions_equipped_head_check check (equipped_head in (''wizard-hat'', ''strawberry-hat'', ''leaf-umbrella'', ''santa-hat'', ''golden-butterfly'', ''snow_globe'', ''dev_headset'', ''rubber_duck'', ''reindeer_antlers'', ''halo_crown'', ''astronaut_helmet''))';
    execute 'alter table public.user_companions drop constraint if exists user_companions_equipped_body_check';
    execute 'alter table public.user_companions add constraint user_companions_equipped_body_check check (equipped_body in (''wizard-cloak'', ''round-glasses'', ''leaf-scarf'', ''dev_hoodie'', ''code_visor'', ''binary_sweater'', ''programmer_tshirt'', ''santa_coat'', ''pixel_sunglasses'', ''angel_wings''))';
    execute 'alter table public.user_companions drop constraint if exists user_companions_equipped_hand_check';
    execute 'alter table public.user_companions add constraint user_companions_equipped_hand_check check (equipped_hand in (''glow-lantern'', ''coffee-mug'', ''cheese-wedge'', ''white-fish'', ''mini_laptop'', ''mechanical_keyboard'', ''candy_cane'', ''bubble_tea'', ''pixel_sword''))';
  end if;
end
$$;

-- Sync creator full unlocks (`@SaraMag25`) to cover all newly added shop items
do $$
declare
  v_uid uuid;
begin
  for v_uid in
    select distinct uid
      from (
        select t.user_id as uid
          from public.trees t
         where t.user_id is not null
           and t.github_username_lower = 'saramag25'
        union
        select u.id as uid
          from auth.users u
         where public.is_verified_creator_user(u.id)
      ) candidates
     where uid is not null
  loop
    perform public.grant_creator_full_unlocks(v_uid);
  end loop;
end
$$;

notify pgrst, 'reload schema';
