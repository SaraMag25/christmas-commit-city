import type Phaser from 'phaser'
import type { GitHubContributionWeek, TreeLevelId } from '../../types/city'
import { drawTreeToCanvas } from './treeCanvasRenderer'

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

const PIER_PALETTE: PaletteMap = {
  a: '#38bdf8',
  b: '#0284c7',
  w: '#8c5835',
  d: '#523018',
  l: '#b57a4c',
  s: '#f8fafc',
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

  drawMatrix(
    scene,
    'tile-pier',
    [
      'aaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaa',
      'ssddddddddddddss',
      'slllllllllllllls',
      'dwwwwwwwwwwwwwwd',
      'dwwdwwwdwwwdwwwd',
      'llllllllllllllll',
      'dwwwwwwwwwwwwwwd',
      'dwwdwwwdwwwdwwwd',
      'llllllllllllllll',
      'dwwwwwwwwwwwwwwd',
      'ssddddddddddddss',
      'bbddddaaaaaddddb',
      'bbddddaaaaaddddb',
      'aaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaa',
    ],
    PIER_PALETTE,
  )
}

/**
 * Storybook rounded shingle cottage (56x56) inspired by cozy fairy-tale cottages
 * with arched wooden doorway, festive eaves garland, warm windows and twin yard lanterns.
 */
function generateStorybookCottage(scene: Phaser.Scene): void {
  createCanvasTexture(scene, 'cottage-storybook', 56, 56, (ctx) => {
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
    }

    // Winding stone chimney + snow cap
    px(38, 4, 7, 15, '#3b2110')
    px(39, 5, 5, 13, '#64748b')
    px(37, 3, 9, 2, '#f8fafc')

    // Rounded bell-shaped shingle roof (rows 6..28)
    for (let r = 0; r < 23; r += 1) {
      const curve = Math.pow((22 - r) / 22, 1.35)
      const hw = Math.round(25 - curve * 19)
      const left = 28 - hw
      const width = hw * 2
      px(left - 1, 6 + r, width + 2, 1, '#45120b')
      const rowCol = r % 4 === 0 ? '#9a2a1e' : r % 2 === 0 ? '#c2412d' : '#dc5b3e'
      px(left, 6 + r, width, 1, rowCol)
      // Shingle staggered highlights
      for (let sx = left + (r % 2) * 3; sx < left + width - 2; sx += 5) {
        px(sx, 6 + r, 2, 1, r % 4 === 0 ? '#7c1d13' : '#e87a54')
      }
    }
    // Snow cap at roof crest & scalloped snowy eaves
    px(22, 5, 12, 2, '#f8fafc')
    px(20, 7, 4, 2, '#e2e8f0')
    px(32, 7, 4, 2, '#e2e8f0')
    px(2, 27, 52, 3, '#f8fafc')
    px(3, 30, 50, 1, '#cbd5e1')

    // Dormer window in roof
    px(23, 13, 10, 9, '#45120b')
    px(24, 14, 8, 7, '#fef3c7')
    px(25, 15, 6, 5, '#fbbf24')
    px(27, 15, 2, 5, '#523018')
    px(22, 12, 12, 2, '#f8fafc')

    // Warm cream & timber walls
    px(8, 30, 40, 20, '#4a2c18')
    px(9, 31, 38, 18, '#f5e6d3')
    px(9, 31, 5, 18, '#e5ceb4')
    px(42, 31, 5, 18, '#e5ceb4')
    px(9, 31, 38, 2, '#6b4226')

    // Arched storybook door + wreath
    px(13, 35, 12, 14, '#4a2c18')
    px(14, 34, 10, 1, '#4a2c18')
    px(15, 35, 8, 14, '#7c4d2b')
    px(16, 36, 6, 13, '#9c6644')
    px(18, 37, 1, 12, '#6b4226')
    px(20, 42, 1, 2, '#fbbf24') // doorknob
    px(17, 38, 4, 3, '#15803d') // wreath
    px(18, 39, 2, 1, '#dc2626')

    // Cozy glowing bay window on the right
    px(30, 35, 13, 10, '#4a2c18')
    px(31, 36, 11, 8, '#fbbf24')
    px(32, 37, 9, 6, '#fef08a')
    px(36, 36, 1, 8, '#523018')
    px(31, 39, 11, 1, '#523018')
    px(29, 45, 15, 2, '#f8fafc') // snow window box

    // Ivy & Christmas flower garland draping on left roof
    for (const [gx, gy, col] of [
      [8, 20, '#166534'],
      [9, 21, '#22c55e'],
      [11, 22, '#166534'],
      [10, 23, '#f472b6'],
      [13, 24, '#22c55e'],
      [14, 25, '#dc2626'],
      [16, 26, '#166534'],
      [42, 23, '#166534'],
      [43, 25, '#dc2626'],
    ] as const) {
      px(gx, gy, 2, 2, col)
    }

    // Cobblestone doorstep & snow base + twin warm garden lanterns
    px(12, 49, 14, 4, '#94a3b8')
    px(14, 50, 10, 3, '#cbd5e1')
    px(4, 49, 8, 3, '#f8fafc')
    px(44, 49, 8, 3, '#f8fafc')
    // Left & right mini fairy lanterns
    for (const lx of [6, 48]) {
      px(lx, 44, 1, 6, '#4a2c18')
      px(lx - 1, 41, 3, 3, '#fef08a')
      px(lx, 42, 1, 1, '#ffffff')
    }
  })
}

