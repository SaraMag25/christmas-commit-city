import type { AppLanguage } from '../i18n/translations'
import type { CityTree, VillagePropDialogue } from '../types/city'
import type { AmbientTreePoint } from './voxel/proceduralTreesLayer'

type Listener<T> = (payload: T) => void

export type GraphicsQualityMode = 'high' | 'low'
export type TreeExportFormat = 'png' | 'gif'

export interface TreeExportRequest {
  treeId: string
  username: string
  displayCommits: number
  periodYear: number
  level: number
  stageName: string
  language: AppLanguage
  format: TreeExportFormat
  onProgress?: (percent: number) => void
  onComplete?: (success: boolean) => void
}

export interface CameraTelemetry {
  targetX: number
  targetZ: number
  distance: number
  azimuth: number
  polar: number
}

export interface GameEventMap {
  'city:ready': undefined
  'city:trees-updated': readonly CityTree[]
  'city:tree-hovered': CityTree | null
  'city:tree-selected': CityTree
  'city:focus-tree': string
  'city:focus-creator': undefined
  'city:pan-to-world': { x: number; z: number; distance?: number }
  'city:camera-telemetry': CameraTelemetry
  'city:request-telemetry': undefined
  'city:ambient-points-updated': readonly AmbientTreePoint[]
  'city:low-fps-suggested': undefined
  'city:search-flight-start': { username: string }
  'city:search-flight-abort': undefined
  'city:request-swap-slot': {
    excludedIds: Set<string>
    onResolve: (slot: CityTree | null) => void
  }
  'city:prop-interacted': VillagePropDialogue
  'city:zoom-in': undefined
  'city:zoom-out': undefined
  'city:reset-camera': undefined
  'city:orbit-left': undefined
  'city:orbit-right': undefined
  'city:graphics-quality': GraphicsQualityMode
  'city:graphics-auto-downgraded': undefined
  'city:export-tree': TreeExportRequest
}

class TypedEventBus {
  private listeners = new Map<keyof GameEventMap, Set<Listener<never>>>()

  on<K extends keyof GameEventMap>(event: K, listener: Listener<GameEventMap[K]>): () => void {
    const existing = this.listeners.get(event) ?? new Set<Listener<never>>()
    existing.add(listener as Listener<never>)
    this.listeners.set(event, existing)

    return () => {
      existing.delete(listener as Listener<never>)
    }
  }

  emit<K extends keyof GameEventMap>(
    event: K,
    ...args: GameEventMap[K] extends undefined ? [] : [GameEventMap[K]]
  ): void {
    const set = this.listeners.get(event)
    if (!set) return
    const payload = args[0] as GameEventMap[K]
    set.forEach((fn) => {
      ;(fn as Listener<GameEventMap[K]>)(payload)
    })
  }
}

export const gameEventBus = new TypedEventBus()
