import { Gift, Sparkles, X } from 'lucide-react'
import { MOCK_GIFTS_CATALOG } from '../../data/mockCityData'

interface GiftCatalogPreviewModalProps {
  recipientUsername: string
  onClose: () => void
}

export function GiftCatalogPreviewModal({
  recipientUsername,
  onClose,
}: GiftCatalogPreviewModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Catálogo de presentes para @${recipientUsername}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs sm:p-6"
    >
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto pixel-wood-panel rounded-sm p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#8c5835] pb-3">
          <div>
            <h2 className="flex items-center gap-2 font-pixel-title text-xs text-amber-300 sm:text-sm">
              <Gift className="h-4 w-4 text-rose-400" />
              Presentear @{recipientUsername}
            </h2>
            <p className="mt-1 font-pixel-body text-xl text-amber-100">
              Presentes decoram a árvore visualmente sem alterar commits ou nível.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar catálogo"
            className="rounded-sm border border-amber-400/40 bg-[#261409] p-1 text-amber-200 hover:bg-amber-500/20 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {MOCK_GIFTS_CATALOG.map((gift) => (
            <div
              key={gift.id}
              className="flex flex-col justify-between rounded-sm border border-[#8c5835] bg-[#070d1f]/85 p-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="flex items-center gap-1.5 text-xs font-bold"
                    style={{ color: gift.accentColor }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {gift.name}
                  </span>
                  <span
                    className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      gift.category === 'special'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {gift.category === 'special' ? `Especial · R$ ${gift.price}` : 'Gratuito'}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-300">{gift.description}</p>
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">
                Raridade: {gift.rarity}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-sm border border-sky-400/35 bg-[#0d1833]/90 p-3 sm:flex-row sm:items-center">
          <p className="text-[11px] text-sky-100">
            O envio interativo e persistente no Supabase (gratuitos + especiais via Pix) será
            habilitado nas Fases 6 e 7.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn pixel-btn-gold shrink-0 rounded-sm px-4 py-1.5 text-xs font-bold"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
