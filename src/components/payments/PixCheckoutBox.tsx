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
    <div className="mt-3 rounded-sm border-2 border-emerald-400/55 bg-[#081621] p-3.5 text-[11px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
            <QrCode className="h-3.5 w-3.5" />
            <span>
              {t.shop.pixWaitingTitle} — {itemLabel}
            </span>
          </p>
          <p className="mt-0.5 text-slate-300">
            <strong className="text-amber-300">{formattedAmount}</strong>
            {expiresTime ? ` · ${t.shop.pixExpiresAt} ${expiresTime}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
        >
          {t.shop.cancel}
        </button>
      </div>

      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {order.qrCodeBase64 && (
          <div className="shrink-0 rounded-sm border border-slate-700 bg-white p-1.5">
            <img
              src={`data:image/png;base64,${order.qrCodeBase64}`}
              alt={`QR Code Pix ${itemLabel}`}
              className="h-32 w-32 object-contain"
            />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t.shop.pixCopyCodeLabel}
          </p>
          <div className="flex items-center gap-1.5 rounded-sm border border-slate-700 bg-[#040811] px-2.5 py-1.5">
            <code className="min-w-0 flex-1 truncate text-[10px] text-amber-200">
              {order.qrCode}
            </code>
            <button
              type="button"
              onClick={() => void handleCopyCode()}
              className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-emerald-400 cursor-pointer"
            >
              {codeCopied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <span>{codeCopied ? t.shop.copied : t.shop.copy}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => void verifyOrderStatus()}
              disabled={isChecking || activeHasFailed}
              className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-60 cursor-pointer"
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
