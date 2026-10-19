import type { Planet } from '@/types/game'

export type GalaxyMapView = 'system' | 'region' | 'galaxy'

export interface GalaxyMapSlot {
  position: number
  planet: Planet | null
  moon: Planet | null
}
