-- ==============================================================================
-- Creator Full Unlock (@SaraMag25)
-- Grants all companions, accessories/apparel, special gifts/scene props, and
-- the supporter bundle exclusively to the verified creator GitHub account
-- (`saramag25`), both retroactively and automatically when claiming/syncing.
-- Regular users keep strict commit/Pix/Stripe unlock enforcement.
-- ==============================================================================

-- 1. Verified creator helper (used internally by SECURITY DEFINER triggers/RPCs)
create or replace function public.is_verified_creator_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select p_user_id is not null and (
    exists (
      select 1
        from public.trees t
       where t.user_id = p_user_id
         and t.claimed = true
         and t.github_username_lower = 'saramag25'
    )
    or exists (
      select 1
        from auth.users u
       where u.id = p_user_id
         and (
           lower(coalesce(u.raw_user_meta_data ->> 'user_name', '')) = 'saramag25'
           or lower(coalesce(u.raw_user_meta_data ->> 'preferred_username', '')) = 'saramag25'
           or exists (
             select 1
               from auth.identities i
              where i.user_id = u.id
                and i.provider = 'github'
                and (
                  lower(coalesce(i.identity_data ->> 'user_name', '')) = 'saramag25'
                  or lower(coalesce(i.identity_data ->> 'preferred_username', '')) = 'saramag25'
                )
           )
         )
    )
  );
$$;

revoke all on function public.is_verified_creator_user(uuid) from public, anon, authenticated;
grant execute on function public.is_verified_creator_user(uuid) to service_role;

-- 2. Backfill & trigger helper inserting every active shop item into `user_unlocks`
create or replace function public.grant_creator_full_unlocks(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or not public.is_verified_creator_user(p_user_id) then
    return;
  end if;

  insert into public.user_unlocks (user_id, item_id, unlock_source)
  select p_user_id, sc.id, 'bundle'
    from public.shop_catalog sc
   where sc.active = true
  on conflict (user_id, item_id) do nothing;
end;
$$;

revoke all on function public.grant_creator_full_unlocks(uuid) from public, anon, authenticated;
grant execute on function public.grant_creator_full_unlocks(uuid) to service_role;

-- Backfill immediately for an already-claimed tree or already-authenticated GitHub user
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

-- Trigger: if `@SaraMag25` tree is claimed later via OAuth sync, unlock everything automatically
create or replace function public.trg_trees_grant_creator_unlocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null and new.github_username_lower = 'saramag25' then
    perform public.grant_creator_full_unlocks(new.user_id);
  end if;
  return new;
end;
$$;

revoke all on function public.trg_trees_grant_creator_unlocks() from public, anon, authenticated;
grant execute on function public.trg_trees_grant_creator_unlocks() to service_role;

drop trigger if exists trg_trees_grant_creator_unlocks on public.trees;
create trigger trg_trees_grant_creator_unlocks
  after insert or update of user_id on public.trees
  for each row
  execute function public.trg_trees_grant_creator_unlocks();

-- 3. Allow verified creator in `equip_companion_loadout` while preserving strict checks for all other users
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
  v_is_creator boolean := false;
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

  v_is_creator := public.is_verified_creator_user(v_user_id);

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

    if not v_is_creator and not ((v_has_bundle and v_item.price_commits is not null) or exists (
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

    if not v_is_creator and not ((v_has_bundle and v_item.price_commits is not null) or exists (
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

    if not v_is_creator and not ((v_has_bundle and v_item.price_commits is not null) or exists (
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

    if not v_is_creator and not ((v_has_bundle and v_item.price_commits is not null) or exists (
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

-- 4. RPC allowing placing already-unlocked gifts/scene props (e.g. for verified creator)
--    without weakening `send_free_gift` (which remains strictly for `is_free = true`).
create or replace function public.send_unlocked_gift(
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
  v_is_creator boolean := false;
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
     and item_type = 'gift';

  if not found then
    raise exception 'GIFT_NOT_UNLOCKED';
  end if;

  v_is_creator := public.is_verified_creator_user(v_sender_id);

  if not v_gift.is_free and not v_is_creator and not exists (
    select 1
      from public.user_unlocks
     where user_id = v_sender_id
       and item_id = v_gift.id
  ) then
    raise exception 'GIFT_NOT_UNLOCKED';
  end if;

  select *
    into v_recipient
    from public.trees
   where id = p_recipient_tree_id;

  if not found then
    raise exception 'RECIPIENT_TREE_NOT_FOUND';
  end if;

  if not v_is_creator then
    select count(*)
      into v_recent_sender_count
      from public.tree_gifts
     where sender_user_id = v_sender_id
       and created_at >= now() - interval '10 minutes';

    if v_recent_sender_count >= 10 then
      raise exception 'RATE_LIMIT_SENDER_WINDOW';
    end if;

    select count(*)
      into v_daily_tree_count
      from public.tree_gifts
     where sender_user_id = v_sender_id
       and recipient_tree_id = p_recipient_tree_id
       and created_at >= now() - interval '24 hours';

    if v_daily_tree_count >= 12 then
      raise exception 'RATE_LIMIT_TREE_DAILY';
    end if;
  end if;

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
    case when v_gift.is_free then 'free' else 'pix' end
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

revoke all on function public.send_unlocked_gift(uuid, text) from public, anon;
grant execute on function public.send_unlocked_gift(uuid, text) to authenticated;

notify pgrst, 'reload schema';
