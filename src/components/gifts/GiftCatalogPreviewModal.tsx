import { useMemo, useState } from 'react'
import { Check, CreditCard, Eye, Gift, Loader2, QrCode, Sparkles, X } from 'lucide-react'
import { normalizeGiftSlug, resolveGiftUsdPrice } from '../../config/gifts'
import { formatCurrencyPrice } from '../../config/supportCampaign'
import { useCity } from '../../context/cityContextStore'
import { useLocale } from '../../context/localeContextStore'
import { MOCK_GIFTS_CATALOG } from '../../data/mockCityData'
import { GIFT_CATALOG_COPY } from '../../i18n/translations'
import {
  createPixPayment,
  createStripeCheckout,
  type PixPaymentOrder,
} from '../../services/paymentService'
import type { CityTree, GiftItem, TreeGiftSummary } from '../../types/city'
import { GitHubIcon } from '../icons/GitHubIcon'
import { PixCheckoutBox } from '../payments/PixCheckoutBox'
import { TreePixelCanvas } from '../tree/TreePixelCanvas'

interface GiftCatalogPreviewModalProps {
  recipientUsername: string
  isOwnTree?: boolean
  onClose: () => void
}

export function GiftCatalogPreviewModal({
  recipientUsername,
  isOwnTree = false,
  onClose,
}: GiftCatalogPreviewModalProps) {
  const {
    trees,
    currentUserTree,
    session,
    isSupabaseReady,
    connectWithGitHub,
    sendGiftToTree,
    refreshCityState,
  } = useCity()
  const { currency, setCurrency, language, t } = useLocale()
  const [selectedGiftId, setSelectedGiftId] = useState<string>(MOCK_GIFTS_CATALOG[0]?.id ?? '')
  const [showWithPreview, setShowWithPreview] = useState(true)
  const [recentGiftName, setRecentGiftName] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [pixOrder, setPixOrder] = useState<PixPaymentOrder | null>(null)

  const targetTree = useMemo(() => {
    const norm = recipientUsername.trim().toLowerCase()
    return trees.find((item) => item.profile.github_username.toLowerCase() === norm) ?? null
  }, [trees, recipientUsername])

  const selectedGift = useMemo<GiftItem>(
    () => MOCK_GIFTS_CATALOG.find((g) => g.id === selectedGiftId) ?? MOCK_GIFTS_CATALOG[0],
    [selectedGiftId],
  )

  const countsBySlug = useMemo(() => {
    const map: Record<string, number> = {}
    if (!targetTree) return map
    for (const g of targetTree.gifts) {
      const normalized = normalizeGiftSlug(g.gift_slug)
      map[normalized] = (map[normalized] ?? 0) + 1
    }
    return map
  }, [targetTree])

  const selectedCopy = GIFT_CATALOG_COPY[language][selectedGift.slug]
  const selectedName = selectedCopy?.name ?? selectedGift.name
  const selectedDesc = selectedCopy?.description ?? selectedGift.description
  const selectedUsdApprox = resolveGiftUsdPrice(selectedGift)
  const selectedFormattedPrice = formatCurrencyPrice(
    currency === 'BRL' ? selectedGift.price : selectedUsdApprox,
    currency,
  )
  const selectedExistingCount = countsBySlug[selectedGift.slug] ?? 0

  // Inject the selected item temporarily into a derived tree object without mutating CityProvider state
  const previewTree = useMemo<CityTree | null>(() => {
    if (!targetTree) return null
    if (!showWithPreview || !selectedGift) return targetTree

    const tempGift: TreeGiftSummary = {
      id: `preview-${selectedGift.id}`,
      gift_id: selectedGift.id,
      gift_slug: selectedGift.slug,
      gift_name: selectedGift.name,
      category: selectedGift.category,
      rarity: selectedGift.rarity,
      sender_name: 'preview',
      created_at: targetTree.last_synced_at,
    }

    return {
      ...targetTree,
      gifts: [...targetTree.gifts, tempGift],
    }
  }, [targetTree, selectedGift, showWithPreview])

  const handleConfirmGift = async () => {
    setActionError(null)
    setRecentGiftName(null)
    setIsSending(true)
    try {
      if (isSupabaseReady && selectedGift.category === 'special') {
        if (!session) {
          await connectWithGitHub()
          return
        }
        if (!targetTree) {
          setActionError('Árvore destinatária não encontrada.')
          return
        }

        if (currency === 'BRL') {
          const order = await createPixPayment({
            itemId: selectedGift.id,
            targetTreeId: targetTree.id,
          })
          setPixOrder(order)
        } else {
          const stripe = await createStripeCheckout({
            itemId: selectedGift.id,
            targetTreeId: targetTree.id,
          })
          window.location.assign(stripe.checkoutUrl)
        }
        return
      }

      const senderLabel = isOwnTree
        ? currentUserTree
          ? `@${currentUserTree.profile.github_username}`
          : `@${recipientUsername}`
        : currentUserTree
          ? `@${currentUserTree.profile.github_username}`
          : language === 'en'
            ? 'Community Dev'
            : 'Dev da Comunidade'

      const result = await sendGiftToTree(recipientUsername, selectedGift, senderLabel)
      if (result.ok) {
        setRecentGiftName(selectedName)
        setShowWithPreview(true)
      } else if (result.error) {
        setActionError(result.error)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao iniciar pagamento.')
    } finally {
      setIsSending(false)
    }
  }

  const handleGiftPixConfirmed = async () => {
    await refreshCityState()
    setPixOrder(null)
    setRecentGiftName(selectedName)
    setShowWithPreview(true)
  }

  const headerTitle = isOwnTree
    ? t.giftModal.titleOwn
    : `${t.giftModal.title} @${recipientUsername}`

  const confirmLabel =
    selectedGift.category === 'special'
      ? `${t.giftModal.giftSpecialBtn} (${selectedFormattedPrice})`
      : isOwnTree
        ? t.giftModal.addToMyTreeBtn
        : t.giftModal.placeGiftBtn

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={headerTitle}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-xs sm:p-6"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto pixel-wood-panel rounded-sm p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#8c5835] pb-3">
          <div>
            <h2 className="flex items-center gap-2 font-pixel-title text-xs text-amber-300 sm:text-sm">
              <Gift className="h-4 w-4 text-rose-400" />
              {headerTitle}
            </h2>
            <p className="mt-1 font-pixel-body text-xl text-amber-100">
              {isOwnTree ? t.giftModal.subtitleOwn : t.giftModal.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Currency selector"
              className="flex rounded-sm border border-amber-400/35 bg-[#040811] p-0.5 text-[10px]"
            >
              <button
                type="button"
                onClick={() => {
                  setCurrency('BRL')
                  setPixOrder(null)
                  setActionError(null)
                }}
                className={`rounded-[2px] px-2 py-1 font-semibold transition cursor-pointer ${
                  currency === 'BRL'
                    ? 'bg-emerald-500/25 text-emerald-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.shop.currencyBrlLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrency('USD')
                  setPixOrder(null)
                  setActionError(null)
                }}
                className={`rounded-[2px] px-2 py-1 font-semibold transition cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-sky-500/25 text-sky-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.shop.currencyUsdLabel}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t.home.close}
              className="rounded-sm border border-amber-400/40 bg-[#261409] p-1 text-amber-200 hover:bg-amber-500/20 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {recentGiftName && (
          <div
            role="status"
            className="mt-3 flex items-center gap-2 rounded-sm border border-emerald-400/45 bg-emerald-950/75 px-3 py-2 text-xs text-emerald-200"
          >
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              <strong>{recentGiftName}:</strong> {t.giftModal.placedFeedback}
            </span>
          </div>
        )}

        {/* Two-column layout: Live 3D Preview (left) + Clickable Gift Catalog (right) */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[316px_1fr] lg:items-start">
          {/* Column 1: Sticky 3D Live Preview & Confirmation Action */}
          <aside className="flex flex-col items-center rounded-sm border border-[#8c5835] bg-[#060c1a]/95 p-3.5 lg:sticky lg:top-0">
            <div className="flex w-full items-center justify-between gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-500/35 bg-emerald-950/60 px-1.5 py-0.5 font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {t.giftModal.livePreview}
              </span>
              <span
                className="truncate font-semibold"
                style={{ color: showWithPreview ? selectedGift.accentColor : '#94a3b8' }}
              >
                {showWithPreview
                  ? `${t.giftModal.previewingLabel} ${selectedName}`
                  : t.giftModal.currentTreeLabel}
              </span>
            </div>

            <div className="mt-2.5 flex w-full flex-col items-center justify-center rounded-sm border border-slate-800/90 bg-gradient-to-b from-[#0a1633] via-[#102247] to-[#1a325c] p-2">
              {previewTree && (
                <TreePixelCanvas tree={previewTree} scale={5} interactive={false} />
              )}
            </div>

            <div className="mt-2 flex w-full justify-end">
              <button
                type="button"
                onClick={() => setShowWithPreview((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-sm border border-slate-700 bg-[#040811] px-2.5 py-1 text-[10px] font-medium text-slate-300 transition hover:border-amber-400/50 hover:text-amber-200 cursor-pointer"
              >
                <Eye className="h-3 w-3 text-amber-300" />
                <span>
                  {showWithPreview ? t.giftModal.compareCurrent : t.giftModal.compareWithPreview}
                </span>
              </button>
            </div>

            {/* Selected Gift Summary + Confirm Action */}
            <div className="mt-2.5 w-full rounded-sm border border-amber-500/35 bg-[#040811]/95 p-3">
              <div className="flex items-start justify-between gap-2">
                <p
                  className="flex items-center gap-1.5 text-xs font-bold"
                  style={{ color: selectedGift.accentColor }}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>{selectedName}</span>
                </p>
                <span
                  className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    selectedGift.category === 'special'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {selectedGift.category === 'special'
                    ? selectedFormattedPrice
                    : t.giftModal.free}
                </span>
              </div>

              <p className="mt-1.5 text-[11px] leading-snug text-slate-300">
                {selectedDesc}
              </p>

              <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
                <span>
                  {t.giftModal.rarity}: {selectedGift.rarity}
                </span>
                {selectedExistingCount > 0 && (
                  <span className="rounded-sm bg-slate-800 px-1.5 py-0.5 text-amber-300">
                    {selectedExistingCount}x {t.giftModal.onTreeCount}
                  </span>
                )}
              </div>

              {actionError && (
                <p
                  role="alert"
                  className="mt-2.5 rounded-sm border border-rose-500/50 bg-rose-950/70 p-2 text-[11px] leading-snug text-rose-200"
                >
                  {actionError}
                </p>
              )}

              {isSupabaseReady && !session ? (
                <div className="mt-3 space-y-2">
                  <p className="rounded-sm border border-sky-400/35 bg-[#0d1833]/80 p-2 text-[11px] leading-snug text-sky-100">
                    {selectedGift.category === 'special'
                      ? t.giftModal.loginRequiredPaid
                      : t.giftModal.loginRequiredFree}
                  </p>
                  <button
                    type="button"
                    onClick={() => void connectWithGitHub()}
                    className="pixel-btn pixel-btn-red w-full rounded-sm px-3 py-2 text-xs font-bold"
                  >
                    <GitHubIcon className="h-3.5 w-3.5" />
                    <span>{t.connectModal.authorize}</span>
                  </button>
                </div>
              ) : isSupabaseReady && selectedGift.category === 'special' && pixOrder ? (
                <PixCheckoutBox
                  order={pixOrder}
                  itemLabel={selectedName}
                  onConfirmed={handleGiftPixConfirmed}
                  onCancel={() => setPixOrder(null)}
                />
              ) : (
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => void handleConfirmGift()}
                  className={`pixel-btn mt-3 w-full rounded-sm px-3 py-2 text-xs font-bold disabled:opacity-60 ${
                    selectedGift.category === 'special' ? 'pixel-btn-gold' : 'pixel-btn-pine'
                  }`}
                >
                  {isSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isSupabaseReady && selectedGift.category === 'special' && currency === 'BRL' ? (
                    <QrCode className="h-3.5 w-3.5" />
                  ) : isSupabaseReady && selectedGift.category === 'special' ? (
                    <CreditCard className="h-3.5 w-3.5" />
                  ) : (
                    <Gift className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {isSending
                      ? selectedGift.category === 'special' && isSupabaseReady
                        ? t.shop.generatingCheckout
                        : t.giftModal.sendingBtn
                      : confirmLabel}
                  </span>
                </button>
              )}
            </div>
          </aside>

          {/* Column 2: Selectable Gift Catalog */}
          <div className="flex flex-col">
            <p className="mb-2.5 text-[11px] text-amber-100/90">{t.giftModal.selectHint}</p>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:max-h-[58vh] lg:overflow-y-auto lg:pr-1">
              {MOCK_GIFTS_CATALOG.map((gift) => {
                const copy = GIFT_CATALOG_COPY[language][gift.slug]
                const displayName = copy?.name ?? gift.name
                const displayDesc = copy?.description ?? gift.description
                const usdApprox = resolveGiftUsdPrice(gift)
                const currentCount = countsBySlug[gift.slug] ?? 0
                const isSelected = gift.id === selectedGift.id

                return (
                  <button
                    key={gift.id}
                    type="button"
                    onClick={() => {
                      setSelectedGiftId(gift.id)
                      setShowWithPreview(true)
                      setRecentGiftName(null)
                      setActionError(null)
                      setPixOrder(null)
                    }}
                    className={`flex flex-col justify-between rounded-sm border p-3 text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-400 bg-[#0d221c]/95 ring-1 ring-emerald-400/50'
                        : 'border-[#8c5835] bg-[#070d1f]/85 hover:border-amber-400/60 hover:bg-[#0b1530]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="flex items-center gap-1.5 text-xs font-bold"
                          style={{ color: gift.accentColor }}
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0" />
                          {displayName}
                        </span>
                        <span
                          className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            gift.category === 'special'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {gift.category === 'special'
                            ? `${t.giftModal.special} · ${formatCurrencyPrice(
                                currency === 'BRL' ? gift.price : usdApprox,
                                currency,
                              )}`
                            : t.giftModal.free}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-snug text-slate-300">
                        {displayDesc}
                      </p>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-[10px] uppercase tracking-wide text-slate-400">
                      <span>
                        {t.giftModal.rarity}: {gift.rarity}
                      </span>
                      {currentCount > 0 && (
                        <span className="rounded-sm bg-slate-800 px-1.5 py-0.5 text-amber-300">
                          {currentCount}x {t.giftModal.onTreeCount}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-sm border border-sky-400/35 bg-[#0d1833]/90 p-3 sm:flex-row sm:items-center">
              <p className="text-[11px] text-sky-100">{t.giftModal.note}</p>
              <button
                type="button"
                onClick={onClose}
                className="pixel-btn pixel-btn-gold shrink-0 rounded-sm px-4 py-1.5 text-xs font-bold"
              >
                {t.giftModal.back}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
