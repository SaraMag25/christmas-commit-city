import type Phaser from 'phaser'
import type { TreeLevelId } from '../../types/city'

type PaletteMap = Record<string, string>

function createCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return
  const canvasTex = scene.textures.createCanvas(key, width, height)
  if (!canvasTex) return
  const ctx = canvasTex.getContext()
  ctx.imageSmoothingEnabled = false
  draw(ctx)
  canvasTex.refresh()
}

function drawMatrix(
  scene: Phaser.Scene,
  key: string,
  rows: readonly string[],
  palette: PaletteMap,
): void {
  const height = rows.length
  const width = rows[0]?.length ?? 1
  createCanvasTexture(scene, key, width, height, (ctx) => {
    for (let y = 0; y < height; y += 1) {
      const row = rows[y]
      for (let x = 0; x < row.length; x += 1) {
        const ch = row[x]
        if (ch === '.' || ch === ' ') continue
        const color = palette[ch]
        if (!color) continue
        ctx.fillStyle = color
        ctx.fillRect(x, y, 1, 1)
      }
    }
  })
}

const SNOW_PALETTE: PaletteMap = {
  s: '#e8f1fa',
  l: '#f8fafc',
  b: '#cbd8ea',
  d: '#b8c9e0',
}

const COBBLE_PALETTE: PaletteMap = {
  a: '#64748b',
  b: '#475569',
  c: '#94a3b8',
  s: '#e2e8f0',
  d: '#334155',
}

const PLAZA_PALETTE: PaletteMap = {
  a: '#785a3c',
  b: '#5c4028',
  c: '#9c7853',
  g: '#fbbf24',
  s: '#f1f5f9',
}

const ICE_PALETTE: PaletteMap = {
  a: '#38bdf8',
  b: '#0284c7',
  c: '#bae6fd',
  w: '#f8fafc',
}

function generateGroundTextures(scene: Phaser.Scene): void {
  drawMatrix(
    scene,
    'tile-snow-0',
    [
      'ssssssssssssssss',
      'ssllssssssssssss',
      'ssssssssssssbsss',
      'ssssssssssssssss',
      'ssssbsssssssssss',
      'sssssssssllsssss',
      'ssssssssssssssss',
      'ssssssssssssssbs',
      'ssbsssssssssssss',
      'ssssssssssssssss',
      'ssssssllssssssss',
      'ssssssssssssbsss',
      'ssssssssssssssss',
      'ssllssssssssssss',
      'sssssssssbssssss',
      'ssssssssssssssss',
    ],
    SNOW_PALETTE,
  )

  drawMatrix(
    scene,
    'tile-snow-1',
    [
      'ssssssssssssssss',
      'sssssbssssssssss',
      'ssssssssssllssss',
      'ssssssssssssssss',
      'ssllssssssssssss',
      'sssssssssssbssss',
      'ssssssssssssssss',
      'sssssdssssssssss',
      'ssssssssssssllss',
      'ssssssssssssssss',
      'ssbsssssssssssss',
      'ssssssssllssssss',
      'ssssssssssssssss',
      'sssssbssssssssss',
      'ssssssssssssbsss',
      'ssssssssssssssss',
    ],
    SNOW_PALETTE,
  )

  drawMatrix(
    scene,
    'tile-cobble',
    [
      'ssaaaaaaaaaaaass',
      'scaaabccaaabccas',
      'daaaabbaaaaabbad',
      'dabbbbaaaabbbbad',
      'aaaccaaaaccaaaaa',
      'aabbaaaabbaaaabb',
      'ccaaabccaaabccaa',
      'baaaabbaaaaabbaa',
      'aaabccaaabccaaaa',
      'aaabbaaaabbaaaab',
      'accaaaaccaaaacca',
      'abbaaaabbaaaabba',
      'daaaabccaaabccad',
      'daaaabbaaaaabbad',
      'scbbbaaaabbbbcas',
      'ssddddddddddddss',
    ],
    COBBLE_PALETTE,
  )

  drawMatrix(
    scene,
    'tile-plaza',
    [
      'gbbbbbbbbbbbbbbg',
      'baaaaaaaaaaaaaab',
      'baccccaaaaccccab',
      'bacaaacaaacaaacb',
      'bacaaaccccaaacab',
      'baaaaccccccaaaab',
      'baaaccaaaaccaaab',
      'baaacaaagaaacaab',
      'baaacaaagaaacaab',
      'baaaccaaaaccaaab',
      'baaaaccccccaaaab',
      'bacaaaccccaaacab',
      'bacaaacaaacaaacb',
      'baccccaaaaccccab',
      'baaaaaaaaaaaaaab',
      'gbbbbbbbbbbbbbbg',
    ],
    PLAZA_PALETTE,
  )

  drawMatrix(
    scene,
    'tile-ice',
    [
      'wwwwbbbbbbbbwwww',
      'wwbbaaaaaaaaabww',
      'wbaaacccaaaaaabw',
      'baaacccaaaaaaaaa',
      'baaaaaaaaaacccaa',
      'baaaawaaaaaccaaa',
      'baaaaaaaaaaaaaaa',
      'baaaccaaaaaaaaaa',
      'baaaacccaaaaawaa',
      'baaaaaaaaaaaaaaa',
      'baaaaaacccaaaaaa',
      'baaaaaaaccaaaaaa',
      'baaaaaaaaaaaaaaa',
      'wbaaaaaaaaaaaabw',
      'wwbbaaaaaaaaabww',
      'wwwwbbbbbbbbwwww',
    ],
    ICE_PALETTE,
  )
}

