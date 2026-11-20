export type TreeLevelId = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface TreeStageConfig {
  level: TreeLevelId
  slug: string
  name: string
  minContributions: number
  maxContributions: number | null
  badgeLabel: string
  description: string
  visualFeatures: string[]
  accentColor: string
  hasLights: boolean
  hasStar: boolean
  hasAura: boolean
}

export interface ProfileSummary {
  id: string
  github_username: string
  github_name: string
  avatar_url: string
  created_at: string
}

export type GiftCategory = 'free' | 'special'
export type GiftRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface GiftItem {
  id: string
  slug: string
  name: string
  category: GiftCategory
  price: number
  rarity: GiftRarity
  description: string
  accentColor: string
}

export interface TreeGiftSummary {
  id: string
  gift_id: string
  gift_slug: string
  gift_name: string
  category: GiftCategory
  rarity: GiftRarity
  sender_name: string
  created_at: string
}

export interface TreePosition {
  /** Grid column in city tile coordinates */
  gridX: number
  /** Grid row in city tile coordinates */
  gridY: number
}

export interface CityTree {
  id: string
  user_id: string
  profile: ProfileSummary
  contribution_count: number
  tree_level: TreeLevelId
  tree_position: TreePosition
  gifts: TreeGiftSummary[]
  custom_message?: string
  is_creator_special?: boolean
  last_synced_at: string
}

export interface CityCommunityStats {
  totalTrees: number
  totalContributions: number
  totalGifts: number
  illuminatedTrees: number
}

export interface PixCampaignConfig {
  title: string
  university: string
  course: string
  message: string
  pixKey: string
  recipientName: string
  recipientCity: string
  goalAmount: number
  raisedAmount: number
}
