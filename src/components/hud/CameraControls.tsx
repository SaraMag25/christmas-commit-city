import { Compass, Minus, Plus, RotateCcw, RotateCw, Shuffle, Trees } from 'lucide-react'
import { resolveTreeStage } from '../../config/treeLevels'
import { useLocale } from '../../context/localeContextStore'
import { TREE_STAGE_COPY } from '../../i18n/translations'
import type { CityTree } from '../../types/city'

interface CameraControlsProps {
  hoveredTree: CityTree | null
  totalTreesCount: number
  hasMyTree: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onOrbitLeft: () => void
  onOrbitRight: () => void
  onResetCamera: () => void
  onExploreRandom: () => void
  onFocusMyTree?: () => void
}

export function CameraControls({
  hoveredTree,
  totalTreesCount,
  hasMyTree,
  onZoomIn,
  onZoomOut,
  onOrbitLeft,
  onOrbitRight,
  onResetCamera,
  onExploreRandom,
  onFocusMyTree,
}: CameraControlsProps) {
  const { language, t } = useLocale()
  const stage = hoveredTree ? resolveTreeStage(hoveredTree.contribution_count) : null
  const stageCopy = stage ? TREE_STAGE_COPY[language][stage.level] : null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-between gap-2 p-3 sm:p-4">
      <div className="pointer-events-auto flex max-w-md flex-col items-start gap-1.5">
        {hoveredTree ? (
          <div className="pixel-night-panel rounded-sm px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-none"
                style={{ backgroundColor: stage?.accentColor }}
              />
              <span className="font-semibold text-emerald-400">
                @{hoveredTree.profile.github_username}
              </span>
              {hoveredTree.is_creator_special && (
                <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                  {t.camera.creatorBadge}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-300">
              lv.{stage?.level} · {stageCopy?.name ?? stage?.name} ·{' '}
              <span className="text-amber-300">
                {hoveredTree.contribution_count.toLocaleString(language)} commits
              </span>
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-500/35 bg-[#060b16]/85 px-2.5 py-1.5 text-[11px] text-slate-200 backdrop-blur-md">
              <Trees className="h-3.5 w-3.5 text-emerald-400" />
              <strong className="text-emerald-300">
                {totalTreesCount.toLocaleString(language)}
              </strong>
              <span className="text-slate-400">{t.camera.treesInCity}</span>
            </div>

            <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 rounded-sm border border-slate-800/90 bg-[#060b16]/80 px-3 py-1.5 text-[11px] text-slate-400 backdrop-blur-md md:flex">
              <span>
                <strong className="text-emerald-400">[WASD]</strong> {t.camera.move}
              </span>
              <span>
                <strong className="text-emerald-400">[SHIFT]</strong> {t.camera.rotate}
              </span>
              <span>
                <strong className="text-emerald-400">[SCROLL]</strong> {t.camera.zoom}
              </span>
              <span>
                <strong className="text-emerald-400">[CLICK]</strong> {t.camera.inspect}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
        {hasMyTree && onFocusMyTree && (
          <button
            type="button"
            onClick={onFocusMyTree}
            title={t.header.myTreeTitle}
            className="pixel-btn pixel-btn-pine h-8 rounded-sm px-2.5 text-[11px] font-semibold"
          >
            <Trees className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.camera.myTreeShort}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onExploreRandom}
          disabled={totalTreesCount === 0}
          title={t.camera.exploreRandomTitle}
          className="pixel-btn pixel-btn-gold h-8 rounded-sm px-2.5 text-[11px] font-semibold disabled:opacity-50"
        >
          <Shuffle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t.camera.exploreRandom}</span>
        </button>

        <button
          type="button"
          onClick={onOrbitLeft}
          aria-label={`${t.camera.rotate} ←`}
          className="pixel-btn pixel-btn-wood h-8 w-8 rounded-sm text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onOrbitRight}
          aria-label={`${t.camera.rotate} →`}
          className="pixel-btn pixel-btn-wood h-8 w-8 rounded-sm text-xs"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom out"
          className="pixel-btn pixel-btn-wood h-8 w-8 rounded-sm text-xs"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          className="pixel-btn pixel-btn-wood h-8 w-8 rounded-sm text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onResetCamera}
          className="pixel-btn pixel-btn-pine h-8 rounded-sm px-2.5 text-[11px] font-semibold"
          title={t.camera.centerTitle}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>{t.camera.center}</span>
        </button>
      </div>
    </div>
  )
}
