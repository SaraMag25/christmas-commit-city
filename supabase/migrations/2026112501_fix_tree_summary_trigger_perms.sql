-- ==============================================================================
-- Fix permission denied for function compute_tree_activity_summary on inserts/updates
-- ==============================================================================
-- In PostgreSQL, `revoke all ... from public` removes execute privilege from
-- `service_role` too. Making the trigger function `security definer` and granting
-- execute to `service_role` unblocks `seed-city.ts`, `resolve-github-tree`, and
-- `sync-github-contributions` when inserting/updating `public.trees`.
-- ==============================================================================

create or replace function public.sync_tree_activity_summary()
returns trigger
language plpgsql
security definer
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

revoke all on function public.compute_tree_activity_summary(jsonb) from public, anon, authenticated;
revoke all on function public.sync_tree_activity_summary() from public, anon, authenticated;

grant execute on function public.compute_tree_activity_summary(jsonb) to service_role;
grant execute on function public.sync_tree_activity_summary() to service_role;

notify pgrst, 'reload schema';
