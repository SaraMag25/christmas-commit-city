import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Globe, Loader2, MapPin, Search, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { resolveTreeStage } from '../../config/treeLevels'
import { useCity } from '../../context/cityContextStore'
import { useLocale } from '../../context/localeContextStore'
import { gameEventBus } from '../../game/eventBus'
import { TREE_STAGE_COPY } from '../../i18n/translations'
import { normalizeGitHubUsernameInput } from '../../services/githubSyncService'
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
  const { discoverGitHubTree, isSupabaseReady } = useCity()
  const { language, t } = useLocale()
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<'all' | 'illuminated'>('all')
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
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
  const rawQueryTerm = query.trim().replace(/^@+/, '')
  const normalizedLower = rawQueryTerm.toLowerCase()
  const validGithubUsername = normalizeGitHubUsernameInput(rawQueryTerm)

  const exactLocalMatch = useMemo(() => {
    if (!normalizedLower) return null
    return (
      realTrees.find((tree) => tree.profile.github_username.toLowerCase() === normalizedLower) ??
      null
    )
  }, [realTrees, normalizedLower])

  const filteredTrees = useMemo(() => {
    const matches = realTrees.filter((tree) => {
      if (stageFilter === 'illuminated' && tree.tree_level < 4) return false
      if (!normalizedLower) return true
      return (
        tree.profile.github_username.toLowerCase().includes(normalizedLower) ||
        tree.profile.github_name.toLowerCase().includes(normalizedLower)
      )
    })

    return matches
      .slice()
      .sort((a, b) => {
        if (normalizedLower) {
          const aUser = a.profile.github_username.toLowerCase()
          const bUser = b.profile.github_username.toLowerCase()
          const aExact = aUser === normalizedLower ? 0 : aUser.startsWith(normalizedLower) ? 1 : 2
          const bExact = bUser === normalizedLower ? 0 : bUser.startsWith(normalizedLower) ? 1 : 2
          if (aExact !== bExact) return aExact - bExact
        }
        return b.contribution_count - a.contribution_count
      })
      .slice(0, 40)
  }, [realTrees, normalizedLower, stageFilter])

  const handleUniversalLookup = async (usernameToLookup: string) => {
    if (isDiscovering) return
    setLookupError(null)

    const clean = normalizeGitHubUsernameInput(usernameToLookup)
    if (!clean) {
      setLookupError(t.explorer.invalidUsername)
      return
    }

    setIsDiscovering(true)
    gameEventBus.emit('city:search-flight-start', { username: clean })

    const pickOffCameraSlot = (excludedIds: Set<string>): CityTree | null => {
      let picked: CityTree | null = null
      gameEventBus.emit('city:request-swap-slot', {
        excludedIds,
        onResolve: (slot) => {
          picked = slot
        },
      })
      return picked
    }

    try {
      const res = await discoverGitHubTree(clean, {
        silentSwap: true,
        pickOffCameraSlot,
      })
      if (!res.ok || !res.tree) {
        gameEventBus.emit('city:search-flight-abort')
        const rawErr = res.error ?? ''
        const isNotFound = /não encontrado|not found|404/i.test(rawErr)
        setLookupError(
          isNotFound ? `@${clean} ${t.explorer.notFoundGithub}` : rawErr || t.explorer.empty,
        )
        return
      }
      onSelectTree(res.tree)
      setQuery('')
      setLookupError(null)
      onClose()
    } finally {
      setIsDiscovering(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (exactLocalMatch) {
      onSelectTree(exactLocalMatch)
      setQuery('')
      setLookupError(null)
      onClose()
      return
    }

    if (normalizedLower && validGithubUsername && isSupabaseReady) {
      void handleUniversalLookup(validGithubUsername)
      return
    }

    if (filteredTrees.length === 1 && normalizedLower) {
      onSelectTree(filteredTrees[0])
      setQuery('')
      setLookupError(null)
      onClose()
    }
  }

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
            <span>$ tree find --github</span>
            <span className="rounded-sm border border-emerald-500/30 bg-emerald-950/70 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
              {t.explorer.cityCountLabel} · {realTrees.length.toLocaleString(language)}
            </span>
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

        <form onSubmit={handleSubmit} className="mt-2.5">
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              enterKeyHint="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (lookupError) setLookupError(null)
              }}
              placeholder={t.explorer.placeholder}
              className="min-w-0 flex-1 rounded-sm border border-slate-700 bg-[#040811] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            />
            {rawQueryTerm && !exactLocalMatch && validGithubUsername && isSupabaseReady && (
              <button
                type="submit"
                disabled={isDiscovering}
                className="pixel-btn pixel-btn-pine shrink-0 rounded-sm px-2.5 py-2 text-[11px] font-bold disabled:opacity-60"
              >
                {isDiscovering ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{t.explorer.searchGithubCta}</span>
              </button>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
            {(
              [
                ['all', t.explorer.all],
                ['illuminated', t.explorer.illuminated],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStageFilter(key)}
                className={`rounded-sm border px-2 py-1 cursor-pointer ${
                  stageFilter === key
                    ? 'border-emerald-400/60 bg-emerald-500/15 font-semibold text-emerald-300'
                    : 'border-slate-800 bg-[#040811]/70 text-slate-400 hover:border-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {!rawQueryTerm && (
            <p className="mt-2 text-[10px] leading-snug text-slate-400">
              {t.explorer.searchGithubHint}
            </p>
          )}

          {rawQueryTerm && !exactLocalMatch && validGithubUsername && (
            <div className="mt-2">
              {isSupabaseReady ? (
                <button
                  type="button"
                  disabled={isDiscovering}
                  onClick={() => void handleUniversalLookup(validGithubUsername)}
                  className="flex w-full items-center justify-between gap-2 rounded-sm border border-emerald-400/55 bg-emerald-950/60 px-3 py-2 text-left text-[11px] text-emerald-200 transition hover:bg-emerald-900/60 disabled:opacity-70 cursor-pointer"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {isDiscovering ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-300" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                    )}
                    <span className="truncate font-semibold">
                      {isDiscovering
                        ? `${t.explorer.locatingPrefix} @${validGithubUsername} ${t.explorer.locatingSuffix}`
                        : `${t.explorer.searchGithubCta}: @${validGithubUsername}`}
                    </span>
                  </span>
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                </button>
              ) : (
                <p className="rounded-sm border border-slate-800 bg-[#040811]/80 px-2.5 py-2 text-[10px] text-slate-400">
                  {t.explorer.offlineLookupNote}
                </p>
              )}
            </div>
          )}

          {lookupError && (
            <p
              role="alert"
              className="mt-2 rounded-sm border border-rose-500/50 bg-rose-950/70 px-2.5 py-1.5 text-[11px] text-rose-200"
            >
              {lookupError}
            </p>
          )}

          <ul className="mt-2.5 max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
            {filteredTrees.length === 0 ? (
              <li className="py-4 text-center text-[11px] text-slate-400">{t.explorer.empty}</li>
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
                            @{tree.profile.github_username}
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
        </form>
      </div>
    </div>
  )
}
