import type { CityTree, VillagePropDialogue } from '../types/city'

type Listener<T> = (payload: T) => void

export interface GameEventMap {
  'city:ready': undefined
  'city:trees-updated': readonly CityTree[]
  'city:tree-hovered': CityTree | null
  'city:tree-selected': CityTree
  'city:focus-tree': string
  'city:focus-creator': undefined
  'city:prop-interacted': VillagePropDialogue
  'city:zoom-in': undefined
  'city:zoom-out': undefined
  'city:reset-camera': undefined
  'city:orbit-left': undefined
  'city:orbit-right': undefined
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
