import { Lock, ShieldCheck, X } from 'lucide-react'
import { STANDARD_CONTRIBUTION_YEAR } from '../../config/pixCampaign'
import { GitHubIcon } from '../icons/GitHubIcon'

interface GitHubConnectPreviewModalProps {
  onClose: () => void
}

export function GitHubConnectPreviewModal({ onClose }: GitHubConnectPreviewModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Conexão com GitHub"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs"
    >
      <div className="w-full max-w-md pixel-night-panel rounded-sm p-5">
        <div className="flex items-start justify-between gap-3 border-b border-amber-500/30 pb-3">
          <div className="flex items-center gap-2">
            <GitHubIcon className="h-5 w-5 text-amber-300" />
            <h2 className="font-pixel-title text-xs text-amber-300">Conectar com GitHub</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="rounded-sm border border-amber-400/30 p-1 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-200">
          Nesta <strong>Fase 1 (Identidade Visual)</strong>, a cidade está rodando com desenvolvedores
          fictícios para validar o visual em pixel art e o crescimento das árvores.
        </p>

        <div className="mt-3 space-y-2 rounded-sm border border-emerald-500/30 bg-[#0f2e24]/60 p-3 text-[11px] text-emerald-100">
          <p className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
            <span>
              <strong>Na Fase 3</strong>, este botão iniciará o login OAuth via Supabase Auth.
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0 text-amber-300" />
            <span>
              Somente leitura pública: nenhum acesso de escrita aos seus repositórios será pedido.
            </span>
          </p>
          <p className="text-slate-200">
            Período justo de comparação: calendário GraphQL do ano corrente ({STANDARD_CONTRIBUTION_YEAR}).
          </p>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn pixel-btn-gold rounded-sm px-4 py-2 text-xs font-bold"
          >
            Entendi, voltar à vila
          </button>
        </div>
      </div>
    </div>
  )
}
