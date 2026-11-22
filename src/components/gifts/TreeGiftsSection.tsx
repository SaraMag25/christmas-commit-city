import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Eye, Gift, Sparkles } from 'lucide-react'
import { normalizeGiftSlug } from '../../config/gifts'
import { useLocale } from '../../context/localeContextStore'
import { MOCK_GIFTS_CATALOG } from '../../data/mockCityData'
import { GIFT_CATALOG_COPY } from '../../i18n/translations'
import type { CityTree } from '../../types/city'

interface TreeGiftsSectionProps {
  tree: CityTree
  isOwner: boolean
  compact?: boolean
}

interface GroupedGiftEntry {
  key: string
  slug: string
  displayName: string
  rarity: string
  count: number
  accentColor: string
}

export function TreeGiftsSection({ tree, isOwner, compact = false }: TreeGiftsSectionProps) {
  const { language, t } = useLocale()
  const [expandedForTreeId, setExpandedForTreeId] = useState<string | null>(null)
  const isSendersOpen = isOwner && expandedForTreeId === tree.id

  const groupedGifts = useMemo<GroupedGiftEntry[]>(() => {
    const groups = new Map<string, GroupedGiftEntry>()
    const catalogAccentBySlug = new Map(MOCK_GIFTS_CATALOG.map((g) => [g.slug, g.accentColor]))

    for (const gift of tree.gifts) {
      const normalizedSlug = normalizeGiftSlug(gift.gift_slug)
      const groupKey = normalizedSlug || gift.gift_id
      const existing = groups.get(groupKey)
      if (existing) {
        existing.count += 1
        continue
      }

      const displayName = GIFT_CATALOG_COPY[language][normalizedSlug]?.name ?? gift.gift_name
      groups.set(groupKey, {
        key: groupKey,
        slug: normalizedSlug,
        displayName,
        rarity: gift.rarity,
        count: 1,
        accentColor: catalogAccentBySlug.get(normalizedSlug) ?? '#fbbf24',
      })
    }

    return Array.from(groups.values())
  }, [tree.gifts, language])

  const senderHistory = useMemo(
    () =>
      [...tree.gifts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [tree.gifts],
  )

  const formatSenderLabel = (rawSender: string): string => {
    const normalized = rawSender.trim().replace(/^@/, '').toLowerCase()
    if (
      normalized === tree.profile.github_username.toLowerCase() ||
      normalized === 'você' ||
      normalized === 'voce' ||
      normalized === 'you'
    ) {
      return t.giftsSection.youLabel
    }
    return rawSender
  }

  const formatGiftDate = (isoDate: string): string => {
    const parsed = new Date(isoDate)
    if (Number.isNaN(parsed.getTime())) return '—'
    return parsed.toLocaleDateString(language, { day: '2-digit', month: '2-digit' })
  }

  const toggleSenders = () => {
    setExpandedForTreeId((prev) => (prev === tree.id ? null : tree.id))
  }

  return (
    <div>
      {tree.gifts.length === 0 ? (
        <p
          className={
            compact
              ? 'mt-1.5 rounded-sm border border-dashed border-slate-800 p-2.5 text-[11px] text-slate-500'
              : 'mt-3 text-xs text-slate-400'
          }
        >
          {compact ? t.treePanel.noGifts : t.profile.noGifts}
        </p>
      ) : (
        <>
          <div className={compact ? 'mt-2 flex flex-wrap gap-1.5' : 'mt-3 flex flex-wrap gap-2'}>
            {groupedGifts.map((entry) => (
              <div
                key={entry.key}
                className={`inline-flex items-center gap-1.5 rounded-sm border border-slate-700/80 bg-[#070d1f]/90 ${
                  compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
                }`}
              >
                <Sparkles
                  className={compact ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0'}
                  style={{ color: entry.accentColor }}
                />
                <span className="font-semibold text-amber-200">{entry.displayName}</span>
                <span className="rounded-sm bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                  ×{entry.count}
                </span>
              </div>
            ))}
          </div>

          {isOwner && (
            <div className={compact ? 'mt-2.5' : 'mt-3.5'}>
              <button
                type="button"
                onClick={toggleSenders}
                aria-expanded={isSendersOpen}
                className="inline-flex items-center gap-1.5 rounded-sm border border-slate-700 bg-[#040811]/90 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-amber-400/50 hover:text-amber-200 cursor-pointer"
              >
                <Eye className="h-3 w-3 text-amber-300" />
                <span>
                  {isSendersOpen
                    ? t.giftsSection.hideSenders
                    : `${t.giftsSection.seeSenders} (${tree.gifts.length})`}
                </span>
                {isSendersOpen ? (
                  <ChevronUp className="h-3 w-3 text-slate-400" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                )}
              </button>

              {isSendersOpen && (
                <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-sm border border-slate-800 bg-[#040811]/90 p-2 pr-1.5">
                  {senderHistory.map((gift) => {
                    const normalizedSlug = normalizeGiftSlug(gift.gift_slug)
                    const giftLabel =
                      GIFT_CATALOG_COPY[language][normalizedSlug]?.name ?? gift.gift_name
                    return (
                      <li
                        key={gift.id}
                        className="flex items-center justify-between gap-2 rounded-sm border border-slate-800/80 bg-[#070d1f]/80 px-2.5 py-1.5 text-[11px]"
                      >
                        <div className="flex min-w-0 items-center gap-1.5 truncate">
                          <Gift className="h-3 w-3 shrink-0 text-rose-400" />
                          <span className="truncate font-semibold text-emerald-300">
                            {formatSenderLabel(gift.sender_name)}
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="truncate text-amber-200">{giftLabel}</span>
                        </div>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {formatGiftDate(gift.created_at)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
