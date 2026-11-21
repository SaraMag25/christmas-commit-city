import { useMemo, useState } from 'react'
import {
  Check,
  Compass,
  ExternalLink,
  Gift,
  Heart,
  MessageSquare,
  Share2,
  Sparkles,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AvatarBadge } from '../components/common/AvatarBadge'
import { GiftCatalogPreviewModal } from '../components/gifts/GiftCatalogPreviewModal'
import { SubpageLayout } from '../components/layout/SubpageLayout'
import { ContributionCalendarPreview } from '../components/tree/ContributionCalendarPreview'
import { TreePixelCanvas } from '../components/tree/TreePixelCanvas'
import { STANDARD_CONTRIBUTION_YEAR } from '../config/githubPeriod'
import { CREATOR_CAMPAIGN } from '../config/pixCampaign'
import { resolveTreeStage, TREE_STAGES } from '../config/treeLevels'
import { useCity } from '../context/cityContextStore'
import { getMessagesByTreeId } from '../data/mockCityData'

export function TreeProfilePage() {
  const { trees } = useCity()
  const { username = '' } = useParams<{ username: string }>()
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [copied, setCopied] = useState(false)

  const tree = useMemo(() => {
    const normalized = username.trim().toLowerCase()
    return trees.find((t) => t.profile.github_username.toLowerCase() === normalized)
  }, [trees, username])
  const messages = useMemo(() => (tree ? getMessagesByTreeId(tree.id) : []), [tree])

  const shareUrl = `${window.location.origin}/tree/${tree?.profile.github_username ?? username}`

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
            <span>Localizar na Cidade</span>
          </Link>
        ) : undefined
      }
    >
      {!tree || !currentStage ? (
        <section className="pixel-wood-panel rounded-sm p-8 text-center">
          <h1 className="font-pixel-title text-base text-amber-300">Árvore não encontrada</h1>
          <p className="mt-3 text-sm text-amber-100/90">
            Ainda não existe uma árvore plantada para <strong>@{username}</strong> na vila.
          </p>
          <Link
            to="/"
            className="pixel-btn pixel-btn-gold mt-5 inline-flex rounded-sm px-5 py-2.5 text-xs font-bold"
          >
            Explorar Árvores da Vila
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Left Showcase: 3D Pixel-Art Tree + Quick Share */}
          <section className="flex flex-col items-center pixel-night-panel rounded-md p-5">
            <div className="relative flex w-full flex-col items-center justify-center rounded-sm border border-slate-800 bg-gradient-to-b from-[#040811] via-[#0a1324] to-[#0f2e24]/40 p-5">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-sm border border-emerald-500/30 bg-[#040811]/90 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                <Sparkles className="h-3 w-3 text-amber-300" />
                <span>
                  {tree.is_creator_special
                    ? '★ árvore especial ufc'
                    : `nv.${String(currentStage.level).padStart(2, '0')} · ${currentStage.name}`}
                </span>
              </div>

              <TreePixelCanvas tree={tree} scale={5} className="my-2" />

              <p className="mt-2 text-sm font-semibold text-slate-200">
                @{tree.profile.github_username}
              </p>
            </div>

            <div className="mt-4 flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowGiftModal(true)}
                className="pixel-btn pixel-btn-red w-full rounded-sm px-4 py-2.5 text-xs font-bold"
              >
                <Gift className="h-4 w-4" />
                <span>Presentear esta Árvore</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="pixel-btn pixel-btn-gold w-full rounded-sm px-4 py-2 text-xs font-bold"
              >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                <span>{copied ? 'Link copiado!' : 'Copiar link da árvore'}</span>
              </button>
            </div>

            {/* Social Share Links */}
            <div className="mt-4 w-full border-t border-amber-500/25 pt-3">
              <p className="text-center text-[10px] uppercase tracking-wide text-slate-400">
                Compartilhar nas redes
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px]">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `Veja a árvore de @${tree.profile.github_username} na Christmas Commit City!`,
                  )}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-sm border border-slate-700 bg-[#0d1833] py-1.5 text-sky-300 hover:border-sky-400"
                >
                  X / Twitter
                </a>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Olha essa árvore na Christmas Commit City: ${shareUrl}`,
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

          {/* Right Column: Developer Profile, Contributions, Gifts & Visitor Messages */}
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
                      href={`https://github.com/${tree.profile.github_username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                    >
                      <span>[ view github profile ]</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="rounded-sm border border-slate-800 bg-[#040811]/90 px-4 py-2.5 text-right">
                  <p className="text-[10px] text-slate-400">
                    commits ({STANDARD_CONTRIBUTION_YEAR})
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-emerald-400">
                    {tree.contribution_count.toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-sm border border-slate-800 bg-[#040811]/85 p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ color: currentStage.accentColor }} className="font-semibold">
                    {currentStage.name} ({currentStage.badgeLabel})
                  </span>
                  <span className="text-slate-400">
                    {nextStage
                      ? `${Math.max(0, nextStage.minContributions - tree.contribution_count)} commits para ${nextStage.name}`
                      : 'Estágio máximo'}
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
                <div className="mt-4 rounded-sm border-2 border-amber-400/70 bg-[#0d1833]/90 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Heart className="h-4 w-4 fill-rose-500 text-rose-400" />
                    {CREATOR_CAMPAIGN.title}
                  </p>
                  <p className="mt-2 font-pixel-body text-xl leading-snug text-amber-50">
                    &ldquo;{CREATOR_CAMPAIGN.message}&rdquo;
                  </p>
                </div>
              )}
            </section>

            {/* GitHub GraphQL Activity Breakdown & Contribution Calendar */}
            <ContributionCalendarPreview
              stats={tree.stats}
              fallbackTotal={tree.contribution_count}
            />

            <section className="pixel-night-panel rounded-sm p-5">
              <div className="flex items-center justify-between border-b border-amber-500/30 pb-2.5">
                <h2 className="flex items-center gap-2 text-xs font-bold text-rose-300">
                  <Gift className="h-4 w-4" />
                  Presentes recebidos ({tree.gifts.length})
                </h2>
                <span className="text-[10px] text-slate-400">
                  Separados das estatísticas de commits
                </span>
              </div>

              {tree.gifts.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">
                  Nenhum presente recebido ainda. Use o botão ao lado para conhecer o catálogo!
                </p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {tree.gifts.map((gift) => (
                    <div
                      key={gift.id}
                      className="flex items-center justify-between rounded-sm border border-slate-700 bg-[#070d1f]/85 px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-bold text-amber-200">{gift.gift_name}</p>
                        <p className="text-[10px] text-slate-400">Enviado por {gift.sender_name}</p>
                      </div>
                      <span className="rounded-sm bg-[#15244a] px-2 py-0.5 text-[10px] uppercase text-sky-300">
                        {gift.rarity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="pixel-night-panel rounded-sm p-5">
              <h2 className="flex items-center gap-2 border-b border-amber-500/30 pb-2.5 text-xs font-bold text-emerald-300">
                <MessageSquare className="h-4 w-4" />
                Mensagens de visitantes ({messages.length})
              </h2>

              {messages.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">
                  Ainda não há recados nesta árvore. O mural interativo será conectado na Fase 6.
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {messages.map((msg) => (
                    <li
                      key={msg.id}
                      className="rounded-sm border border-[#8c5835] bg-[#3b2110]/60 p-3"
                    >
                      <p className="text-xs font-bold text-amber-300">{msg.sender_name}</p>
                      <p className="mt-1 font-pixel-body text-xl leading-snug text-amber-50">
                        &ldquo;{msg.message}&rdquo;
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {showGiftModal && tree && (
        <GiftCatalogPreviewModal
          recipientUsername={tree.profile.github_username}
          onClose={() => setShowGiftModal(false)}
        />
      )}
    </SubpageLayout>
  )
}
