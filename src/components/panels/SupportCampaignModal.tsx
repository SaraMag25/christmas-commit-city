import { useState } from 'react'
import { Check, Copy, ExternalLink, Heart, Sparkles, X } from 'lucide-react'
import {
  CREATOR_CAMPAIGN,
  formatCurrencyPrice,
  getInternationalCheckoutUrl,
  SUPPORTER_BUNDLE,
} from '../../config/supportCampaign'
import { useCity } from '../../context/cityContextStore'
import { useLocale } from '../../context/localeContextStore'
import { CAMPAIGN_COPY } from '../../i18n/translations'

interface SupportCampaignModalProps {
  targetUsername?: string
  onClose: () => void
}

export function SupportCampaignModal({
  targetUsername = 'SaraMag25',
  onClose,
}: SupportCampaignModalProps) {
  const { language, currency, setCurrency, t } = useLocale()
  const { isSupabaseReady, getCompanionLoadout, unlockSupporterBundle } = useCity()
  const [copied, setCopied] = useState(false)
  const [bundleUnlockedMsg, setBundleUnlockedMsg] = useState<string | null>(null)
  const [bundleError, setBundleError] = useState<string | null>(null)

  const campaignCopy = CAMPAIGN_COPY[language]
  const loadout = getCompanionLoadout(targetUsername)
  const checkoutUrl = getInternationalCheckoutUrl()
  const bundlePrice =
    currency === 'BRL' ? SUPPORTER_BUNDLE.priceBrl : SUPPORTER_BUNDLE.priceUsd

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(CREATOR_CAMPAIGN.pixKey)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Ignore clipboard failures.
    }
  }

  const handleUnlockBundle = async () => {
    setBundleError(null)
    const res = await unlockSupporterBundle(targetUsername, currency)
    if (res.ok) {
      setBundleUnlockedMsg(t.shop.supporterUnlocked)
    } else if (res.error) {
      setBundleError(res.error)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.supportModal.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-xs sm:p-6"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto pixel-night-panel rounded-md p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <p className="text-[11px] text-emerald-400">
              $ support campaign --currency={currency}
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-base font-bold text-amber-300">
              <Heart className="h-4 w-4 fill-rose-500 text-rose-400" />
              <span>{t.supportModal.title}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.supportModal.close}
            className="rounded-sm border border-slate-700 p-1 text-slate-400 hover:border-slate-500 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Currency Switcher */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            {campaignCopy.course} · {campaignCopy.university}
          </span>
          <div className="flex rounded-sm border border-slate-700 bg-[#040811] p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setCurrency('BRL')}
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
              onClick={() => setCurrency('USD')}
              className={`rounded-[2px] px-2.5 py-1 font-semibold transition cursor-pointer ${
                currency === 'USD'
                  ? 'bg-sky-500/25 text-sky-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.shop.currencyUsdLabel}
            </button>
          </div>
        </div>

        {/* Authentic Story */}
        <blockquote className="mt-3 space-y-2.5 rounded-sm border border-amber-400/35 bg-[#040811]/90 p-4 text-xs leading-relaxed text-slate-200">
          {campaignCopy.paragraphs.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </blockquote>

        {/* Supporter Bundle Box */}
        <div className="mt-4 rounded-sm border border-amber-400/45 bg-gradient-to-r from-[#1a1333]/90 to-[#0f2438]/90 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Sparkles className="h-4 w-4" />
            <span>{t.supportModal.supporterTitle}</span>
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
            {t.supportModal.supporterDesc}
          </p>

          <div className="mt-3">
            {loadout.supporterBundleUnlocked ? (
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-[11px] font-bold text-emerald-200">
                <Check className="h-3.5 w-3.5" /> {t.supportModal.supporterDone}
              </span>
            ) : isSupabaseReady ? (
              <p className="rounded-sm border border-amber-400/40 bg-amber-950/35 p-2.5 text-[11px] leading-relaxed text-amber-100">
                {t.shop.phase7Notice}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void handleUnlockBundle()}
                className="pixel-btn pixel-btn-gold rounded-sm px-4 py-2 text-xs font-bold"
              >
                <Heart className="h-3.5 w-3.5" />
                <span>
                  {t.supportModal.supporterCta} {formatCurrencyPrice(bundlePrice, currency)}
                </span>
              </button>
            )}
          </div>
          {bundleError && (
            <p className="mt-2 text-[11px] text-amber-200">{bundleError}</p>
          )}
        </div>

        {/* Direct Contribution Details (Pix BRL or International USD) */}
        <div className="mt-4 rounded-sm border border-slate-800 bg-[#040811]/85 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-100">{t.supportModal.directTitle}</p>
            <span className="text-[11px] text-emerald-300">
              {t.supportModal.goal}: {formatCurrencyPrice(currency === 'BRL' ? CREATOR_CAMPAIGN.goalAmount : 1000, currency)}
            </span>
          </div>

          {currency === 'BRL' ? (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-slate-300">{t.supportModal.directPixDesc}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-slate-700 bg-[#070d1f] px-3 py-2 text-[11px]">
                <span className="truncate text-amber-200">
                  {t.shop.pixKeyLabel}: <code>{CREATOR_CAMPAIGN.pixKey}</code>
                </span>
                <button
                  type="button"
                  onClick={handleCopyPix}
                  className="inline-flex items-center gap-1 rounded-sm border border-slate-700 px-2.5 py-1 text-[10px] text-slate-200 hover:border-amber-400 cursor-pointer"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? t.shop.copied : t.shop.copy}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-slate-300">{t.supportModal.directUsdDesc}</p>
              {checkoutUrl ? (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="pixel-btn pixel-btn-pine inline-flex rounded-sm px-4 py-2 text-xs font-bold"
                >
                  <span>{t.shop.openCheckout}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="rounded-sm border border-slate-800 bg-[#070d1f] p-2.5 text-[10px] text-sky-200">
                  {t.shop.noCheckoutEnv}
                </p>
              )}
            </div>
          )}
        </div>

        {bundleUnlockedMsg && (
          <p className="mt-3 rounded-sm border border-emerald-500/40 bg-emerald-950/60 px-3 py-2 text-[11px] text-emerald-200">
            &gt; {bundleUnlockedMsg}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn pixel-btn-wood rounded-sm px-4 py-1.5 text-xs font-bold"
          >
            {t.supportModal.close}
          </button>
        </div>
      </div>
    </div>
  )
}
