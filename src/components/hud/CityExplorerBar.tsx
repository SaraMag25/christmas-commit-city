import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, MapPin, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { resolveTreeStage } from '../../config/treeLevels'
import { useLocale } from '../../context/localeContextStore'
import { TREE_STAGE_COPY } from '../../i18n/translations'
import type { CityTree } from '../../types/city'
import { AvatarBadge } from '../common/AvatarBadge'

interface CityExplorerBarProps {
  trees: readonly CityTree[]
  selectedTreeId: string | null
  isOpen: boolean
  onClose: () => void
  onSelectTree: (tree: CityTree) => void
}

export function CityExplorerBar({
  trees,
  selectedTreeId,
  isOpen,
  onClose,
  onSelectTree,
}: CityExplorerBarProps) {
  const { language, t } = useLocale()
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<'all' | 'illuminated' | 'special'>('all')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  const realTrees = useMemo(() => trees.filter((tree) => !tree.isDecorative), [trees])

  const filteredTrees = useMemo(() => {
    const normalized = query.trim().replace(/^@/, '').toLowerCase()
    const matches = realTrees.filter((tree) => {
      if (stageFilter === 'illuminated' && tree.tree_level < 4) return false
      if (stageFilter === 'special' && !tree.is_creator_special && tree.tree_level < 6) return false
      if (!normalized) return true
      return (
        tree.profile.github_username.toLowerCase().includes(normalized) ||
        tree.profile.github_name.toLowerCase().includes(normalized)
      )
    })

    return matches
      .slice()
      .sort((a, b) => {
        if (normalized) {
          const aUser = a.profile.github_username.toLowerCase()
          const bUser = b.profile.github_username.toLowerCase()
          const aExact = aUser === normalized ? 0 : aUser.startsWith(normalized) ? 1 : 2
          const bExact = bUser === normalized ? 0 : bUser.startsWith(normalized) ? 1 : 2
          if (aExact !== bExact) return aExact - bExact
        }
        if (a.is_creator_special && !b.is_creator_special) return -1
        if (!a.is_creator_special && b.is_creator_special) return 1
        return b.contribution_count - a.contribution_count
      })
      .slice(0, 40)
  }, [realTrees, query, stageFilter])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.explorer.buttonLabel}
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/55 px-3 pt-20 backdrop-blur-[2px] sm:pt-24"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md pixel-night-panel rounded-md p-3.5 shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <Search className="h-3.5 w-3.5" />
            <span>$ tree find --devs ({realTrees.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[10px] text-slate-500 sm:inline">
              {t.explorer.closeHint}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.home.close}
              className="rounded-sm border border-slate-700 p-1 text-slate-400 hover:border-slate-500 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-2.5">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.explorer.placeholder}
            className="w-full rounded-sm border border-slate-700 bg-[#040811] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
          />

          <div className="mt-2 flex gap-1.5 text-[10px]">
            {(
              [
                ['all', t.explorer.all],
                ['illuminated', t.explorer.illuminated],
                ['special', t.explorer.special],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStageFilter(key)}
                className={`flex-1 rounded-sm border px-2 py-1 cursor-pointer ${
                  stageFilter === key
                    ? 'border-emerald-400/60 bg-emerald-500/15 font-semibold text-emerald-300'
                    : 'border-slate-800 bg-[#040811]/70 text-slate-400 hover:border-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="mt-2.5 max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
            {filteredTrees.length === 0 ? (
              <li className="py-5 text-center text-[11px] text-slate-400">{t.explorer.empty}</li>
            ) : (
              filteredTrees.map((tree) => {
                const stage = resolveTreeStage(tree.contribution_count)
                const stageCopy = TREE_STAGE_COPY[language][stage.level]
                const isActive = tree.id === selectedTreeId
                return (
                  <li key={tree.id} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTree(tree)
                        onClose()
                      }}
                      className={`flex min-w-0 flex-1 items-center justify-between gap-2.5 rounded-sm border px-2.5 py-2 text-left text-[11px] transition cursor-pointer ${
                        isActive
                          ? 'border-emerald-400/70 bg-emerald-500/15'
                          : 'border-slate-800/90 bg-[#040811]/80 hover:border-emerald-500/50 hover:bg-[#081327]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <AvatarBadge
                          username={tree.profile.github_username}
                          name={tree.profile.github_name}
                          avatarUrl={tree.profile.avatar_url}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-100">
                            {tree.is_creator_special ? '★ ' : ''}@{tree.profile.github_username}
                            {tree.profile.github_name &&
                              tree.profile.github_name !== tree.profile.github_username && (
                                <span className="ml-1.5 font-normal text-slate-400">
                                  · {tree.profile.github_name}
                                </span>
                              )}
                          </p>
                          <p className="truncate text-[10px] text-slate-400">
                            lv.{stage.level} ({stageCopy.name}) ·{' '}
                            <span className="text-emerald-300">
                              {tree.contribution_count.toLocaleString(language)} commits
                            </span>
                          </p>
                        </div>
                      </div>
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    </button>

                    <Link
                      to={`/tree/${encodeURIComponent(tree.profile.github_username)}`}
                      onClick={onClose}
                      title={t.explorer.openProfile}
                      aria-label={`${t.explorer.openProfile}: @${tree.profile.github_username}`}
                      className="pixel-btn pixel-btn-wood shrink-0 rounded-sm p-2.5 text-slate-300 hover:text-amber-300"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
