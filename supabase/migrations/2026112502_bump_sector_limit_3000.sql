-- ==============================================================================
-- Bump default city sector RPC limit from 1,500 to 3,000 real GitHub trees
-- (with a safe ceiling of 3,500), preserving guaranteed, claimed & seed order.
-- ==============================================================================

create or replace function public.get_city_sector_trees(
  p_session_seed text,
  p_limit integer default 3000,
  p_focus_username text default null,
  p_viewer_user_id uuid default null
)
returns table (
  id uuid,
  github_username text,
  display_name text,
  avatar_url text,
  total_commits integer,
  plot_index integer,
  active_companion_id text,
  companion_custom_name text,
  equipped_head_id text,
  equipped_body_id text,
  equipped_hand_id text,
  last_synced_at timestamptz,
  claimed boolean,
  active_days integer,
  commit_level_counts integer[]
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      coalesce(nullif(btrim(p_session_seed), ''), 'default-sector-seed') as seed,
      least(greatest(coalesce(p_limit, 3000), 1), 3500) as lim,
      nullif(lower(regexp_replace(btrim(coalesce(p_focus_username, '')), '^@+', '')), '') as focus_lower,
      case
        when auth.uid() is not null and (p_viewer_user_id is null or p_viewer_user_id = auth.uid())
          then auth.uid()
        else null::uuid
      end as viewer_id
  ),
  guaranteed as (
    select t.id, 1 as tier_rank, 0 as sub_rank, ''::text as rot_key
    from public.trees t, params p
    where t.github_username_lower = 'saramag25'
       or (p.viewer_id is not null and t.user_id = p.viewer_id)
       or (p.focus_lower is not null and t.github_username_lower = p.focus_lower)
  ),
  claimed_pool as (
    select
      t.id,
      2 as tier_rank,
      row_number() over (
        order by t.last_synced_at desc nulls last, t.total_commits desc, t.id
      ) as sub_rank,
      ''::text as rot_key
    from public.trees t
    where t.claimed = true
      and not exists (select 1 from guaranteed g where g.id = t.id)
    order by t.last_synced_at desc nulls last, t.total_commits desc, t.id
    limit 600
  ),
  rotated_pool as (
    select
      t.id,
      3 as tier_rank,
      0 as sub_rank,
      md5(t.github_username_lower || ':' || p.seed) as rot_key
    from public.trees t, params p
    where not exists (select 1 from guaranteed g where g.id = t.id)
      and not exists (select 1 from claimed_pool c where c.id = t.id)
    order by md5(t.github_username_lower || ':' || p.seed)
    limit (select lim from params)
  ),
  combined as (
    select id, tier_rank, sub_rank, rot_key from guaranteed
    union all
    select id, tier_rank, sub_rank, rot_key from claimed_pool
    union all
    select id, tier_rank, sub_rank, rot_key from rotated_pool
  ),
  selected as (
    select c.id, c.tier_rank, c.sub_rank, c.rot_key
    from combined c, params p
    order by c.tier_rank asc, c.sub_rank asc, c.rot_key asc
    limit (select lim from params)
  )
  select
    t.id,
    t.github_username,
    t.display_name,
    t.avatar_url,
    t.total_commits,
    t.plot_index,
    t.active_companion_id,
    t.companion_custom_name,
    t.equipped_head_id,
    t.equipped_body_id,
    t.equipped_hand_id,
    t.last_synced_at,
    t.claimed,
    t.active_days,
    t.commit_level_counts
  from selected s
  join public.trees t on t.id = s.id
  order by s.tier_rank asc, s.sub_rank asc, s.rot_key asc, t.id asc;
$$;

revoke all on function public.get_city_sector_trees(text, integer, text, uuid) from public;
grant execute on function public.get_city_sector_trees(text, integer, text, uuid)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
