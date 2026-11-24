import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, QrCode, RefreshCw } from 'lucide-react'
import { formatBrlPrice } from '../../config/supportCampaign'
import { useLocale } from '../../context/localeContextStore'
import {
  fetchMyPaymentOrderStatus,
  type PixPaymentOrder,
} from '../../services/paymentService'
import { toSafeHttpUrl } from '../../utils/urlSafety'

interface PixCheckoutBoxProps {
  order: PixPaymentOrder
  itemLabel: string
  onConfirmed: () => Promise<void> | void
  onCancel: () => void
}

const POLL_INTERVAL_MS = 3000

export function PixCheckoutBox({
  order,
  itemLabel,
  onConfirmed,
  onCancel,
}: PixCheckoutBoxProps) {
  const { t } = useLocale()
  const [codeCopied, setCodeCopied] = useState(false)
  const [pollState, setPollState] = useState<{
    orderId: string
    statusMsg: string | null
    hasFailed: boolean
  }>({ orderId: order.orderId, statusMsg: null, hasFailed: false })
  const [isChecking, setIsChecking] = useState(false)
  const confirmedRef = useRef<string | null>(null)

  const activeStatusMsg = pollState.orderId === order.orderId ? pollState.statusMsg : null
  const activeHasFailed = pollState.orderId === order.orderId ? pollState.hasFailed : false

  const verifyOrderStatus = useCallback(async () => {
    if (confirmedRef.current === order.orderId) return
    setIsChecking(true)
    try {
      const record = await fetchMyPaymentOrderStatus(order.orderId)
      if (!record) return

      if (record.status === 'paid' && confirmedRef.current !== order.orderId) {
        confirmedRef.current = order.orderId
        setPollState({ orderId: order.orderId, statusMsg: t.shop.pixConfirmed, hasFailed: false })
        await onConfirmed()
      } else if (record.status === 'failed') {
        setPollState({
          orderId: order.orderId,
          statusMsg: t.shop.pixExpiredOrFailed,
          hasFailed: true,
        })
      }
    } finally {
      setIsChecking(false)
    }
  }, [order.orderId, onConfirmed, t.shop.pixConfirmed, t.shop.pixExpiredOrFailed])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void verifyOrderStatus()
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [order.orderId, verifyOrderStatus])

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(order.qrCode)
      setCodeCopied(true)
      window.setTimeout(() => setCodeCopied(false), 1800)
    } catch {
      // Ignore clipboard failures in restricted environments.
    }
  }

  const safeTicketUrl = toSafeHttpUrl(order.ticketUrl)
  const formattedAmount = formatBrlPrice(order.amountCents / 100)
  const expiresTime = (() => {
    const parsed = Date.parse(order.expiresAt)
    if (Number.isNaN(parsed)) return null
    return new Date(parsed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })()

  return (
    <div className="@container mt-3 w-full min-w-0 overflow-hidden rounded-sm border-2 border-emerald-400/55 bg-[#0a1929] p-4 text-[11px]">
      <div className="flex items-start justify-between gap-3 border-b border-emerald-500/20 pb-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-emerald-300">
            <QrCode className="h-4 w-4 shrink-0" />
            <span className="break-words">
              {t.shop.pixWaitingTitle}: {itemLabel}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-slate-300">
            <strong className="text-amber-300">{formattedAmount}</strong>
            {expiresTime ? ` · ${t.shop.pixExpiresAt} ${expiresTime}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-sm border border-slate-700/80 px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
        >
          {t.shop.cancel}
        </button>
      </div>

      <div className="mt-3.5 grid grid-cols-1 items-center gap-4 @md:grid-cols-[auto_minmax(0,1fr)] @md:items-start">
        {order.qrCodeBase64 && (
          <div className="mx-auto shrink-0 rounded-sm border border-slate-600 bg-white p-2 @md:mx-0">
            <img
              src={`data:image/png;base64,${order.qrCodeBase64}`}
              alt={`QR Code Pix ${itemLabel}`}
              className="block h-36 w-36 object-contain"
            />
          </div>
        )}

        <div className="w-full min-w-0 space-y-2.5">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t.shop.pixCopyCodeLabel}
            </p>
            <div className="flex w-full min-w-0 items-center gap-1.5 rounded-sm border border-slate-700 bg-[#040811] p-1.5">
              <input
                type="text"
                readOnly
                aria-label={t.shop.pixCopyCodeLabel}
                value={order.qrCode}
                onFocus={(e) => e.currentTarget.select()}
                className="w-0 min-w-0 flex-1 truncate bg-transparent px-1 font-mono text-[10px] text-amber-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-[10px] font-semibold text-slate-100 hover:border-emerald-400 cursor-pointer"
              >
                {codeCopied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span>{codeCopied ? t.shop.copied : t.shop.copy}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void verifyOrderStatus()}
              disabled={isChecking || activeHasFailed}
              className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-60 cursor-pointer"
            >
              {isChecking ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              <span>{t.shop.checkStatusBtn}</span>
            </button>

            {safeTicketUrl && (
              <a
                href={safeTicketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-sky-300 hover:underline"
              >
                <span>Mercado Pago</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <p className="text-[10px] leading-relaxed text-sky-200/90">
            {activeStatusMsg ?? t.shop.pixAutoConfirmHint}
          </p>
        </div>
      </div>
    </div>
  )
}
