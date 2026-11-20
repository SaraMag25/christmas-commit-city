import { Compass, Minus, Plus } from 'lucide-react'
import { resolveTreeStage } from '../../config/treeLevels'
import type { CityTree } from '../../types/city'

interface CameraControlsProps {
  hoveredTree: CityTree | null
  onZoomIn: () => void
  onZoomOut: () => void
  onResetCamera: () => void
}

export function CameraControls({
  hoveredTree,
  onZoomIn,
  onZoomOut,
  onResetCamera,
}: CameraControlsProps) {
  const stage = hoveredTree ? resolveTreeStage(hoveredTree.contribution_count) : null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between p-3 sm:p-4">
      {/* Hovered tree quick readout */}
      <div className="pointer-events-auto max-w-xs">
        {hoveredTree ? (
          <div className="pixel-night-panel rounded-sm px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-none border border-white/40"
                style={{ backgroundColor: stage?.accentColor }}
              />
              <span className="font-bold text-amber-300">
                @{hoveredTree.profile.github_username}
              </span>
              {hoveredTree.is_creator_special && (
                <span className="rounded-sm bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-200">
                  UFC
                </span>
              )}
            </div>
            <p className="mt-1 font-pixel-body text-base leading-tight text-slate-200">
              {stage?.name} · {hoveredTree.contribution_count} commits
            </p>
          </div>
        ) : (
          <div className="hidden rounded-sm border border-amber-500/30 bg-[#070d1f]/75 px-3 py-1.5 text-[11px] text-slate-300 sm:block">
            Arraste para explorar a vila · Role para zoom · Clique em uma árvore
          </div>
        )}
      </div>

      {/* Tactile zoom & plaza buttons */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Diminuir zoom"
          className="pixel-btn pixel-btn-wood h-9 w-9 rounded-sm text-sm"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Aumentar zoom"
          className="pixel-btn pixel-btn-wood h-9 w-9 rounded-sm text-sm"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onResetCamera}
          className="pixel-btn pixel-btn-pine h-9 rounded-sm px-3 text-[11px] font-bold"
          title="Centralizar na praça"
        >
          <Compass className="h-4 w-4" />
          <span>Praça</span>
        </button>
      </div>
    </div>
  )
}