/**
 * Woodland mushroom-roof winter cottage (56x56) directly inspired by PIXEL MUSHROOM HOUSE.jpeg
 * with curved spotted pine/cranberry cap, twisting vine chimney and twin glowing lanterns.
 */
function generateMushroomCottage(scene: Phaser.Scene, key: string, capMain: string, capDark: string, capSpot: string): void {
  createCanvasTexture(scene, key, 56, 56, (ctx) => {
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
    }

    // Curved twisting wooden chimney with festive vine & berries
    px(36, 4, 7, 13, '#4a2c18')
    px(37, 5, 5, 11, '#8c5835')
    px(38, 6, 3, 9, '#b57a4c')
    px(35, 3, 9, 2, '#f8fafc')
    px(36, 8, 6, 1, '#15803d')
    px(37, 12, 6, 1, '#15803d')
    px(35, 7, 2, 2, '#dc2626')
    px(42, 11, 2, 2, '#fbbf24')

    // Mushroom cap dome (rows 9..30)
    for (let r = 0; r < 22; r += 1) {
      const t = r / 21
      const hw = Math.round(6 + Math.sin(t * Math.PI * 0.68) * 20)
      const left = 28 - hw
      const width = hw * 2
      px(left - 1, 9 + r, width + 2, 1, '#091f17')
      px(left, 9 + r, width, 1, r > 17 ? capDark : capMain)
    }
    // Snow patches / toadstool spots on the mushroom cap
    for (const [sx, sy, sw, sh] of [
      [23, 12, 5, 4],
      [13, 18, 4, 3],
      [33, 17, 5, 4],
      [24, 21, 6, 4],
      [8, 24, 4, 3],
      [42, 23, 4, 3],
    ] as const) {
      px(sx, sy, sw, sh, capSpot)
      px(sx + 1, sy, Math.max(1, sw - 2), 1, '#ffffff')
    }
    // Scalloped snow rim on cap bottom
    px(3, 29, 50, 2, '#f8fafc')

    // Rounded warm cottage stem walls
    px(10, 31, 36, 19, '#4a2c18')
    px(11, 31, 34, 18, '#d4b483')
    px(11, 31, 4, 18, '#b59461')
    px(41, 31, 4, 18, '#b59461')

    // Wide arched woodland green/wood plank door
    px(21, 35, 14, 14, '#1e3a24')
    px(22, 34, 12, 1, '#1e3a24')
    px(23, 35, 10, 14, '#2d5a36')
    px(25, 35, 1, 14, '#1e3a24')
    px(28, 35, 1, 14, '#1e3a24')
    px(31, 35, 1, 14, '#1e3a24')
    px(27, 42, 2, 2, '#fbbf24')

    // Glowing round cabin window
    px(13, 36, 6, 6, '#3b2110')
    px(14, 37, 4, 4, '#fef08a')
    px(15, 37, 1, 4, '#523018')
    px(14, 38, 4, 1, '#523018')

    // Hanging festive vines & lights
    for (const [vx, vy, col] of [
      [5, 31, '#22c55e'],
      [6, 33, '#fbbf24'],
      [49, 31, '#22c55e'],
      [48, 33, '#dc2626'],
    ] as const) {
      px(vx, vy, 2, 2, col)
    }

    // Twin glowing garden lanterns + stone stepping path
    px(22, 49, 12, 5, '#78716c')
    px(23, 50, 10, 3, '#a8a29e')
    for (const lx of [14, 41]) {
      px(lx, 44, 1, 6, '#3b2110')
      px(lx - 1, 41, 3, 3, '#fef08a')
      px(lx, 42, 1, 1, '#ffffff')
    }
    // Snowy bushes flanking entrance
    px(5, 47, 11, 4, '#166534')
    px(6, 46, 9, 2, '#f8fafc')
    px(40, 47, 11, 4, '#166534')
    px(41, 46, 9, 2, '#f8fafc')
  })
}

