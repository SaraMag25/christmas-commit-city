import type { TreeLevelId } from '../../types/city'

export interface TreeCanvasDrawOptions {
  level: TreeLevelId
  seed: number
  isCreatorSpecial?: boolean
  lightsPhase: 0 | 1
}

/**
 * Pure Canvas2D pixel-art Christmas tree renderer (40x56 texels).
 * Shared between Phaser boot textures and React profile previews so every
 * tree renders identically across the village map and `/tree/:username`.
 */
export function drawTreeToCanvas(
  ctx: CanvasRenderingContext2D,
  opts: TreeCanvasDrawOptions,
): void {
  const { level, seed, isCreatorSpecial = false, lightsPhase } = opts

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }

  const cx = 20
  const isCoolSpruce = !isCreatorSpecial && seed % 3 === 0
  const pineOutline = '#071c15'
  const pineDark = isCreatorSpecial ? '#0c3b2e' : isCoolSpruce ? '#0f302b' : '#0f2e24'
  const pineMid = isCreatorSpecial ? '#16654e' : isCoolSpruce ? '#175249' : '#184b39'
  const pineBright = isCreatorSpecial ? '#249473' : isCoolSpruce ? '#247868' : '#267355'
  const pineTip = isCreatorSpecial ? '#5eead4' : '#6ee7b7'

  // Soft snow shadow underneath roots
  px(10, 51, 20, 3, 'rgba(15, 23, 42, 0.34)')
  px(13, 50, 14, 4, 'rgba(15, 23, 42, 0.24)')

  // Festive ground aura for stage 6 or Creator Special Tree
  if (level >= 6 || isCreatorSpecial) {
    const auraColor = isCreatorSpecial
      ? 'rgba(56, 189, 248, 0.16)'
      : 'rgba(251, 191, 36, 0.15)'
    px(7, 14, 26, 37, auraColor)
    px(4, 22, 32, 24, auraColor)
  }

  // Textured bark trunk with flared storybook roots
  const trunkW = level >= 4 ? 4 : 2
  const trunkH = level === 0 ? 5 : level <= 2 ? 6 : 7
  const baseY = 52
  px(cx - trunkW / 2 - 1, baseY - trunkH, trunkW + 2, trunkH, '#261409')
  px(cx - trunkW / 2, baseY - trunkH, trunkW, trunkH, '#6b4226')
  px(cx - trunkW / 2, baseY - trunkH + 1, 1, trunkH - 1, '#8c5835')
  if (level >= 3 || isCreatorSpecial) {
    px(cx - trunkW / 2 - 2, baseY - 2, 2, 2, '#4a2c18')
    px(cx + trunkW / 2, baseY - 2, 2, 2, '#4a2c18')
  }

  const tierCountByLevel: Record<TreeLevelId, number> = {
    0: 2,
    1: 3,
    2: 4,
    3: 4,
    4: 5,
    5: 6,
    6: 6,
  }
  const tiers = isCreatorSpecial ? 6 : tierCountByLevel[level]
  const treeBottomY = baseY - trunkH + 1
  const tierHeight = level === 0 ? 5 : 6
  const maxHalfW =
    level === 0 ? 6 : level === 1 ? 8 : level === 2 ? 10 : level <= 4 ? 13 : 15

  // Organic scalloped foliage tiers with leaf-cluster texture
  for (let t = 0; t < tiers; t += 1) {
    const progress = t / Math.max(1, tiers - 1)
    const tierBaseY = treeBottomY - t * (tierHeight - 1)
    const tierHalfW = Math.max(2, Math.round(maxHalfW * (1 - progress * 0.7)))

    for (let row = 0; row < tierHeight; row += 1) {
      const y = tierBaseY - row
      const rowShrink = Math.floor((row / tierHeight) * (tierHalfW - 1))
      const scalloped = row === 0 ? 1 : 0
      const hw = Math.max(1, tierHalfW - rowShrink + scalloped)
      const left = cx - hw
      const width = hw * 2

      px(left - 1, y, width + 2, 1, pineOutline)
      px(left, y, width, 1, pineDark)
      if (width >= 4) {
        px(left + 1, y, width - 2, 1, pineMid)
      }
      if (width >= 6 && row >= 1) {
        px(left + 1, y, Math.max(2, Math.floor(width * 0.36)), 1, pineBright)
        if ((t + row + seed) % 2 === 0 && width >= 10) {
          px(left + 3, y, 2, 1, pineTip)
        }
      }
      if (row === 0 && width >= 6) {
        px(left, y, 2, 1, '#f8fafc')
        px(left + width - 2, y, 2, 1, '#cbd5e1')
      }
    }
  }

  const topTipY = treeBottomY - (tiers - 1) * (tierHeight - 1) - tierHeight

  // Ornaments from level 2+
  if (level >= 2 || isCreatorSpecial) {
    const ornamentColors = isCreatorSpecial
      ? ['#fbbf24', '#38bdf8', '#f8fafc', '#f43f5e']
      : ['#dc2626', '#fbbf24', '#38bdf8', '#f472b6']
    const ornamentCount = Math.min(16, level * 2 + 2)
    for (let i = 0; i < ornamentCount; i += 1) {
      const h = (seed + i * 37) % 100
      const tierIdx = i % Math.max(1, tiers - 1)
      const ty = treeBottomY - 2 - tierIdx * (tierHeight - 1)
      const spread = Math.max(2, Math.floor(maxHalfW * (1 - tierIdx * 0.18)) - 2)
      const ox = cx + ((h % (spread * 2 + 1)) - spread)
      const color = ornamentColors[(seed + i) % ornamentColors.length]
      px(ox, ty, 1, 1, color)
      if (level >= 3 && i % 3 === 0) {
        px(ox, ty + 1, 1, 1, color)
      }
    }
  }

  // Garland ribbon from level 3+
  if (level >= 3 || isCreatorSpecial) {
    const garlandColor = isCreatorSpecial ? '#fde047' : '#fca5a5'
    for (let t = 0; t < tiers - 1; t += 1) {
      const gy = treeBottomY - 1 - t * (tierHeight - 1)
      const span = Math.max(2, Math.floor(maxHalfW * (1 - t * 0.2)) - 2)
      for (let dx = -span; dx <= span; dx += 2) {
        px(cx + dx, gy - (Math.abs(dx) % 2), 1, 1, garlandColor)
      }
    }
  }

  // Twinkling lights from level 4+
  if (level >= 4 || isCreatorSpecial) {
    const bulbColorsA = ['#fef08a', '#38bdf8', '#f87171', '#4ade80']
    const bulbColorsB = ['#f59e0b', '#f8fafc', '#f472b6', '#60a5fa']
    for (let t = 0; t < tiers; t += 1) {
      const ly = treeBottomY - 2 - t * (tierHeight - 1)
      const span = Math.max(1, Math.floor(maxHalfW * (1 - t * 0.2)) - 2)
      for (let dx = -span; dx <= span; dx += 3) {
        const isSetA = (dx + t) % 2 === 0
        const isLit = (isSetA && lightsPhase === 0) || (!isSetA && lightsPhase === 1)
        const color = isLit
          ? (lightsPhase === 0 ? bulbColorsA : bulbColorsB)[Math.abs(dx + t) % 4]
          : '#475569'
        px(cx + dx, ly, 1, 1, color)
      }
    }
  }

  // Topper: gold tip on level 4, radiant star on level 5-6 & Creator
  if (level === 4 && !isCreatorSpecial) {
    px(cx - 1, topTipY - 1, 2, 2, '#fbbf24')
  } else if (level >= 5 || isCreatorSpecial) {
    const starMain = lightsPhase === 0 ? '#fbbf24' : '#fef08a'
    px(cx - 1, topTipY - 4, 2, 5, starMain)
    px(cx - 3, topTipY - 2, 6, 1, starMain)
    px(cx - 2, topTipY - 3, 4, 3, starMain)
    px(cx - 1, topTipY - 2, 2, 1, '#fffbeb')
    if (isCreatorSpecial) {
      px(cx - 5, topTipY - 4, 1, 1, '#7dd3fc')
      px(cx + 4, topTipY - 4, 1, 1, '#7dd3fc')
    }
  }

  // Wrapped gifts stacked beneath tree on level 5-6 & Creator
  if (level >= 5 || isCreatorSpecial) {
    px(cx - 8, 49, 4, 4, '#dc2626')
    px(cx - 7, 49, 1, 4, '#fbbf24')
    px(cx + 4, 50, 4, 3, '#2563eb')
    px(cx + 5, 50, 1, 3, '#f8fafc')
    if (level >= 6 || isCreatorSpecial) {
      px(cx - 2, 50, 4, 3, '#f59e0b')
      px(cx - 1, 50, 1, 3, '#b91c1c')
    }
  }
}
