import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Coins,
  CreditCard,
  ExternalLink,
  Heart,
  Loader2,
  Lock,
  PawPrint,
  QrCode,
  Rocket,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import {
  COMPANION_ACCESSORIES_CATALOG,
  COMPANION_NAME_MAX_LENGTH,
  COMPANION_SPECIES_CATALOG,
  EMPTY_EQUIPPED_ACCESSORIES,
  getAccessoryById,
  getSpeciesById,
  isCatalogItemUnlocked,
  resolveCompanionDisplayName,
} from '../../config/companions'
import {
  GIFTS_CATALOG,
  resolveGiftUsdPrice,
  SCENE_EXCLUSIVE_GIFT_IDS,
} from '../../config/gifts'
import {
  buildCompanionSupportPreview,
  formatCurrencyPrice,
  SUPPORTER_BUNDLE,
} from '../../config/supportCampaign'
import { useCity } from '../../context/cityContextStore'
import { useLocale } from '../../context/localeContextStore'
import {
  ACCESSORY_COPY,
  GIFT_CATALOG_COPY,
  SLOT_LABELS_BY_LANG,
  SPECIES_COPY,
} from '../../i18n/translations'
import {
  createPixPayment,
  createStripeCheckout,
  type PixPaymentOrder,
} from '../../services/paymentService'
import { toSafeHttpUrl } from '../../utils/urlSafety'
import type { CityTree, GiftItem, TreeGiftSummary } from '../../types/city'
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
import { GitHubIcon } from '../icons/GitHubIcon'
import { PixCheckoutBox } from '../payments/PixCheckoutBox'
import { TreePixelCanvas } from '../tree/TreePixelCanvas'
import { CompanionPreviewCanvas } from './CompanionPreviewCanvas'

interface CompanionShopModalProps {
  tree: CityTree
  onClose: () => void
}

type ShopTab = 'species' | 'customize' | 'scene'

type PendingPaymentItem =
  | { kind: 'species'; item: CompanionSpeciesItem }
  | { kind: 'accessory'; item: CompanionAccessoryItem }
  | { kind: 'gift'; item: GiftItem }
  | { kind: 'bundle' }

function setSlotOverride(
  prev: Partial<EquippedAccessories>,
  slot: AccessorySlot,
  id: CompanionAccessoryId | null | undefined,
): Partial<EquippedAccessories> {
  const next = { ...prev }
  if (id === undefined) {
    delete next[slot]
    return next
  }
  if (slot === 'head') next.head = id as HeadAccessoryId | null
  else if (slot === 'body') next.body = id as BodyAccessoryId | null
  else next.hand = id as HandAccessoryId | null
  return next
}

