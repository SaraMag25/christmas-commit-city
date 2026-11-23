import { useState, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLocale } from '../../context/localeContextStore'
import { CityHeader } from '../hud/CityHeader'
import { GitHubConnectModal } from '../panels/GitHubConnectModal'
import { HowItWorksModal } from '../panels/HowItWorksModal'
import { SupportCampaignModal } from '../panels/SupportCampaignModal'

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
  const { t } = useLocale()
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)

  return (
    <div
      className="min-h-screen bg-[#070d1f] pb-16 pt-24 text-slate-100 sm:pt-28"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(16, 185, 129, 0.12), transparent 40%), radial-gradient(circle at 80% 15%, rgba(251, 191, 36, 0.1), transparent 36%), radial-gradient(circle at 50% 85%, rgba(15, 46, 36, 0.35), transparent 55%)',
      }}
    >
      <CityHeader
        onOpenConnectModal={() => setShowConnectModal(true)}
        onOpenHowItWorks={() => setShowHowItWorks(true)}
        onOpenSupport={() => setShowSupportModal(true)}
      />

      <main className={`mx-auto px-4 ${maxWidthClass}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/"
            className="pixel-btn pixel-btn-wood rounded-sm px-3 py-1.5 text-xs font-bold"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.subpage.backToCity}</span>
          </Link>

          {topRightAction}
        </div>

        {children}
      </main>

      {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
      {showConnectModal && <GitHubConnectModal onClose={() => setShowConnectModal(false)} />}
      {showSupportModal && <SupportCampaignModal onClose={() => setShowSupportModal(false)} />}
    </div>
  )
}
