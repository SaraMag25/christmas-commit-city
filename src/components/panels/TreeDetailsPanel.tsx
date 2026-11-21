import { useState } from 'react'
import { Check, ExternalLink, Gift, Heart, Share2, Trees, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CREATOR_CAMPAIGN } from '../../config/pixCampaign'
import { resolveTreeStage } from '../../config/treeLevels'
import { hashUsername } from '../../game/layout/treePlacement'
import { resolveTreeTheme } from '../../game/voxel/voxelTreeBuilder'
import type { CityTree } from '../../types/city'
import { AvatarBadge } from '../common/AvatarBadge'

interface TreeDetailsPanelProps {
  tree: CityTree
  onClose: () => void
  onOpenGiftCatalog: (tree: CityTree) => void
}

function getCalendarSquareColor(count: number): string {
  if (count <= 0) return '#0f172a'
  if (count <= 2) return '#14532d'
  if (count <= 5) return '#16a34a'
  if (count <= 9) return '#22c55e'
  return '#4ade80'
}

export function TreeDetailsPanel({
  tree,
  onClose,
  onOpenGiftCatalog,
}: TreeDetailsPanelProps) {
  const [copied, setCopied] = useState(false)
  const stage = resolveTreeStage(tree.contribution_count)
  const seed = hashUsername(tree.profile.github_username)
  const theme = resolveTreeTheme(
    seed,
    tree.tree_position.gridX,
    tree.tree_position.gridY,
    tree.tree_level,
  )
  const recentWeeks = tree.stats?.calendarWeeks.slice(-24) ?? []
  const levelFormatted = String(stage.level).padStart(2, '0')
  const statusLabel = tree.is_creator_special
    ? 'SPECIAL_UFC'
    : tree.contribution_count > 0
      ? 'ACTIVE'
      : 'SEEDLING'

  const handleCopyShareLink = async () => {
    const shareUrl = `${window.location.origin}/tree/${tree.profile.github_username}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard may be blocked in restricted browsers; fallback silently.
    }
  }

  return (
    <aside
      aria-label={`Detalhes da árvore de ${tree.profile.github_username}`}
      className="fixed inset-x-3 bottom-14 z-30 max-h-[75vh] overflow-y-auto pixel-night-panel rounded-md p-4 sm:inset-x-auto sm:bottom-16 sm:right-4 sm:top-20 sm:w-96 sm:max-h-none"
    >
      {/* Terminal command header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 text-[11px]">
        <span className="truncate text-emerald-400">
          $ tree inspect @{tree.profile.github_username}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel da árvore"
          className="rounded-sm border border-slate-700 p-1 text-slate-400 hover:border-slate-500 hover:text-white cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Developer summary */}
      <div className="mt-3 flex items-center gap-3">
        <AvatarBadge
          key={tree.profile.github_username}
          username={tree.profile.github_username}
          name={tree.profile.github_name}
          avatarUrl={tree.profile.avatar_url}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="truncate text-sm font-bold text-slate-100">{tree.profile.github_name}</h2>
            {tree.is_creator_special && (
              <span className="rounded-sm border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                ★ ufc
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">@{tree.profile.github_username}</p>
        </div>
      </div>

      {/* Structured CLI key-value block */}
      <div className="mt-3 rounded-sm border border-slate-800 bg-[#040811]/90 p-3 text-xs">
        <dl className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-slate-500">USER</dt>
            <dd className="truncate font-medium text-slate-200">
              @{tree.profile.github_username}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-slate-500">COMMITS</dt>
            <dd className="font-semibold text-emerald-400">
              {tree.contribution_count.toLocaleString('pt-BR')}
              <span className="ml-1 text-[10px] font-normal text-slate-500">
                ({tree.stats?.periodYear ?? 2026})
              </span>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-slate-500">TREE_LEVEL</dt>
            <dd className="font-semibold" style={{ color: stage.accentColor }}>
              {levelFormatted} · {stage.name}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-slate-500">TREE_TYPE</dt>
            <dd className="text-slate-200">{theme.label}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-slate-500">REGION</dt>
            <dd className="text-sky-300">{theme.regionName}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-slate-500">STATUS</dt>
            <dd className="font-medium text-emerald-300">{statusLabel}</dd>
          </div>
          {tree.stats && (
            <div className="flex items-baseline justify-between gap-2 border-t border-slate-800/80 pt-1.5 text-[10px]">
              <dt className="text-slate-500">BREAKDOWN</dt>
              <dd className="text-slate-300">
                {tree.stats.commits}c · {tree.stats.pullRequests}pr · {tree.stats.issues}i
              </dd>
            </div>
          )}
        </dl>

        {/* Compact GitHub-style Contribution Calendar */}
        {recentWeeks.length > 0 && (
          <div className="mt-2.5 border-t border-slate-800/80 pt-2">
            <p className="mb-1.5 text-[10px] text-slate-500">
              CONTRIBUTION_GRAPH ({recentWeeks.length}w)
            </p>
            <div className="flex gap-[2px] overflow-x-auto pb-0.5">
              {recentWeeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[2px]">
                  {week.contributionDays.map((day) => (
                    <span
                      key={day.date}
                      title={`${day.date}: ${day.contributionCount} contribuições`}
                      className="h-2 w-2 rounded-[1px]"
                      style={{ backgroundColor: getCalendarSquareColor(day.contributionCount) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-2.5 border-t border-slate-800/80 pt-2">
          <a
            href={`https://github.com/${tree.profile.github_username}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
          >
            <span>[ view github profile ]</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Stage features tags */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {stage.visualFeatures.map((feature) => (
          <span
            key={feature}
            className="rounded-sm border border-slate-800 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-300"
          >
            + {feature}
          </span>
        ))}
      </div>

      {/* Creator UFC Campaign Special Box */}
      {tree.is_creator_special ? (
        <div className="mt-3 rounded-sm border border-amber-400/35 bg-amber-950/20 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-400" />
            <span>{CREATOR_CAMPAIGN.title}</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-200">
            &ldquo;{CREATOR_CAMPAIGN.message}&rdquo;
          </p>
        </div>
      ) : (
        tree.custom_message && (
          <div className="mt-3 rounded-sm border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-[10px] text-slate-400">// mensagem</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-200">
              &ldquo;{tree.custom_message}&rdquo;
            </p>
          </div>
        )
      )}

      {/* Gifts Received */}
      <div className="mt-3.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 font-semibold text-slate-200">
            <Gift className="h-3.5 w-3.5 text-amber-300" />
            gifts ({tree.gifts.length})
          </span>
          <span className="text-[10px] text-slate-500">visual only</span>
        </div>

        {tree.gifts.length === 0 ? (
          <p className="mt-1.5 rounded-sm border border-dashed border-slate-800 p-2.5 text-[11px] text-slate-500">
            Nenhum presente recebido ainda.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {tree.gifts.map((gift) => (
              <li
                key={gift.id}
                className="flex items-center justify-between rounded-sm border border-slate-800 bg-[#040811]/80 px-2.5 py-1.5 text-[11px]"
              >
                <div className="truncate">
                  <span className="font-medium text-amber-200">{gift.gift_name}</span>
                  <span className="ml-1.5 text-slate-500">by {gift.sender_name}</span>
                </div>
                <span className="rounded-sm bg-slate-800/90 px-1.5 py-0.5 text-[10px] text-slate-300">
                  {gift.category === 'special' ? 'special' : 'free'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to={`/tree/${tree.profile.github_username}`}
          className="pixel-btn pixel-btn-pine rounded-sm px-3 py-1.5 text-[11px] font-semibold"
        >
          <Trees className="h-3.5 w-3.5" />
          <span>ver árvore</span>
        </Link>

        <button
          type="button"
          onClick={() => onOpenGiftCatalog(tree)}
          className="pixel-btn pixel-btn-red rounded-sm px-3 py-1.5 text-[11px] font-semibold"
        >
          <Gift className="h-3.5 w-3.5" />
          <span>presentear</span>
        </button>

        <button
          type="button"
          onClick={handleCopyShareLink}
          className="pixel-btn pixel-btn-wood col-span-2 rounded-sm px-3 py-1.5 text-[11px]"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
          <span>{copied ? 'link copiado!' : 'copiar link da árvore'}</span>
        </button>
      </div>
    </aside>
  )
}
