import { useEffect, useRef, useState } from 'react'
import {
  Camera,
  ChevronDown,
  Download,
  ExternalLink,
  Film,
  Gift,
  Heart,
  PawPrint,
  Trees,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { getSpeciesById, resolveCompanionDisplayName } from '../../config/companions'
import { STANDARD_CONTRIBUTION_YEAR } from '../../config/githubPeriod'
import { resolveTreeStage } from '../../config/treeLevels'
import { useCity } from '../../context/cityContextStore'
import { useLocale } from '../../context/localeContextStore'
import { gameEventBus, type TreeExportFormat } from '../../game/eventBus'
import { hashUsername } from '../../game/layout/treePlacement'
import { resolveTreeTheme } from '../../game/voxel/voxelTreeBuilder'
import {
  ACCESSORY_COPY,
  SLOT_LABELS_BY_LANG,
  SPECIES_COPY,
  TREE_STAGE_COPY,
} from '../../i18n/translations'
import type { CityTree } from '../../types/city'
import {
  computeCalendarMaxDayCount,
  getGitHubCalendarCellColor,
  selectRecentCalendarWeeks,
} from '../../utils/calendarStats'
import { buildTreeSocialShareLinks } from '../../utils/socialShare'
import { isViewerTreeOwner } from '../../utils/treeOwnership'
import { AvatarBadge } from '../common/AvatarBadge'
import { TreeGiftsSection } from '../gifts/TreeGiftsSection'

interface TreeDetailsPanelProps {
  tree: CityTree
  onClose: () => void
  onOpenGiftCatalog: (tree: CityTree) => void
  onOpenCompanionShop: (tree: CityTree) => void
  onOpenSupportModal: (tree: CityTree) => void
}

export function TreeDetailsPanel({
  tree,
  onClose,
  onOpenGiftCatalog,
  onOpenCompanionShop,
  onOpenSupportModal,
}: TreeDetailsPanelProps) {
  const { currentUserTree, isSupabaseReady, ensureTreeCalendarLoaded, equipSpecies } = useCity()
  const { language, t } = useLocale()
  const [instagramCopied, setInstagramCopied] = useState(false)
  const [isRemovingCompanion, setIsRemovingCompanion] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportStatus, setExportStatus] = useState<{
    format: TreeExportFormat
    progress: number
  } | null>(null)
  const [exportError, setExportError] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!exportMenuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [exportMenuOpen])

  const hasCalendarWeeks = (tree.stats?.calendarWeeks?.length ?? 0) > 0
  useEffect(() => {
    if (isSupabaseReady && !tree.isDecorative && tree.contribution_count > 0 && !hasCalendarWeeks) {
      void ensureTreeCalendarLoaded(tree.id)
    }
  }, [isSupabaseReady, tree.id, tree.isDecorative, tree.contribution_count, hasCalendarWeeks, ensureTreeCalendarLoaded])

  const stage = resolveTreeStage(tree.contribution_count)
  const stageCopy = TREE_STAGE_COPY[language][stage.level]

  const companionSpecies = getSpeciesById(tree.companion?.species)
  const companionSpeciesCopy = companionSpecies
    ? SPECIES_COPY[language][companionSpecies.id]
    : null
  const companionName = companionSpecies && companionSpeciesCopy
    ? resolveCompanionDisplayName(
        companionSpecies.id,
        tree.companion?.customName,
        companionSpeciesCopy.defaultName,
      )
    : null

  const isOwnTree = isViewerTreeOwner(tree, currentUserTree, isSupabaseReady)
  const canCustomizeCompanion = !isSupabaseReady || isOwnTree

  const seed = hashUsername(tree.profile.github_username)
  const theme = resolveTreeTheme(
    seed,
    tree.tree_position.gridX,
    tree.tree_position.gridY,
    tree.tree_level,
  )
  const recentWeeks = selectRecentCalendarWeeks(tree.stats?.calendarWeeks, 24)
  const maxDayCount = computeCalendarMaxDayCount(recentWeeks)
  const levelFormatted = String(stage.level).padStart(2, '0')
  const statusLabel = tree.is_creator_special
    ? t.treePanel.creatorStatus
    : tree.claimed === false
      ? t.treePanel.unclaimedStatus
      : tree.contribution_count > 0
        ? 'ACTIVE'
        : 'SEEDLING'

  const accessoryCopy = ACCESSORY_COPY[language]
  const slotLabels = SLOT_LABELS_BY_LANG[language]
  const equippedAccessoryEntries = (
    [
      ['head', tree.companion?.equipped.head],
      ['body', tree.companion?.equipped.body],
      ['hand', tree.companion?.equipped.hand],
    ] as const
  )
    .map(([slot, id]) => (id ? { slot: slotLabels[slot], name: accessoryCopy[id].name } : null))
    .filter((entry): entry is { slot: string; name: string } => entry !== null)

  const socialLinks = buildTreeSocialShareLinks(
    tree.profile.github_username,
    tree.contribution_count,
    language,
  )

  const handleShareInstagram = () => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(socialLinks.instagramCopyText)
        .then(() => {
          if (!mountedRef.current) return
          setInstagramCopied(true)
          window.setTimeout(() => {
            if (mountedRef.current) setInstagramCopied(false)
          }, 2600)
        })
        .catch(() => {
          // Clipboard may be blocked in restricted browsers; still open Instagram cleanly.
        })
    }
    window.open(socialLinks.instagramHref, '_blank', 'noopener,noreferrer')
  }

  const handleExportTree = (format: TreeExportFormat) => {
    if (exportStatus) return
    setExportMenuOpen(false)
    setExportError(false)
    setExportStatus({ format, progress: 5 })

    gameEventBus.emit('city:export-tree', {
      treeId: tree.id,
      username: tree.profile.github_username,
      displayCommits: tree.contribution_count,
      periodYear: tree.stats?.periodYear ?? STANDARD_CONTRIBUTION_YEAR,
      level: stage.level,
      stageName: stageCopy.name,
      language,
      format,
      onProgress: (percent) => {
        if (mountedRef.current) {
          setExportStatus({ format, progress: percent })
        }
      },
      onComplete: (success) => {
        if (!mountedRef.current) return
        setExportStatus(null)
        if (!success) {
          setExportError(true)
          window.setTimeout(() => {
            if (mountedRef.current) setExportError(false)
          }, 2600)
        }
      },
    })
  }

  return (
    <aside
      aria-label={`@${tree.profile.github_username}`}
      className="fixed inset-x-3 bottom-14 z-30 max-h-[75vh] overflow-y-auto pixel-night-panel rounded-md p-4 sm:inset-x-auto sm:bottom-16 sm:right-4 sm:top-20 sm:w-96 sm:max-h-none"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 text-[11px]">
        <span className="truncate text-emerald-400">
          $ tree inspect @{tree.profile.github_username}
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
                {t.treePanel.creatorBadge}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">@{tree.profile.github_username}</p>
        </div>
      </div>

      <div className="mt-3 rounded-sm border border-slate-800 bg-[#040811]/90 p-3 text-xs">
        <dl className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-slate-500">{t.treePanel.user}</dt>
            <dd className="truncate font-medium text-slate-200">
              @{tree.profile.github_username}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-slate-500">{t.treePanel.commits}</dt>
            <dd className="font-semibold text-emerald-400">
              {tree.contribution_count.toLocaleString(language)}
              <span className="ml-1 text-[10px] font-normal text-slate-500">
                ({tree.stats?.periodYear ?? 2026})
              </span>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-slate-500">{t.treePanel.level}</dt>
            <dd className="font-semibold" style={{ color: stage.accentColor }}>
              {levelFormatted} · {stageCopy.name}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-slate-500">{t.treePanel.type}</dt>
            <dd className="text-slate-200">{theme.label}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-slate-500">{t.treePanel.region}</dt>
            <dd className="text-sky-300">
              {language === 'en' ? theme.regionNameEn : theme.regionName}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] text-slate-500">{t.treePanel.status}</dt>
            <dd className="font-medium text-emerald-300">{statusLabel}</dd>
          </div>
        </dl>

        {recentWeeks.length > 0 && (
          <div className="mt-2.5 border-t border-slate-800/80 pt-2">
            <p className="mb-1.5 text-[10px] text-slate-500">
              {t.treePanel.graph} ({recentWeeks.length}w)
            </p>
            <div className="flex gap-[2px] overflow-x-auto pb-0.5">
              {recentWeeks.map((week, wIdx) => (
                <div key={wIdx} className="flex shrink-0 flex-col gap-[2px]">
                  {week.contributionDays.map((day) => (
                    <span
                      key={day.date}
                      title={`${day.date}: ${day.contributionCount} commits`}
                      className="block h-2 w-2 shrink-0 rounded-[1px]"
                      style={{
                        backgroundColor: getGitHubCalendarCellColor(
                          day.contributionCount,
                          maxDayCount,
                        ),
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-2.5 border-t border-slate-800/80 pt-2">
          <a
            href={`https://github.com/${encodeURIComponent(tree.profile.github_username)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
          >
            <span>{t.treePanel.viewGithub}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {stageCopy.visualFeatures.map((feature) => (
          <span
            key={feature}
            className="rounded-sm border border-slate-800 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-300"
          >
            + {feature}
          </span>
        ))}
      </div>

      {tree.is_creator_special && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onOpenSupportModal(tree)}
            className="pixel-btn pixel-btn-gold w-full rounded-sm px-3 py-1.5 text-[11px] font-bold"
          >
            <Heart className="h-3.5 w-3.5" />
            <span>{t.treePanel.supportBtn}</span>
          </button>
        </div>
      )}

      {/* Companion Summary & Equipped Items */}
      <div className="mt-3.5 rounded-sm border border-slate-800 bg-[#040811]/85 p-2.5 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-semibold text-slate-200">
            <PawPrint className="h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span className="truncate">{companionName ?? t.treePanel.companionNone}</span>
          </span>
          {canCustomizeCompanion && companionName && (
            <button
              type="button"
              disabled={isRemovingCompanion}
              onClick={() => {
                if (isRemovingCompanion) return
                setIsRemovingCompanion(true)
                void equipSpecies(tree.profile.github_username, null).finally(() => {
                  if (mountedRef.current) setIsRemovingCompanion(false)
                })
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-rose-500/45 bg-rose-950/45 px-2 py-0.5 text-[10px] font-semibold text-rose-200 hover:border-rose-400 hover:text-white disabled:opacity-60 cursor-pointer"
            >
              <X className="h-3 w-3" />
              <span>{t.treePanel.removeCompanionBtn}</span>
            </button>
          )}
        </div>
        {equippedAccessoryEntries.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-800/80 pt-2">
            {equippedAccessoryEntries.map((item) => (
              <span
                key={`${item.slot}:${item.name}`}
                className="rounded-sm border border-slate-700/80 bg-slate-900/75 px-1.5 py-0.5 text-[10px] text-slate-300"
              >
                <span className="text-slate-500">{item.slot}:</span> {item.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Gifts Received */}
      <div className="mt-3.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 font-semibold text-slate-200">
            <Gift className="h-3.5 w-3.5 text-amber-300" />
            {t.treePanel.gifts} ({tree.gifts.length})
          </span>
          <span className="text-[10px] text-slate-500">{t.treePanel.visualOnly}</span>
        </div>

        <TreeGiftsSection tree={tree} isOwner={isOwnTree} compact />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-3">
        <Link
          to={`/tree/${tree.profile.github_username}`}
          className="pixel-btn pixel-btn-pine rounded-sm px-3 py-1.5 text-[11px] font-semibold"
        >
          <Trees className="h-3.5 w-3.5" />
          <span>{t.treePanel.viewTree}</span>
        </Link>

        <button
          type="button"
          onClick={() => onOpenGiftCatalog(tree)}
          className="pixel-btn pixel-btn-red rounded-sm px-3 py-1.5 text-[11px] font-semibold"
        >
          <Gift className="h-3.5 w-3.5" />
          <span>{isOwnTree ? t.treePanel.giftMyTreeBtn : t.treePanel.giftBtn}</span>
        </button>

        {canCustomizeCompanion && (
          <button
            type="button"
            onClick={() => onOpenCompanionShop(tree)}
            className="pixel-btn pixel-btn-gold col-span-2 rounded-sm px-3 py-1.5 text-[11px] font-semibold"
          >
            <PawPrint className="h-3.5 w-3.5" />
            <span>{t.treePanel.companionShopBtn}</span>
          </button>
        )}

        <div ref={exportMenuRef} className="relative col-span-2">
          <button
            type="button"
            disabled={Boolean(exportStatus)}
            aria-expanded={exportMenuOpen}
            aria-haspopup="menu"
            onClick={() => setExportMenuOpen((prev) => !prev)}
            className={`pixel-btn pixel-btn-pine w-full rounded-sm px-2.5 py-1.5 text-[11px] font-semibold ${
              exportStatus ? 'cursor-wait opacity-90' : ''
            }`}
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {exportStatus
                ? exportStatus.format === 'gif'
                  ? `${t.treePanel.exportGeneratingGif} ${exportStatus.progress}%`
                  : t.treePanel.exportCapturing
                : t.treePanel.exportBtn}
            </span>
            {!exportStatus && <ChevronDown className="h-3 w-3 shrink-0 opacity-80" />}
          </button>

          {exportMenuOpen && !exportStatus && (
            <div
              role="menu"
              className="absolute bottom-full right-0 z-40 mb-1.5 w-48 rounded-sm border border-emerald-500/40 bg-[#060b16]/98 p-1 shadow-xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => handleExportTree('png')}
                className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-100 hover:bg-emerald-500/15 hover:text-emerald-300 cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5 text-emerald-400" />
                <span>{t.treePanel.exportPng}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleExportTree('gif')}
                className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-100 hover:bg-emerald-500/15 hover:text-emerald-300 cursor-pointer"
              >
                <Film className="h-3.5 w-3.5 text-amber-300" />
                <span>{t.treePanel.exportGif}</span>
              </button>
            </div>
          )}
        </div>

        {exportStatus && (
          <div className="col-span-2 mt-0.5 space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-sm bg-slate-900">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-amber-300 transition-[width] duration-150"
                style={{ width: `${Math.max(8, exportStatus.progress)}%` }}
              />
            </div>
          </div>
        )}

        {exportError && (
          <p className="col-span-2 text-center text-[10px] text-rose-300">
            {t.treePanel.exportError}
          </p>
        )}

        <div className="col-span-2 mt-1 border-t border-slate-800/70 pt-2">
          <p className="mb-1.5 text-center text-[10px] uppercase tracking-wide text-slate-500">
            {t.treePanel.shareSocial}
          </p>
          <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
            <a
              href={socialLinks.xHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm border border-slate-700 bg-[#0d1833] py-1 text-sky-300 hover:border-sky-400"
            >
              X / Twitter
            </a>
            <button
              type="button"
              onClick={handleShareInstagram}
              className="rounded-sm border border-slate-700 bg-[#0d1833] py-1 text-pink-300 hover:border-pink-400 cursor-pointer"
            >
              Instagram
            </button>
            <a
              href={socialLinks.linkedinHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm border border-slate-700 bg-[#0d1833] py-1 text-amber-200 hover:border-amber-400"
            >
              LinkedIn
            </a>
          </div>
          {instagramCopied && (
            <p className="mt-1.5 text-center text-[10px] font-medium text-pink-300">
              {t.treePanel.instagramCopied}
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}
