import { Heart, HelpCircle, Sparkles, Trees } from 'lucide-react'
import { GitHubIcon } from '../icons/GitHubIcon'
import type { CityCommunityStats } from '../../types/city'

interface CityHeaderProps {
  stats: CityCommunityStats
  onOpenConnectModal: () => void
  onOpenHowItWorks: () => void
  onFocusCreatorTree: () => void
  onShowWelcome: () => void
}

export function CityHeader({
  stats,
  onOpenConnectModal,
  onOpenHowItWorks,
  onFocusCreatorTree,
  onShowWelcome,
}: CityHeaderProps) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 p-3 sm:p-4">
      <div className="pointer-events-auto mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5 px-3 py-2.5 pixel-night-panel rounded-sm">
        <button
          type="button"
          onClick={onShowWelcome}
          className="flex items-center gap-2.5 text-left transition hover:brightness-110 cursor-pointer"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-sm border-2 border-amber-400 bg-[#0f2e24] text-amber-300 shadow-inner">
            <Trees className="h-5 w-5" />
          </span>
          <div>
            <p className="font-pixel-title text-[11px] leading-tight text-amber-300 sm:text-xs">
              Christmas Commit City
            </p>
            <p className="font-pixel-body text-base leading-none text-slate-300">
              Vila Natalina Open Source
            </p>
          </div>
        </button>

        {/* Live community stats bar (mock data in Phase 1) */}
        <div className="hidden items-center gap-3 rounded-sm border border-amber-500/30 bg-[#070d1f]/75 px-3 py-1.5 text-xs lg:flex">
          <span className="flex items-center gap-1.5 text-emerald-300">
            <Trees className="h-3.5 w-3.5" />
            <strong>{stats.totalTrees}</strong> árvores
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1.5 text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            <strong>{stats.totalContributions.toLocaleString('pt-BR')}</strong> commits
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-sky-200">
            <strong>{stats.illuminatedTrees}</strong> iluminadas
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenHowItWorks}
            className="pixel-btn pixel-btn-wood rounded-sm px-2.5 py-1.5 text-[11px]"
            title="Como funciona e estágios das árvores"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Como funciona</span>
          </button>

          <button
            type="button"
            onClick={onFocusCreatorTree}
            className="pixel-btn pixel-btn-gold rounded-sm px-2.5 py-1.5 text-[11px] font-bold"
          >
            <Heart className="h-3.5 w-3.5 fill-current" />
            <span>Campanha UFC</span>
          </button>

          <button
            type="button"
            onClick={onOpenConnectModal}
            className="pixel-btn pixel-btn-red rounded-sm px-3 py-1.5 text-[11px] font-bold"
          >
            <GitHubIcon className="h-3.5 w-3.5" />
            <span>Conectar com GitHub</span>
          </button>
        </div>
      </div>
    </header>
  )
}
