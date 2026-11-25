-- ==============================================================================
-- Christmas Commit City — Massive GitHub City (Unclaimed Public Trees,
-- Automatic OAuth Claiming, Gift Continuity & On-Demand Rate Limiting)
-- ==============================================================================

-- 1. Support unclaimed seeded & on-demand resolved public GitHub trees
alter table public.trees
  add column if not exists claimed boolean not null default true,
  add column if not exists github_username_lower text
    generated always as (lower(github_username)) stored;

update public.trees
   set claimed = (user_id is not null)
 where claimed is distinct from (user_id is not null);

alter table public.trees
  alter column user_id drop not null;

alter table public.trees
  drop constraint if exists trees_claimed_user_id_chk;

alter table public.trees
  add constraint trees_claimed_user_id_chk
  check ((user_id is null) = (not claimed));

drop index if exists public.trees_github_username_lower_idx;
create unique index if not exists trees_github_username_lower_uidx
  on public.trees (github_username_lower);

-- 2. Allow visitors to send gifts to unclaimed seeded/discovered trees too;
--    gifts are bound to recipient_user_id automatically when the owner claims.
alter table public.tree_gifts
  alter column recipient_user_id drop not null;

-- 3. Extend safe public read view without exposing private columns (user_id, spent_commits)
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
  t.last_synced_at,
  t.claimed,
  t.github_username_lower
from public.trees t;

alter view public.public_trees set (security_invoker = false);
revoke all on public.public_trees from public;
grant select on public.public_trees to anon, authenticated, service_role;

-- 4. Server-only negative cache & rate-limit tables for `resolve-github-tree`
create table if not exists public.github_lookup_guard (
  username_lower text primary key,
  status text not null check (status in ('not_found', 'rate_limited', 'error')),
  checked_at timestamptz not null default now()
);

create table if not exists public.resolve_rate_limits (
  bucket_key text primary key,
  request_count integer not null default 0 check (request_count >= 0),
  window_started_at timestamptz not null default now()
);

alter table public.github_lookup_guard enable row level security;
alter table public.resolve_rate_limits enable row level security;

revoke all on table public.github_lookup_guard from public, anon, authenticated;
revoke all on table public.resolve_rate_limits from public, anon, authenticated;

grant all privileges on table public.github_lookup_guard to service_role;
grant all privileges on table public.resolve_rate_limits to service_role;

-- Atomic sliding-window rate limiter restricted exclusively to Edge Function `service_role`
create or replace function public.consume_resolve_rate_limit(
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.resolve_rate_limits%rowtype;
begin
  if p_bucket_key is null or btrim(p_bucket_key) = '' then
    return false;
  end if;

  insert into public.resolve_rate_limits (bucket_key, request_count, window_started_at)
  values (p_bucket_key, 0, v_now)
  on conflict (bucket_key) do nothing;

  select *
    into v_row
    from public.resolve_rate_limits
   where bucket_key = p_bucket_key
   for update;

  if v_row.window_started_at + make_interval(secs => greatest(1, p_window_seconds)) <= v_now then
    update public.resolve_rate_limits
       set request_count = 1,
           window_started_at = v_now
     where bucket_key = p_bucket_key;
    return true;
  end if;

  if v_row.request_count >= greatest(1, p_max_requests) then
    return false;
  end if;

  update public.resolve_rate_limits
     set request_count = v_row.request_count + 1
   where bucket_key = p_bucket_key;

  return true;
end;
$$;

revoke all on function public.consume_resolve_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_resolve_rate_limit(text, integer, integer)
  to service_role;

notify pgrst, 'reload schema';
