-- ==============================================================================
-- Christmas Commit City — Per-Session City Sector Rotation & Commit Activity Summary
-- ==============================================================================
-- 1. Precomputes `active_days` and `commit_level_counts` [l1, l2, l3, l4] on
--    `public.trees` via trigger so loading 1,500+ trees for a session is fast
--    without transferring megabytes of raw `contribution_calendar` JSONB upfront.
-- 2. Adds `public.get_city_sector_trees(p_session_seed, p_limit, ...)` so each
--    visitor/computer sees a fresh, deterministic rotation of real GitHub devs
--    alongside guaranteed trees (creator, signed-in viewer, focused user) and
--    claimed accounts.
-- ==============================================================================

alter table public.trees
  add column if not exists active_days integer not null default 0 check (active_days >= 0),
  add column if not exists commit_level_counts integer[] not null default array[0, 0, 0, 0];

create or replace function public.compute_tree_activity_summary(p_calendar jsonb)
returns table (active_days integer, level_counts integer[])
language plpgsql
immutable
set search_path = public
as $$
declare
  v_max_day integer := 0;
  v_active integer := 0;
  v_l1 integer := 0;
  v_l2 integer := 0;
  v_l3 integer := 0;
  v_l4 integer := 0;
  v_count integer;
  v_t4 integer;
  v_t3 integer;
begin
  if p_calendar is null or jsonb_typeof(p_calendar) <> 'array' then
    return query select 0, array[0, 0, 0, 0];
    return;
  end if;

  select coalesce(
    max(greatest(0, coalesce(floor((day_obj ->> 'contributionCount')::numeric)::integer, 0))),
    0
  )
    into v_max_day
    from jsonb_array_elements(p_calendar) as wk(week_obj),
         jsonb_array_elements(
           case
             when jsonb_typeof(wk.week_obj -> 'contributionDays') = 'array'
               then wk.week_obj -> 'contributionDays'
             else '[]'::jsonb
           end
         ) as dy(day_obj);

  v_t4 := greatest(5, ceil(v_max_day * 0.78)::integer);
  v_t3 := greatest(3, ceil(v_max_day * 0.48)::integer);

  for v_count in
    select greatest(0, coalesce(floor((day_obj ->> 'contributionCount')::numeric)::integer, 0))
      from jsonb_array_elements(p_calendar) as wk(week_obj),
           jsonb_array_elements(
             case
               when jsonb_typeof(wk.week_obj -> 'contributionDays') = 'array'
                 then wk.week_obj -> 'contributionDays'
               else '[]'::jsonb
             end
           ) as dy(day_obj)
  loop
    if v_count <= 0 then
      continue;
    end if;
    v_active := v_active + 1;
    if v_count >= 10 or (v_max_day >= 5 and v_count >= v_t4) then
      v_l4 := v_l4 + 1;
    elsif v_count >= 5 or (v_max_day >= 4 and v_count >= v_t3) then
      v_l3 := v_l3 + 1;
    elsif v_count >= 2 then
      v_l2 := v_l2 + 1;
    else
      v_l1 := v_l1 + 1;
    end if;
  end loop;

  return query select v_active, array[v_l1, v_l2, v_l3, v_l4];
end;
$$;

create or replace function public.sync_tree_activity_summary()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_summary record;
begin
  select * into v_summary
    from public.compute_tree_activity_summary(new.contribution_calendar);
  new.active_days := coalesce(v_summary.active_days, 0);
  new.commit_level_counts := coalesce(v_summary.level_counts, array[0, 0, 0, 0]);
  return new;
end;
$$;

drop trigger if exists trg_trees_activity_summary on public.trees;
create trigger trg_trees_activity_summary
  before insert or update of contribution_calendar, total_commits on public.trees
  for each row
  execute function public.sync_tree_activity_summary();

revoke all on function public.compute_tree_activity_summary(jsonb) from public, anon, authenticated;
revoke all on function public.sync_tree_activity_summary() from public, anon, authenticated;

-- Backfill summary metrics for existing trees
update public.trees t
   set active_days = coalesce(s.active_days, 0),
       commit_level_counts = coalesce(s.level_counts, array[0, 0, 0, 0])
  from public.trees t2
  cross join lateral public.compute_tree_activity_summary(t2.contribution_calendar) as s
 where t.id = t2.id;

-- Extend safe public read view (appending summary columns at end to preserve compatibility)
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
  t.github_username_lower,
  t.active_days,
  t.commit_level_counts
from public.trees t;

alter view public.public_trees set (security_invoker = false);
revoke all on public.public_trees from public;
grant select on public.public_trees to anon, authenticated, service_role;

create index if not exists trees_claimed_recent_idx
  on public.trees (claimed, last_synced_at desc nulls last, total_commits desc)
  where claimed = true;

-- Rotated city sector RPC: returns up to `p_limit` safe public trees per visitor session
create or replace function public.get_city_sector_trees(
  p_session_seed text,
  p_limit integer default 1500,
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
      least(greatest(coalesce(p_limit, 1500), 1), 2000) as lim,
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
    limit 350
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
