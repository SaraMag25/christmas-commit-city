import { useEffect, useMemo, useState } from 'react'
import { CameraControls } from '../components/hud/CameraControls'
import { CityHeader } from '../components/hud/CityHeader'
import { GitHubConnectPreviewModal } from '../components/panels/GitHubConnectPreviewModal'
import { HeroWelcomeOverlay } from '../components/panels/HeroWelcomeOverlay'
import { HowItWorksModal } from '../components/panels/HowItWorksModal'
import { TreeDetailsPanel } from '../components/panels/TreeDetailsPanel'
import { computeCommunityStats, MOCK_CITY_TREES } from '../data/mockCityData'
import { PhaserGame } from '../game/PhaserGame'
import { gameEventBus } from '../game/eventBus'
import type { CityTree } from '../types/city'

export function HomePage() {
  const [showWelcome, setShowWelcome] = useState(true)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showConnectPreview, setShowConnectPreview] = useState(false)
  const [hoveredTree, setHoveredTree] = useState<CityTree | null>(null)
  const [selectedTree, setSelectedTree] = useState<CityTree | null>(null)

  const communityStats = useMemo(() => computeCommunityStats(MOCK_CITY_TREES), [])

  useEffect(() => {
    const unsubHover = gameEventBus.on('city:tree-hovered', setHoveredTree)
    const unsubSelect = gameEventBus.on('city:tree-selected', (tree) => {
      setSelectedTree(tree)
      setShowWelcome(false)
    })

    return () => {
      unsubHover()
      unsubSelect()
    }
  }, [])

  const handleFocusCreatorTree = () => {
    const creatorTree = MOCK_CITY_TREES.find((t) => t.is_creator_special) ?? null
    setShowWelcome(false)
    if (creatorTree) {
      setSelectedTree(creatorTree)
    }
    gameEventBus.emit('city:focus-creator')
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
          setShowWelcome(true)
        }}
      />

      {/* Welcome banner highlighting the tagline and actions */}
      {showWelcome && (
        <HeroWelcomeOverlay
          stats={communityStats}
          onExploreCity={() => setShowWelcome(false)}
          onConnectGitHub={() => setShowConnectPreview(true)}
          onFocusCreatorTree={handleFocusCreatorTree}
        />
      )}

      {/* Selected tree details drawer / bottom-sheet */}
      {selectedTree && (
        <TreeDetailsPanel tree={selectedTree} onClose={() => setSelectedTree(null)} />
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
    </main>
  )
}
