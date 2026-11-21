import type { GitHubContributionWeek, TreeLevelId } from '../../types/city'

export interface TreeCanvasDrawOptions {
  level: TreeLevelId
  seed: number
  isCreatorSpecial?: boolean
  lightsPhase: 0 | 1
  contributionCount?: number
  calendarWeeks?: GitHubContributionWeek[]
}

interface CanopyPoint {
  x: number
  y: number
}

/**
 * Pure Canvas2D pixel-art Christmas tree renderer (48x64 texels).
 * Shared between Phaser boot textures and React profile previews so every
 * tree renders identically across the village map and `/tree/:username`.
 */
export function drawTreeToCanvas(
  ctx: CanvasRenderingContext2D,
  opts: TreeCanvasDrawOptions,
): void {
  const {
    level,
    seed,
    isCreatorSpecial = false,
    lightsPhase,
    contributionCount = 0,
    calendarWeeks,
  } = opts

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }

  const cx = 24
  const baseY = 60
  const isCoolSpruce = !isCreatorSpecial && seed % 3 === 0

  const pineOutline = '#051610'
  const pineShadow = isCreatorSpecial ? '#082c22' : isCoolSpruce ? '#0a2622' : '#0a241b'
  const pineDark = isCreatorSpecial ? '#0d4032' : isCoolSpruce ? '#113a34' : '#10382a'
  const pineMid = isCreatorSpecial ? '#176650' : isCoolSpruce ? '#18544b' : '#19543e'
  const pineBright = isCreatorSpecial ? '#259676' : isCoolSpruce ? '#247868' : '#267556'
  const pineTip = isCreatorSpecial ? '#5eead4' : '#4ade80'

  // Soft snow shadow underneath roots
  px(12, 58, 24, 3, 'rgba(15, 23, 42, 0.36)')
  px(15, 57, 18, 4, 'rgba(15, 23, 42, 0.25)')

  // Festive ground aura for stage 6 or Creator Special Tree
  if (level >= 6 || isCreatorSpecial) {
    const auraColor = isCreatorSpecial
      ? 'rgba(56, 189, 248, 0.16)'
      : 'rgba(251, 191, 36, 0.14)'
    px(8, 14, 32, 44, auraColor)
    px(5, 22, 38, 28, auraColor)
  }

  // Textured bark trunk with flared storybook roots
  const trunkW = level >= 5 || isCreatorSpecial ? 6 : level >= 3 ? 4 : 2
  const trunkH = level === 0 ? 5 : level <= 2 ? 7 : 8
  px(cx - trunkW / 2 - 1, baseY - trunkH, trunkW + 2, trunkH, '#261409')
  px(cx - trunkW / 2, baseY - trunkH, trunkW, trunkH, '#6b4226')
  px(cx - trunkW / 2, baseY - trunkH + 1, 1, trunkH - 1, '#8c5835')
  if (trunkW >= 4) {
    px(cx + trunkW / 2 - 1, baseY - trunkH + 1, 1, trunkH - 1, '#4a2c18')
  }
  if (level >= 3 || isCreatorSpecial) {
    px(cx - trunkW / 2 - 2, baseY - 2, 2, 2, '#4a2c18')
    px(cx + trunkW / 2, baseY - 2, 2, 2, '#4a2c18')
  }

  const tierCountByLevel: Record<TreeLevelId, number> = {
    0: 2,
    1: 3,
    2: 4,
    3: 5,
    4: 5,
    5: 6,
    6: 7,
  }
  const tiers = isCreatorSpecial ? 7 : tierCountByLevel[level]
  const treeBottomY = baseY - trunkH + 1
  const tierHeight = level === 0 ? 5 : level <= 2 ? 6 : 6
  const maxHalfW =
    level === 0
      ? 6
      : level === 1
        ? 9
        : level === 2
          ? 12
          : level === 3
            ? 14
            : level === 4
              ? 16
              : level === 5
                ? 18
                : 19

  const canopyPoints: CanopyPoint[] = []

  // Voluminous, scalloped pine boughs with layered foliage & snow tips
  for (let t = 0; t < tiers; t += 1) {
    const progress = t / Math.max(1, tiers - 1)
    const tierBaseY = treeBottomY - t * (tierHeight - 1)
    const tierHalfW = Math.max(2, Math.round(maxHalfW * (1 - progress * 0.72)))

    for (let row = 0; row < tierHeight; row += 1) {
      const y = tierBaseY - row
      const rowProgress = row / tierHeight
      // Curved, organic bough silhouette instead of a flat triangle
      const curveShrink = Math.floor(Math.pow(rowProgress, 0.85) * (tierHalfW - 1))
      const scalloped = row === 0 ? 1 : row === 1 && tierHalfW >= 8 ? 1 : 0
      const hw = Math.max(1, tierHalfW - curveShrink + scalloped)
      const left = cx - hw
      const width = hw * 2

      px(left - 1, y, width + 2, 1, pineOutline)
      px(left, y, width, 1, row === 0 ? pineShadow : pineDark)

      if (width >= 4) {
        px(left + 1, y, width - 2, 1, pineMid)
      }
      if (width >= 6 && row >= 1) {
        px(left + 1, y, Math.max(2, Math.floor(width * 0.4)), 1, pineBright)
        if ((t + row + seed) % 2 === 0 && width >= 10) {
          px(left + 3, y, 2, 1, pineTip)
        }
      }

      // Snow-dusted bough edges
      if (row === 0 && width >= 6) {
        px(left, y, 2, 1, '#f8fafc')
        px(left + width - 2, y, 2, 1, '#cbd5e1')
        if (width >= 14) {
          px(left + 4, y, 2, 1, '#e2e8f0')
          px(left + width - 6, y, 2, 1, '#cbd5e1')
        }
      }

      // Collect interior canopy coordinates for organic commit-light placement
      if (width >= 4 && row >= 1 && row < tierHeight - 1) {
        for (let x = left + 2; x <= left + width - 3; x += 2) {
          canopyPoints.push({ x, y })
        }
      }
    }
  }

  const topTipY = treeBottomY - (tiers - 1) * (tierHeight - 1) - tierHeight

  // Festive Christmas ornaments from level 2+
  if (level >= 2 || isCreatorSpecial) {
    const ornamentColors = isCreatorSpecial
      ? ['#fbbf24', '#38bdf8', '#f8fafc', '#f43f5e']
      : ['#dc2626', '#fbbf24', '#f43f5e', '#f8fafc']
    const ornamentCount = Math.min(18, level * 2 + 2)
    for (let i = 0; i < ornamentCount; i += 1) {
      const h = (seed + i * 37) % 100
      const tierIdx = i % Math.max(1, tiers - 1)
      const ty = treeBottomY - 2 - tierIdx * (tierHeight - 1)
      const spread = Math.max(2, Math.floor(maxHalfW * (1 - tierIdx * 0.16)) - 2)
      const ox = cx + ((h % (spread * 2 + 1)) - spread)
      const color = ornamentColors[(seed + i) % ornamentColors.length]
      px(ox, ty, 1, 1, color)
      if (level >= 3 && i % 4 === 0) {
        px(ox, ty + 1, 1, 1, color)
      }
    }
  }

  // Garland ribbon from level 3+
  if (level >= 3 || isCreatorSpecial) {
    const garlandColor = isCreatorSpecial ? '#fde047' : '#fca5a5'
    for (let t = 0; t < tiers - 1; t += 1) {
      const gy = treeBottomY - 1 - t * (tierHeight - 1)
      const span = Math.max(2, Math.floor(maxHalfW * (1 - t * 0.18)) - 2)
      for (let dx = -span; dx <= span; dx += 2) {
        px(cx + dx, gy - (Math.abs(dx) % 2), 1, 1, garlandColor)
      }
    }
  }

  // Organic GitHub Commit Lights across the canopy
  drawCommitLights(px, canopyPoints, {
    seed,
    lightsPhase,
    contributionCount,
    calendarWeeks,
    isCreatorSpecial,
  })

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
    px(cx - 10, 56, 5, 4, '#dc2626')
    px(cx - 8, 56, 1, 4, '#fbbf24')
    px(cx + 5, 57, 5, 3, '#2563eb')
    px(cx + 7, 57, 1, 3, '#f8fafc')
    if (level >= 6 || isCreatorSpecial) {
      px(cx - 3, 57, 5, 3, '#f59e0b')
      px(cx - 1, 57, 1, 3, '#b91c1c')
    }
  }
}

