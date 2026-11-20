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
    <div className="pointer-events-none fixed left-3 top-20 z-20 w-[calc(100vw-1.5rem)] max-w-xs sm:left-4 sm:top-24">
      <div className="pointer-events-auto pixel-night-panel rounded-sm">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-amber-200 hover:bg-amber-400/10 cursor-pointer"
        >
          <span className="flex items-center gap-2 font-bold">
            <Search className="h-3.5 w-3.5 text-amber-300" />
            Explorar Árvores ({trees.length})
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {isOpen && (
          <div className="border-t border-amber-500/30 p-2.5">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar @username ou nome..."
              className="w-full rounded-sm border border-amber-500/40 bg-[#070d1f] px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-300 focus:outline-none"
            />

            <div className="mt-2 flex gap-1 text-[10px]">
              {(
                [
                  ['all', 'Todas'],
                  ['illuminated', 'Iluminadas'],
                  ['special', 'Especiais'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStageFilter(key)}
                  className={`flex-1 rounded-sm border px-2 py-1 cursor-pointer ${
                    stageFilter === key
                      ? 'border-amber-300 bg-amber-400/20 font-bold text-amber-200'
                      : 'border-slate-700 bg-[#070d1f]/70 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-0.5">
              {filteredTrees.length === 0 ? (
                <li className="py-3 text-center text-[11px] text-slate-400">
                  Nenhuma árvore encontrada.
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
                            ? 'border-amber-400 bg-amber-400/15'
                            : 'border-slate-700/80 bg-[#070d1f]/75 hover:border-amber-500/50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold text-amber-200">
                            {tree.is_creator_special ? '★ ' : ''}@{tree.profile.github_username}
                          </p>
                          <p className="truncate text-[10px] text-slate-400">
                            {stage.name} · {tree.contribution_count} commits
                          </p>
                        </div>
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
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
