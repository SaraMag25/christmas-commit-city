import { Heart, HelpCircle, LogOut, RefreshCw, Search, Terminal, Trees } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCity } from '../../context/cityContextStore'
import { useLocale } from '../../context/localeContextStore'
import { extractSessionGitHubUser } from '../../services/githubSyncService'
import { GitHubIcon } from '../icons/GitHubIcon'

interface CityHeaderProps {
  onOpenConnectModal: () => void
  onOpenHowItWorks: () => void
  onOpenSearch?: () => void
  onFocusMyTree?: () => void
  onFocusCreatorTree?: () => void
  onShowWelcome?: () => void
}

export function CityHeader({
  onOpenConnectModal,
  onOpenHowItWorks,
  onOpenSearch,
  onFocusMyTree,
  onFocusCreatorTree,
  onShowWelcome,
}: CityHeaderProps) {
  const { session, currentUserTree, isSyncing, resyncMyTree, signOut } = useCity()
  const { language, setLanguage, t } = useLocale()
  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === '/'
  const sessionUser = !currentUserTree ? extractSessionGitHubUser(session) : null

  const handleBrandClick = () => {
    if (isHome && onShowWelcome) {
      onShowWelcome()
    } else {
      navigate('/')
    }
  }

  const handleMyTreeClick = () => {
    if (!currentUserTree) return
    if (isHome && onFocusMyTree) {
      onFocusMyTree()
    } else {
      navigate(`/?focus=${encodeURIComponent(currentUserTree.profile.github_username)}`)
    }
  }

  const handleCreatorClick = () => {
    if (isHome && onFocusCreatorTree) {
      onFocusCreatorTree()
    } else {
      navigate('/?focus=SaraMag25')
    }
  }

  const handleSearchClick = () => {
    if (isHome && onOpenSearch) {
      onOpenSearch()
    } else {
      navigate('/?search=1')
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
              {t.header.subtitle}
            </span>
          </div>
        </button>

        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-1.5">
          {/* Discreet PT | EN Language Switcher */}
          <div
            role="group"
            aria-label="Language"
            className="flex items-center rounded-sm border border-slate-700 bg-[#040811] p-0.5 text-[10px]"
          >
            <button
              type="button"
              onClick={() => setLanguage('pt-BR')}
              className={`rounded-[2px] px-1.5 py-0.5 font-bold transition cursor-pointer ${
                language === 'pt-BR'
                  ? 'bg-emerald-500/25 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PT
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`rounded-[2px] px-1.5 py-0.5 font-bold transition cursor-pointer ${
                language === 'en'
                  ? 'bg-sky-500/25 text-sky-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              EN
            </button>
          </div>

          <Link
            to="/"
            className={`pixel-btn rounded-sm px-2.5 py-1 text-[11px] ${
              isHome ? 'pixel-btn-pine font-semibold' : 'pixel-btn-wood'
            }`}
          >
            <Trees className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t.header.city}</span>
          </Link>

          <button
            type="button"
            onClick={handleSearchClick}
            className="pixel-btn pixel-btn-wood rounded-sm px-2.5 py-1 text-[11px]"
            title={t.header.findTitle}
          >
            <Search className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden sm:inline">{t.header.find}</span>
          </button>

          <button
            type="button"
            onClick={onOpenHowItWorks}
            className="pixel-btn pixel-btn-wood rounded-sm px-2.5 py-1 text-[11px]"
            title={t.howItWorks.title}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{t.header.docs}</span>
          </button>

          <button
            type="button"
            onClick={handleCreatorClick}
            className="pixel-btn pixel-btn-gold rounded-sm px-2.5 py-1 text-[11px] font-medium"
          >
            <Heart className="h-3 w-3 fill-current" />
            <span className="hidden sm:inline">{t.header.support}</span>
          </button>

          {currentUserTree ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleMyTreeClick}
                className="pixel-btn pixel-btn-pine rounded-sm px-2.5 py-1 text-[11px] font-semibold"
                title={t.header.myTreeTitle}
              >
                <img
                  src={currentUserTree.profile.avatar_url}
                  alt={currentUserTree.profile.github_username}
                  className="h-3.5 w-3.5 rounded-[2px] border border-emerald-400/50"
                />
                <span>@{currentUserTree.profile.github_username}</span>
              </button>

              <button
                type="button"
                onClick={() => void resyncMyTree()}
                disabled={isSyncing}
                className="pixel-btn pixel-btn-wood rounded-sm p-1.5 text-[11px] disabled:opacity-60"
                title={t.header.resyncTitle}
                aria-label={t.header.resyncTitle}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => void signOut()}
                className="pixel-btn pixel-btn-wood rounded-sm p-1.5 text-[11px]"
                title={t.header.signOutTitle}
                aria-label={t.header.signOutTitle}
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : session ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void resyncMyTree()}
                disabled={isSyncing}
                className="pixel-btn pixel-btn-pine rounded-sm px-2.5 py-1 text-[11px] font-semibold disabled:opacity-70"
                title={t.header.resyncTitle}
              >
                {sessionUser?.avatarUrl ? (
                  <img
                    src={sessionUser.avatarUrl}
                    alt={sessionUser.username}
                    className="h-3.5 w-3.5 rounded-[2px] border border-emerald-400/50"
                  />
                ) : (
                  <GitHubIcon className="h-3.5 w-3.5" />
                )}
                <span>@{sessionUser?.username || 'github'}</span>
                <span className="hidden text-[10px] text-amber-200/90 md:inline">
                  · {isSyncing ? t.header.syncing : t.header.syncPending}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void resyncMyTree()}
                disabled={isSyncing}
                className="pixel-btn pixel-btn-wood rounded-sm p-1.5 text-[11px] disabled:opacity-60"
                title={t.header.resyncTitle}
                aria-label={t.header.resyncTitle}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => void signOut()}
                className="pixel-btn pixel-btn-wood rounded-sm p-1.5 text-[11px]"
                title={t.header.signOutTitle}
                aria-label={t.header.signOutTitle}
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
              <span className="hidden sm:inline">{t.header.connect}</span>
              <span className="sm:hidden">{t.header.connectShort}</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
