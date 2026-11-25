-- ==============================================================================
-- Fast single-roundtrip city sector loader returning stripped compact JSONB
-- for up to 3,000 trees (omitting heavy contribution_calendar & null defaults)
-- so initial render completes in 1–2s over Cloudflare Pages & mobile networks.
-- ==============================================================================

create or replace function public.get_city_sector_bundle(
  p_session_seed text,
  p_limit integer default 3000,
  p_focus_username text default null,
  p_viewer_user_id uuid default null
)
returns jsonb
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
  ),
  trees_json as (
    select coalesce(
      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', t.id,
            'u', t.github_username,
            'dn', nullif(t.display_name, t.github_username),
            'av', t.avatar_url,
            'tc', t.total_commits,
            'pi', t.plot_index,
            'cm', t.active_companion_id,
            'cn', t.companion_custom_name,
            'eh', t.equipped_head_id,
            'eb', t.equipped_body_id,
            'ey', t.equipped_hand_id,
            'cl', case when t.claimed then true else null end,
            'ad', t.active_days,
            'lc', t.commit_level_counts
          )
        )
        order by s.tier_rank asc, s.sub_rank asc, s.rot_key asc, t.id asc
      ),
      '[]'::jsonb
    ) as items
    from selected s
    join public.trees t on t.id = s.id
  ),
  gifts_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'r', tg.recipient_tree_id,
          'g', tg.gift_id,
          'n', count(*)::integer
        )
      ),
      '[]'::jsonb
    ) as items
    from public.tree_gifts tg
    where tg.recipient_tree_id in (select id from selected)
    group by tg.recipient_tree_id, tg.gift_id
  )
  select jsonb_build_object(
    'trees', (select items from trees_json),
    'gifts', (select items from gifts_json)
  );
$$;

revoke all on function public.get_city_sector_bundle(text, integer, text, uuid) from public;
grant execute on function public.get_city_sector_bundle(text, integer, text, uuid)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
