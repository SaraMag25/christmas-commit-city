import { Compass, Heart, Sparkles, Trees, X } from 'lucide-react'
import { STANDARD_CONTRIBUTION_YEAR } from '../../config/pixCampaign'
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
        className="pointer-events-auto relative w-full max-w-xl pixel-wood-panel rounded-sm p-4 sm:p-6"
      >
        <button
          type="button"
          onClick={onExploreCity}
          aria-label="Fechar boas-vindas e explorar a cidade"
          className="absolute right-3 top-3 rounded-sm border border-amber-400/40 bg-[#261409] p-1 text-amber-200 transition hover:bg-amber-500/20 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="inline-flex items-center gap-1.5 rounded-sm border border-amber-400/50 bg-[#070d1f]/80 px-2.5 py-1 text-[10px] text-amber-300">
          <Sparkles className="h-3 w-3 animate-twinkle" />
          <span>TEMPORADA DE NATAL {STANDARD_CONTRIBUTION_YEAR} · FASE 1 (PREVIEW VISUAL)</span>
        </div>

        <h1 className="mt-3 font-pixel-title text-base leading-relaxed text-amber-300 drop-shadow-[0_2px_0_#1e0f07] sm:text-xl">
          Christmas Commit City
        </h1>

        <p className="mt-2 font-pixel-body text-2xl leading-tight text-amber-100 sm:text-3xl">
          &ldquo;Every commit lights up a Christmas tree.&rdquo;
        </p>
        <p className="font-pixel-body text-xl leading-tight text-emerald-200">
          Cada commit ilumina uma árvore de Natal.
        </p>

        <p className="mt-3 text-xs leading-relaxed text-amber-100/90">
          Explore nossa vila natalina em pixel art construída pela comunidade GitHub. Cada conta
          cultiva um pinheiro único conforme suas contribuições em {STANDARD_CONTRIBUTION_YEAR},
          recebe presentes e ilumina a cidade.
        </p>

        {/* Mini community stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-sm border border-[#8c5835] bg-[#261409]/85 p-2 text-center">
            <p className="text-[10px] text-amber-200/80">Árvores</p>
            <p className="mt-0.5 font-pixel-title text-sm text-emerald-300">{stats.totalTrees}</p>
          </div>
          <div className="rounded-sm border border-[#8c5835] bg-[#261409]/85 p-2 text-center">
            <p className="text-[10px] text-amber-200/80">Commits</p>
            <p className="mt-0.5 font-pixel-title text-sm text-amber-300">
              {stats.totalContributions.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="rounded-sm border border-[#8c5835] bg-[#261409]/85 p-2 text-center">
            <p className="text-[10px] text-amber-200/80">Presentes</p>
            <p className="mt-0.5 font-pixel-title text-sm text-rose-300">{stats.totalGifts}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onExploreCity}
            className="pixel-btn pixel-btn-pine flex-1 rounded-sm px-4 py-2.5 text-xs font-bold"
          >
            <Compass className="h-4 w-4" />
            <span>Explorar a Cidade</span>
          </button>

          <button
            type="button"
            onClick={onConnectGitHub}
            className="pixel-btn pixel-btn-red flex-1 rounded-sm px-4 py-2.5 text-xs font-bold"
          >
            <GitHubIcon className="h-4 w-4" />
            <span>Conectar com GitHub</span>
          </button>
        </div>

        {/* Special UFC Tree Highlight */}
        <div className="mt-4 flex flex-col items-start justify-between gap-2 rounded-sm border border-sky-400/40 bg-[#0d1833]/90 p-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5">
            <Trees className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
            <div className="text-[11px] leading-snug text-slate-200">
              <strong className="text-amber-300">Árvore Especial na Praça Central:</strong>{' '}
              conheça a campanha voluntária da criadora (Engenharia da Computação — UFC).
            </div>
          </div>
          <button
            type="button"
            onClick={onFocusCreatorTree}
            className="pixel-btn pixel-btn-gold shrink-0 rounded-sm px-3 py-1.5 text-[11px] font-bold"
          >
            <Heart className="h-3.5 w-3.5 fill-current" />
            <span>Ver Árvore</span>
          </button>
        </div>
      </section>
    </div>
  )
}