function generateCottageTexture(
  scene: Phaser.Scene,
  key: string,
  roofMain: string,
  roofDark: string,
): void {
  // 48x48 pixel cozy Stardew-style winter cottage
  createCanvasTexture(scene, key, 48, 48, (ctx) => {
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)
    }

    // Chimney on the right
    px(33, 2, 7, 13, '#475569')
    px(34, 3, 5, 11, '#64748b')
    px(32, 1, 9, 2, '#f8fafc') // snow cap on chimney

    // Pitched snowy roof (rows 5..24)
    for (let row = 0; row < 20; row += 1) {
      const inset = Math.max(0, 16 - row)
      const width = 48 - inset * 2
      px(inset, 5 + row, width, 1, row % 3 === 0 ? roofDark : roofMain)
    }
    // Snow trim along roof ridge & eaves
    px(16, 5, 16, 2, '#f8fafc')
    px(14, 7, 4, 2, '#e2e8f0')
    px(30, 7, 4, 2, '#e2e8f0')
    px(0, 23, 48, 3, '#f8fafc')
    px(0, 26, 48, 1, '#cbd5e1')

    // Wooden log cabin walls
    px(4, 27, 40, 18, '#6b4226')
    px(4, 27, 40, 2, '#4a2c18')
    px(4, 43, 40, 2, '#3b2110')
    // Log beams
    for (let y = 30; y <= 41; y += 3) {
      px(4, y, 40, 1, '#523018')
    }
    // Corner posts
    px(4, 27, 3, 18, '#3b2110')
    px(41, 27, 3, 18, '#3b2110')

    // Cozy front door + Christmas wreath
    px(20, 31, 8, 14, '#3b2110')
    px(21, 32, 6, 13, '#8c5835')
    px(25, 38, 1, 2, '#fbbf24') // brass handle
    // Mini wreath on door
    px(22, 34, 4, 3, '#15803d')
    px(23, 35, 2, 1, '#dc2626')

    // Left & right warm glowing windows
    const drawWindow = (wx: number, wy: number) => {
      px(wx, wy, 9, 8, '#3b2110')
      px(wx + 1, wy + 1, 7, 6, '#fbbf24')
      px(wx + 2, wy + 2, 5, 4, '#fef08a')
      px(wx + 4, wy + 1, 1, 6, '#523018')
      px(wx + 1, wy + 3, 7, 1, '#523018')
      // Snow sill
      px(wx - 1, wy + 8, 11, 2, '#f8fafc')
    }
    drawWindow(9, 31)
    drawWindow(30, 31)

    // Snow drift at base
    px(2, 44, 16, 3, '#f8fafc')
    px(30, 44, 16, 3, '#f8fafc')
    px(19, 45, 10, 2, '#94a3b8') // stone doorstep
  })
}

