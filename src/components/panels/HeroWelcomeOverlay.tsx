import { Compass, Heart, Terminal, X } from 'lucide-react'
import { STANDARD_CONTRIBUTION_YEAR } from '../../config/githubPeriod'
import { GitHubIcon } from '../icons/GitHubIcon'
import type { CityCommunityStats } from '../../types/city'

interface HeroWelcomeOverlayProps {
  stats: CityCommunityStats
  onExploreCity: () => void
  onConnectGitHub: () => void
  onFocusCreatorTree: () => void
}

export function HeroWelcomeOverlay({
  stats,
  onExploreCity,
  onConnectGitHub,
  onFocusCreatorTree,
}: HeroWelcomeOverlayProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-end justify-center p-3 pb-16 sm:items-center sm:p-6">
      <section
        aria-label="Boas-vindas à Christmas Commit City"
        className="pointer-events-auto relative w-full max-w-lg pixel-night-panel rounded-md p-5 sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-slate-700/70 pb-3">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <Terminal className="h-3.5 w-3.5" />
            <span>$ christmas-commit-city --start</span>
          </div>
          <button
            type="button"
            onClick={onExploreCity}
            aria-label="Fechar boas-vindas e explorar a cidade"
            className="rounded-sm border border-slate-700 bg-slate-900/80 p-1 text-slate-400 transition hover:border-slate-500 hover:text-slate-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4">
          <h1 className="text-base font-bold text-slate-100 sm:text-lg">
            Christmas Commit City
            <span className="ml-2 text-xs font-normal text-amber-300/90">
              v{STANDARD_CONTRIBUTION_YEAR}
            </span>
          </h1>
          <div className="mt-2 space-y-1 text-xs text-slate-300">
            <p>
              <span className="text-emerald-400">&gt;</span> Uma árvore para cada desenvolvedor.
            </p>
            <p>
              <span className="text-emerald-400">&gt;</span> Cada commit ilumina a floresta 3D.
            </p>
          </div>
        </div>

        {/* Terminal status block */}
        <div className="mt-4 rounded-sm border border-slate-800 bg-[#040811]/90 p-3 text-xs">
          <p className="text-[11px] font-semibold text-slate-400">[ status ]</p>
          <dl className="mt-2 grid grid-cols-2 gap-y-1 sm:grid-cols-3 sm:gap-x-4">
            <div className="flex items-center justify-between sm:block">
              <dt className="text-[11px] text-slate-400">trees</dt>
              <dd className="font-semibold text-emerald-400">{stats.totalTrees}</dd>
            </div>
            <div className="flex items-center justify-between sm:block">
              <dt className="text-[11px] text-slate-400">commits</dt>
              <dd className="font-semibold text-amber-300">
                {stats.totalContributions.toLocaleString('pt-BR')}
              </dd>
            </div>
            <div className="flex items-center justify-between sm:block">
              <dt className="text-[11px] text-slate-400">gifted</dt>
              <dd className="font-semibold text-slate-200">{stats.totalGifts}</dd>
            </div>
          </dl>
        </div>

        {/* Actions */}
        <div className="mt-4">
          <p className="mb-2 text-[11px] text-slate-400">[ actions ]</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onExploreCity}
              className="pixel-btn pixel-btn-pine flex-1 rounded-sm px-3.5 py-2 text-xs font-semibold"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>$ explore --city</span>
            </button>

            <button
              type="button"
              onClick={onConnectGitHub}
              className="pixel-btn pixel-btn-red flex-1 rounded-sm px-3.5 py-2 text-xs font-semibold"
            >
              <GitHubIcon className="h-3.5 w-3.5" />
              <span>$ connect --github</span>
            </button>
          </div>
        </div>

        {/* Special UFC Tree compact footer line */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3 text-[11px]">
          <span className="text-slate-300">
            <span className="text-amber-300">★</span> Campanha voluntária UFC na floresta
          </span>
          <button
            type="button"
            onClick={onFocusCreatorTree}
            className="inline-flex items-center gap-1.5 rounded-sm border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 transition hover:bg-amber-500/20 cursor-pointer"
          >
            <Heart className="h-3 w-3 fill-current" />
            <span>ver árvore</span>
          </button>
        </div>
      </section>
    </div>
  )
}
