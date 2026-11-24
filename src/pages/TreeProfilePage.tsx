import { useMemo, useState } from 'react'
import {
  Check,
  Compass,
  ExternalLink,
  Gift,
  Heart,
  PawPrint,
  Share2,
  Sparkles,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AvatarBadge } from '../components/common/AvatarBadge'
import { CompanionShopModal } from '../components/companions/CompanionShopModal'
import { GiftCatalogPreviewModal } from '../components/gifts/GiftCatalogPreviewModal'
import { TreeGiftsSection } from '../components/gifts/TreeGiftsSection'
import { isViewerTreeOwner } from '../utils/treeOwnership'
import { SubpageLayout } from '../components/layout/SubpageLayout'
import { SupportCampaignModal } from '../components/panels/SupportCampaignModal'
import { ContributionCalendarPreview } from '../components/tree/ContributionCalendarPreview'
import { TreePixelCanvas } from '../components/tree/TreePixelCanvas'
import { getSpeciesById, resolveCompanionDisplayName } from '../config/companions'
import { STANDARD_CONTRIBUTION_YEAR } from '../config/githubPeriod'
import { resolveTreeStage, TREE_STAGES } from '../config/treeLevels'
import { useCity } from '../context/cityContextStore'
import { useLocale } from '../context/localeContextStore'
import {
  SPECIES_COPY,
  TREE_STAGE_COPY,
} from '../i18n/translations'