function generateDecorTextures(scene: Phaser.Scene): void {
  // Streetlamp (16x28)
  createCanvasTexture(scene, 'deco-lamp', 16, 28, (ctx) => {
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)
    }
    px(6, 24, 4, 3, '#1e293b')
    px(7, 9, 2, 16, '#334155')
    px(5, 8, 6, 2, '#1e293b')
    px(4, 2, 8, 6, '#475569')
    px(5, 3, 6, 4, '#fbbf24')
    px(6, 4, 4, 2, '#fef08a')
    px(5, 1, 6, 1, '#f8fafc') // snow on top
  })

  // Cute Snowman (16x20)
  createCanvasTexture(scene, 'deco-snowman', 16, 20, (ctx) => {
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)
    }
    px(4, 18, 8, 2, '#cbd5e1')
    px(4, 11, 8, 7, '#f8fafc')
    px(5, 5, 6, 6, '#f8fafc')
    // Top hat
    px(4, 4, 8, 1, '#1e293b')
    px(5, 1, 6, 3, '#1e293b')
    px(5, 3, 6, 1, '#dc2626')
    // Eyes & carrot nose
    px(6, 7, 1, 1, '#0f172a')
    px(9, 7, 1, 1, '#0f172a')
    px(7, 8, 3, 1, '#f97316')
    // Red scarf
    px(5, 10, 6, 2, '#dc2626')
    px(9, 12, 2, 3, '#b91c1c')
    // Buttons
    px(7, 13, 1, 1, '#1e293b')
    px(7, 15, 1, 1, '#1e293b')
  })

  // Wooden Signpost (16x18)
  createCanvasTexture(scene, 'deco-signpost', 16, 18, (ctx) => {
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)
    }
    px(7, 8, 2, 9, '#4a2c18')
    px(2, 3, 12, 6, '#6b4226')
    px(3, 4, 10, 4, '#8c5835')
    px(2, 2, 12, 1, '#f8fafc')
    px(4, 5, 8, 1, '#fef3c7')
  })

  // Festive Gift Pile (16x16)
  createCanvasTexture(scene, 'deco-gift-pile', 16, 16, (ctx) => {
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)
    }
    // Red box
    px(2, 8, 7, 6, '#dc2626')
    px(5, 8, 1, 6, '#fbbf24')
    px(2, 10, 7, 1, '#fbbf24')
    // Green box
    px(8, 9, 6, 5, '#15803d')
    px(10, 9, 2, 5, '#f8fafc')
    px(8, 11, 6, 1, '#f8fafc')
    // Small gold box on top
    px(5, 4, 5, 4, '#f59e0b')
    px(7, 4, 1, 4, '#b91c1c')
  })

  // Warm Radial Pixel Glow (32x32)
  createCanvasTexture(scene, 'deco-glow', 32, 32, (ctx) => {
    const gradient = ctx.createRadialGradient(16, 16, 1, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(253, 224, 71, 0.55)')
    gradient.addColorStop(0.45, 'rgba(251, 191, 36, 0.22)')
    gradient.addColorStop(1, 'rgba(251, 191, 36, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 32, 32)
  })

  // Snow particle (2x2 pixel snowflake)
  createCanvasTexture(scene, 'particle-snow', 2, 2, (ctx) => {
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, 2, 2)
  })
}

export interface TreeTextureOptions {
  key: string
  level: TreeLevelId
  seed: number
  isCreatorSpecial?: boolean
  lightsPhase: 0 | 1
}

/**
 * Procedurally draws a crisp 32x48 pixel-art Christmas tree whose tiers, branches,
 * ornaments, lights, star, gifts and aura scale directly with its commit stage.
 */