/**
 * Giant snowy tree-stump cabin (56x56) inspired by jpeg(5) stump house.
 */
function generateStumpCabin(scene: Phaser.Scene): void {
  createCanvasTexture(scene, 'cottage-stump', 56, 56, (ctx) => {
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
    }

    // Snow-topped wood-grain stump top (y = 14..22)
    px(14, 14, 28, 8, '#3b2110')
    px(15, 15, 26, 6, '#e2e8f0')
    px(17, 16, 22, 4, '#f8fafc')
    // Jagged bark rim sticking up
    px(13, 12, 3, 6, '#6b4226')
    px(39, 11, 4, 7, '#6b4226')
    px(25, 10, 3, 5, '#523018')

    // Flared tree trunk walls (y = 21..50)
    for (let r = 0; r < 30; r += 1) {
      const flare = Math.max(0, Math.floor((r - 16) / 2))
      const left = 13 - flare
      const width = 30 + flare * 2
      px(left - 1, 21 + r, width + 2, 1, '#261409')
      px(left, 21 + r, width, 1, '#6b4226')
      for (let bx = left + 3; bx < left + width - 3; bx += 5) {
        px(bx, 21 + r, 2, 1, '#523018')
      }
    }

    // Glowing four-pane window on left
    px(16, 29, 10, 10, '#3b2110')
    px(17, 30, 8, 8, '#fbbf24')
    px(18, 31, 6, 6, '#fef08a')
    px(20, 30, 2, 8, '#523018')
    px(17, 33, 8, 2, '#523018')
    px(15, 39, 12, 2, '#f8fafc')

    // Arched honey-wood door on right
    px(30, 32, 11, 17, '#3b2110')
    px(31, 31, 9, 1, '#3b2110')
    px(32, 32, 7, 17, '#d97706')
    px(33, 33, 5, 16, '#fbbf24')
    px(37, 40, 1, 2, '#78350f')
    // Mini wreath
    px(34, 35, 3, 3, '#15803d')
    px(35, 36, 1, 1, '#dc2626')

    // Cute snowy shelf mushrooms on bark
    px(9, 34, 5, 3, '#f8fafc')
    px(10, 36, 3, 1, '#cbd5e1')
    px(42, 29, 5, 3, '#f8fafc')
    px(43, 31, 3, 1, '#cbd5e1')

    // Stepping stone path & snow mounds
    px(29, 49, 13, 4, '#94a3b8')
    px(31, 50, 9, 2, '#cbd5e1')
    px(5, 48, 12, 4, '#f8fafc')
    px(42, 48, 9, 4, '#f8fafc')
  })
}

