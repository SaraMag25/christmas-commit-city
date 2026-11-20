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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs sm:p-6"
    >
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto pixel-wood-panel rounded-sm p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#8c5835] pb-3">
          <div>
            <h2 className="font-pixel-title text-sm text-amber-300 sm:text-base">
              Como funciona a cidade
            </h2>
            <p className="mt-1 font-pixel-body text-xl text-amber-100">
              Cada commit no ano corrente faz sua árvore crescer e ganhar brilho!
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="rounded-sm border border-amber-400/40 bg-[#261409] p-1 text-amber-200 hover:bg-amber-500/20 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-sm border border-[#8c5835] bg-[#261409]/85 p-3">
            <GitCommit className="h-5 w-5 text-emerald-300" />
            <h3 className="mt-2 text-xs font-bold text-amber-200">1. Conecte o GitHub</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-100/85">
              Autenticação OAuth apenas leitura para consultar suas contribuições públicas do ano
              atual via GraphQL.
            </p>
          </div>
          <div className="rounded-sm border border-[#8c5835] bg-[#261409]/85 p-3">
            <Trees className="h-5 w-5 text-amber-300" />
            <h3 className="mt-2 text-xs font-bold text-amber-200">2. Cultive sua Árvore</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-100/85">
              Sua árvore evolui por 7 estágios com novos galhos, bolas, luzes cintilantes, estrela
              e aura especial.
            </p>
          </div>
          <div className="rounded-sm border border-[#8c5835] bg-[#261409]/85 p-3">
            <Gift className="h-5 w-5 text-rose-300" />
            <h3 className="mt-2 text-xs font-bold text-amber-200">3. Envie Presentes</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-100/85">
              Presentes decoram visualmente as árvores e apoiam a campanha voluntária via Pix — sem
              alterar commits.
            </p>
          </div>
        </div>

        <h3 className="mt-5 flex items-center gap-2 text-xs font-bold text-amber-300">
          <Heart className="h-4 w-4 text-rose-400" />
          Estágios de crescimento configuráveis
        </h3>

        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {TREE_STAGES.map((stage) => (
            <div
              key={stage.level}
              className="flex items-start justify-between gap-2 rounded-sm border border-amber-500/25 bg-[#070d1f]/80 p-2.5 text-[11px]"
            >
              <div>
                <p className="font-bold" style={{ color: stage.accentColor }}>
                  Nível {stage.level} · {stage.name}
                </p>
                <p className="mt-0.5 text-slate-300">{stage.description}</p>
              </div>
              <span className="shrink-0 rounded-sm bg-[#15244a] px-2 py-0.5 text-[10px] font-bold text-amber-200">
                {stage.badgeLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
