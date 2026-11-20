import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { GiftCatalogPreviewModal } from '../components/gifts/GiftCatalogPreviewModal'
import { CameraControls } from '../components/hud/CameraControls'
import { CityExplorerBar } from '../components/hud/CityExplorerBar'
import { CityHeader } from '../components/hud/CityHeader'
import { GitHubConnectPreviewModal } from '../components/panels/GitHubConnectPreviewModal'
import { HeroWelcomeOverlay } from '../components/panels/HeroWelcomeOverlay'
import { HowItWorksModal } from '../components/panels/HowItWorksModal'
import { TreeDetailsPanel } from '../components/panels/TreeDetailsPanel'
import { computeCommunityStats, MOCK_CITY_TREES } from '../data/mockCityData'
import { PhaserGame } from '../game/PhaserGame'
import { gameEventBus } from '../game/eventBus'
import type { CityTree, VillagePropDialogue } from '../types/city'

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const focusParam = searchParams.get('focus')

  const [showWelcome, setShowWelcome] = useState(() => !focusParam)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showConnectPreview, setShowConnectPreview] = useState(false)
  const [giftTargetTree, setGiftTargetTree] = useState<CityTree | null>(null)
  const [hoveredTree, setHoveredTree] = useState<CityTree | null>(null)
  const [selectedTree, setSelectedTree] = useState<CityTree | null>(null)
  const [propDialogue, setPropDialogue] = useState<VillagePropDialogue | null>(null)
  const isCityReadyRef = useRef(false)

  const communityStats = useMemo(() => computeCommunityStats(MOCK_CITY_TREES), [])

  useEffect(() => {
    const unsubReady = gameEventBus.on('city:ready', () => {
      isCityReadyRef.current = true
    })
    const unsubHover = gameEventBus.on('city:tree-hovered', setHoveredTree)
    const unsubSelect = gameEventBus.on('city:tree-selected', (tree) => {
      setSelectedTree(tree)
      setPropDialogue(null)
      setShowWelcome(false)
    })
    const unsubProp = gameEventBus.on('city:prop-interacted', (dialogue) => {
      setPropDialogue(dialogue)
      setShowWelcome(false)
    })

    return () => {
      unsubReady()
      unsubHover()
      unsubSelect()
      unsubProp()
    }
  }, [])

  // Handle incoming focus query like `/?focus=SaraMag25` from /rankings or /tree/:username
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

  const handleFocusCreatorTree = () => {
    setShowWelcome(false)
    setPropDialogue(null)
    gameEventBus.emit('city:focus-creator')
  }

  const handleSelectFromExplorer = (tree: CityTree) => {
    setShowWelcome(false)
    setPropDialogue(null)
    gameEventBus.emit('city:focus-tree', tree.id)
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#070d1f]">
      {/* Full-bleed pixel-art village canvas */}
      <PhaserGame />

      {/* Top RPG HUD */}
      <CityHeader
        stats={communityStats}
        onOpenConnectModal={() => setShowConnectPreview(true)}
        onOpenHowItWorks={() => setShowHowItWorks(true)}
        onFocusCreatorTree={handleFocusCreatorTree}
        onShowWelcome={() => {
          setSelectedTree(null)
          setPropDialogue(null)
          setShowWelcome(true)
        }}
      />

      {/* Quick explorer & filter bar */}
      {!showWelcome && (
        <CityExplorerBar
          trees={MOCK_CITY_TREES}
          selectedTreeId={selectedTree?.id ?? null}
          onSelectTree={handleSelectFromExplorer}
        />
      )}

      {/* Welcome banner highlighting the tagline and actions */}
      {showWelcome && (
        <HeroWelcomeOverlay
          stats={communityStats}
          onExploreCity={() => setShowWelcome(false)}
          onConnectGitHub={() => setShowConnectPreview(true)}
          onFocusCreatorTree={handleFocusCreatorTree}
        />
      )}

      {/* Interactive village prop RPG dialogue box */}
      {propDialogue && (
        <div
          role="status"
          className="fixed bottom-16 left-1/2 z-30 w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 pixel-wood-panel rounded-sm p-3.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-amber-300">{propDialogue.title}</p>
              <p className="mt-1 font-pixel-body text-xl leading-snug text-amber-50">
                {propDialogue.text}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPropDialogue(null)}
              aria-label="Fechar diálogo"
              className="rounded-sm border border-amber-400/30 p-1 text-amber-200 hover:bg-amber-500/20 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Selected tree details drawer / bottom-sheet */}
      {selectedTree && (
        <TreeDetailsPanel
          tree={selectedTree}
          onClose={() => setSelectedTree(null)}
          onOpenGiftCatalog={(tree) => setGiftTargetTree(tree)}
        />
      )}

      {/* Zoom & hover coordinates bar */}
      <CameraControls
        hoveredTree={hoveredTree}
        onZoomIn={() => gameEventBus.emit('city:zoom-in')}
        onZoomOut={() => gameEventBus.emit('city:zoom-out')}
        onResetCamera={() => gameEventBus.emit('city:reset-camera')}
      />

      {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
      {showConnectPreview && (
        <GitHubConnectPreviewModal onClose={() => setShowConnectPreview(false)} />
      )}
      {giftTargetTree && (
        <GiftCatalogPreviewModal
          recipientUsername={giftTargetTree.profile.github_username}
          onClose={() => setGiftTargetTree(null)}
        />
      )}
    </main>
  )
}