export function CompanionShopModal({ tree, onClose }: CompanionShopModalProps) {
  const { language, currency, setCurrency, t } = useLocale()
  const {
    session,
    isSupabaseReady,
    currentUserTree,
    getCompanionLoadout,
    getAvailableCommits,
    unlockAndSelectSpecies,
    equipSpecies,
    unlockAndEquipAccessory,
    toggleEquippedAccessory,
    unlockSupporterBundle,
    sendGiftToTree,
    renameCompanion,
    connectWithGitHub,
    refreshCityState,
  } = useCity()

  const username = tree.profile.github_username
  const totalCommits = tree.contribution_count
  const loadout = getCompanionLoadout(username)
  const availableCommits = getAvailableCommits(username, totalCommits)

  const sceneGifts = useMemo(
    () =>
      GIFTS_CATALOG.filter((gift) =>
        (SCENE_EXCLUSIVE_GIFT_IDS as readonly string[]).includes(gift.id),
      ),
    [],
  )

  const [activeTab, setActiveTab] = useState<ShopTab>(() =>
    loadout.species ? 'customize' : 'species',
  )
  const [activeSlot, setActiveSlot] = useState<AccessorySlot>('head')
  // Initialize the inspected/previewed companion strictly once per modal open;
  // never reset on subsequent re-renders, tab switches, or tree refreshes.
  const [previewCompanionId, setPreviewCompanionId] = useState<CompanionSpeciesId>(() => {
    if (loadout.species) return loadout.species
    const firstUnlocked = COMPANION_SPECIES_CATALOG.find((sp) =>
      isCatalogItemUnlocked(
        sp,
        loadout.unlockedSpecies,
        sp.id,
        loadout.supporterBundleUnlocked,
      ),
    )
    return firstUnlocked?.id ?? COMPANION_SPECIES_CATALOG[0].id
  })
  const [previewAccessoryOverride, setPreviewAccessoryOverride] = useState<
    Partial<EquippedAccessories>
  >({})
  const [focusedAccessoryId, setFocusedAccessoryId] = useState<CompanionAccessoryId>(
    'wizard-hat',
  )
  const [focusedSceneGiftId, setFocusedSceneGiftId] = useState<string>(
    SCENE_EXCLUSIVE_GIFT_IDS[0],
  )
  const nameSyncKey = `${username}:${loadout.customName ?? ''}`
  const [nameDraftState, setNameDraftState] = useState<{ key: string; value: string }>(() => ({
    key: nameSyncKey,
    value: loadout.customName ?? '',
  }))
  const nameDraft =
    nameDraftState.key === nameSyncKey ? nameDraftState.value : (loadout.customName ?? '')
  const setNameDraft = (value: string) => setNameDraftState({ key: nameSyncKey, value })
  const [pendingPayment, setPendingPayment] = useState<PendingPaymentItem | null>(null)
  const [pixOrder, setPixOrder] = useState<PixPaymentOrder | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<{
    source: 'focused' | 'bundle'
    message: string
  } | null>(null)
  const [mutatingSource, setMutatingSource] = useState<'focused' | 'bundle' | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const paymentPanelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!pendingPayment) return
    paymentPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [pendingPayment])

  const focusedSpeciesId: CompanionSpeciesId = previewCompanionId
  const isPreviewingDifferentCompanion = previewCompanionId !== loadout.species

  const slotAccessories = useMemo(
    () => COMPANION_ACCESSORIES_CATALOG.filter((item) => item.slot === activeSlot),
    [activeSlot],
  )

  const focusedSpecies = getSpeciesById(focusedSpeciesId) ?? COMPANION_SPECIES_CATALOG[0]
  const focusedAccessory =
    getAccessoryById(focusedAccessoryId) ?? slotAccessories[0] ?? COMPANION_ACCESSORIES_CATALOG[0]
  const focusedSceneGift =
    sceneGifts.find((gift) => gift.id === focusedSceneGiftId) ?? sceneGifts[0] ?? GIFTS_CATALOG[0]

  // Fitting-room base: if user is previewing a different companion than what's on the tree (e.g. Claude),
  // start cleanly without carrying over another companion's active hat/outfit until user tries items on.
  const basePreviewEquipped: EquippedAccessories = isPreviewingDifferentCompanion
    ? EMPTY_EQUIPPED_ACCESSORIES
    : loadout.equipped

  const effectivePreviewEquipped: EquippedAccessories = useMemo(
    () => ({
      head:
        previewAccessoryOverride.head !== undefined
          ? previewAccessoryOverride.head
          : basePreviewEquipped.head,
      body:
        previewAccessoryOverride.body !== undefined
          ? previewAccessoryOverride.body
          : basePreviewEquipped.body,
      hand:
        previewAccessoryOverride.hand !== undefined
          ? previewAccessoryOverride.hand
          : basePreviewEquipped.hand,
    }),
    [basePreviewEquipped, previewAccessoryOverride],
  )

  const hasAccessoryPreviewOverride =
    previewAccessoryOverride.head !== undefined ||
    previewAccessoryOverride.body !== undefined ||
    previewAccessoryOverride.hand !== undefined
  const isPreviewModeActive = isPreviewingDifferentCompanion || hasAccessoryPreviewOverride

  const isSpeciesUnlocked = (id: CompanionSpeciesId) =>
    isCatalogItemUnlocked(
      getSpeciesById(id),
      loadout.unlockedSpecies,
      id,
      loadout.supporterBundleUnlocked,
    )
  const isAccessoryUnlocked = (id: CompanionAccessoryId) =>
    isCatalogItemUnlocked(
      getAccessoryById(id),
      loadout.unlockedAccessories,
      id,
      loadout.supporterBundleUnlocked,
    )
  const viewerUnlockedGifts = currentUserTree
    ? getCompanionLoadout(currentUserTree.profile.github_username).unlockedGifts
    : loadout.unlockedGifts
  const isSceneGiftUnlocked = (giftId: string) =>
    Boolean(
      viewerUnlockedGifts?.includes(giftId) ||
        loadout.unlockedGifts?.includes(giftId),
    )

  const unlockedSpeciesCount = COMPANION_SPECIES_CATALOG.filter((sp) =>
    isSpeciesUnlocked(sp.id),
  ).length
  const unlockedAccessoriesCount = COMPANION_ACCESSORIES_CATALOG.filter((acc) =>
    isAccessoryUnlocked(acc.id),
  ).length

  const getItemCurrencyPrice = (item: { priceBrl: number; priceUsd: number }) =>
    currency === 'BRL' ? item.priceBrl : item.priceUsd
  const getGiftCurrencyPrice = (gift: GiftItem) =>
    currency === 'BRL' ? gift.price : resolveGiftUsdPrice(gift)

  const speciesLabels = SPECIES_COPY[language]
  const accessoryLabels = ACCESSORY_COPY[language]
  const giftLabels = GIFT_CATALOG_COPY[language]
  const slotLabels = SLOT_LABELS_BY_LANG[language]

  const previewTreeWithSceneProp = useMemo((): CityTree => {
    const tempGift: TreeGiftSummary = {
      id: `preview-scene-${focusedSceneGift.id}`,
      gift_id: focusedSceneGift.id,
      gift_slug: focusedSceneGift.slug,
      gift_name: focusedSceneGift.name,
      category: focusedSceneGift.category,
      rarity: focusedSceneGift.rarity,
      sender_name: `@${username}`,
      created_at: tree.last_synced_at,
    }
    return {
      ...tree,
      gifts: [...tree.gifts, tempGift],
    }
  }, [tree, focusedSceneGift, username])

  const resetPaymentUi = () => {
    setPendingPayment(null)
    setPixOrder(null)
    setPaymentError(null)
  }

  const handleSelectSpeciesCard = (item: CompanionSpeciesItem) => {
    if (isMutating) return
    resetPaymentUi()
    setFeedback(null)
    if (item.id !== previewCompanionId) {
      setPreviewAccessoryOverride({})
    }
    setPreviewCompanionId(item.id)
  }

  const handleSelectAccessoryCard = async (item: CompanionAccessoryItem) => {
    if (isMutating) return
    setFocusedAccessoryId(item.id)
    resetPaymentUi()
    setFeedback(null)

    if (isAccessoryUnlocked(item.id) && !isPreviewingDifferentCompanion) {
      setIsMutating(true)
      try {
        const res = await toggleEquippedAccessory(username, item.slot, item.id)
        if (!res.ok) {
          if (res.error) setFeedback(res.error)
          setPreviewAccessoryOverride((prev) => setSlotOverride(prev, item.slot, item.id))
          return
        }
        setPreviewAccessoryOverride((prev) => setSlotOverride(prev, item.slot, undefined))
      } finally {
        setIsMutating(false)
      }
    } else {
      setPreviewAccessoryOverride((prev) => {
        const currentShown =
          prev[item.slot] !== undefined ? prev[item.slot] : basePreviewEquipped[item.slot]
        if (currentShown === item.id) {
          return setSlotOverride(
            prev,
            item.slot,
            basePreviewEquipped[item.slot] === null ? undefined : null,
          )
        }
        return setSlotOverride(prev, item.slot, item.id)
      })
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
      setPreviewCompanionId(item.id)
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

  const handlePlaceUnlockedSceneGift = async (gift: GiftItem) => {
    if (isMutating) return
    setIsMutating(true)
    setFeedback(null)
    try {
      const senderLabel = currentUserTree
        ? `@${currentUserTree.profile.github_username}`
        : `@${username}`
      const res = await sendGiftToTree(username, gift, senderLabel)
      if (!res.ok) {
        setFeedback(res.error ?? t.shop.phase7Notice)
        return
      }
      const giftName = giftLabels[gift.slug as keyof typeof giftLabels]?.name ?? gift.name
      setFeedback(`${giftName} — ${t.shop.activeOnTree}!`)
    } finally {
      setIsMutating(false)
    }
  }

  const startDirectStripeCheckout = async (
    target: PendingPaymentItem,
    source: 'focused' | 'bundle',
  ) => {
    if (isMutating) return
    setPaymentError(null)
    setFeedback(null)

    if (!session) {
      const ok = await connectWithGitHub()
      if (!ok) {
        setPaymentError({ source, message: t.shop.loginRequiredCard })
      }
      return
    }

    const itemId = target.kind === 'bundle' ? SUPPORTER_BUNDLE.id : target.item.id
    const targetTreeId = target.kind === 'gift' ? tree.id : undefined

    setIsMutating(true)
    setMutatingSource(source)
    try {
      const stripe = await createStripeCheckout({ itemId, targetTreeId })
      window.location.assign(stripe.checkoutUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.shop.phase7Notice
      setPaymentError({ source, message: msg })
      setFeedback(msg)
    } finally {
      setIsMutating(false)
      setMutatingSource(null)
    }
  }

  const handleOpenOrStartPayment = (
    target: PendingPaymentItem,
    source: 'focused' | 'bundle',
  ) => {
    setPixOrder(null)
    setPaymentError(null)
    setFeedback(null)

    // In USD mode with Supabase active, launch Stripe Checkout directly in 1 click
    // instead of revealing a secondary panel below the catalog grid.
    if (isSupabaseReady && currency === 'USD') {
      void startDirectStripeCheckout(target, source)
      return
    }

    setPendingPayment(target)
  }

  const handleConfirmPaymentUnlock = async () => {
    if (!pendingPayment || isMutating) return

    if (isSupabaseReady) {
      if (!session) {
        await connectWithGitHub()
        return
      }
      const itemId =
        pendingPayment.kind === 'bundle' ? SUPPORTER_BUNDLE.id : pendingPayment.item.id
      const targetTreeId = pendingPayment.kind === 'gift' ? tree.id : undefined
      setIsMutating(true)
      setFeedback(null)
      setPaymentError(null)
      try {
        if (currency === 'BRL') {
          const order = await createPixPayment({ itemId, targetTreeId })
          setPixOrder(order)
        } else {
          const stripe = await createStripeCheckout({ itemId, targetTreeId })
          window.location.assign(stripe.checkoutUrl)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : t.shop.phase7Notice
        setPaymentError({
          source: pendingPayment.kind === 'bundle' ? 'bundle' : 'focused',
          message: msg,
        })
        setFeedback(msg)
      } finally {
        setIsMutating(false)
      }
      return
    }

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
      } else if (pendingPayment.kind === 'gift') {
        const senderLabel = currentUserTree
          ? `@${currentUserTree.profile.github_username}`
          : `@${username}`
        const res = await sendGiftToTree(username, pendingPayment.item, senderLabel)
        if (!res.ok) {
          setFeedback(res.error ?? t.shop.phase7Notice)
          return
        }
        const giftName =
          giftLabels[pendingPayment.item.slug as keyof typeof giftLabels]?.name ??
          pendingPayment.item.name
        setFeedback(`${giftName} — ${t.shop.activeOnTree}!`)
      } else if (pendingPayment.kind === 'species') {
        const res = await unlockAndSelectSpecies(username, pendingPayment.item.id, method, currency)
        if (!res.ok) {
          setFeedback(res.error ?? t.shop.phase7Notice)
          return
        }
        setPreviewCompanionId(pendingPayment.item.id)
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

  const handlePixPaymentConfirmed = async () => {
    const confirmedItem = pendingPayment
    await refreshCityState()
    setPixOrder(null)
    setPendingPayment(null)
    if (confirmedItem?.kind === 'bundle') {
      setPreviewAccessoryOverride({})
      setFeedback(t.shop.supporterUnlocked)
    } else if (confirmedItem?.kind === 'gift') {
      const giftName =
        giftLabels[confirmedItem.item.slug as keyof typeof giftLabels]?.name ??
        confirmedItem.item.name
      setFeedback(`${giftName} — ${t.shop.paymentConfirmedUnlocked}`)
    } else if (confirmedItem?.kind === 'species') {
      await equipSpecies(username, confirmedItem.item.id)
      setPreviewCompanionId(confirmedItem.item.id)
      setFeedback(
        `${speciesLabels[confirmedItem.item.id].name} — ${t.shop.paymentConfirmedUnlocked}`,
      )
    } else if (confirmedItem?.kind === 'accessory') {
      setPreviewAccessoryOverride((prev) => setSlotOverride(prev, confirmedItem.item.slot, undefined))
      setFeedback(
        `${accessoryLabels[confirmedItem.item.id].name} — ${t.shop.paymentConfirmedUnlocked}`,
      )
    } else {
      setFeedback(t.shop.paymentConfirmedUnlocked)
    }
  }

  const activeHead = getAccessoryById(effectivePreviewEquipped.head)
  const activeBody = getAccessoryById(effectivePreviewEquipped.body)
  const activeHand = getAccessoryById(effectivePreviewEquipped.hand)
  const previewSpeciesMeta = getSpeciesById(previewCompanionId)

  const pendingAmount = pendingPayment
    ? pendingPayment.kind === 'bundle'
      ? getItemCurrencyPrice(SUPPORTER_BUNDLE)
      : pendingPayment.kind === 'gift'
        ? getGiftCurrencyPrice(pendingPayment.item)
        : getItemCurrencyPrice(pendingPayment.item)
    : 0

  const pendingName = pendingPayment
    ? pendingPayment.kind === 'bundle'
      ? t.shop.supporterTitle
      : pendingPayment.kind === 'gift'
        ? (giftLabels[pendingPayment.item.slug as keyof typeof giftLabels]?.name ??
          pendingPayment.item.name)
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
  const isViewingScene = activeTab === 'scene'
  const focusedSceneGiftUnlocked = isViewingScene && isSceneGiftUnlocked(focusedSceneGift.id)
  const focusedItemOwned = isViewingScene
    ? false
    : isViewingSpecies
      ? isSpeciesUnlocked(focusedSpecies.id)
      : isAccessoryUnlocked(focusedAccessory.id)
  const focusedItemEquipped = isViewingScene
    ? false
    : isViewingSpecies
      ? loadout.species === focusedSpecies.id
      : !isPreviewingDifferentCompanion &&
        loadout.equipped[focusedAccessory.slot] === focusedAccessory.id
  const focusedCommitPrice = isViewingScene
    ? null
    : isViewingSpecies
      ? focusedSpecies.priceCommits
      : focusedAccessory.priceCommits
  const focusedIsPixOnly = isViewingScene
    ? true
    : isViewingSpecies
      ? Boolean(focusedSpecies.pixOnly || focusedSpecies.priceCommits === null)
      : Boolean(focusedAccessory.pixOnly || focusedAccessory.priceCommits === null)
  const focusedCurrencyPrice = isViewingScene
    ? getGiftCurrencyPrice(focusedSceneGift)
    : isViewingSpecies
      ? getItemCurrencyPrice(focusedSpecies)
      : getItemCurrencyPrice(focusedAccessory)
  const focusedSceneGiftCopy =
    giftLabels[focusedSceneGift.slug as keyof typeof giftLabels]
  const focusedDisplayName = isViewingScene
    ? (focusedSceneGiftCopy?.name ?? focusedSceneGift.name)
    : isViewingSpecies
      ? speciesLabels[focusedSpecies.id].name
      : accessoryLabels[focusedAccessory.id].name
  const focusedSceneGiftActiveCount = tree.gifts.filter(
    (g) => g.gift_id === focusedSceneGift.id || g.gift_slug === focusedSceneGift.slug,
  ).length
  const missingCommits =
    focusedCommitPrice !== null ? Math.max(0, focusedCommitPrice - availableCommits) : 0

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
                  resetPaymentUi()
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
                  resetPaymentUi()
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
            <div className="flex w-full items-center justify-between gap-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span>{t.shop.livePreview}</span>
                {!isViewingScene && isPreviewModeActive && (
                  <span className="rounded-sm border border-amber-400/50 bg-amber-500/15 px-1.5 py-0.2 font-bold uppercase text-amber-300">
                    {t.shop.previewBadge}
                  </span>
                )}
              </span>
              <span className="truncate font-semibold text-amber-300">
                {isViewingScene
                  ? focusedDisplayName
                  : previewSpeciesMeta
                    ? `${resolveCompanionDisplayName(
                        previewSpeciesMeta.id,
                        loadout.species === previewSpeciesMeta.id ? loadout.customName : undefined,
                        speciesLabels[previewSpeciesMeta.id].defaultName,
                      )} · ${speciesLabels[previewSpeciesMeta.id].name}`
                    : ''}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-center rounded-sm border border-slate-800/90 bg-gradient-to-b from-[#0a1633] via-[#102247] to-[#1a325c] p-2">
              {isViewingScene ? (
                <TreePixelCanvas tree={previewTreeWithSceneProp} scale={3} interactive={false} />
              ) : (
                <CompanionPreviewCanvas
                  species={previewCompanionId}
                  equipped={effectivePreviewEquipped}
                  sizePx={216}
                />
              )}
            </div>

            {/* Companion Story or Scene Prop Description Card */}
            {isViewingScene ? (
              <div className="mt-2.5 w-full rounded-sm border border-slate-800 bg-[#040811]/85 p-2.5 text-[11px]">
                <p className="text-[10px] font-semibold text-emerald-400">
                  {t.giftModal.rarity}: {focusedSceneGift.rarity.toUpperCase()} · @{username}
                </p>
                <p className="mt-1 leading-relaxed text-slate-300">
                  {focusedSceneGiftCopy?.description ?? focusedSceneGift.description}
                </p>
              </div>
            ) : (
              previewSpeciesMeta && (
                <div className="mt-2.5 w-full rounded-sm border border-slate-800 bg-[#040811]/85 p-2.5 text-[11px]">
                  <p className="text-[10px] font-semibold text-emerald-400">
                    {t.shop.storyLabel} · {speciesLabels[previewSpeciesMeta.id].defaultName}
                  </p>
                  <p className="mt-1 leading-relaxed text-slate-300">
                    &ldquo;{speciesLabels[previewSpeciesMeta.id].story}&rdquo;
                  </p>
                </div>
              )
            )}

            {/* Companion Custom Rename Control */}
            {!isViewingScene && loadout.species && (
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
                {focusedSceneGiftUnlocked ? (
                  <span className="shrink-0 rounded-sm border border-emerald-400/45 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    {t.giftModal.unlockedBadge}
                  </span>
                ) : (
                  !focusedItemOwned && (
                    <span className="shrink-0 text-[10px] font-semibold text-amber-300">
                      {focusedIsPixOnly
                        ? `${t.shop.supporterExclusiveNote} · ${formatCurrencyPrice(focusedCurrencyPrice, currency)}`
                        : `${focusedCommitPrice}c · ${formatCurrencyPrice(focusedCurrencyPrice, currency)}`}
                    </span>
                  )
                )}
              </div>

              {focusedSceneGiftUnlocked ? (
                <div className="mt-2.5 flex flex-col gap-2">
                  {focusedSceneGiftActiveCount > 0 && (
                    <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-emerald-500/40 bg-emerald-500/15 py-1 text-[10px] font-bold text-emerald-300">
                      <Check className="h-3 w-3" />
                      {focusedSceneGiftActiveCount}x {t.giftModal.onTreeCount}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => void handlePlaceUnlockedSceneGift(focusedSceneGift)}
                    className="pixel-btn pixel-btn-pine w-full rounded-sm px-3 py-2 text-xs font-bold disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{t.giftModal.placeGiftBtn}</span>
                  </button>
                </div>
              ) : focusedItemOwned ? (
                <div className="mt-2.5 space-y-1.5">
                  {focusedItemEquipped ? (
                    <div className="space-y-1.5">
                      <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-emerald-500/40 bg-emerald-500/15 py-1.5 text-[11px] font-bold text-emerald-300">
                        <Check className="h-3.5 w-3.5" />
                        {t.shop.activeOnTree}
                      </span>
                      {isViewingSpecies && !isViewingScene && (
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() => {
                            if (isMutating) return
                            setIsMutating(true)
                            void equipSpecies(username, null)
                              .then((res) => {
                                setFeedback(
                                  res.ok
                                    ? t.shop.companionRemovedMsg
                                    : (res.error ?? t.shop.companionRemovedMsg),
                                )
                              })
                              .finally(() => {
                                setIsMutating(false)
                              })
                          }}
                          className="pixel-btn pixel-btn-red w-full rounded-sm px-3 py-1.5 text-[11px] font-bold disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>{t.shop.removePetShort}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => {
                        if (isMutating) return
                        setIsMutating(true)
                        if (isViewingSpecies) {
                          const targetSpecies = focusedSpecies.id
                          void equipSpecies(username, targetSpecies)
                            .then((res) => {
                              setPreviewCompanionId(targetSpecies)
                              if (res.ok) {
                                setFeedback(`${focusedDisplayName} — ${t.shop.activeOnTree}!`)
                              } else if (res.error) {
                                setFeedback(res.error)
                              }
                            })
                            .finally(() => {
                              setIsMutating(false)
                            })
                        } else {
                          void toggleEquippedAccessory(
                            username,
                            focusedAccessory.slot,
                            focusedAccessory.id,
                          )
                            .then((res) => {
                              if (res.ok) {
                                if (!isPreviewingDifferentCompanion) {
                                  setPreviewAccessoryOverride((prev) =>
                                    setSlotOverride(prev, focusedAccessory.slot, undefined),
                                  )
                                }
                                setFeedback(`${focusedDisplayName} — ${t.shop.activeOnTree}!`)
                              } else if (res.error) {
                                setFeedback(res.error)
                              }
                            })
                            .finally(() => {
                              setIsMutating(false)
                            })
                        }
                      }}
                      className="pixel-btn pixel-btn-pine w-full rounded-sm px-3 py-2 text-xs font-bold disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{t.shop.equipBtn}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-2.5 flex flex-col gap-2">
                  {isViewingScene && focusedSceneGiftActiveCount > 0 && (
                    <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-emerald-500/40 bg-emerald-500/15 py-1 text-[10px] font-bold text-emerald-300">
                      <Check className="h-3 w-3" />
                      {focusedSceneGiftActiveCount}x {t.giftModal.onTreeCount}
                    </span>
                  )}

                  {focusedIsPixOnly ? (
                    <p className="rounded-sm border border-emerald-400/35 bg-emerald-950/50 px-2.5 py-1.5 text-[10px] leading-snug text-emerald-200">
                      {currency === 'USD' ? t.shop.cardOnlyNotice : t.shop.pixOnlyNotice}
                    </p>
                  ) : (
                    /* Primary green button: Adopt / Equip by commits (disabled with missing hint if insufficient) */
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
                  )}

                  {/* Gold/highlighted button: Unlock / Place via Pix (BRL) or Card (USD) */}
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => {
                      handleOpenOrStartPayment(
                        isViewingScene
                          ? { kind: 'gift', item: focusedSceneGift }
                          : isViewingSpecies
                            ? { kind: 'species', item: focusedSpecies }
                            : { kind: 'accessory', item: focusedAccessory },
                        'focused',
                      )
                    }}
                    className={`pixel-btn w-full rounded-sm px-3 py-2 text-xs font-bold disabled:opacity-60 ${
                      focusedIsPixOnly
                        ? 'pixel-btn-gold'
                        : missingCommits > 0
                          ? 'pixel-btn-red'
                          : 'pixel-btn-gold'
                    }`}
                  >
                    {isMutating && mutatingSource === 'focused' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Heart className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isMutating && mutatingSource === 'focused'
                        ? t.shop.generatingCheckout
                        : isViewingScene
                          ? `${t.giftModal.giftSpecialBtn} (${formatCurrencyPrice(focusedCurrencyPrice, currency)})`
                          : `${currency === 'BRL' ? t.shop.unlockPix : t.shop.unlockCard} (${formatCurrencyPrice(focusedCurrencyPrice, currency)})`}
                    </span>
                  </button>

                  {paymentError?.source === 'focused' && (
                    <p
                      role="alert"
                      className="rounded-sm border border-rose-500/50 bg-rose-950/75 px-2.5 py-1.5 text-[11px] leading-snug text-rose-200"
                    >
                      {paymentError.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            {!loadout.species && (
              <p className="mt-2 text-center text-[11px] text-amber-300/90">
                {t.shop.noPetHint}
              </p>
            )}

            <dl className="mt-2.5 w-full space-y-1 rounded-sm border border-slate-800 bg-[#040811]/85 p-2.5 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">{t.shop.headLabel}</dt>
                <dd className="flex min-w-0 items-center gap-1.5 text-slate-200">
                  <span className="truncate">
                    {activeHead ? accessoryLabels[activeHead.id].name : '—'}
                  </span>
                  {activeHead &&
                    (isPreviewingDifferentCompanion ||
                      previewAccessoryOverride.head !== undefined ||
                      activeHead.id !== loadout.equipped.head) && (
                      <span className="shrink-0 rounded-sm border border-amber-400/45 bg-amber-500/15 px-1 text-[9px] font-semibold uppercase text-amber-300">
                        {t.shop.previewBadge}
                      </span>
                    )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">{t.shop.bodyLabel}</dt>
                <dd className="flex min-w-0 items-center gap-1.5 text-slate-200">
                  <span className="truncate">
                    {activeBody ? accessoryLabels[activeBody.id].name : '—'}
                  </span>
                  {activeBody &&
                    (isPreviewingDifferentCompanion ||
                      previewAccessoryOverride.body !== undefined ||
                      activeBody.id !== loadout.equipped.body) && (
                      <span className="shrink-0 rounded-sm border border-amber-400/45 bg-amber-500/15 px-1 text-[9px] font-semibold uppercase text-amber-300">
                        {t.shop.previewBadge}
                      </span>
                    )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">{t.shop.handLabel}</dt>
                <dd className="flex min-w-0 items-center gap-1.5 text-slate-200">
                  <span className="truncate">
                    {activeHand ? accessoryLabels[activeHand.id].name : '—'}
                  </span>
                  {activeHand &&
                    (isPreviewingDifferentCompanion ||
                      previewAccessoryOverride.hand !== undefined ||
                      activeHand.id !== loadout.equipped.hand) && (
                      <span className="shrink-0 rounded-sm border border-amber-400/45 bg-amber-500/15 px-1 text-[9px] font-semibold uppercase text-amber-300">
                        {t.shop.previewBadge}
                      </span>
                    )}
                </dd>
              </div>
              {activeTab === 'customize' &&
                isPreviewingDifferentCompanion &&
                isSpeciesUnlocked(previewCompanionId) && (
                  <div className="pt-1.5">
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => {
                        if (isMutating) return
                        setIsMutating(true)
                        const targetSpecies = previewCompanionId
                        void equipSpecies(username, targetSpecies)
                          .then((res) => {
                            setPreviewCompanionId(targetSpecies)
                            if (res.ok) {
                              setFeedback(
                                `${speciesLabels[targetSpecies].name} — ${t.shop.activeOnTree}!`,
                              )
                            } else if (res.error) {
                              setFeedback(res.error)
                            }
                          })
                          .finally(() => {
                            setIsMutating(false)
                          })
                      }}
                      className="pixel-btn pixel-btn-pine w-full rounded-sm px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-60"
                    >
                      <Check className="h-3 w-3" />
                      <span>
                        {t.shop.equipBtn} {speciesLabels[previewCompanionId].defaultName}
                      </span>
                    </button>
                  </div>
                )}
              {hasAccessoryPreviewOverride && (
                <div className="pt-1 text-right">
                  <button
                    type="button"
                    onClick={() => setPreviewAccessoryOverride({})}
                    className="text-[10px] font-medium text-amber-300 hover:text-amber-200 hover:underline cursor-pointer"
                  >
                    {t.shop.clearPreviewBtn}
                  </button>
                </div>
              )}
            </dl>

            {loadout.species && (
              <button
                type="button"
                disabled={isMutating}
                onClick={() => {
                  if (isMutating) return
                  setIsMutating(true)
                  void equipSpecies(username, null)
                    .then((res) => {
                      setFeedback(
                        res.ok
                          ? t.shop.companionRemovedMsg
                          : (res.error ?? t.shop.companionRemovedMsg),
                      )
                    })
                    .finally(() => {
                      setIsMutating(false)
                    })
                }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-sm border border-rose-500/45 bg-rose-950/40 px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 hover:border-rose-400 hover:bg-rose-900/50 hover:text-white disabled:opacity-60 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>{t.shop.removePet}</span>
              </button>
            )}
          </aside>

          {/* Right Column: Tabs, Species Grid, Accessories, Scene Props, Supporter Bundle & Checkout */}
          <div className="flex flex-col">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('species')
                  resetPaymentUi()
                }}
                className={`pixel-btn rounded-sm px-3 py-2 text-xs font-bold ${
                  activeTab === 'species' ? 'pixel-btn-pine' : 'pixel-btn-wood'
                }`}
              >
                <PawPrint className="h-3.5 w-3.5" />
                <span>
                  {t.shop.tabSpecies} ({unlockedSpeciesCount}/{COMPANION_SPECIES_CATALOG.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('customize')
                  resetPaymentUi()
                }}
                className={`pixel-btn rounded-sm px-3 py-2 text-xs font-bold ${
                  activeTab === 'customize' ? 'pixel-btn-pine' : 'pixel-btn-wood'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>
                  {t.shop.tabCustomize} ({unlockedAccessoriesCount}/{COMPANION_ACCESSORIES_CATALOG.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('scene')
                  resetPaymentUi()
                }}
                className={`pixel-btn rounded-sm px-3 py-2 text-xs font-bold ${
                  activeTab === 'scene' ? 'pixel-btn-pine' : 'pixel-btn-wood'
                }`}
              >
                <Rocket className="h-3.5 w-3.5 text-emerald-300" />
                <span>
                  {currency === 'USD' ? t.shop.tabScenePropsUsd : t.shop.tabSceneProps} (
                  {sceneGifts.length})
                </span>
              </button>
            </div>

            {/* Tab 1: Companion Species Grid */}
            {activeTab === 'species' && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {COMPANION_SPECIES_CATALOG.map((sp) => {
                  const owned = isSpeciesUnlocked(sp.id)
                  const isEquipped = loadout.species === sp.id
                  const isFocused = focusedSpeciesId === sp.id
                  const copy = speciesLabels[sp.id]
                  const priceFiat = formatCurrencyPrice(getItemCurrencyPrice(sp), currency)
                  const isPixOnly = Boolean(sp.pixOnly || sp.priceCommits === null)

                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => handleSelectSpeciesCard(sp)}
                      className={`flex flex-col justify-between rounded-sm border p-3 text-left transition cursor-pointer ${
                        isFocused
                          ? 'border-emerald-400 bg-[#0d221c]/90'
                          : isPixOnly
                            ? 'border-emerald-700/50 bg-[#070d1f]/85 hover:border-emerald-500/70'
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

                      <div className="mt-2.5 flex items-center justify-between gap-2 text-[10px]">
                        {isEquipped ? (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">
                            <Check className="h-3 w-3" /> {t.shop.activeOnTree}
                          </span>
                        ) : owned ? (
                          <span className="rounded-sm bg-sky-500/20 px-2 py-0.5 font-semibold text-sky-300">
                            {t.giftModal.unlockedBadge}
                          </span>
                        ) : isPixOnly ? (
                          <>
                            <span className="rounded-sm border border-emerald-400/45 bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-300">
                              {currency === 'USD' ? t.shop.cardOnlyBadge : t.shop.pixOnlyBadge}
                            </span>
                            <span className="font-bold text-amber-300">{priceFiat}</span>
                          </>
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
                        resetPaymentUi()
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
                    const equippedInSlot =
                      !isPreviewingDifferentCompanion && loadout.equipped[acc.slot] === acc.id
                    const isPreviewingThisAcc =
                      !equippedInSlot && effectivePreviewEquipped[acc.slot] === acc.id
                    const isFocused = focusedAccessoryId === acc.id || isPreviewingThisAcc
                    const copy = accessoryLabels[acc.id]
                    const priceFiat = formatCurrencyPrice(getItemCurrencyPrice(acc), currency)
                    const isPixOnly = Boolean(acc.pixOnly || acc.priceCommits === null)

                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleSelectAccessoryCard(acc)}
                        className={`flex flex-col justify-between rounded-sm border p-3 text-left transition cursor-pointer ${
                          isFocused
                            ? 'border-emerald-400 bg-[#0d221c]/90'
                            : isPixOnly
                              ? 'border-emerald-700/50 bg-[#070d1f]/85 hover:border-emerald-500/70'
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

                        <div className="mt-2.5 flex items-center justify-between gap-2 text-[10px]">
                          {equippedInSlot ? (
                            <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">
                              <Check className="h-3 w-3" /> {t.shop.equippedClickRemove}
                            </span>
                          ) : isPreviewingThisAcc ? (
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="rounded-sm border border-amber-400/50 bg-amber-500/15 px-1.5 py-0.5 font-bold uppercase text-amber-300">
                                {t.shop.previewBadge}
                              </span>
                              <span className="font-bold text-amber-300">
                                {isPixOnly
                                  ? priceFiat
                                  : owned
                                    ? t.shop.unlockedClickEquip
                                    : `${acc.priceCommits} ${t.shop.commitsWord}`}
                              </span>
                            </div>
                          ) : owned ? (
                            <span className="rounded-sm bg-sky-500/20 px-2 py-0.5 font-semibold text-sky-300">
                              {t.shop.unlockedClickEquip}
                            </span>
                          ) : isPixOnly ? (
                            <>
                              <span className="rounded-sm border border-emerald-400/45 bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-300">
                                {currency === 'USD' ? t.shop.cardOnlyBadge : t.shop.pixOnlyBadge}
                              </span>
                              <span className="font-bold text-amber-300">{priceFiat}</span>
                            </>
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

            {/* Tab 3: Exclusive 3D Scene Objects (Pix / Card Only) */}
            {activeTab === 'scene' && (
              <div className="mt-3 flex flex-col gap-3">
                <p className="rounded-sm border border-emerald-400/35 bg-emerald-950/45 px-3 py-2 text-[11px] leading-snug text-emerald-200">
                  {currency === 'USD' ? t.shop.cardOnlyNotice : t.shop.pixOnlyNotice}
                </p>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  {sceneGifts.map((gift) => {
                    const isFocused = focusedSceneGift.id === gift.id
                    const giftCopy = giftLabels[gift.slug as keyof typeof giftLabels]
                    const displayName = giftCopy?.name ?? gift.name
                    const displayDesc = giftCopy?.description ?? gift.description
                    const priceFiat = formatCurrencyPrice(getGiftCurrencyPrice(gift), currency)
                    const activeCount = tree.gifts.filter(
                      (g) => g.gift_id === gift.id || g.gift_slug === gift.slug,
                    ).length
                    const unlockedSceneGift = isSceneGiftUnlocked(gift.id)

                    return (
                      <button
                        key={gift.id}
                        type="button"
                        onClick={() => {
                          setFocusedSceneGiftId(gift.id)
                          resetPaymentUi()
                          setFeedback(null)
                        }}
                        className={`flex flex-col justify-between rounded-sm border p-3.5 text-left transition cursor-pointer ${
                          isFocused
                            ? 'border-emerald-400 bg-[#0d221c]/90'
                            : 'border-emerald-700/50 bg-[#070d1f]/85 hover:border-emerald-500/70'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className="text-xs font-bold"
                              style={{ color: gift.accentColor }}
                            >
                              {displayName}
                            </span>
                            <span
                              className="h-3.5 w-3.5 shrink-0 rounded-[2px] border border-white/25"
                              style={{ backgroundColor: gift.accentColor }}
                            />
                          </div>

                          <p className="mt-1.5 text-[11px] leading-snug text-slate-300">
                            {displayDesc}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-[10px]">
                          {unlockedSceneGift ? (
                            <span className="rounded-sm bg-sky-500/20 px-2 py-0.5 font-semibold text-sky-300">
                              {t.giftModal.unlockedBadge}
                            </span>
                          ) : (
                            <span className="rounded-sm border border-emerald-400/45 bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-300">
                              {currency === 'USD' ? t.shop.cardOnlyBadge : t.shop.pixOnlyBadge}
                            </span>
                          )}
                          <div className="flex items-center gap-2">
                            {activeCount > 0 && (
                              <span className="rounded-sm bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-300">
                                {activeCount}x {t.giftModal.onTreeCount}
                              </span>
                            )}
                            {!unlockedSceneGift && (
                              <span className="font-bold text-amber-300">{priceFiat}</span>
                            )}
                          </div>
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
                    disabled={isMutating}
                    onClick={() => handleOpenOrStartPayment({ kind: 'bundle' }, 'bundle')}
                    className="pixel-btn pixel-btn-gold shrink-0 rounded-sm px-3.5 py-2 text-xs font-bold disabled:opacity-60"
                  >
                    {isMutating && mutatingSource === 'bundle' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Heart className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isMutating && mutatingSource === 'bundle'
                        ? t.shop.generatingCheckout
                        : `${t.shop.supporterBtn} (${formatCurrencyPrice(bundlePrice, currency)})`}
                    </span>
                  </button>
                )}
              </div>
              {paymentError?.source === 'bundle' && (
                <p
                  role="alert"
                  className="mt-2 rounded-sm border border-rose-500/50 bg-rose-950/75 px-2.5 py-1.5 text-[11px] leading-snug text-rose-200"
                >
                  {paymentError.message}
                </p>
              )}
            </div>

            {/* Dual Payment Panel (Real Mercado Pago Pix / Stripe Checkout in production, Local Preview offline) */}
            {pendingPayment && paymentPreview && (
              <div
                ref={paymentPanelRef}
                className="mt-3 rounded-sm border-2 border-amber-400/55 bg-[#111c36] p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      {currency === 'BRL' ? (
                        <QrCode className="h-3.5 w-3.5 text-emerald-300" />
                      ) : (
                        <CreditCard className="h-3.5 w-3.5 text-sky-300" />
                      )}
                      {currency === 'BRL' ? t.shop.checkoutPixTitle : t.shop.checkoutUsdTitle} —{' '}
                      {pendingName}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-300">
                      <strong className="text-emerald-300">
                        {formatCurrencyPrice(paymentPreview.amount, currency)}
                      </strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPayment(null)
                      setPixOrder(null)
                    }}
                    className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    {t.shop.cancel}
                  </button>
                </div>

                {isSupabaseReady ? (
                  !session ? (
                    <div className="mt-3 space-y-2">
                      <p className="rounded-sm border border-sky-400/35 bg-[#040811]/90 p-2.5 text-[11px] text-sky-100">
                        {currency === 'USD' ? t.shop.loginRequiredCard : t.shop.loginRequiredPaid}
                      </p>
                      <button
                        type="button"
                        onClick={() => void connectWithGitHub()}
                        className="pixel-btn pixel-btn-red rounded-sm px-3.5 py-2 text-xs font-bold"
                      >
                        <GitHubIcon className="h-3.5 w-3.5" />
                        <span>{t.connectModal.authorize}</span>
                      </button>
                    </div>
                  ) : pixOrder && currency === 'BRL' ? (
                    <PixCheckoutBox
                      order={pixOrder}
                      itemLabel={pendingName}
                      onConfirmed={handlePixPaymentConfirmed}
                      onCancel={() => setPixOrder(null)}
                    />
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] text-sky-200/85">{t.shop.phase7Notice}</p>
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={() => void handleConfirmPaymentUnlock()}
                        className="pixel-btn pixel-btn-gold shrink-0 rounded-sm px-3.5 py-2 text-xs font-bold disabled:opacity-60"
                      >
                        {isMutating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : currency === 'BRL' ? (
                          <QrCode className="h-3.5 w-3.5" />
                        ) : (
                          <CreditCard className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {isMutating
                            ? t.shop.generatingCheckout
                            : currency === 'BRL'
                              ? t.shop.generatePixBtn
                              : t.shop.payWithStripeBtn}
                        </span>
                      </button>
                    </div>
                  )
                ) : (
                  <>
                    {currency === 'USD' && (
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-slate-700 bg-[#040811]/90 px-3 py-2 text-[11px]">
                        {toSafeHttpUrl(paymentPreview.checkoutUrl) ? (
                          <>
                            <span className="text-slate-300">
                              Ref:{' '}
                              <code className="text-sky-300">
                                {paymentPreview.externalReference}
                              </code>
                            </span>
                            <a
                              href={toSafeHttpUrl(paymentPreview.checkoutUrl) ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
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
                  </>
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
