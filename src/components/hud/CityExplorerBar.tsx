import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, MapPin, Search } from 'lucide-react'
import { resolveTreeStage } from '../../config/treeLevels'
import type { CityTree } from '../../types/city'

interface CityExplorerBarProps {
  trees: readonly CityTree[]
  selectedTreeId: string | null
  onSelectTree: (tree: CityTree) => void
}

export function CityExplorerBar({
  trees,
  selectedTreeId,
  onSelectTree,
}: CityExplorerBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<'all' | 'illuminated' | 'special'>('all')

  const filteredTrees = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return trees.filter((tree) => {
      if (stageFilter === 'illuminated' && tree.tree_level < 4) return false
      if (stageFilter === 'special' && !tree.is_creator_special && tree.tree_level < 6) return false
      if (!normalized) return true
      return (
        tree.profile.github_username.toLowerCase().includes(normalized) ||
        tree.profile.github_name.toLowerCase().includes(normalized)
      )
    })
  }, [trees, query, stageFilter])

  return (
    <div className="pointer-events-none fixed left-3 top-16 z-20 w-[calc(100vw-1.5rem)] max-w-xs sm:left-4 sm:top-20">
      <div className="pointer-events-auto pixel-night-panel rounded-md">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-slate-200 hover:bg-emerald-500/10 cursor-pointer"
        >
          <span className="flex items-center gap-2 font-medium">
            <Search className="h-3.5 w-3.5 text-emerald-400" />
            <span>trees --list ({trees.length})</span>
          </span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
        </button>

        {isOpen && (
          <div className="border-t border-slate-800 p-2.5">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="filter @username..."
              className="w-full rounded-sm border border-slate-700 bg-[#040811] px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            />

            <div className="mt-2 flex gap-1 text-[10px]">
              {(
                [
                  ['all', 'todas'],
                  ['illuminated', 'iluminadas'],
                  ['special', 'especiais'],
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

            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-0.5">
              {filteredTrees.length === 0 ? (
                <li className="py-3 text-center text-[11px] text-slate-500">
                  nenhuma árvore encontrada.
                </li>
              ) : (
                filteredTrees.map((tree) => {
                  const stage = resolveTreeStage(tree.contribution_count)
                  const isActive = tree.id === selectedTreeId
                  return (
                    <li key={tree.id}>
                      <button
                        type="button"
                        onClick={() => onSelectTree(tree)}
                        className={`flex w-full items-center justify-between gap-2 rounded-sm border px-2.5 py-1.5 text-left text-[11px] transition cursor-pointer ${
                          isActive
                            ? 'border-emerald-400/70 bg-emerald-500/15'
                            : 'border-slate-800/90 bg-[#040811]/75 hover:border-emerald-500/40'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-100">
                            {tree.is_creator_special ? '★ ' : ''}@{tree.profile.github_username}
                          </p>
                          <p className="truncate text-[10px] text-slate-400">
                            nv.{stage.level} · {tree.contribution_count} commits
                          </p>
                        </div>
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
