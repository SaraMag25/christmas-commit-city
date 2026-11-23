import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { CompanionShopModal } from '../components/companions/CompanionShopModal'
import { GiftCatalogPreviewModal } from '../components/gifts/GiftCatalogPreviewModal'
import { isViewerTreeOwner } from '../utils/treeOwnership'
import { CameraControls } from '../components/hud/CameraControls'
import { CityExplorerBar } from '../components/hud/CityExplorerBar'
import { CityHeader } from '../components/hud/CityHeader'
import { GitHubConnectModal } from '../components/panels/GitHubConnectModal'
import { HeroWelcomeOverlay } from '../components/panels/HeroWelcomeOverlay'
import { HowItWorksModal } from '../components/panels/HowItWorksModal'
import { SupportCampaignModal } from '../components/panels/SupportCampaignModal'
import { TreeDetailsPanel } from '../components/panels/TreeDetailsPanel'
import { useCity } from '../context/cityContextStore'
import { useLocale } from '../context/localeContextStore'
import { City3DCanvas } from '../game/City3DCanvas'
import { gameEventBus } from '../game/eventBus'
import { fetchMyPaymentOrderStatus } from '../services/paymentService'
import type { CityTree, VillagePropDialogue } from '../types/city'

export function HomePage() {
  const {
    trees,
    decorativeTrees,
    session,
    currentUserTree,
    isSupabaseReady,
    isSyncing,
    authError,
    resyncMyTree,
    refreshCityState,
    signOut,
    clearAuthError,
  } = useCity()
  const { language, t } = useLocale()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusParam = searchParams.get('focus')
  const searchParam = searchParams.get('search')
  const paymentParam = searchParams.get('payment')
  const orderIdParam = searchParams.get('order_id')

  const [paymentBanner, setPaymentBanner] = useState<{
    kind: 'success' | 'pending' | 'cancelled'
    message: string
  } | null>(() => {
    if (paymentParam === 'cancelled') {
      return { kind: 'cancelled', message: t.home.paymentCancelledBanner }
    }
    if (paymentParam === 'success') {
      return { kind: 'pending', message: t.home.paymentPendingBanner }
    }
    return null
  })

  const [welcomeMode, setWelcomeMode] = useState<'auto' | 'manual' | 'closed'>(() =>
    focusParam || searchParam || paymentParam ? 'closed' : 'auto',
  )
  const [showSearch, setShowSearch] = useState(() => Boolean(searchParam))
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [giftTargetTree, setGiftTargetTree] = useState<CityTree | null>(null)
  const [companionTargetTreeId, setCompanionTargetTreeId] = useState<string | null>(null)
  const [supportTargetUsername, setSupportTargetUsername] = useState<string | null>(null)
  const [hoveredTree, setHoveredTree] = useState<CityTree | null>(null)
  const [selectedTree, setSelectedTree] = useState<CityTree | null>(null)

  const isWelcomeVisible =
    welcomeMode === 'manual' || (welcomeMode === 'auto' && !session)
  const isConnectModalVisible = showConnectModal && !session

  const activeSelectedTree = selectedTree
    ? (trees.find((tItem) => tItem.id === selectedTree.id) ?? selectedTree)
    : null
  const companionTargetTree = companionTargetTreeId
    ? (trees.find((tItem) => tItem.id === companionTargetTreeId) ?? null)
    : null
  const [propDialogue, setPropDialogue] = useState<VillagePropDialogue | null>(null)
  const [bootLogVisible, setBootLogVisible] = useState(true)
  const isCityReadyRef = useRef(false)
  const autoFocusedUserRef = useRef<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setBootLogVisible(false), 4500)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const unsubReady = gameEventBus.on('city:ready', () => {
      isCityReadyRef.current = true
    })
    const unsubHover = gameEventBus.on('city:tree-hovered', setHoveredTree)
    const unsubSelect = gameEventBus.on('city:tree-selected', (tree) => {
      setSelectedTree(tree)
      setPropDialogue(null)
      setWelcomeMode('closed')
    })
    const unsubProp = gameEventBus.on('city:prop-interacted', (dialogue) => {
      setPropDialogue(dialogue)
      setWelcomeMode('closed')
    })

    return () => {
      unsubReady()
      unsubHover()
      unsubSelect()
      unsubProp()
    }
  }, [])

  useEffect(() => {
    if (!searchParam) return
    setSearchParams({}, { replace: true })
  }, [searchParam, setSearchParams])

  useEffect(() => {
    if (!paymentParam) return
    let active = true

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('payment')
    nextParams.delete('order_id')
    setSearchParams(nextParams, { replace: true })

    if (paymentParam !== 'success') {
      return () => {
        active = false
      }
    }

    const verifyPaid = async () => {
      if (orderIdParam) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const record = await fetchMyPaymentOrderStatus(orderIdParam)
          if (!active) return
          if (record?.status === 'paid') {
            await refreshCityState()
            if (active) {
              setPaymentBanner({ kind: 'success', message: t.home.paymentSuccessBanner })
            }
            return
          }
          if (record?.status === 'failed') {
            setPaymentBanner({ kind: 'cancelled', message: t.shop.pixExpiredOrFailed })
            return
          }
          await new Promise((r) => window.setTimeout(r, 2000))
        }
      }
      await refreshCityState()
    }
    void verifyPaid()

    return () => {
      active = false
    }
  }, [
    paymentParam,
    orderIdParam,
    searchParams,
    setSearchParams,
    refreshCityState,
    t.home.paymentSuccessBanner,
    t.shop.pixExpiredOrFailed,
  ])

  useEffect(() => {
    if (!session) {
      autoFocusedUserRef.current = null
      return
    }

    if (focusParam || searchParam || !currentUserTree) return

    const usernameKey = currentUserTree.profile.github_username.toLowerCase()
    if (autoFocusedUserRef.current !== usernameKey) {
      autoFocusedUserRef.current = usernameKey
      gameEventBus.emit('city:focus-tree', currentUserTree.profile.github_username)
    }
  }, [session, currentUserTree, focusParam, searchParam])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        setWelcomeMode('closed')
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!focusParam) return

    const focusNow = () => {
      gameEventBus.emit('city:focus-tree', focusParam)
      setSearchParams({}, { replace: true })
    }

    if (isCityReadyRef.current) {
      focusNow()
      return
    }

    const unsubReady = gameEventBus.on('city:ready', focusNow)
    return () => {
      unsubReady()
    }
  }, [focusParam, setSearchParams])

  const handleFocusMyTree = () => {
    setWelcomeMode('closed')
    setShowSearch(false)
    setPropDialogue(null)
    if (currentUserTree) {
      setSelectedTree(currentUserTree)
      gameEventBus.emit('city:focus-tree', currentUserTree.profile.github_username)
    } else if (session) {
      void resyncMyTree()
    }
  }

  const handleFocusCreatorTree = () => {
    setWelcomeMode('closed')
    setPropDialogue(null)
    gameEventBus.emit('city:focus-creator')
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0a1633]">
      <City3DCanvas trees={trees} decorativeTrees={decorativeTrees} />

      <CityHeader
        onOpenConnectModal={() => setShowConnectModal(true)}
        onOpenHowItWorks={() => setShowHowItWorks(true)}
        onOpenSearch={() => {
          setWelcomeMode('closed')
          setShowSearch(true)
        }}
        onFocusMyTree={handleFocusMyTree}
        onFocusCreatorTree={handleFocusCreatorTree}
        onOpenSupport={() => {
          setWelcomeMode('closed')
          setPropDialogue(null)
          setSupportTargetUsername('SaraMag25')
        }}
        onShowWelcome={() => {
          setSelectedTree(null)
          setPropDialogue(null)
          setShowSearch(false)
          setWelcomeMode('manual')
        }}
      />

      <CityExplorerBar
        trees={trees}
        selectedTreeId={activeSelectedTree?.id ?? null}
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectTree={(tree) => {
          setWelcomeMode('closed')
          setPropDialogue(null)
          setSelectedTree(tree)
          gameEventBus.emit('city:focus-tree', tree.profile.github_username)
        }}
      />

      {paymentBanner && (
        <div
          role="status"
          className={`fixed left-4 top-24 z-40 max-w-sm rounded-sm border-2 p-3 text-xs shadow-lg ${
            paymentBanner.kind === 'success'
              ? 'border-emerald-400 bg-emerald-950/95 text-emerald-100'
              : paymentBanner.kind === 'pending'
                ? 'border-amber-400 bg-amber-950/95 text-amber-100'
                : 'border-slate-500 bg-slate-900/95 text-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="leading-snug">{paymentBanner.message}</p>
            <button
              type="button"
              onClick={() => setPaymentBanner(null)}
              aria-label={t.home.close}
              className="rounded-sm p-1 text-slate-300 hover:bg-black/30 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {authError && (
        <div
          role="alert"
          className="fixed right-4 top-24 z-40 max-w-sm rounded-sm border-2 border-rose-500 bg-rose-950/95 p-3 text-xs text-rose-100 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-rose-300">{t.home.syncWarning}</p>
              <p className="mt-1 leading-snug">{authError}</p>
              {session && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => void resyncMyTree()}
                    disabled={isSyncing}
                    className="pixel-btn pixel-btn-pine rounded-sm px-2.5 py-1 text-[11px] font-semibold disabled:opacity-60"
                  >
                    {isSyncing ? t.header.syncing : t.header.retrySyncBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowConnectModal(false)
                      void signOut()
                    }}
                    className="pixel-btn pixel-btn-wood rounded-sm px-2.5 py-1 text-[11px]"
                  >
                    {t.header.signOutBtn}
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={clearAuthError}
              aria-label={t.home.close}
              className="rounded-sm p-1 text-rose-200 hover:bg-rose-900 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {isWelcomeVisible && (
        <HeroWelcomeOverlay
          onExploreCity={() => setWelcomeMode('closed')}
          onConnectGitHub={() => setShowConnectModal(true)}
          onGoToMyTree={handleFocusMyTree}
          onFocusCreatorTree={handleFocusCreatorTree}
        />
      )}

      {bootLogVisible && !isWelcomeVisible && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-16 left-3 z-20 rounded-sm border border-emerald-500/25 bg-[#060b16]/80 px-3 py-2 text-[11px] text-slate-300 backdrop-blur-md sm:left-4"
        >
          <p className="text-emerald-400">&gt; Loading North Pole Forest...</p>
          <p>&gt; Syncing GitHub contributions...</p>
          <p>&gt; Generating developer trees &amp; companions...</p>
          <p className="text-amber-300">&gt; World ready.</p>
        </div>
      )}

      {propDialogue && (
        <div
          role="status"
          className="fixed bottom-16 left-1/2 z-30 w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 pixel-night-panel rounded-md p-3.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-emerald-400">
                $ npc talk --target=&quot;
                {language === 'en' ? (propDialogue.titleEn ?? propDialogue.title) : propDialogue.title}
                &quot;
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-200">
                {language === 'en' ? (propDialogue.textEn ?? propDialogue.text) : propDialogue.text}
              </p>

              {propDialogue.action === 'open-shop' && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target =
                        currentUserTree ??
                        activeSelectedTree ??
                        trees.find((item) => item.is_creator_special) ??
                        trees[0]
                      if (target) {
                        setCompanionTargetTreeId(target.id)
                      }
                      setPropDialogue(null)
                    }}
                    className="pixel-btn pixel-btn-pine rounded-sm px-2.5 py-1 text-[11px] font-bold"
                  >
                    {language === 'en' ? 'Open Companion Shop' : 'Abrir Loja de Companheiros'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target =
                        activeSelectedTree ??
                        currentUserTree ??
                        trees.find((item) => item.is_creator_special) ??
                        trees[0]
                      if (target) {
                        setGiftTargetTree(target)
                      }
                      setPropDialogue(null)
                    }}
                    className="pixel-btn pixel-btn-gold rounded-sm px-2.5 py-1 text-[11px] font-bold"
                  >
                    {language === 'en' ? 'Browse Gifts' : 'Ver Presentes'}
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPropDialogue(null)}
              aria-label={t.home.close}
              className="rounded-sm border border-slate-700 p-1 text-slate-400 hover:border-slate-500 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {activeSelectedTree && (
        <TreeDetailsPanel
          tree={activeSelectedTree}
          onClose={() => setSelectedTree(null)}
          onOpenGiftCatalog={(tree) => setGiftTargetTree(tree)}
          onOpenCompanionShop={(tree) => setCompanionTargetTreeId(tree.id)}
          onOpenSupportModal={(tree) => setSupportTargetUsername(tree.profile.github_username)}
        />
      )}

      <CameraControls
        hoveredTree={hoveredTree}
        onZoomIn={() => gameEventBus.emit('city:zoom-in')}
        onZoomOut={() => gameEventBus.emit('city:zoom-out')}
        onOrbitLeft={() => gameEventBus.emit('city:orbit-left')}
        onOrbitRight={() => gameEventBus.emit('city:orbit-right')}
        onResetCamera={() => gameEventBus.emit('city:reset-camera')}
      />

      {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
      {isConnectModalVisible && <GitHubConnectModal onClose={() => setShowConnectModal(false)} />}
      {giftTargetTree && (
        <GiftCatalogPreviewModal
          recipientUsername={giftTargetTree.profile.github_username}
          isOwnTree={isViewerTreeOwner(giftTargetTree, currentUserTree, isSupabaseReady)}
          onClose={() => setGiftTargetTree(null)}
        />
      )}
      {companionTargetTree && (
        <CompanionShopModal
          tree={companionTargetTree}
          onClose={() => setCompanionTargetTreeId(null)}
        />
      )}
      {supportTargetUsername && (
        <SupportCampaignModal
          targetUsername={supportTargetUsername}
          onClose={() => setSupportTargetUsername(null)}
        />
      )}
    </main>
  )
}
