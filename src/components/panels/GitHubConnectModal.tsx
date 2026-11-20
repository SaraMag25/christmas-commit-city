import { FileCode2, Lock, ShieldCheck, X } from 'lucide-react'
import { STANDARD_CONTRIBUTION_YEAR } from '../../config/githubPeriod'
import { useCity } from '../../context/cityContextStore'
import { GitHubIcon } from '../icons/GitHubIcon'

interface GitHubConnectModalProps {
  onClose: () => void
}

export function GitHubConnectModal({ onClose }: GitHubConnectModalProps) {
  const { isSupabaseReady, isConnecting, authError, connectWithGitHub } = useCity()

  const handleStartOAuth = async () => {
    await connectWithGitHub()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Conectar com GitHub"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs"
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

        <div className="mt-3 space-y-2 rounded-sm border border-emerald-500/30 bg-[#0f2e24]/60 p-3 text-[11px] text-emerald-100">
          <p className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
            <span>
              Autenticação OAuth via Supabase Auth para consultar sua atividade via{' '}
              <strong>GitHub GraphQL API</strong>.
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0 text-amber-300" />
            <span>
              Escopo estritamente <code>read:user</code>: nenhum acesso de escrita aos seus
              repositórios é solicitado.
            </span>
          </p>
          <p className="text-slate-200">
            Período padronizado de comparação: calendário de {STANDARD_CONTRIBUTION_YEAR}.
          </p>
        </div>

        {!isSupabaseReady && (
          <div className="mt-3 rounded-sm border border-amber-400/40 bg-[#3b2110]/70 p-3 text-[11px] text-amber-100">
            <p className="flex items-center gap-1.5 font-bold text-amber-300">
              <FileCode2 className="h-4 w-4" />
              Credenciais do Supabase ainda não configuradas no .env
            </p>
            <p className="mt-1.5 leading-relaxed text-amber-100/90">
              Para ativar o login OAuth real, configure <code>VITE_SUPABASE_URL</code> e{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env</code> e publique a Edge
              Function <code>sync-github-contributions</code> seguindo{' '}
              <code>docs/SUPABASE_GITHUB_SETUP.md</code>.
            </p>
          </div>
        )}

        {authError && (
          <p className="mt-3 rounded-sm border border-rose-500/50 bg-rose-950/70 p-2.5 text-[11px] text-rose-200">
            {authError}
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn pixel-btn-wood rounded-sm px-3.5 py-2 text-xs"
          >
            Voltar
          </button>

          {isSupabaseReady && (
            <button
              type="button"
              onClick={handleStartOAuth}
              disabled={isConnecting}
              className="pixel-btn pixel-btn-red rounded-sm px-4 py-2 text-xs font-bold disabled:opacity-60"
            >
              <GitHubIcon className="h-4 w-4" />
              <span>{isConnecting ? 'Redirecionando...' : 'Autorizar com GitHub'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
