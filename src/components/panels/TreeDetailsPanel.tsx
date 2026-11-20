import { useState } from 'react'
import { Check, ExternalLink, Gift, Heart, Share2, Sparkles, Trees, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CREATOR_CAMPAIGN } from '../../config/pixCampaign'
import { resolveTreeStage } from '../../config/treeLevels'
import type { CityTree } from '../../types/city'
import { AvatarBadge } from '../common/AvatarBadge'

interface TreeDetailsPanelProps {
  tree: CityTree
  onClose: () => void
  onOpenGiftCatalog: (tree: CityTree) => void
}

export function TreeDetailsPanel({
  tree,
  onClose,
  onOpenGiftCatalog,
}: TreeDetailsPanelProps) {
  const [copied, setCopied] = useState(false)
  const stage = resolveTreeStage(tree.contribution_count)

  const handleCopyShareLink = async () => {
    const shareUrl = `${window.location.origin}/tree/${tree.profile.github_username}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard may be blocked in restricted browsers; fallback silently.
    }
  }

  return (
    <aside
      aria-label={`Detalhes da árvore de ${tree.profile.github_username}`}
      className="fixed inset-x-3 bottom-14 z-30 max-h-[75vh] overflow-y-auto pixel-night-panel rounded-sm p-4 sm:inset-x-auto sm:bottom-16 sm:right-4 sm:top-24 sm:w-96 sm:max-h-none"
    >
      <div className="flex items-start justify-between gap-3 border-b border-amber-500/30 pb-3">
        <div className="flex items-center gap-3">
          <AvatarBadge
            key={tree.profile.github_username}
            username={tree.profile.github_username}
            name={tree.profile.github_name}
            avatarUrl={tree.profile.avatar_url}
          />
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-sm font-bold text-amber-200">{tree.profile.github_name}</h2>
              {tree.is_creator_special && (
                <span className="rounded-sm bg-sky-500/25 px-1.5 py-0.5 text-[10px] font-bold text-sky-200">
                  ★ CRIADORA UFC
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300">@{tree.profile.github_username}</p>
            <a
              href={`https://github.com/${tree.profile.github_username}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-300 hover:underline"
            >
              <span>Ver perfil no GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel da árvore"
          className="rounded-sm border border-amber-400/30 p-1 text-slate-300 hover:bg-amber-400/10 hover:text-white cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Stage & Contributions */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-sm border border-emerald-500/30 bg-[#0f2e24]/70 p-2.5">
          <p className="text-[10px] text-emerald-200/80">
            Contribuições ({tree.stats?.periodYear ?? 2026})
          </p>
          <p className="mt-1 font-pixel-title text-base text-amber-300">
            {tree.contribution_count}
          </p>
          {tree.stats && (
            <p className="mt-1 text-[10px] text-emerald-200/85">
              {tree.stats.commits} commits · {tree.stats.pullRequests} PRs · {tree.stats.issues}{' '}
              issues
            </p>
          )}
        </div>
        <div className="rounded-sm border border-amber-500/30 bg-[#15244a]/70 p-2.5">
          <p className="text-[10px] text-amber-200/80">Nível da árvore</p>
          <p className="mt-1 text-xs font-bold" style={{ color: stage.accentColor }}>
            Nv. {stage.level} · {stage.name}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {stage.visualFeatures.map((feature) => (
          <span
            key={feature}
            className="inline-flex items-center gap-1 rounded-sm border border-slate-600/70 bg-[#070d1f]/80 px-2 py-0.5 text-[10px] text-slate-200"
          >
            <Sparkles className="h-2.5 w-2.5 text-amber-300" />
            {feature}
          </span>
        ))}
      </div>

      {/* Creator UFC Campaign Special Box */}
      {tree.is_creator_special ? (
        <div className="mt-4 rounded-sm border-2 border-amber-400/70 bg-gradient-to-b from-[#174636]/70 to-[#0d1833]/90 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Heart className="h-4 w-4 fill-rose-500 text-rose-400" />
            <span>{CREATOR_CAMPAIGN.title}</span>
          </div>
          <p className="mt-2 font-pixel-body text-lg leading-snug text-amber-50">
            &ldquo;{CREATOR_CAMPAIGN.message}&rdquo;
          </p>
          <p className="mt-2 text-[10px] text-sky-200/90">
            QR Code Pix e barra de progresso da campanha serão integrados na Fase 7.
          </p>
        </div>
      ) : (
        tree.custom_message && (
          <div className="mt-4 rounded-sm border border-[#8c5835] bg-[#3b2110]/70 p-3">
            <p className="text-[10px] text-amber-200/80">Mensagem natalina</p>
            <p className="mt-1 font-pixel-body text-lg leading-snug text-amber-50">
              &ldquo;{tree.custom_message}&rdquo;
            </p>
          </div>
        )
      )}

      {/* Gifts Received */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-bold text-rose-300">
            <Gift className="h-3.5 w-3.5" />
            Presentes recebidos ({tree.gifts.length})
          </span>
          <span className="text-[10px] text-slate-400">Não alteram commits</span>
        </div>

        {tree.gifts.length === 0 ? (
          <p className="mt-2 rounded-sm border border-dashed border-slate-600/80 p-2.5 text-[11px] text-slate-400">
            Esta árvore ainda não recebeu presentes.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {tree.gifts.map((gift) => (
              <li
                key={gift.id}
                className="flex items-center justify-between rounded-sm border border-slate-700 bg-[#070d1f]/80 px-2.5 py-1.5 text-[11px]"
              >
                <div>
                  <span className="font-bold text-amber-200">{gift.gift_name}</span>
                  <span className="ml-1.5 text-slate-400">por {gift.sender_name}</span>
                </div>
                <span className="rounded-sm bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase text-sky-300">
                  {gift.category === 'special' ? 'Especial' : 'Gratuito'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to={`/tree/${tree.profile.github_username}`}
          className="pixel-btn pixel-btn-pine rounded-sm px-3 py-2 text-[11px] font-bold"
        >
          <Trees className="h-3.5 w-3.5" />
          <span>Página da Árvore</span>
        </Link>

        <button
          type="button"
          onClick={() => onOpenGiftCatalog(tree)}
          className="pixel-btn pixel-btn-red rounded-sm px-3 py-2 text-[11px] font-bold"
        >
          <Gift className="h-3.5 w-3.5" />
          <span>Presentear</span>
        </button>

        <button
          type="button"
          onClick={handleCopyShareLink}
          className="pixel-btn pixel-btn-wood col-span-2 rounded-sm px-3 py-1.5 text-[11px]"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Share2 className="h-3.5 w-3.5" />}
          <span>{copied ? 'Link copiado!' : 'Copiar link compartilhável'}</span>
        </button>
      </div>
    </aside>
  )
}
