import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { ChevronDown, ChevronUp, Map as MapIcon } from 'lucide-react'
import {
  OUTER_IGLOO_VILLAGES,
  OUTER_NEIGHBORHOOD_CHALETS,
  OUTER_WATCHTOWERS,
} from '../../config/cityMapConfig'
import { useLocale } from '../../context/localeContextStore'
import { type CameraTelemetry, gameEventBus } from '../../game/eventBus'
import {
  CONTINENT_LAKES,
  CONTINENT_REGIONS,
  getBridgeDirectionWorld,
  getContinentElevationFactor,
  getContinentRegionAtWorld,
  gridToWorldCoords,
  isLakeIsletWorld,
  isLakePierWorld,
  isLakeWorld,
  isLandWorld,
  isRiverWorld,
  isWithinSafePlayableBounds,
  WORLD_MAP_BOUNDS,
} from '../../game/layout/continentGeography'
import type { AmbientTreePoint } from '../../game/voxel/proceduralTreesLayer'
import type { CityTree } from '../../types/city'

interface CityMinimapProps {
  trees: readonly CityTree[]
  ambientPoints: readonly AmbientTreePoint[]
  selectedTree: CityTree | null
  isHidden?: boolean
}

const CANVAS_W = 212
const CANVAS_H = 222
const RASTER_SCALE = 2
const RASTER_W = CANVAS_W * RASTER_SCALE
const RASTER_H = CANVAS_H * RASTER_SCALE
const WORLD_SPAN_X = WORLD_MAP_BOUNDS.maxX - WORLD_MAP_BOUNDS.minX
const WORLD_SPAN_Z = WORLD_MAP_BOUNDS.maxZ - WORLD_MAP_BOUNDS.minZ

function worldToCanvas(wx: number, wz: number): { px: number; py: number } {
  return {
    px: ((wx - WORLD_MAP_BOUNDS.minX) / WORLD_SPAN_X) * CANVAS_W,
    py: ((wz - WORLD_MAP_BOUNDS.minZ) / WORLD_SPAN_Z) * CANVAS_H,
  }
}

function canvasToWorld(px: number, py: number): { x: number; z: number } {
  const nx = Math.max(0, Math.min(1, px / CANVAS_W))
  const ny = Math.max(0, Math.min(1, py / CANVAS_H))
  return {
    x: WORLD_MAP_BOUNDS.minX + nx * WORLD_SPAN_X,
    z: WORLD_MAP_BOUNDS.minZ + ny * WORLD_SPAN_Z,
  }
}

interface MinimapRadarBodyProps {
  realTrees: readonly CityTree[]
  creatorTree: CityTree | null
  ambientPoints: readonly AmbientTreePoint[]
  selectedTree: CityTree | null
  telemetryRef: MutableRefObject<CameraTelemetry>
  onCollapse: () => void
  positionClass: string
}

/**
 * Isolated radar body mounted ONLY when the minimap is actually visible and expanded.
 * Guarantees canvas refs always exist on initial mount (including after closing the welcome modal).
 */
