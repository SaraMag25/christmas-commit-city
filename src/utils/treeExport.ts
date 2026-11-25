import type { AppLanguage } from '../i18n/translations'

export interface TreeExportCardOptions {
  size: number
  username: string
  commits: number
  periodYear: number
  level: number
  stageName: string
  language: AppLanguage
}

export interface TreeExportCardCompositor {
  size: number
  sceneWidth: number
  sceneHeight: number
  composeFrameData: (webglCanvas: HTMLCanvasElement) => Uint8ClampedArray
  exportPngBlob: () => Promise<Blob | null>
  dispose: () => void
}

const HEATMAP_PALETTE = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'] as const

/** Sanitizes a GitHub username into a safe cross-platform download slug. */
export function sanitizeExportSlug(username: string): string {
  const cleaned = username
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'developer'
}

/** Triggers a clean browser file download and schedules Object URL revocation. */
export function downloadExportBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1500)
}

/**
 * Reusable 2D Canvas compositor that wraps rendered WebGL frames inside a
 * minimalist terminal-aesthetic card (footer metadata + border drawn once).
 */
export function createTreeExportCardCompositor(
  options: TreeExportCardOptions,
): TreeExportCardCompositor {
  const { size, username, commits, periodYear, level, stageName, language } = options
  const footerHeight = Math.round(size * 0.155)
  const borderWidth = Math.max(2, Math.round(size * 0.004))
  const sceneHeight = size - footerHeight - borderWidth
  const sceneWidth = size - borderWidth * 2

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for tree export.')
  }

  const scale = size / 1080
  const padX = Math.round(36 * scale)
  const cleanUser = username.trim().replace(/^@+/, '') || 'developer'
  const levelCode = String(Math.max(0, level)).padStart(2, '0')
  const formattedCommits = Math.max(0, Math.floor(commits)).toLocaleString(
    language === 'en' ? 'en-US' : 'pt-BR',
  )

  const paintChromeAndFooter = () => {
    // Outer night frame + glowing top/footer borders
    ctx.fillStyle = '#060b16'
    ctx.fillRect(0, 0, size, size)

    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, size, borderWidth)
    ctx.fillRect(0, size - borderWidth, size, borderWidth)
    ctx.fillRect(0, 0, borderWidth, size)
    ctx.fillRect(size - borderWidth, 0, borderWidth, size)

    // Minimalist pixel accents in upper corners
    const corner = Math.max(6, Math.round(14 * scale))
    ctx.fillStyle = '#34d399'
    ctx.fillRect(0, 0, corner, borderWidth)
    ctx.fillRect(0, 0, borderWidth, corner)
    ctx.fillRect(size - corner, 0, corner, borderWidth)
    ctx.fillRect(size - borderWidth, 0, borderWidth, corner)

    const footerTop = size - footerHeight
    ctx.fillStyle = '#050a16'
    ctx.fillRect(borderWidth, footerTop, sceneWidth, footerHeight - borderWidth)

    // Crisp emerald divider between 3D diorama and terminal footer
    const dividerH = Math.max(2, Math.round(2 * scale))
    ctx.fillStyle = '#1f7a4c'
    ctx.fillRect(borderWidth, footerTop, sceneWidth, dividerH)

    ctx.textBaseline = 'middle'

    const topRowY = footerTop + Math.round(footerHeight * 0.3)
    const mainRowY = footerTop + Math.round(footerHeight * 0.68)

    // Top row left: terminal prompt
    ctx.font = `600 ${Math.round(20 * scale)}px "JetBrains Mono", ui-monospace, SFMono-Regular, monospace`
    ctx.fillStyle = '#34d399'
    ctx.textAlign = 'left'
    ctx.fillText(`$ tree inspect @${cleanUser}`, padX, topRowY)

    // Top row right: GitHub commit palette squares + discreet signature
    const sqSize = Math.max(5, Math.round(12 * scale))
    const sqGap = Math.max(2, Math.round(4 * scale))
    const paletteWidth = HEATMAP_PALETTE.length * (sqSize + sqGap)
    ctx.font = `600 ${Math.round(18 * scale)}px "JetBrains Mono", ui-monospace, SFMono-Regular, monospace`
    ctx.fillStyle = '#94a3b8'
    ctx.textAlign = 'right'
    const brandText = 'Christmas Commit City'
    const brandX = size - padX
    ctx.fillText(brandText, brandX, topRowY)

    const brandMetrics = ctx.measureText(brandText)
    const paletteStartX = Math.round(brandX - brandMetrics.width - paletteWidth - 14 * scale)
    if (paletteStartX > size * 0.45) {
      for (let i = 0; i < HEATMAP_PALETTE.length; i += 1) {
        ctx.fillStyle = HEATMAP_PALETTE[i]
        ctx.fillRect(
          paletteStartX + i * (sqSize + sqGap),
          Math.round(topRowY - sqSize / 2),
          sqSize,
          sqSize,
        )
      }
    }

    // Bottom row right: commit count badge (measure first so left label never overlaps)
    ctx.textAlign = 'right'
    ctx.font = `700 ${Math.round(28 * scale)}px "JetBrains Mono", ui-monospace, SFMono-Regular, monospace`
    const commitsLabel = `${formattedCommits} commits (${periodYear})`
    const commitsWidth = ctx.measureText(commitsLabel).width
    ctx.fillStyle = '#39d353'
    ctx.fillText(commitsLabel, brandX, mainRowY)

    // Bottom row left: handle + level stage cleanly bounded
    const maxLeftWidth = Math.max(120 * scale, size - padX * 2 - commitsWidth - 28 * scale)
    ctx.textAlign = 'left'
    ctx.font = `700 ${Math.round(30 * scale)}px "JetBrains Mono", ui-monospace, SFMono-Regular, monospace`
    ctx.fillStyle = '#f8fafc'
    const handleLabel = `@${cleanUser}`
    const handleMeasured = Math.min(maxLeftWidth, ctx.measureText(handleLabel).width)
    ctx.fillText(handleLabel, padX, mainRowY, maxLeftWidth)

    const remainingLeft = maxLeftWidth - handleMeasured
    if (remainingLeft > 70 * scale) {
      ctx.font = `600 ${Math.round(21 * scale)}px "JetBrains Mono", ui-monospace, SFMono-Regular, monospace`
      ctx.fillStyle = '#4ade80'
      ctx.fillText(
        ` · LVL ${levelCode} · ${stageName}`,
        padX + handleMeasured,
        mainRowY + Math.round(1 * scale),
        remainingLeft,
      )
    }
  }

  paintChromeAndFooter()

  const drawSceneSlot = (webglCanvas: HTMLCanvasElement) => {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      webglCanvas,
      0,
      0,
      webglCanvas.width,
      webglCanvas.height,
      borderWidth,
      borderWidth,
      sceneWidth,
      sceneHeight,
    )
  }

  return {
    size,
    sceneWidth,
    sceneHeight,
    composeFrameData: (webglCanvas) => {
      drawSceneSlot(webglCanvas)
      return ctx.getImageData(0, 0, size, size).data
    },
    exportPngBlob: () =>
      new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png')
      }),
    dispose: () => {
      canvas.width = 0
      canvas.height = 0
    },
  }
}