function generateDecorTextures(scene: Phaser.Scene): void {
  // Vintage glowing streetlamp (16x28)
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
    px(5, 1, 6, 1, '#f8fafc')
  })

  // Cozy wooden park bench (24x16) inspired by ref_0 & ref_1
  createCanvasTexture(scene, 'deco-bench', 24, 16, (ctx) => {
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)
    }
    // Shadow
    px(3, 14, 18, 2, 'rgba(15, 23, 42, 0.3)')
    // Iron legs
    px(4, 9, 2, 6, '#1e293b')
    px(18, 9, 2, 6, '#1e293b')
    // Backrest wooden slats + snow dusting
    px(2, 4, 20, 2, '#6b4226')
    px(2, 7, 20, 2, '#8c5835')
    px(3, 3, 18, 1, '#f8fafc')
    // Seat planks
    px(2, 10, 20, 2, '#b57a4c')
    px(2, 12, 20, 1, '#4a2c18')
  })

  // Cute winter caretaker NPC with potted pine sapling (20x24) inspired by ref_4
  createCanvasTexture(scene, 'deco-caretaker', 20, 24, (ctx) => {
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)
    }
    // Shadow
    px(4, 21, 12, 2, 'rgba(15, 23, 42, 0.3)')
    // Cozy pointed winter hat (warm wood/gold tone with white trim)
    px(8, 2, 4, 2, '#f8fafc')
    px(6, 4, 8, 3, '#b91c1c')
    px(4, 7, 12, 2, '#f8fafc')
    // Face & rosy cheeks
    px(5, 9, 10, 5, '#fde68a')
    px(7, 10, 1, 2, '#1e0f07')
    px(12, 10, 1, 2, '#1e0f07')
    px(6, 12, 1, 1, '#fb7185')
    px(13, 12, 1, 1, '#fb7185')
    // Cozy green coat & red scarf
    px(6, 14, 8, 2, '#dc2626')
    px(5, 16, 10, 4, '#15803d')
    px(6, 20, 3, 2, '#4a2c18')
    px(11, 20, 3, 2, '#4a2c18')
    // Mini potted pine beside caretaker
    px(15, 19, 4, 3, '#9a3412')
    px(15, 16, 4, 3, '#166534')
    px(16, 14, 2, 2, '#22c55e')
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
    px(4, 4, 8, 1, '#1e293b')
    px(5, 1, 6, 3, '#1e293b')
    px(5, 3, 6, 1, '#dc2626')
    px(6, 7, 1, 1, '#0f172a')
    px(9, 7, 1, 1, '#0f172a')
    px(7, 8, 3, 1, '#f97316')
    px(5, 10, 6, 2, '#dc2626')
    px(9, 12, 2, 3, '#b91c1c')
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
    px(2, 8, 7, 6, '#dc2626')
    px(5, 8, 1, 6, '#fbbf24')
    px(2, 10, 7, 1, '#fbbf24')
    px(8, 9, 6, 5, '#15803d')
    px(10, 9, 2, 5, '#f8fafc')
    px(8, 11, 6, 1, '#f8fafc')
    px(5, 4, 5, 4, '#f59e0b')
    px(7, 4, 1, 4, '#b91c1c')
  })

  // Warm Radial Pixel Glow (32x32)
  createCanvasTexture(scene, 'deco-glow', 32, 32, (ctx) => {
    const gradient = ctx.createRadialGradient(16, 16, 1, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(253, 224, 71, 0.58)')
    gradient.addColorStop(0.45, 'rgba(251, 191, 36, 0.24)')
    gradient.addColorStop(1, 'rgba(251, 191, 36, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 32, 32)
  })

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
  contributionCount?: number
  calendarWeeks?: GitHubContributionWeek[]
}

/**
 * Draws a 48x64 storybook pixel-art Christmas tree combining organic leaf-cluster
 * foliage, textured bark roots, snow tufts, twinkling commit lights, ornaments and gifts.
 */
export function ensureTreeTexture(scene: Phaser.Scene, opts: TreeTextureOptions): void {
  const {
    key,
    level,
    seed,
    isCreatorSpecial = false,
    lightsPhase,
    contributionCount,
    calendarWeeks,
  } = opts
  createCanvasTexture(scene, key, 48, 64, (ctx) => {
    drawTreeToCanvas(ctx, {
      level,
      seed,
      isCreatorSpecial,
      lightsPhase,
      contributionCount,
      calendarWeeks,
    })
  })
}

export function generateAllVillageTextures(scene: Phaser.Scene): void {
  generateGroundTextures(scene)
  generateStorybookCottage(scene)
  generateMushroomCottage(scene, 'cottage-mushroom-pine', '#166534', '#14532d', '#e2e8f0')
  generateMushroomCottage(scene, 'cottage-mushroom-red', '#991b1b', '#7f1d1d', '#fef3c7')
  generateStumpCabin(scene)
  generateDecorTextures(scene)
}