function MinimapRadarBody({
  realTrees,
  creatorTree,
  ambientPoints,
  selectedTree,
  telemetryRef,
  onCollapse,
  positionClass,
}: MinimapRadarBodyProps) {
  const { language, t } = useLocale()
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const regionBadgeRef = useRef<HTMLSpanElement | null>(null)
  const isScrubbingRef = useRef(false)

  const renderOverlay = useCallback(() => {
    const fgCanvas = fgCanvasRef.current
    if (!fgCanvas) return
    const ctx = fgCanvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const targetW = Math.round(CANVAS_W * dpr)
    const targetH = Math.round(CANVAS_H * dpr)
    if (fgCanvas.width !== targetW || fgCanvas.height !== targetH) {
      fgCanvas.width = targetW
      fgCanvas.height = targetH
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    // 1. Creator tree gold diamond (@SaraMag25)
    if (creatorTree) {
      const cw = gridToWorldCoords(creatorTree.tree_position.gridX, creatorTree.tree_position.gridY)
      const cp = worldToCanvas(cw.x, cw.z)
      ctx.fillStyle = '#051124'
      ctx.beginPath()
      ctx.moveTo(cp.px, cp.py - 4.4)
      ctx.lineTo(cp.px + 4.2, cp.py)
      ctx.lineTo(cp.px, cp.py + 4.4)
      ctx.lineTo(cp.px - 4.2, cp.py)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = '#fde047'
      ctx.beginPath()
      ctx.moveTo(cp.px, cp.py - 3.2)
      ctx.lineTo(cp.px + 3.0, cp.py)
      ctx.lineTo(cp.px, cp.py + 3.2)
      ctx.lineTo(cp.px - 3.0, cp.py)
      ctx.closePath()
      ctx.fill()
    }

    // 2. Active selected developer tree marker
    if (selectedTree && !selectedTree.isDecorative) {
      const sw = gridToWorldCoords(selectedTree.tree_position.gridX, selectedTree.tree_position.gridY)
      const sp = worldToCanvas(sw.x, sw.z)
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(sp.px, sp.py, 5.2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#e0f2fe'
      ctx.beginPath()
      ctx.arc(sp.px, sp.py, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }

    // 3. Real-time camera target + oriented FOV rectangle
    const cam = telemetryRef.current
    const cp = worldToCanvas(cam.targetX, cam.targetZ)
    const fovHalfW = Math.max(4.5, ((cam.distance * 0.64) / WORLD_SPAN_X) * CANVAS_W)
    const fovHalfH = Math.max(4.0, ((cam.distance * 0.45) / WORLD_SPAN_Z) * CANVAS_H)

    ctx.save()
    ctx.translate(cp.px, cp.py)
    // Camera azimuth 0 looks from +Z toward -Z; rotate viewport indicator to match map axes
    ctx.rotate(-cam.azimuth)
    ctx.fillStyle = 'rgba(253, 224, 71, 0.14)'
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.84)'
    ctx.lineWidth = 1.15
    ctx.fillRect(-fovHalfW, -fovHalfH, fovHalfW * 2, fovHalfH * 2)
    ctx.strokeRect(-fovHalfW, -fovHalfH, fovHalfW * 2, fovHalfH * 2)
    // Forward direction notch
    ctx.fillStyle = '#fde047'
    ctx.fillRect(-2, -fovHalfH - 2, 4, 2.2)
    ctx.restore()

    // Bright gold/white crosshair center dot
    ctx.fillStyle = '#041022'
    ctx.beginPath()
    ctx.arc(cp.px, cp.py, 4.0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cp.px, cp.py, 2.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fde047'
    ctx.beginPath()
    ctx.arc(cp.px, cp.py, 1.7, 0, Math.PI * 2)
    ctx.fill()

    // Update current district badge via DOM ref without React re-renders during drag/pan
    if (regionBadgeRef.current) {
      const region = getContinentRegionAtWorld(cam.targetX, cam.targetZ)
      const nextLabel = language === 'en' ? region.nameEn : region.namePt
      if (regionBadgeRef.current.textContent !== nextLabel) {
        regionBadgeRef.current.textContent = nextLabel
      }
    }
  }, [creatorTree, selectedTree, language, telemetryRef])

  const renderStaticTerrain = useCallback(() => {
    const bgCanvas = bgCanvasRef.current
    if (!bgCanvas) return
    const ctx = bgCanvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const targetW = Math.round(CANVAS_W * dpr)
    const targetH = Math.round(CANVAS_H * dpr)
    if (bgCanvas.width !== targetW || bgCanvas.height !== targetH) {
      bgCanvas.width = targetW
      bgCanvas.height = targetH
    }

    // Offscreen hi-res terrain raster so coasts, lakes, and rivers look crisp at every DPR
    const rasterCanvas = document.createElement('canvas')
    rasterCanvas.width = RASTER_W
    rasterCanvas.height = RASTER_H
    const rCtx = rasterCanvas.getContext('2d')
    if (!rCtx) return

    const img = rCtx.createImageData(RASTER_W, RASTER_H)
    const data = img.data

    for (let py = 0; py < RASTER_H; py += 1) {
      const wz = WORLD_MAP_BOUNDS.minZ + ((py + 0.5) / RASTER_H) * WORLD_SPAN_Z
      const depthGrad = Math.abs(py / RASTER_H - 0.5) * 2
      for (let px = 0; px < RASTER_W; px += 1) {
        const wx = WORLD_MAP_BOUNDS.minX + ((px + 0.5) / RASTER_W) * WORLD_SPAN_X
        const idx = (py * RASTER_W + px) * 4

        const bridge = getBridgeDirectionWorld(wx, wz)
        if (bridge !== null) {
          data[idx] = 212
          data[idx + 1] = 154
          data[idx + 2] = 86
          data[idx + 3] = 255
          continue
        }

        if (isLakePierWorld(wx, wz)) {
          data[idx] = 198
          data[idx + 1] = 142
          data[idx + 2] = 80
          data[idx + 3] = 255
          continue
        }

        if (isLakeWorld(wx, wz)) {
          const lakeRim =
            !isLakeWorld(wx - 4.0, wz) ||
            !isLakeWorld(wx + 4.0, wz) ||
            !isLakeWorld(wx, wz - 4.0) ||
            !isLakeWorld(wx, wz + 4.0)
          if (lakeRim) {
            data[idx] = 112
            data[idx + 1] = 211
            data[idx + 2] = 252
            data[idx + 3] = 255
          } else {
            data[idx] = 28
            data[idx + 1] = 152
            data[idx + 2] = 236
            data[idx + 3] = 255
          }
          continue
        }

        if (isRiverWorld(wx, wz)) {
          data[idx] = 26
          data[idx + 1] = 146
          data[idx + 2] = 230
          data[idx + 3] = 255
          continue
        }

        if (isLandWorld(wx, wz)) {
          const coastEdge =
            !isLandWorld(wx - 3.8, wz) ||
            !isLandWorld(wx + 3.8, wz) ||
            !isLandWorld(wx, wz - 3.8) ||
            !isLandWorld(wx, wz + 3.8)

          if (coastEdge) {
            data[idx] = 125
            data[idx + 1] = 211
            data[idx + 2] = 252
            data[idx + 3] = 255
          } else if (isLakeIsletWorld(wx, wz)) {
            data[idx] = 74
            data[idx + 1] = 116
            data[idx + 2] = 160
            data[idx + 3] = 255
          } else {
            const elev = getContinentElevationFactor(wx, wz)
            data[idx] = Math.round(28 + elev * 22)
            data[idx + 1] = Math.round(52 + elev * 32)
            data[idx + 2] = Math.round(86 + elev * 44)
            data[idx + 3] = 255
          }
        } else {
          // Arctic Ocean shallow ice glow near coasts, deep polar abyss further out
          const nearCoast =
            isLandWorld(wx - 9, wz) ||
            isLandWorld(wx + 9, wz) ||
            isLandWorld(wx, wz - 9) ||
            isLandWorld(wx, wz + 9)
          if (nearCoast) {
            data[idx] = 12
            data[idx + 1] = 42
            data[idx + 2] = 78
            data[idx + 3] = 255
          } else {
            data[idx] = Math.round(5 + (1 - depthGrad) * 3)
            data[idx + 1] = Math.round(16 + (1 - depthGrad) * 7)
            data[idx + 2] = Math.round(34 + (1 - depthGrad) * 14)
            data[idx + 3] = 255
          }
        }
      }
    }

    rCtx.putImageData(img, 0, 0)

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.drawImage(rasterCanvas, 0, 0, CANVAS_W, CANVAS_H)

    // Subtle polar grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)'
    ctx.lineWidth = 1
    for (let x = 42; x < CANVAS_W; x += 42) {
      ctx.beginPath()
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, CANVAS_H)
      ctx.stroke()
    }
    for (let y = 44; y < CANVAS_H; y += 44) {
      ctx.beginPath()
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(CANVAS_W, y + 0.5)
      ctx.stroke()
    }

    // Scenic lake shimmer accents so each lake reads clearly even at a glance
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)'
    ctx.lineWidth = 0.8
    for (const lake of CONTINENT_LAKES) {
      const lp = worldToCanvas(lake.x, lake.z)
      ctx.beginPath()
      ctx.ellipse(
        lp.px,
        lp.py,
        Math.max(2, (lake.rx / WORLD_SPAN_X) * CANVAS_W * 0.65),
        Math.max(1.5, (lake.rz / WORLD_SPAN_Z) * CANVAS_H * 0.65),
        0,
        0,
        Math.PI * 2,
      )
      ctx.stroke()
    }

    // Peripheral coastal-fringe trees (strictly capped <= 25% of real trees in High mode)
    for (let i = 0; i < ambientPoints.length; i += 1) {
      const pt = ambientPoints[i]
      const { px, py } = worldToCanvas(pt.x, pt.z)
      ctx.fillStyle = 'rgba(38, 166, 65, 0.38)'
      ctx.fillRect(px - 0.65, py - 0.65, 1.3, 1.3)
    }

    // Real clickable GitHub developer trees forming all neighborhoods & lakeshores (up to 3,000)
    ctx.fillStyle = 'rgba(94, 232, 122, 0.92)'
    for (let i = 0; i < realTrees.length; i += 1) {
      const tPos = realTrees[i].tree_position
      const w = gridToWorldCoords(tPos.gridX, tPos.gridY)
      const { px, py } = worldToCanvas(w.x, w.z)
      ctx.fillRect(px - 0.9, py - 0.9, 1.8, 1.8)
    }

    // Landmark pins for igloo villages, neighborhood chalets & lighthouses
    ctx.fillStyle = 'rgba(186, 230, 253, 0.78)'
    for (const ig of OUTER_IGLOO_VILLAGES) {
      const w = gridToWorldCoords(ig.gridX, ig.gridY)
      const { px, py } = worldToCanvas(w.x, w.z)
      ctx.fillRect(px - 0.85, py - 0.85, 1.7, 1.7)
    }
    ctx.fillStyle = 'rgba(255, 209, 102, 0.9)'
    for (const c of OUTER_NEIGHBORHOOD_CHALETS) {
      const w = gridToWorldCoords(c.gridX, c.gridY)
      const { px, py } = worldToCanvas(w.x, w.z)
      ctx.fillRect(px - 1.1, py - 1.1, 2.2, 2.2)
    }
    ctx.fillStyle = 'rgba(125, 211, 252, 0.95)'
    for (const tower of OUTER_WATCHTOWERS) {
      const w = gridToWorldCoords(tower.gridX, tower.gridY)
      const { px, py } = worldToCanvas(w.x, w.z)
      ctx.fillRect(px - 1.25, py - 1.25, 2.5, 2.5)
    }

    // Discreet North (N) compass tag at top-right of radar
    ctx.fillStyle = 'rgba(148, 163, 184, 0.85)'
    ctx.font = 'bold 8px monospace'
    ctx.fillText('N', CANVAS_W - 10, 10)

    renderOverlay()
  }, [realTrees, ambientPoints, renderOverlay])

  // Render immediately on mount and whenever data or resize changes
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      renderStaticTerrain()
      gameEventBus.emit('city:request-telemetry')
    })

    const onResize = () => renderStaticTerrain()
    window.addEventListener('resize', onResize)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [renderStaticTerrain])

  // Paint live overlay telemetry
  useEffect(() => {
    renderOverlay()
    return gameEventBus.on('city:camera-telemetry', () => {
      renderOverlay()
    })
  }, [renderOverlay])

  const getSafeWorldFromPointer = (clientX: number, clientY: number): { x: number; z: number } | null => {
    const canvas = fgCanvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const px = ((clientX - rect.left) / rect.width) * CANVAS_W
    const py = ((clientY - rect.top) / rect.height) * CANVAS_H
    const raw = canvasToWorld(px, py)
    return isWithinSafePlayableBounds(raw.x, raw.z) ? raw : null
  }

  const panFromPointerEvent = (clientX: number, clientY: number) => {
    const safeTarget = getSafeWorldFromPointer(clientX, clientY)
    if (!safeTarget) return
    gameEventBus.emit('city:pan-to-world', { x: safeTarget.x, z: safeTarget.z })
  }

  const updateCursorAtPointer = (el: HTMLCanvasElement, clientX: number, clientY: number) => {
    el.style.cursor = getSafeWorldFromPointer(clientX, clientY) ? 'crosshair' : 'not-allowed'
  }

  return (
    <section
      aria-label={t.minimap.ariaLabel}
      className={`fixed bottom-14 z-20 w-[228px] pixel-night-panel rounded-md p-2 shadow-2xl transition-all duration-200 sm:bottom-16 ${positionClass}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1.5 border-b border-slate-800/90 pb-1 text-[10px]">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
          <span className="font-bold text-emerald-300">$ {t.minimap.radarLabel}</span>
          <span className="text-slate-600">·</span>
          <span ref={regionBadgeRef} className="truncate font-medium text-amber-300">
            {language === 'en' ? 'Central Village' : 'Vila Central'}
          </span>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          title={t.minimap.collapseTitle}
          aria-label={t.minimap.collapseTitle}
          className="rounded-sm p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className="relative overflow-hidden rounded-sm border border-sky-500/35 bg-[#051124]"
        style={{ width: CANVAS_W, height: CANVAS_H }}
      >
        <canvas
          ref={bgCanvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block h-full w-full"
        />
        <canvas
          ref={fgCanvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={(e) => {
            e.stopPropagation()
            updateCursorAtPointer(e.currentTarget, e.clientX, e.clientY)
            if (!getSafeWorldFromPointer(e.clientX, e.clientY)) return
            isScrubbingRef.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            panFromPointerEvent(e.clientX, e.clientY)
          }}
          onPointerMove={(e) => {
            updateCursorAtPointer(e.currentTarget, e.clientX, e.clientY)
            if (!isScrubbingRef.current) return
            e.stopPropagation()
            panFromPointerEvent(e.clientX, e.clientY)
          }}
          onPointerUp={(e) => {
            if (!isScrubbingRef.current) return
            e.stopPropagation()
            isScrubbingRef.current = false
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
          }}
          onPointerCancel={() => {
            isScrubbingRef.current = false
          }}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
        />
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {CONTINENT_REGIONS.map((region) => (
          <button
            key={region.id}
            type="button"
            onClick={() =>
              gameEventBus.emit('city:pan-to-world', {
                x: region.x,
                z: region.z,
                distance: region.cameraDist,
              })
            }
            className="rounded-[2px] border border-slate-700/90 bg-[#040811]/85 px-1.5 py-0.5 text-[9px] font-medium text-slate-200 transition hover:border-emerald-400/70 hover:text-emerald-300 cursor-pointer"
          >
            {language === 'en' ? region.nameEn : region.namePt}
          </button>
        ))}
      </div>
    </section>
  )
}

export function CityMinimap({
  trees,
  ambientPoints,
  selectedTree,
  isHidden = false,
}: CityMinimapProps) {
  const { t } = useLocale()
  const [isCollapsed, setIsCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  )
  const telemetryRef = useRef<CameraTelemetry>({
    targetX: 1.6,
    targetZ: 1.6,
    distance: 62,
    azimuth: Math.PI * 0.25,
    polar: 0.6,
  })

  // Keep telemetryRef warm even while welcome screen or collapsed drawer is active
  useEffect(() => {
    return gameEventBus.on('city:camera-telemetry', (telem) => {
      telemetryRef.current = telem
    })
  }, [])

  const realTrees = useMemo(() => trees.filter((item) => !item.isDecorative), [trees])
  const creatorTree = useMemo(
    () => realTrees.find((item) => item.is_creator_special) ?? realTrees[0] ?? null,
    [realTrees],
  )

  if (isHidden) return null

  const positionClass = selectedTree
    ? 'hidden sm:block sm:right-[25.5rem]'
    : 'right-3 sm:right-4'

  if (isCollapsed) {
    return (
      <div className={`fixed bottom-14 z-20 transition-all duration-200 sm:bottom-16 ${positionClass}`}>
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          title={t.minimap.expandTitle}
          className="pixel-night-panel inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 transition hover:border-emerald-400/70 cursor-pointer"
        >
          <MapIcon className="h-3.5 w-3.5 text-emerald-400" />
          <span>{t.minimap.radarLabel}</span>
          <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </div>
    )
  }

  return (
    <MinimapRadarBody
      realTrees={realTrees}
      creatorTree={creatorTree}
      ambientPoints={ambientPoints}
      selectedTree={selectedTree}
      telemetryRef={telemetryRef}
      onCollapse={() => setIsCollapsed(true)}
      positionClass={positionClass}
    />
  )
}
