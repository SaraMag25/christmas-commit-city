import { Heart, HelpCircle, LogOut, RefreshCw, Terminal, Trees, Trophy } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCity } from '../../context/cityContextStore'
import { GitHubIcon } from '../icons/GitHubIcon'

interface CityHeaderProps {
  onOpenConnectModal: () => void
  onOpenHowItWorks: () => void
  onFocusCreatorTree?: () => void
  onShowWelcome?: () => void
}

export function CityHeader({
  onOpenConnectModal,
  onOpenHowItWorks,
  onFocusCreatorTree,
  onShowWelcome,
}: CityHeaderProps) {
  const { stats, currentUserTree, isSyncing, resyncMyTree, signOut } = useCity()
  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === '/'
  const isRankings = location.pathname === '/rankings'

  const handleBrandClick = () => {
    if (isHome && onShowWelcome) {
      onShowWelcome()
    } else {
      navigate('/')
    }
  }

  const handleCreatorClick = () => {
    if (isHome && onFocusCreatorTree) {
      onFocusCreatorTree()
    } else {
      navigate('/?focus=SaraMag25')
    }
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 p-3 sm:p-4">
      <div className="pointer-events-auto mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5 rounded-md px-3.5 py-2 pixel-night-panel">
        <button
          type="button"
          onClick={handleBrandClick}
          className="flex items-center gap-2 text-left transition hover:brightness-110 cursor-pointer"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-emerald-400/40 bg-emerald-950/70 text-emerald-400">
            <Terminal className="h-3.5 w-3.5" />
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold text-slate-100 sm:text-sm">
              christmas_commit_city
            </span>
            <span className="hidden text-[11px] text-amber-300/80 md:inline">
              // natal 3d
            </span>
          </div>
        </button>

        <div className="hidden items-center gap-2.5 rounded-sm border border-slate-800 bg-[#040811]/85 px-3 py-1 text-[11px] text-slate-300 xl:flex">
          <span>
            trees: <strong className="text-emerald-400">{stats.totalTrees}</strong>
          </span>
          <span className="text-slate-700">|</span>
          <span>
            commits:{' '}
            <strong className="text-amber-300">
              {stats.totalContributions.toLocaleString('pt-BR')}
            </strong>
          </span>
          <span className="text-slate-700">|</span>
          <span>
            lights: <strong className="text-emerald-300">{stats.illuminatedTrees}</strong>
          </span>
        </div>

        <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-1.5">
          <Link
            to="/"
            className={`pixel-btn rounded-sm px-2.5 py-1 text-[11px] ${
              isHome ? 'pixel-btn-pine font-semibold' : 'pixel-btn-wood'
            }`}
          >
            <Trees className="h-3.5 w-3.5" />
            <span className="hidden md:inline">cidade</span>
          </Link>

          <Link
            to="/rankings"
            className={`pixel-btn rounded-sm px-2.5 py-1 text-[11px] ${
              isRankings ? 'pixel-btn-pine font-semibold' : 'pixel-btn-wood'
            }`}
          >
            <Trophy className="h-3.5 w-3.5 text-amber-300" />
            <span className="hidden sm:inline">rankings</span>
          </Link>

          <button
            type="button"
            onClick={onOpenHowItWorks}
            className="pixel-btn pixel-btn-wood rounded-sm px-2.5 py-1 text-[11px]"
            title="Como funciona e estágios das árvores"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">docs</span>
          </button>

          <button
            type="button"
            onClick={handleCreatorClick}
            className="pixel-btn pixel-btn-gold rounded-sm px-2.5 py-1 text-[11px] font-medium"
          >
            <Heart className="h-3 w-3 fill-current" />
            <span className="hidden sm:inline">ufc</span>
          </button>

          {currentUserTree ? (
            <div className="flex items-center gap-1.5">
              <Link
                to={`/?focus=${encodeURIComponent(currentUserTree.profile.github_username)}`}
                className="pixel-btn pixel-btn-pine rounded-sm px-2.5 py-1 text-[11px] font-semibold"
                title="Ir para minha árvore"
              >
                <img
                  src={currentUserTree.profile.avatar_url}
                  alt={currentUserTree.profile.github_username}
                  className="h-3.5 w-3.5 rounded-[2px] border border-emerald-400/50"
                />
                <span>@{currentUserTree.profile.github_username}</span>
              </Link>

              <button
                type="button"
                onClick={() => void resyncMyTree()}
                disabled={isSyncing}
                className="pixel-btn pixel-btn-wood rounded-sm p-1.5 text-[11px] disabled:opacity-60"
                title="Sincronizar contribuições do GitHub"
                aria-label="Sincronizar contribuições"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => void signOut()}
                className="pixel-btn pixel-btn-wood rounded-sm p-1.5 text-[11px]"
                title="Sair da conta GitHub"
                aria-label="Sair"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenConnectModal}
              className="pixel-btn pixel-btn-red rounded-sm px-2.5 py-1 text-[11px] font-semibold"
            >
              <GitHubIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">connect</span>
              <span className="sm:hidden">git</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
