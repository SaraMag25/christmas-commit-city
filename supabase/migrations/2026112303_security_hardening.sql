-- ==============================================================================
-- Christmas Commit City — Security Hardening (Least-Privilege & Function ACLs)
-- ==============================================================================

-- 1. Fully lock down unused legacy Phase 4/5 tables if they exist
do $$
begin
  if to_regclass('public.user_companions') is not null then
    execute 'drop policy if exists "Anyone can view active tree companions" on public.user_companions';
    execute 'drop policy if exists "Users manage their own companion loadout" on public.user_companions';
    execute 'revoke all on table public.user_companions from public, anon, authenticated';
    execute 'grant all privileges on table public.user_companions to service_role';
  end if;

  if to_regclass('public.user_companion_unlocks') is not null then
    execute 'drop policy if exists "Users view their own companion unlocks" on public.user_companion_unlocks';
    execute 'revoke all on table public.user_companion_unlocks from public, anon, authenticated';
    execute 'grant all privileges on table public.user_companion_unlocks to service_role';
  end if;
end
$$;

-- 2. Lock down sequence privileges
revoke all on sequence public.trees_plot_index_seq from public, anon, authenticated;
grant usage, select on sequence public.trees_plot_index_seq to service_role;

-- 3. Fix mutable search_path on trigger helper & restrict direct execution
create or replace function public.set_trees_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_trees_updated_at() from public, anon, authenticated;

-- 4. Explicitly revoke default anon EXECUTE grants on authenticated-only & internal RPCs
revoke all on function public.unlock_item_with_commits(text) from public, anon;
grant execute on function public.unlock_item_with_commits(text) to authenticated;

revoke all on function public.equip_companion_loadout(text, text, text, text, text) from public, anon;
grant execute on function public.equip_companion_loadout(text, text, text, text, text) to authenticated;

revoke all on function public.send_free_gift(uuid, text) from public, anon;
grant execute on function public.send_free_gift(uuid, text) to authenticated;

revoke all on function public.grant_paid_unlock_internal(uuid, uuid, text, text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.grant_paid_unlock_internal(uuid, uuid, text, text, text, integer, text, text)
  to service_role;
