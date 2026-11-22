import type { CityTree } from '../types/city'

/**
 * Determines consistently across views whether the current viewer owns `tree`:
 * - Authenticated via GitHub: exact username match against `currentUserTree`.
 * - Offline local preview (no Supabase config / session): creator profile acts as active demo owner,
 *   while other users' trees remain strictly public visitor views.
 */
export function isViewerTreeOwner(
  tree: CityTree,
  currentUserTree: CityTree | null,
  isSupabaseReady: boolean,
): boolean {
  if (currentUserTree) {
    return (
      currentUserTree.profile.github_username.toLowerCase() ===
      tree.profile.github_username.toLowerCase()
    )
  }
  return !isSupabaseReady && Boolean(tree.is_creator_special)
}