export function ensureTreeTexture(scene: Phaser.Scene, opts: TreeTextureOptions): void {
  const { key, level, seed, isCreatorSpecial = false, lightsPhase } = opts
  createCanvasTexture(scene, key, 32, 48, (ctx) => {
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
    }

    // Subtle per-user foliage variation (pine emerald vs classic spruce)
    const isCoolSpruce = !isCreatorSpecial && seed % 3 === 0
    const pineOutline = '#071c15'
    const pineDark = isCreatorSpecial ? '#0c3b2e' : isCoolSpruce ? '#0f302b' : '#0f2e24'
    const pineMid = isCreatorSpecial ? '#155e49' : isCoolSpruce ? '#164d44' : '#174636'
    const pineBright = isCreatorSpecial ? '#228b6d' : isCoolSpruce ? '#1f6a5c' : '#22664d'

    // Ground snow shadow ellipse at base (y = 43..46)
    px(9, 44, 14, 2, 'rgba(15, 23, 42, 0.35)')
    px(11, 43, 10, 3, 'rgba(15, 23, 42, 0.25)')

    // Special Aura for level 6 or Creator Tree
    if (level >= 6 || isCreatorSpecial) {
      const auraColor = isCreatorSpecial
        ? 'rgba(56, 189, 248, 0.18)'
        : 'rgba(251, 191, 36, 0.16)'
      px(6, 12, 20, 32, auraColor)
      px(4, 18, 24, 22, auraColor)
    }

    // Trunk height & width grow with stage
    const trunkWidth = level >= 4 ? 4 : 2
    const trunkX = 16 - trunkWidth / 2
    const trunkHeight = level === 0 ? 4 : level <= 2 ? 5 : 6
    const baseY = 44
    px(trunkX - 1, baseY - trunkHeight, trunkWidth + 2, trunkHeight, '#261409')
    px(trunkX, baseY - trunkHeight, trunkWidth, trunkHeight, '#6b4226')

    // Tiers configuration per level
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
    const treeBottomY = baseY - trunkHeight + 1
    const tierHeight = level === 0 ? 5 : level <= 2 ? 6 : 6
    const maxHalfWidth = level === 0 ? 5 : level === 1 ? 7 : level === 2 ? 9 : level <= 4 ? 11 : 13

    // Draw pine tiers from bottom to top
    for (let t = 0; t < tiers; t += 1) {
      const progress = t / Math.max(1, tiers - 1)
      const tierBaseY = treeBottomY - t * (tierHeight - 1)
      const tierHalfW = Math.max(2, Math.round(maxHalfWidth * (1 - progress * 0.72)))

      for (let row = 0; row < tierHeight; row += 1) {
        const y = tierBaseY - row
        const rowShrink = Math.floor((row / tierHeight) * (tierHalfW - 1))
        const hw = Math.max(1, tierHalfW - rowShrink)
        const left = 16 - hw
        const width = hw * 2

        // Outline + dark core + mid foliage + sunny left highlight
        px(left - 1, y, width + 2, 1, pineOutline)
        px(left, y, width, 1, pineDark)
        if (width >= 4) {
          px(left + 1, y, width - 2, 1, pineMid)
        }
        if (width >= 6 && row >= 1) {
          px(left + 1, y, Math.max(2, Math.floor(width * 0.35)), 1, pineBright)
        }
        // Subtle snow edge on outer tips
        if (row === 0 && width >= 6) {
          px(left, y, 2, 1, '#e2e8f0')
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
      const ornamentCount = Math.min(14, level * 2 + 2)
      for (let i = 0; i < ornamentCount; i += 1) {
        const h = (seed + i * 37) % 100
        const tierIdx = i % Math.max(1, tiers - 1)
        const ty = treeBottomY - 2 - tierIdx * (tierHeight - 1)
        const spread = Math.max(2, Math.floor(maxHalfWidth * (1 - tierIdx * 0.18)) - 2)
        const ox = 16 + ((h % (spread * 2 + 1)) - spread)
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
        const span = Math.max(2, Math.floor(maxHalfWidth * (1 - t * 0.2)) - 2)
        for (let dx = -span; dx <= span; dx += 2) {
          px(16 + dx, gy - (Math.abs(dx) % 2), 1, 1, garlandColor)
        }
      }
    }

    // Twinkling lights from level 4+
    if (level >= 4 || isCreatorSpecial) {
      const bulbColorsA = ['#fef08a', '#38bdf8', '#f87171', '#4ade80']
      const bulbColorsB = ['#f59e0b', '#f8fafc', '#f472b6', '#60a5fa']
      for (let t = 0; t < tiers; t += 1) {
        const ly = treeBottomY - 2 - t * (tierHeight - 1)
        const span = Math.max(1, Math.floor(maxHalfWidth * (1 - t * 0.2)) - 2)
        for (let dx = -span; dx <= span; dx += 3) {
          const isSetA = (dx + t) % 2 === 0
          const isLit = (isSetA && lightsPhase === 0) || (!isSetA && lightsPhase === 1)
          const color = isLit
            ? (lightsPhase === 0 ? bulbColorsA : bulbColorsB)[Math.abs(dx + t) % 4]
            : '#475569'
          px(16 + dx, ly, 1, 1, color)
        }
      }
    }

    // Topper: gold tip on level 4, golden star on level 5-6 & Creator
    if (level === 4 && !isCreatorSpecial) {
      px(15, topTipY - 1, 2, 2, '#fbbf24')
    } else if (level >= 5 || isCreatorSpecial) {
      const starMain = lightsPhase === 0 ? '#fbbf24' : '#fef08a'
      const starCore = '#fffbeb'
      px(15, topTipY - 4, 2, 5, starMain)
      px(13, topTipY - 2, 6, 1, starMain)
      px(14, topTipY - 3, 4, 3, starMain)
      px(15, topTipY - 2, 2, 1, starCore)
      if (isCreatorSpecial) {
        // Extra halo pixel sparkles around the creator star
        px(12, topTipY - 4, 1, 1, '#7dd3fc')
        px(19, topTipY - 4, 1, 1, '#7dd3fc')
      }
    }

    // Wrapped gifts at tree base on level 5-6 & Creator
    if (level >= 5 || isCreatorSpecial) {
      px(9, 41, 4, 4, '#dc2626')
      px(10, 41, 1, 4, '#fbbf24')
      px(19, 42, 4, 3, '#2563eb')
      px(20, 42, 1, 3, '#f8fafc')
      if (level >= 6 || isCreatorSpecial) {
        px(14, 42, 3, 3, '#f59e0b')
        px(15, 42, 1, 3, '#b91c1c')
      }
    }
  })
}

export function generateAllVillageTextures(scene: Phaser.Scene): void {
  generateGroundTextures(scene)
  generateCottageTexture(scene, 'cottage-red', '#991b1b', '#7f1d1d')
  generateCottageTexture(scene, 'cottage-pine', '#166534', '#14532d')
  generateDecorTextures(scene)
}