function drawCommitLights(
  px: (x: number, y: number, w: number, h: number, color: string) => void,
  canopyPoints: CanopyPoint[],
  opts: {
    seed: number
    lightsPhase: 0 | 1
    contributionCount: number
    calendarWeeks?: GitHubContributionWeek[]
    isCreatorSpecial: boolean
  },
): void {
  if (canopyPoints.length === 0) return

  const { seed, lightsPhase, contributionCount, calendarWeeks, isCreatorSpecial } = opts
  const activeDays = calendarWeeks
    ? calendarWeeks.flatMap((w) => w.contributionDays).filter((d) => d.contributionCount > 0)
    : []

  // Determine how many lights to illuminate and their intensities
  const totalPoints = canopyPoints.length
  const ratio =
    contributionCount <= 0
      ? 0
      : Math.min(1, 0.14 + Math.log10(contributionCount + 1) * 0.34)
  const targetLitCount =
    activeDays.length > 0
      ? Math.min(totalPoints, Math.max(1, Math.round((activeDays.length / 365) * totalPoints * 1.8)))
      : Math.round(totalPoints * ratio)

  if (targetLitCount <= 0 && !isCreatorSpecial) {
    // 0 contributions: subtle unlit/dim bulbs
    for (let i = 0; i < totalPoints; i += 7) {
      const pt = canopyPoints[i]
      px(pt.x, pt.y, 1, 1, '#1e293b')
    }
    return
  }

  // Deterministic shuffle of canopy points using golden-ratio stride
  const stride = 17
  const offset = seed % totalPoints
  const litCount = Math.max(isCreatorSpecial ? 14 : 1, targetLitCount)

  for (let i = 0; i < litCount; i += 1) {
    const pt = canopyPoints[(offset + i * stride) % totalPoints]
    const dayCount =
      activeDays.length > 0
        ? activeDays[i % activeDays.length].contributionCount
        : Math.max(1, Math.round(contributionCount / Math.max(1, litCount)))

    const twinkle = (i + lightsPhase) % 2 === 0

    let color: string
    if (dayCount >= 8 || isCreatorSpecial) {
      color = twinkle ? '#bbf7d0' : '#4ade80'
    } else if (dayCount >= 4) {
      color = twinkle ? '#86efac' : '#22c55e'
    } else {
      color = twinkle ? '#4ade80' : '#16a34a'
    }

    px(pt.x, pt.y, 1, 1, color)
  }
}