export function TreeProfilePage() {
  const { trees, currentUserTree, isSupabaseReady, isLoadingTrees } = useCity()
  const { language, t } = useLocale()
  const { username = '' } = useParams<{ username: string }>()
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [showCompanionModal, setShowCompanionModal] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [copied, setCopied] = useState(false)

  const tree = useMemo(() => {
    const normalized = username.trim().toLowerCase()
    return trees.find((tItem) => tItem.profile.github_username.toLowerCase() === normalized)
  }, [trees, username])

  const shareUrl = `${window.location.origin}/tree/${encodeURIComponent(tree?.profile.github_username ?? username)}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Ignore clipboard failures in restricted environments.
    }
  }

  const nextStage = tree
    ? TREE_STAGES.find((stage) => stage.level === tree.tree_level + 1) ?? null
    : null
  const currentStage = tree ? resolveTreeStage(tree.contribution_count) : null
  const currentStageCopy = currentStage ? TREE_STAGE_COPY[language][currentStage.level] : null
  const nextStageCopy = nextStage ? TREE_STAGE_COPY[language][nextStage.level] : null

  const companionSpecies = getSpeciesById(tree?.companion?.species)
  const companionSpeciesCopy = companionSpecies
    ? SPECIES_COPY[language][companionSpecies.id]
    : null
  const companionName = companionSpecies && companionSpeciesCopy
    ? resolveCompanionDisplayName(
        companionSpecies.id,
        tree?.companion?.customName,
        companionSpeciesCopy.defaultName,
      )
    : null

  const isOwnTree = tree ? isViewerTreeOwner(tree, currentUserTree, isSupabaseReady) : false
  const canCustomizeCompanion = Boolean(tree) && (!isSupabaseReady || isOwnTree)

  const progressPercent =
    tree && nextStage && currentStage
      ? Math.min(
          100,
          Math.max(
            6,
            Math.round(
              ((tree.contribution_count - currentStage.minContributions) /
                Math.max(1, nextStage.minContributions - currentStage.minContributions)) *
                100,
            ),
          ),
        )
      : 100

  return (
    <SubpageLayout
      maxWidthClass="max-w-5xl"
      topRightAction={
        tree ? (
          <Link
            to={`/?focus=${encodeURIComponent(tree.profile.github_username)}`}
            className="pixel-btn pixel-btn-pine rounded-sm px-3 py-1.5 text-xs font-bold"
          >
            <Compass className="h-4 w-4" />
            <span>{t.profile.locateInCity}</span>
          </Link>
        ) : undefined
      }
    >
      {isLoadingTrees && !tree ? (
        <section className="pixel-night-panel rounded-sm p-8 text-center">
          <p className="text-xs text-emerald-300">{t.profile.loadingTrees}</p>
        </section>
      ) : !tree || !currentStage || !currentStageCopy ? (
        <section className="pixel-wood-panel rounded-sm p-8 text-center">
          <h1 className="font-pixel-title text-base text-amber-300">{t.profile.notFoundTitle}</h1>
          <p className="mt-3 text-sm text-amber-100/90">
            {t.profile.notFoundDesc} <strong>@{username}</strong>.
          </p>
          <Link
            to="/"
            className="pixel-btn pixel-btn-gold mt-5 inline-flex rounded-sm px-5 py-2.5 text-xs font-bold"
          >
            {t.profile.exploreCta}
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <section className="flex flex-col items-center pixel-night-panel rounded-md p-5">
            <div className="relative flex w-full flex-col items-center justify-center rounded-sm border border-slate-800 bg-gradient-to-b from-[#040811] via-[#0a1324] to-[#0f2e24]/40 p-5">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-sm border border-emerald-500/30 bg-[#040811]/90 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                <Sparkles className="h-3 w-3 text-amber-300" />
                <span>
                  {tree.is_creator_special
                    ? t.profile.specialBadge
                    : `lv.${String(currentStage.level).padStart(2, '0')} · ${currentStageCopy.name}`}
                </span>
              </div>

              <TreePixelCanvas tree={tree} scale={5} className="my-2" />

              <p className="mt-2 text-sm font-semibold text-slate-200">
                @{tree.profile.github_username}
              </p>
            </div>

            {/* Companion Summary Box (visible to all visitors) */}
            <div className="mt-3 w-full rounded-sm border border-slate-800 bg-[#040811]/85 p-3 text-left text-[11px]">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                {t.profile.companionActiveLabel}
              </p>
              <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                <PawPrint className="h-3.5 w-3.5 text-amber-300" />
                <span>{companionName ?? t.profile.noPet}</span>
              </span>
            </div>

            <div className="mt-4 flex w-full flex-col gap-2 border-t border-slate-800/80 pt-3">
              <p className="text-center text-[10px] uppercase tracking-wide text-slate-400">
                {t.profile.actionsLabel}
              </p>

              {canCustomizeCompanion && (
                <button
                  type="button"
                  onClick={() => setShowCompanionModal(true)}
                  className="pixel-btn pixel-btn-pine w-full rounded-sm px-4 py-2.5 text-xs font-bold"
                >
                  <PawPrint className="h-4 w-4 text-amber-300" />
                  <span>
                    {companionSpecies ? t.profile.customizePet : t.profile.adoptPet}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowGiftModal(true)}
                className="pixel-btn pixel-btn-red w-full rounded-sm px-4 py-2.5 text-xs font-bold"
              >
                <Gift className="h-4 w-4" />
                <span>{isOwnTree ? t.profile.giftMyTree : t.profile.giftTree}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="pixel-btn pixel-btn-gold w-full rounded-sm px-4 py-2 text-xs font-bold"
              >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                <span>{copied ? t.profile.linkCopied : t.profile.copyLink}</span>
              </button>
            </div>

            <div className="mt-4 w-full border-t border-amber-500/25 pt-3">
              <p className="text-center text-[10px] uppercase tracking-wide text-slate-400">
                {t.profile.shareSocial}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px]">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `Check out @${tree.profile.github_username}'s tree in Christmas Commit City!`,
                  )}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-sm border border-slate-700 bg-[#0d1833] py-1.5 text-sky-300 hover:border-sky-400"
                >
                  X / Twitter
                </a>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Christmas Commit City: ${shareUrl}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-sm border border-slate-700 bg-[#0d1833] py-1.5 text-emerald-300 hover:border-emerald-400"
                >
                  WhatsApp
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                    shareUrl,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-sm border border-slate-700 bg-[#0d1833] py-1.5 text-amber-200 hover:border-amber-400"
                >
                  LinkedIn
                </a>
              </div>
            </div>
          </section>

          <div className="space-y-5">
            <section className="pixel-night-panel rounded-md p-5">
              <p className="mb-3 text-[11px] text-emerald-400">
                $ tree inspect @{tree.profile.github_username}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <AvatarBadge
                    key={tree.profile.github_username}
                    username={tree.profile.github_username}
                    name={tree.profile.github_name}
                    avatarUrl={tree.profile.avatar_url}
                    size="lg"
                  />
                  <div>
                    <h1 className="text-base font-bold text-slate-100">
                      {tree.profile.github_name}
                    </h1>
                    <p className="mt-0.5 text-xs text-slate-400">
                      @{tree.profile.github_username}
                    </p>
                    <a
                      href={`https://github.com/${encodeURIComponent(tree.profile.github_username)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                    >
                      <span>{t.treePanel.viewGithub}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="rounded-sm border border-slate-800 bg-[#040811]/90 px-4 py-2.5 text-right">
                  <p className="text-[10px] text-slate-400">
                    commits ({STANDARD_CONTRIBUTION_YEAR})
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-emerald-400">
                    {tree.contribution_count.toLocaleString(language)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-sm border border-slate-800 bg-[#040811]/85 p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ color: currentStage.accentColor }} className="font-semibold">
                    {currentStageCopy.name} ({currentStageCopy.badgeLabel})
                  </span>
                  <span className="text-slate-400">
                    {nextStage && nextStageCopy
                      ? `${Math.max(0, nextStage.minContributions - tree.contribution_count)} ${t.profile.commitsLeftFor} ${nextStageCopy.name}`
                      : t.profile.maxStage}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-slate-900">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-amber-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {tree.is_creator_special && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowSupportModal(true)}
                    className="pixel-btn pixel-btn-gold rounded-sm px-4 py-2 text-xs font-bold"
                  >
                    <Heart className="h-3.5 w-3.5" />
                    <span>{t.profile.supportCampaignBtn}</span>
                  </button>
                </div>
              )}
            </section>

            <ContributionCalendarPreview
              stats={tree.stats}
              fallbackTotal={tree.contribution_count}
            />

            <section className="pixel-night-panel rounded-sm p-5">
              <div className="flex items-center justify-between border-b border-amber-500/30 pb-2.5">
                <h2 className="flex items-center gap-2 text-xs font-bold text-rose-300">
                  <Gift className="h-4 w-4" />
                  {t.profile.giftsTitle} ({tree.gifts.length})
                </h2>
                <span className="text-[10px] text-slate-400">{t.profile.giftsNote}</span>
              </div>

              <TreeGiftsSection tree={tree} isOwner={isOwnTree} />
            </section>
          </div>
        </div>
      )}

      {showGiftModal && tree && (
        <GiftCatalogPreviewModal
          recipientUsername={tree.profile.github_username}
          isOwnTree={isOwnTree}
          onClose={() => setShowGiftModal(false)}
        />
      )}
      {showCompanionModal && tree && (
        <CompanionShopModal
          tree={tree}
          onClose={() => setShowCompanionModal(false)}
        />
      )}
      {showSupportModal && tree && (
        <SupportCampaignModal
          targetUsername={tree.profile.github_username}
          onClose={() => setShowSupportModal(false)}
        />
      )}
    </SubpageLayout>
  )
}
