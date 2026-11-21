import { GitCommit, Gift, Heart, Trees, X } from 'lucide-react'
import { TREE_STAGES } from '../../config/treeLevels'

interface HowItWorksModalProps {
  onClose: () => void
}

export function HowItWorksModal({ onClose }: HowItWorksModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Como funciona a Christmas Commit City"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs sm:p-6"
    >
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto pixel-night-panel rounded-md p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <p className="text-[11px] text-emerald-400">$ man christmas-commit-city</p>
            <h2 className="mt-1 text-base font-bold text-slate-100">Como funciona o sistema</h2>
            <p className="mt-1 text-xs text-slate-400">
              Cada commit no ano corrente faz sua árvore crescer e acender novas luzes verdes na copa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="rounded-sm border border-slate-700 bg-slate-900 p-1 text-slate-400 hover:border-slate-500 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <div className="rounded-sm border border-slate-800 bg-[#040811]/90 p-3">
            <GitCommit className="h-4 w-4 text-emerald-400" />
            <h3 className="mt-2 text-xs font-semibold text-slate-100">1. connect --github</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              OAuth somente leitura (<code className="text-emerald-300">read:user</code>) via GitHub GraphQL API.
            </p>
          </div>
          <div className="rounded-sm border border-slate-800 bg-[#040811]/90 p-3">
            <Trees className="h-4 w-4 text-amber-300" />
            <h3 className="mt-2 text-xs font-semibold text-slate-100">2. grow --tree</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Evolução em 7 estágios 3D com galhos, luzes de commits, enfeites, estrela e aura.
            </p>
          </div>
          <div className="rounded-sm border border-slate-800 bg-[#040811]/90 p-3">
            <Gift className="h-4 w-4 text-rose-400" />
            <h3 className="mt-2 text-xs font-semibold text-slate-100">3. send --gift</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Presentes decoram árvores e apoiam a campanha UFC — sem alterar métricas de commits.
            </p>
          </div>
        </div>

        <h3 className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Heart className="h-3.5 w-3.5 text-rose-400" />
          <span>[ tree_levels ]</span>
        </h3>

        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {TREE_STAGES.map((stage) => (
            <div
              key={stage.level}
              className="flex items-start justify-between gap-2 rounded-sm border border-slate-800 bg-[#040811]/85 p-2.5 text-[11px]"
            >
              <div>
                <p className="font-semibold" style={{ color: stage.accentColor }}>
                  nv.{String(stage.level).padStart(2, '0')} · {stage.name}
                </p>
                <p className="mt-0.5 text-slate-400">{stage.description}</p>
              </div>
              <span className="shrink-0 rounded-sm border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-amber-300">
                {stage.badgeLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
