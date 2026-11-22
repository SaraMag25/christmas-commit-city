import { useMemo, useState } from 'react'
import {
  Check,
  Coins,
  Copy,
  ExternalLink,
  Heart,
  Lock,
  PawPrint,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import {
  COMPANION_ACCESSORIES_CATALOG,
  COMPANION_NAME_MAX_LENGTH,
  COMPANION_SPECIES_CATALOG,
  getAccessoryById,
  getSpeciesById,
  resolveCompanionDisplayName,
} from '../../config/companions'
import {
  buildCompanionSupportPreview,
  CREATOR_CAMPAIGN,
  formatCurrencyPrice,
  SUPPORTER_BUNDLE,
} from '../../config/supportCampaign'
import { useCity } from '../../context/cityContextStore'
import { useLocale } from '../../context/localeContextStore'
import {
  ACCESSORY_COPY,
  CAMPAIGN_COPY,
  SLOT_LABELS_BY_LANG,
  SPECIES_COPY,
} from '../../i18n/translations'
import type { CityTree } from '../../types/city'
import type {
  AccessorySlot,
  BodyAccessoryId,
  CompanionAccessoryId,
  CompanionAccessoryItem,
  CompanionSpeciesId,
  CompanionSpeciesItem,
  EquippedAccessories,
  HandAccessoryId,
  HeadAccessoryId,
} from '../../types/companion'
import { CompanionPreviewCanvas } from './CompanionPreviewCanvas'

interface CompanionShopModalProps {
  tree: CityTree
  onClose: () => void
}

type ShopTab = 'species' | 'customize'

type PendingPaymentItem =
  | { kind: 'species'; item: CompanionSpeciesItem }
  | { kind: 'accessory'; item: CompanionAccessoryItem }
  | { kind: 'bundle' }

function setSlotOverride(
  prev: Partial<EquippedAccessories>,
  slot: AccessorySlot,
  id: CompanionAccessoryId | undefined,
): Partial<EquippedAccessories> {
  const next = { ...prev }
  if (id === undefined) {
    delete next[slot]
    return next
  }
  if (slot === 'head') next.head = id as HeadAccessoryId
  else if (slot === 'body') next.body = id as BodyAccessoryId
  else next.hand = id as HandAccessoryId
  return next
}

export function CompanionShopModal({ tree, onClose }: CompanionShopModalProps) {
  const { language, currency, setCurrency, t } = useLocale()
  const {
    isSupabaseReady,
    getCompanionLoadout,
    getAvailableCommits,
    unlockAndSelectSpecies,
    equipSpecies,
    unlockAndEquipAccessory,
    toggleEquippedAccessory,
    unlockSupporterBundle,
    renameCompanion,
  } = useCity()

  const username = tree.profile.github_username
  const totalCommits = tree.contribution_count
  const loadout = getCompanionLoadout(username)
  const availableCommits = getAvailableCommits(username, totalCommits)

  const [activeTab, setActiveTab] = useState<ShopTab>(() =>
    loadout.species ? 'customize' : 'species',
  )
  const [activeSlot, setActiveSlot] = useState<AccessorySlot>('head')
  const [previewSpeciesId, setPreviewSpeciesId] = useState<CompanionSpeciesId>(
    loadout.species ?? 'frog',
  )
  const [previewAccessoryOverride, setPreviewAccessoryOverride] = useState<
    Partial<EquippedAccessories>
  >({})
  const [focusedSpeciesId, setFocusedSpeciesId] = useState<CompanionSpeciesId>(
    loadout.species ?? 'frog',
  )
  const [focusedAccessoryId, setFocusedAccessoryId] = useState<CompanionAccessoryId>(
    'wizard-hat',
  )
  const [nameDraft, setNameDraft] = useState<string>(() => loadout.customName ?? '')
  const [pendingPayment, setPendingPayment] = useState<PendingPaymentItem | null>(null)
  const [pixCopied, setPixCopied] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  const effectivePreviewEquipped: EquippedAccessories = useMemo(
    () => ({
      head:
        previewAccessoryOverride.head !== undefined
          ? previewAccessoryOverride.head
          : loadout.equipped.head,
      body:
        previewAccessoryOverride.body !== undefined
          ? previewAccessoryOverride.body
          : loadout.equipped.body,
      hand:
        previewAccessoryOverride.hand !== undefined
          ? previewAccessoryOverride.hand
          : loadout.equipped.hand,
    }),
    [loadout.equipped, previewAccessoryOverride],
  )

  const slotAccessories = useMemo(
    () => COMPANION_ACCESSORIES_CATALOG.filter((item) => item.slot === activeSlot),
    [activeSlot],
  )

  const focusedSpecies = getSpeciesById(focusedSpeciesId) ?? COMPANION_SPECIES_CATALOG[0]
  const focusedAccessory =
    getAccessoryById(focusedAccessoryId) ?? slotAccessories[0] ?? COMPANION_ACCESSORIES_CATALOG[0]

  const isSpeciesUnlocked = (id: CompanionSpeciesId) =>
    loadout.supporterBundleUnlocked || loadout.unlockedSpecies.includes(id)
  const isAccessoryUnlocked = (id: CompanionAccessoryId) =>
    loadout.supporterBundleUnlocked || loadout.unlockedAccessories.includes(id)

  const getItemCurrencyPrice = (item: { priceBrl: number; priceUsd: number }) =>
    currency === 'BRL' ? item.priceBrl : item.priceUsd

  const speciesLabels = SPECIES_COPY[language]
  const accessoryLabels = ACCESSORY_COPY[language]
  const slotLabels = SLOT_LABELS_BY_LANG[language]
  const campaignCopy = CAMPAIGN_COPY[language]

  const handleSelectSpeciesCard = async (item: CompanionSpeciesItem) => {
    setFocusedSpeciesId(item.id)
    setPreviewSpeciesId(item.id)
    setPendingPayment(null)
    setFeedback(null)
    if (isSpeciesUnlocked(item.id) && !isMutating) {
      setIsMutating(true)
      try {
        const res = await equipSpecies(username, item.id)
        if (!res.ok && res.error) setFeedback(res.error)
      } finally {
        setIsMutating(false)
      }
    }
  }

  const handleSelectAccessoryCard = async (item: CompanionAccessoryItem) => {
    setFocusedAccessoryId(item.id)
    setPendingPayment(null)
    setFeedback(null)

    if (isAccessoryUnlocked(item.id) && !isMutating) {
      setIsMutating(true)
      try {
        const res = await toggleEquippedAccessory(username, item.slot, item.id)
        if (!res.ok && res.error) setFeedback(res.error)
        setPreviewAccessoryOverride((prev) => setSlotOverride(prev, item.slot, undefined))
      } finally {
        setIsMutating(false)
      }
    } else {
      setPreviewAccessoryOverride((prev) => setSlotOverride(prev, item.slot, item.id))
    }
  }

  const handleBuySpeciesWithCommits = async (item: CompanionSpeciesItem) => {
    if (isMutating) return
    setIsMutating(true)
    try {
      const res = await unlockAndSelectSpecies(username, item.id, 'commits', currency)
      if (!res.ok) {
        setFeedback(res.error ?? t.shop.missingCommits)
        return
      }
      setPreviewSpeciesId(item.id)
      setFeedback(`${speciesLabels[item.id].name} — ${t.shop.activeOnTree}!`)
    } finally {
      setIsMutating(false)
    }
  }

  const handleBuyAccessoryWithCommits = async (item: CompanionAccessoryItem) => {
    if (isMutating) return
    setIsMutating(true)
    try {
      const res = await unlockAndEquipAccessory(username, item.id, 'commits', currency)
      if (!res.ok) {
        setFeedback(res.error ?? t.shop.missingCommits)
        return
      }
      setPreviewAccessoryOverride((prev) => setSlotOverride(prev, item.slot, undefined))
      setFeedback(`${accessoryLabels[item.id].name} — ${t.shop.activeOnTree}!`)
    } finally {
      setIsMutating(false)
    }
  }

  const handleConfirmPaymentUnlock = async () => {
    if (!pendingPayment || isMutating) return
    const method = currency === 'BRL' ? 'pix' : 'international'
    setIsMutating(true)
    try {
      if (pendingPayment.kind === 'bundle') {
        const res = await unlockSupporterBundle(username, currency)
        if (!res.ok) {
          setFeedback(res.error ?? t.shop.phase7Notice)
          return
        }
        setPreviewAccessoryOverride({})
        setFeedback(t.shop.supporterUnlocked)
      } else if (pendingPayment.kind === 'species') {
        const res = await unlockAndSelectSpecies(username, pendingPayment.item.id, method, currency)
        if (!res.ok) {
          setFeedback(res.error ?? t.shop.phase7Notice)
          return
        }
        setPreviewSpeciesId(pendingPayment.item.id)
        setFeedback(`${speciesLabels[pendingPayment.item.id].name} — ${t.shop.activeOnTree}!`)
      } else {
        const slot = pendingPayment.item.slot
        const res = await unlockAndEquipAccessory(username, pendingPayment.item.id, method, currency)
        if (!res.ok) {
          setFeedback(res.error ?? t.shop.phase7Notice)
          return
        }
        setPreviewAccessoryOverride((prev) => setSlotOverride(prev, slot, undefined))
        setFeedback(`${accessoryLabels[pendingPayment.item.id].name} — ${t.shop.activeOnTree}!`)
      }
      setPendingPayment(null)
    } finally {
      setIsMutating(false)
    }
  }

  const handleCopyPixKey = async () => {
    try {
      await navigator.clipboard.writeText(CREATOR_CAMPAIGN.pixKey)
      setPixCopied(true)
      window.setTimeout(() => setPixCopied(false), 1800)
    } catch {
      // Ignore clipboard failures in restricted environments.
    }
  }

  const activeHead = getAccessoryById(effectivePreviewEquipped.head)
  const activeBody = getAccessoryById(effectivePreviewEquipped.body)
  const activeHand = getAccessoryById(effectivePreviewEquipped.hand)
  const previewSpeciesMeta = getSpeciesById(previewSpeciesId)

  const pendingAmount = pendingPayment
    ? pendingPayment.kind === 'bundle'
      ? getItemCurrencyPrice(SUPPORTER_BUNDLE)
      : getItemCurrencyPrice(pendingPayment.item)
    : 0

  const pendingName = pendingPayment
    ? pendingPayment.kind === 'bundle'
      ? t.shop.supporterTitle
      : pendingPayment.kind === 'species'
        ? speciesLabels[pendingPayment.item.id].name
        : accessoryLabels[pendingPayment.item.id].name
    : ''

  const paymentPreview = pendingPayment
    ? buildCompanionSupportPreview(
        pendingPayment.kind === 'bundle' ? SUPPORTER_BUNDLE.id : pendingPayment.item.id,
        pendingAmount,
        currency,
        username,
      )
    : null

  const bundlePrice = getItemCurrencyPrice(SUPPORTER_BUNDLE)

  // Focused action target displayed right beneath LIVE_PREVIEW so adoption is always 1 click away
  const isViewingSpecies = activeTab === 'species'
  const focusedItemOwned = isViewingSpecies
    ? isSpeciesUnlocked(focusedSpecies.id)
    : isAccessoryUnlocked(focusedAccessory.id)
  const focusedItemEquipped = isViewingSpecies
    ? loadout.species === focusedSpecies.id
    : loadout.equipped[focusedAccessory.slot] === focusedAccessory.id
  const focusedCommitPrice = isViewingSpecies
    ? focusedSpecies.priceCommits
    : focusedAccessory.priceCommits
  const focusedCurrencyPrice = isViewingSpecies
    ? getItemCurrencyPrice(focusedSpecies)
    : getItemCurrencyPrice(focusedAccessory)
  const focusedDisplayName = isViewingSpecies
    ? speciesLabels[focusedSpecies.id].name
    : accessoryLabels[focusedAccessory.id].name
  const missingCommits = Math.max(0, focusedCommitPrice - availableCommits)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${t.shop.title} — @${username}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-xs sm:p-6"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto pixel-night-panel rounded-md p-4 sm:p-6">
        {/* Terminal Header + Currency Toggle */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div>
            <p className="text-[11px] text-emerald-400">
              $ companion shop --user=@{username} --currency={currency}
            </p>
            <h2 className="mt-0.5 flex items-center gap-2 text-base font-bold text-slate-100">
              <PawPrint className="h-4 w-4 text-amber-300" />
              <span>{t.shop.title}</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Explicit BRL (Pix) / USD (Card / Global) Switcher */}
            <div
              role="group"
              aria-label="Currency selector"
              className="flex rounded-sm border border-slate-700 bg-[#040811] p-0.5 text-[11px]"
            >
              <button
                type="button"
                onClick={() => {
                  setCurrency('BRL')
                  setPendingPayment(null)
                }}
                className={`rounded-[2px] px-2.5 py-1 font-semibold transition cursor-pointer ${
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
                  setPendingPayment(null)
                }}
                className={`rounded-[2px] px-2.5 py-1 font-semibold transition cursor-pointer ${
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
              className="rounded-sm border border-slate-700 p-1 text-slate-400 hover:border-slate-500 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Commit Balance & Immutability Guarantee Banner */}
        <div className="mt-3 grid gap-2 rounded-sm border border-slate-800 bg-[#040811]/90 p-3 sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase text-slate-500">{t.shop.realCommits}</p>
            <p className="text-sm font-bold text-emerald-400">
              {totalCommits.toLocaleString(language)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">{t.shop.availableBalance}</p>
            <p className="text-sm font-bold text-amber-300">
              {availableCommits.toLocaleString(language)} {t.shop.commitsWord}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">{t.shop.spentInShop}</p>
            <p className="text-sm font-semibold text-slate-300">
              {loadout.spentCommits.toLocaleString(language)} {t.shop.commitsWord}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-sky-200">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="leading-tight">{t.shop.ruleBanner}</span>
          </div>
        </div>

        {/* Main 2-Column Layout */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[296px_1fr]">
          {/* Left Column: Front 3/4 Live Preview + Direct Adopt / Buy / Equip Action Box */}
          <aside className="flex flex-col items-center rounded-sm border border-slate-800 bg-[#060c1a]/90 p-3.5">
            <div className="flex w-full items-center justify-between text-[10px] text-slate-400">
              <span>{t.shop.livePreview}</span>
              <span className="font-semibold text-amber-300">
                {previewSpeciesMeta
                  ? `${resolveCompanionDisplayName(
                      previewSpeciesMeta.id,
                      loadout.species === previewSpeciesMeta.id ? loadout.customName : undefined,
                      speciesLabels[previewSpeciesMeta.id].defaultName,
                    )} · ${speciesLabels[previewSpeciesMeta.id].name}`
                  : ''}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-center rounded-sm border border-slate-800/90 bg-gradient-to-b from-[#0a1633] via-[#102247] to-[#1a325c] p-2">
              <CompanionPreviewCanvas
                species={previewSpeciesId}
                equipped={effectivePreviewEquipped}
                sizePx={216}
              />
            </div>

            {/* Companion Story Card */}
            {previewSpeciesMeta && (
              <div className="mt-2.5 w-full rounded-sm border border-slate-800 bg-[#040811]/85 p-2.5 text-[11px]">
                <p className="text-[10px] font-semibold text-emerald-400">
                  {t.shop.storyLabel} · {speciesLabels[previewSpeciesMeta.id].defaultName}
                </p>
                <p className="mt-1 leading-relaxed text-slate-300">
                  &ldquo;{speciesLabels[previewSpeciesMeta.id].story}&rdquo;
                </p>
              </div>
            )}

            {/* Companion Custom Rename Control */}
            {loadout.species && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void renameCompanion(username, nameDraft).then((res) => {
                    setFeedback(res.ok ? t.shop.nameSavedMsg : (res.error ?? t.shop.nameSavedMsg))
                  })
                }}
                className="mt-2.5 w-full rounded-sm border border-slate-800 bg-[#040811]/85 p-2.5"
              >
                <label
                  htmlFor="companion-name-input"
                  className="block text-[10px] font-semibold text-slate-400"
                >
                  {t.shop.petNameLabel}
                </label>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    id="companion-name-input"
                    type="text"
                    maxLength={COMPANION_NAME_MAX_LENGTH}
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder={
                      speciesLabels[loadout.species]?.defaultName ?? t.shop.petNamePlaceholder
                    }
                    className="min-w-0 flex-1 rounded-sm border border-slate-700 bg-[#070d1f] px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="pixel-btn pixel-btn-pine rounded-sm px-2.5 py-1 text-[10px] font-bold"
                  >
                    {t.shop.saveNameBtn}
                  </button>
                  {loadout.customName && (
                    <button
                      type="button"
                      onClick={() => {
                        setNameDraft('')
                        void renameCompanion(username, '').then((res) => {
                          setFeedback(
                            res.ok ? t.shop.nameSavedMsg : (res.error ?? t.shop.nameSavedMsg),
                          )
                        })
                      }}
                      className="rounded-sm border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
                    >
                      {t.shop.resetNameBtn}
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Direct Action Box Immediately Below LIVE_PREVIEW */}
            <div className="mt-3 w-full rounded-sm border border-amber-500/35 bg-[#040811]/95 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold text-slate-100">{focusedDisplayName}</p>
                {!focusedItemOwned && (
                  <span className="shrink-0 text-[10px] font-semibold text-amber-300">
                    {focusedCommitPrice}c · {formatCurrencyPrice(focusedCurrencyPrice, currency)}
                  </span>
                )}
              </div>

              {focusedItemOwned ? (
                <div className="mt-2.5 space-y-1.5">
                  {focusedItemEquipped ? (
                    <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-emerald-500/40 bg-emerald-500/15 py-1.5 text-[11px] font-bold text-emerald-300">
                      <Check className="h-3.5 w-3.5" />
                      {t.shop.activeOnTree}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (isViewingSpecies) {
                          void equipSpecies(username, focusedSpecies.id).then((res) => {
                            if (res.ok) {
                              setPreviewSpeciesId(focusedSpecies.id)
                              setFeedback(`${focusedDisplayName} — ${t.shop.activeOnTree}!`)
                            } else if (res.error) {
                              setFeedback(res.error)
                            }
                          })
                        } else {
                          void toggleEquippedAccessory(
                            username,
                            focusedAccessory.slot,
                            focusedAccessory.id,
                          ).then((res) => {
                            if (res.ok) {
                              setPreviewAccessoryOverride((prev) =>
                                setSlotOverride(prev, focusedAccessory.slot, undefined),
                              )
                              setFeedback(`${focusedDisplayName} — ${t.shop.activeOnTree}!`)
                            } else if (res.error) {
                              setFeedback(res.error)
                            }
                          })
                        }
                      }}
                      className="pixel-btn pixel-btn-pine w-full rounded-sm px-3 py-2 text-xs font-bold"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{t.shop.equipBtn}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-2.5 flex flex-col gap-2">
                  {/* Primary green button: Adopt / Equip by commits (disabled with missing hint if insufficient) */}
                  <button
                    type="button"
                    disabled={missingCommits > 0 || isMutating}
                    onClick={() => {
                      void (isViewingSpecies
                        ? handleBuySpeciesWithCommits(focusedSpecies)
                        : handleBuyAccessoryWithCommits(focusedAccessory))
                    }}
                    className={`pixel-btn w-full rounded-sm px-3 py-2 text-xs font-bold ${
                      missingCommits > 0 || isMutating
                        ? 'cursor-not-allowed border border-slate-700 bg-slate-900 text-slate-400 opacity-75'
                        : 'pixel-btn-pine'
                    }`}
                  >
                    <Coins className="h-3.5 w-3.5" />
                    <span>
                      {missingCommits > 0
                        ? `${t.shop.missingCommits} ${missingCommits} ${t.shop.commitsWord}`
                        : `${isViewingSpecies ? t.shop.adoptFor : t.shop.equipBtn} ${focusedCommitPrice} ${t.shop.commitsWord}`}
                    </span>
                  </button>

                  {/* Secondary gold/highlighted button: Unlock via Pix (BRL) or Card (USD) */}
                  <button
                    type="button"
                    onClick={() =>
                      setPendingPayment(
                        isViewingSpecies
                          ? { kind: 'species', item: focusedSpecies }
                          : { kind: 'accessory', item: focusedAccessory },
                      )
                    }
                    className={`pixel-btn w-full rounded-sm px-3 py-2 text-xs font-bold ${
                      missingCommits > 0 ? 'pixel-btn-red' : 'pixel-btn-gold'
                    }`}
                  >
                    <Heart className="h-3.5 w-3.5" />
                    <span>
                      {currency === 'BRL' ? t.shop.unlockPix : t.shop.unlockCard} (
                      {formatCurrencyPrice(focusedCurrencyPrice, currency)})
                    </span>
                  </button>
                </div>
              )}
            </div>

            {!loadout.species && (
              <p className="mt-2 text-center text-[11px] text-amber-300/90">
                {t.shop.noPetHint}
              </p>
            )}

            <dl className="mt-2.5 w-full space-y-1 rounded-sm border border-slate-800 bg-[#040811]/85 p-2.5 text-[11px]">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{t.shop.headLabel}</dt>
                <dd className="truncate text-slate-200">
                  {activeHead ? accessoryLabels[activeHead.id].name : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{t.shop.bodyLabel}</dt>
                <dd className="truncate text-slate-200">
                  {activeBody ? accessoryLabels[activeBody.id].name : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{t.shop.handLabel}</dt>
                <dd className="truncate text-slate-200">
                  {activeHand ? accessoryLabels[activeHand.id].name : '—'}
                </dd>
              </div>
            </dl>

            {loadout.species && (
              <button
                type="button"
                onClick={() => {
                  void equipSpecies(username, null).then((res) => {
                    setFeedback(res.ok ? t.shop.removePet : (res.error ?? t.shop.removePet))
                  })
                }}
                className="mt-2 w-full rounded-sm border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-[10px] text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
              >
                {t.shop.removePet}
              </button>
            )}
          </aside>

          {/* Right Column: Tabs, 3x2 Species Grid, Accessories, Supporter Bundle & Checkout */}
          <div className="flex flex-col">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('species')
                  setPendingPayment(null)
                }}
                className={`pixel-btn rounded-sm px-3 py-2 text-xs font-bold ${
                  activeTab === 'species' ? 'pixel-btn-pine' : 'pixel-btn-wood'
                }`}
              >
                <PawPrint className="h-3.5 w-3.5" />
                <span>
                  {t.shop.tabSpecies} ({loadout.supporterBundleUnlocked ? COMPANION_SPECIES_CATALOG.length : loadout.unlockedSpecies.length}/{COMPANION_SPECIES_CATALOG.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('customize')
                  setPendingPayment(null)
                }}
                className={`pixel-btn rounded-sm px-3 py-2 text-xs font-bold ${
                  activeTab === 'customize' ? 'pixel-btn-pine' : 'pixel-btn-wood'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>
                  {t.shop.tabCustomize} ({loadout.supporterBundleUnlocked ? COMPANION_ACCESSORIES_CATALOG.length : loadout.unlockedAccessories.length}/{COMPANION_ACCESSORIES_CATALOG.length})
                </span>
              </button>
            </div>

            {/* Tab 1: 6 Species in 3x2 Grid */}
            {activeTab === 'species' && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {COMPANION_SPECIES_CATALOG.map((sp) => {
                  const owned = isSpeciesUnlocked(sp.id)
                  const isEquipped = loadout.species === sp.id
                  const isFocused = focusedSpeciesId === sp.id
                  const copy = speciesLabels[sp.id]
                  const priceFiat = formatCurrencyPrice(getItemCurrencyPrice(sp), currency)

                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => handleSelectSpeciesCard(sp)}
                      className={`flex flex-col justify-between rounded-sm border p-3 text-left transition cursor-pointer ${
                        isFocused
                          ? 'border-emerald-400 bg-[#0d221c]/90'
                          : 'border-slate-800 bg-[#070d1f]/85 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-100">
                            {copy.defaultName}{' '}
                            <span className="font-normal text-slate-400">· {copy.name}</span>
                          </p>
                          <p className="text-[10px] text-slate-400">{copy.subtitle}</p>
                        </div>
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-[2px] border border-white/25"
                          style={{ backgroundColor: sp.primaryColor }}
                        />
                      </div>

                      <p className="mt-1.5 text-[11px] leading-snug text-slate-300">
                        {copy.description}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between text-[10px]">
                        {isEquipped ? (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">
                            <Check className="h-3 w-3" /> {t.shop.activeOnTree}
                          </span>
                        ) : owned ? (
                          <span className="rounded-sm bg-sky-500/20 px-2 py-0.5 font-semibold text-sky-300">
                            {t.shop.unlockedClickEquip}
                          </span>
                        ) : (
                          <>
                            <span className="font-semibold text-amber-300">
                              {sp.priceCommits} {t.shop.commitsWord}
                            </span>
                            <span className="text-slate-400">
                              {t.shop.orLabel} {priceFiat}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Tab 2: Modular Accessories (Head / Body / Hand) */}
            {activeTab === 'customize' && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {(['head', 'body', 'hand'] as AccessorySlot[]).map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setActiveSlot(slot)
                        const firstInSlot = COMPANION_ACCESSORIES_CATALOG.find(
                          (a) => a.slot === slot,
                        )
                        if (firstInSlot) setFocusedAccessoryId(firstInSlot.id)
                        setPendingPayment(null)
                      }}
                      className={`rounded-sm border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                        activeSlot === slot
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-slate-800 bg-[#070d1f] text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {slotLabels[slot]}
                    </button>
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {slotAccessories.map((acc) => {
                    const owned = isAccessoryUnlocked(acc.id)
                    const equippedInSlot = loadout.equipped[acc.slot] === acc.id
                    const isFocused = focusedAccessoryId === acc.id
                    const copy = accessoryLabels[acc.id]
                    const priceFiat = formatCurrencyPrice(getItemCurrencyPrice(acc), currency)

                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleSelectAccessoryCard(acc)}
                        className={`flex flex-col justify-between rounded-sm border p-3 text-left transition cursor-pointer ${
                          isFocused
                            ? 'border-emerald-400 bg-[#0d221c]/90'
                            : 'border-slate-800 bg-[#070d1f]/85 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className="text-xs font-bold"
                            style={{ color: acc.accentColor }}
                          >
                            {copy.name}
                          </span>
                          {!owned && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
                        </div>

                        <p className="mt-1.5 text-[11px] leading-snug text-slate-300">
                          {copy.description}
                        </p>

                        <div className="mt-2.5 flex items-center justify-between text-[10px]">
                          {equippedInSlot ? (
                            <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">
                              <Check className="h-3 w-3" /> {t.shop.equippedClickRemove}
                            </span>
                          ) : owned ? (
                            <span className="rounded-sm bg-sky-500/20 px-2 py-0.5 font-semibold text-sky-300">
                              {t.shop.unlockedClickEquip}
                            </span>
                          ) : (
                            <>
                              <span className="font-semibold text-amber-300">
                                {acc.priceCommits} {t.shop.commitsWord}
                              </span>
                              <span className="text-slate-400">
                                {t.shop.orLabel} {priceFiat}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Supporter Pack / Bundle Card */}
            <div className="mt-3 rounded-sm border border-amber-400/40 bg-gradient-to-r from-[#1a1333]/90 via-[#101c3a]/90 to-[#0d2621]/90 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="max-w-lg">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{t.shop.supporterTitle}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-300">
                    {t.shop.supporterDesc}
                  </p>
                </div>

                {loadout.supporterBundleUnlocked ? (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-[11px] font-bold text-emerald-200">
                    <Check className="h-3.5 w-3.5" /> {t.shop.supporterUnlocked}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingPayment({ kind: 'bundle' })}
                    className="pixel-btn pixel-btn-gold shrink-0 rounded-sm px-3.5 py-2 text-xs font-bold"
                  >
                    <Heart className="h-3.5 w-3.5" />
                    <span>
                      {t.shop.supporterBtn} ({formatCurrencyPrice(bundlePrice, currency)})
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Dual Payment Preview Panel (BRL Pix / USD International Checkout) */}
            {pendingPayment && paymentPreview && (
              <div className="mt-3 rounded-sm border-2 border-amber-400/55 bg-[#111c36] p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-400" />
                      {currency === 'BRL' ? t.shop.checkoutPixTitle : t.shop.checkoutUsdTitle} —{' '}
                      {pendingName}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-300">
                      <strong className="text-emerald-300">
                        {formatCurrencyPrice(paymentPreview.amount, currency)}
                      </strong>{' '}
                      · {t.shop.checkoutSupportLine} {campaignCopy.university} (
                      {paymentPreview.recipientName}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingPayment(null)}
                    className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    {t.shop.cancel}
                  </button>
                </div>

                {currency === 'BRL' ? (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-slate-700 bg-[#040811]/90 px-3 py-2 text-[11px]">
                    <div className="truncate">
                      <span className="text-slate-500">{t.shop.pixKeyLabel}: </span>
                      <code className="text-amber-200">{paymentPreview.pixKey}</code>
                      <span className="ml-2 text-[10px] text-slate-500">
                        ({paymentPreview.externalReference})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyPixKey}
                      className="inline-flex items-center gap-1 rounded-sm border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-amber-400 cursor-pointer"
                    >
                      {pixCopied ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{pixCopied ? t.shop.copied : t.shop.copy}</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-slate-700 bg-[#040811]/90 px-3 py-2 text-[11px]">
                    {paymentPreview.checkoutUrl ? (
                      <>
                        <span className="text-slate-300">
                          Ref: <code className="text-sky-300">{paymentPreview.externalReference}</code>
                        </span>
                        <a
                          href={paymentPreview.checkoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-sm border border-sky-400/50 bg-sky-500/20 px-2.5 py-1 text-[10px] font-semibold text-sky-200 hover:bg-sky-500/30"
                        >
                          <span>{t.shop.openCheckout}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    ) : (
                      <p className="text-[10px] text-sky-200/90">{t.shop.noCheckoutEnv}</p>
                    )}
                  </div>
                )}

                {isSupabaseReady ? (
                  <p className="mt-2.5 rounded-sm border border-amber-400/40 bg-amber-950/35 p-2.5 text-[10px] leading-relaxed text-amber-100">
                    {t.shop.phase7Notice}
                  </p>
                ) : (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] text-sky-200/80">{t.shop.previewNote}</p>
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => void handleConfirmPaymentUnlock()}
                      className="pixel-btn pixel-btn-pine rounded-sm px-3.5 py-1.5 text-[11px] font-bold disabled:opacity-60"
                    >
                      {t.shop.confirmPreview}
                    </button>
                  </div>
                )}
              </div>
            )}

            {feedback && (
              <p
                role="status"
                className="mt-3 rounded-sm border border-emerald-500/40 bg-emerald-950/60 px-3 py-2 text-[11px] text-emerald-200"
              >
                &gt; {feedback}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
