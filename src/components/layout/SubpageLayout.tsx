import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { computeCommunityStats, MOCK_CITY_TREES } from '../../data/mockCityData'
import { CityHeader } from '../hud/CityHeader'
import { GitHubConnectPreviewModal } from '../panels/GitHubConnectPreviewModal'
import { HowItWorksModal } from '../panels/HowItWorksModal'

interface SubpageLayoutProps {
  maxWidthClass?: string
  topRightAction?: ReactNode
  children: ReactNode
}

export function SubpageLayout({
  maxWidthClass = 'max-w-5xl',
  topRightAction,
  children,
}: SubpageLayoutProps) {
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const communityStats = useMemo(() => computeCommunityStats(MOCK_CITY_TREES), [])

  return (
    <div className="min-h-screen bg-[#070d1f] pb-16 pt-24 text-slate-100 sm:pt-28">
      <CityHeader
        stats={communityStats}
        onOpenConnectModal={() => setShowConnectModal(true)}
        onOpenHowItWorks={() => setShowHowItWorks(true)}
      />

      <main className={`mx-auto px-4 ${maxWidthClass}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/"
            className="pixel-btn pixel-btn-wood rounded-sm px-3 py-1.5 text-xs font-bold"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar à Cidade</span>
          </Link>

          {topRightAction}
        </div>

        {children}
      </main>

      {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
      {showConnectModal && (
        <GitHubConnectPreviewModal onClose={() => setShowConnectModal(false)} />
      )}
    </div>
  )
}
