export type CompanionSpeciesId =
  | 'frog'
  | 'snake'
  | 'mouse'
  | 'otter'
  | 'capybara'
  | 'cat'
  | 'clawd_cafe'
  | 'leaf_kitty'

export type AccessorySlot = 'head' | 'body' | 'hand'

export type HeadAccessoryId =
  | 'wizard-hat'
  | 'strawberry-hat'
  | 'leaf-umbrella'
  | 'santa-hat'
  | 'golden-butterfly'
  | 'snow_globe'
  | 'dev_headset'
  | 'rubber_duck'

export type BodyAccessoryId =
  | 'wizard-cloak'
  | 'round-glasses'
  | 'leaf-scarf'
  | 'dev_hoodie'
  | 'code_visor'
  | 'binary_sweater'
  | 'programmer_tshirt'

export type HandAccessoryId =
  | 'glow-lantern'
  | 'coffee-mug'
  | 'cheese-wedge'
  | 'white-fish'
  | 'mini_laptop'
  | 'mechanical_keyboard'

export type CompanionAccessoryId = HeadAccessoryId | BodyAccessoryId | HandAccessoryId

export type SupportCurrency = 'BRL' | 'USD'

export type UnlockProvider = 'commits' | 'pix' | 'international'

export type TransactionCurrency = 'COMMITS' | 'BRL' | 'USD'

export type TransactionStatus = 'pending' | 'paid'

export interface CompanionSpeciesItem {
  id: CompanionSpeciesId
  defaultName: string
  name: string
  subtitle: string
  description: string
  story: string
  priceCommits: number | null
  priceBrl: number
  priceUsd: number
  pixOnly?: boolean
  primaryColor: string
  accentColor: string
}

export interface CompanionAccessoryItem {
  id: CompanionAccessoryId
  slot: AccessorySlot
  name: string
  description: string
  priceCommits: number | null
  priceBrl: number
  priceUsd: number
  pixOnly?: boolean
  accentColor: string
}

export interface SupporterBundleConfig {
  id: 'supporter-bundle'
  priceBrl: number
  priceUsd: number
}

export interface EquippedAccessories {
  head: HeadAccessoryId | null
  body: BodyAccessoryId | null
  hand: HandAccessoryId | null
}

export interface TreeCompanionState {
  species: CompanionSpeciesId
  customName?: string
  equipped: EquippedAccessories
}

export interface CompanionTransactionRecord {
  id: string
  itemType: 'species' | 'accessory' | 'supporter_bundle'
  itemId: string
  provider: UnlockProvider
  currency: TransactionCurrency
  amount: number
  status: TransactionStatus
  externalReference: string
  createdAt: string
}

export interface UserCompanionLoadout {
  species: CompanionSpeciesId | null
  customName?: string
  equipped: EquippedAccessories
  unlockedSpecies: CompanionSpeciesId[]
  unlockedAccessories: CompanionAccessoryId[]
  unlockedGifts?: string[]
  /** Commits allocated to companion/accessory unlocks; NEVER alters real GitHub commit stats */
  spentCommits: number
  /** Whether the user unlocked the Supporter Pack (all species & accessories) */
  supporterBundleUnlocked: boolean
  /** Item keys (`species:<id>` | `accessory:<id>` | `bundle:supporter-bundle`) unlocked via payment */
  unlockedViaPixIds: string[]
  /** Structured transaction audit trail aligned with Phases 6–7 webhooks */
  transactions: CompanionTransactionRecord[]
  updatedAt: string
}

export type UnlockPaymentMethod = 'commits' | 'pix' | 'international'

/**
 * Typed PostgreSQL row contracts matching `supabase/migrations/20261121_companions_schema.sql`.
 */
export interface SupabaseUserCompanionRow {
  user_id: string
  active_species: CompanionSpeciesId | null
  custom_name: string | null
  equipped_head: HeadAccessoryId | null
  equipped_body: BodyAccessoryId | null
  equipped_hand: HandAccessoryId | null
  spent_commits: number
  supporter_bundle_unlocked: boolean
  updated_at: string
}

export interface SupabaseUserCompanionUnlockRow {
  id: string
  user_id: string
  item_type: 'species' | 'accessory' | 'supporter_bundle'
  item_id: string
  provider: UnlockProvider
  currency: TransactionCurrency
  amount: number
  status: TransactionStatus
  external_reference: string | null
  created_at: string
}

/**
 * Phase 6 secure PostgreSQL contracts matching `supabase/migrations/20261122_phase6_secure_backend.sql`.
 */
export interface SupabasePublicTreeRow {
  id: string
  github_username: string
  display_name: string
  avatar_url: string
  total_commits: number
  contribution_calendar?: unknown
  plot_index?: number | null
  active_companion_id: string | null
  companion_custom_name: string | null
  equipped_head_id: string | null
  equipped_body_id: string | null
  equipped_hand_id: string | null
  last_synced_at: string | null
  claimed?: boolean
  github_username_lower?: string
  active_days?: number
  commit_level_counts?: number[] | null
}

export interface SupabasePrivateTreeRow {
  id: string
  user_id: string
  github_username?: string
  spent_commits: number
  contribution_calendar?: unknown
  active_companion_id: string | null
  companion_custom_name: string | null
  equipped_head_id: string | null
  equipped_body_id: string | null
  equipped_hand_id: string | null
}

export interface SupabaseUserUnlockRow {
  item_id: string
  unlock_source: 'commits' | 'pix' | 'international' | 'bundle'
  created_at: string
}

export interface SupabasePublicGiftCountRow {
  recipient_tree_id: string
  gift_id: string
  gift_count: number
}

export interface SupabasePrivateTreeGiftRow {
  id: string
  recipient_tree_id: string
  gift_id: string
  sender_username: string
  source: 'free' | 'pix' | 'international'
  created_at: string
}

export interface UnlockItemRpcResult {
  tree_id: string
  total_commits: number
  spent_commits: number
  unlocked_item_id: string
  active_companion_id: string | null
  equipped_head_id: string | null
  equipped_body_id: string | null
  equipped_hand_id: string | null
}

export interface EquipLoadoutRpcResult {
  tree_id: string
  active_companion_id: string | null
  companion_custom_name: string | null
  equipped_head_id: string | null
  equipped_body_id: string | null
  equipped_hand_id: string | null
}

export interface SendFreeGiftRpcResult {
  id: string
  recipient_tree_id: string
  gift_id: string
  created_at: string
}
