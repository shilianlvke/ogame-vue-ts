<template>
  <div
    ref="wrapRef"
    class="relative h-full min-h-[360px] w-full touch-none overflow-hidden bg-[#050a18] text-slate-100 select-none"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="onPointerLeave"
    @wheel.prevent="onWheel"
  >
    <canvas ref="canvasRef" class="absolute inset-0 h-full w-full" />

    <!-- 画布内悬停信息 -->
    <div
      v-if="hover"
      class="pointer-events-none absolute z-20 w-56 rounded-lg border border-white/15 bg-slate-950/90 p-2.5 text-xs shadow-xl backdrop-blur"
      :style="{ left: `${hover.x}px`, top: `${hover.y}px` }"
    >
      <div class="truncate font-semibold text-white">{{ hover.title }}</div>
      <div v-if="hover.subtitle" class="truncate text-[10px] text-slate-400">{{ hover.subtitle }}</div>
      <div v-for="line in hover.lines" :key="line" class="mt-0.5 text-[10px] text-slate-300">{{ line }}</div>
    </div>

    <!-- 小地图说明 -->
    <div class="pointer-events-none absolute bottom-3 left-3 rounded-md border border-white/10 bg-slate-950/55 px-2 py-1 text-[10px] text-slate-400">
      <span class="sm:hidden">{{ t('galaxyMap.dragHint') }}</span>
      <span class="hidden sm:inline">{{ t('galaxyMap.hoverHint') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useGameStore } from '@/stores/gameStore'
  import { useNPCStore } from '@/stores/npcStore'
  import { useI18n } from '@/composables/useI18n'
  import { DEFAULT_LAYOUT_SEED, LAYOUT_CONFIG, regionOfGalaxy } from '@/config/galaxyConfig'
  import { buildCycleLayout } from '@/logic/galaxyGen'
  import { generateRegionName, generateStellarName } from '@/logic/nameGenerator'
  import type { Planet } from '@/types/game'
  import type { RegionLayout, StarSystem } from '@/types/galaxy'
  import type { GalaxyMapSlot, GalaxyMapView } from './types'

  interface MapState {
    view: GalaxyMapView
    galaxy: number
    system: number
  }

  type HitTarget =
    | { kind: 'slot'; x: number; y: number; radius: number; slot: GalaxyMapSlot }
    | { kind: 'system'; x: number; y: number; radius: number; system: StarSystem }
    | { kind: 'region'; x: number; y: number; radius: number; region: RegionLayout }

  interface HoverInfo {
    x: number
    y: number
    title: string
    subtitle: string
    lines: string[]
  }

  const props = defineProps<{
    view: GalaxyMapView
    galaxy: number
    system: number
    slots: GalaxyMapSlot[]
    selectedPlanetId?: string | null
    selectedSystemId?: string | null
    selectedRegion?: number | null
  }>()

  const emit = defineEmits<{
    (e: 'select-slot', slot: GalaxyMapSlot): void
    (e: 'select-system', system: StarSystem): void
    (e: 'select-region', region: RegionLayout): void
  }>()

  const gameStore = useGameStore()
  const npcStore = useNPCStore()
  const { t } = useI18n()

  const wrapRef = ref<HTMLElement | null>(null)
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const hover = ref<HoverInfo | null>(null)

  const cycle = computed(() => gameStore.player.cycle ?? 1)
  const layout = computed(() => buildCycleLayout(DEFAULT_LAYOUT_SEED, cycle.value))
  const currentRegion = computed(() => regionOfGalaxy(props.galaxy))
  const regionLayout = computed(
    () => layout.value.regions.find(region => region.region === currentRegion.value) ?? layout.value.regions[0]
  )
  const currentStar = computed(() => regionLayout.value?.systems.find(system => system.index === props.system))

  const zoom = ref(1)
  const canvasSize = ref({ width: 1, height: 1 })
  let ctx!: CanvasRenderingContext2D
  let dpr = 1
  let raf = 0
  let resizeObserver: ResizeObserver | null = null
  let hitTargets: HitTarget[] = []
  let lastRendered: MapState = { view: props.view, galaxy: props.galaxy, system: props.system }
  let transition: { from: MapState; to: MapState; startedAt: number } | null = null

  const pointerState = new Map<number, { x: number; y: number }>()
  let dragOrigin: { x: number; y: number } | null = null
  let moved = false
  let pan = { x: 0, y: 0 }
  let pinchDistance = 0

  const COLORS = {
    background: '#050a18',
    star: '#f8d38a',
    orbit: 'rgba(148, 196, 255, 0.22)',
    lane: 'rgba(125, 211, 252, 0.3)',
    gate: 'rgba(167, 139, 250, 0.55)',
    label: '#dbeafe',
    labelMuted: '#7f93b7',
    current: '#fbbf24',
    selected: '#67e8f9',
    own: '#60a5fa',
    npc: '#f59e0b',
    hostile: '#fb7185',
    friendly: '#34d399',
    empty: '#1e293b'
  }

  const ECONOMY_COLOR: Record<string, string> = {
    mining: '#f59e0b',
    industrial: '#94a3b8',
    tech: '#38bdf8',
    trade: '#34d399',
    agriculture: '#84cc16',
    military: '#f43f5e'
  }

  const systemIdOf = (galaxy: number, system: number): string =>
    `${cycle.value}:${regionOfGalaxy(galaxy)}:${system}`

  const discoveredOf = (galaxy: number, system: number) =>
    gameStore.player.discoveredSystems?.[systemIdOf(galaxy, system)]

  const systemName = (system: StarSystem): string => {
    const custom = discoveredOf(system.galaxy, system.index)?.name
    return custom ?? system.name ?? generateStellarName(system.galaxy, system.index)
  }

  const regionName = (region: RegionLayout): string =>
    generateRegionName(region.region)

  const isOwnPlanet = (planet: Planet | null): boolean => !!planet && planet.ownerId === gameStore.player.id

  const npcOfPlanet = (planet: Planet | null) => {
    if (!planet || isOwnPlanet(planet)) return null
    return npcStore.npcs.find(npc =>
      npc.planets.some(
        item =>
          item.position.galaxy === planet.position.galaxy &&
          item.position.system === planet.position.system &&
          item.position.position === planet.position.position
      )
    )
  }

  const ownerColor = (planet: Planet | null): string => {
    if (!planet) return COLORS.empty
    if (isOwnPlanet(planet)) return COLORS.own
    const npc = npcOfPlanet(planet)
    const relation = npc?.relations?.[gameStore.player.id]
    if (relation?.status === 'hostile') return COLORS.hostile
    if (relation?.status === 'friendly') return COLORS.friendly
    return COLORS.npc
  }

  const slotLabel = (slot: GalaxyMapSlot): string => {
    if (!slot.planet) return `${t('galaxyMap.orbit')} ${slot.position}`
    const scanned = !!discoveredOf(slot.planet.position.galaxy, slot.planet.position.system)
    if (isOwnPlanet(slot.planet)) return slot.planet.name
    return scanned ? slot.planet.name : `${t('galaxyMap.orbit')} ${slot.position}`
  }

  const regionScannedCount = (region: RegionLayout): number =>
    region.systems.filter(system => !!discoveredOf(system.galaxy, system.index)).length

  const resize = (): void => {
    const canvas = canvasRef.value
    const wrap = wrapRef.value
    if (!canvas || !wrap) return
    const rect = wrap.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvasSize.value = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) }
    canvas.width = Math.floor(rect.width * dpr)
    canvas.height = Math.floor(rect.height * dpr)
    ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    draw()
  }

  const requestDraw = (): void => {
    if (raf) return
    raf = window.requestAnimationFrame(() => {
      raf = 0
      draw()
    })
  }

  const draw = (): void => {
    const canvas = canvasRef.value
    if (!canvas || !ctx) return
    const { width, height } = canvasSize.value
    ctx.clearRect(0, 0, width, height)
    drawSpaceBackground(ctx, width, height)

    if (transition) {
      const progress = Math.min(1, (performance.now() - transition.startedAt) / 560)
      const eased = 1 - Math.pow(1 - progress, 3)
      drawScene(transition.from, 1 - eased, 1 + 0.22 * eased)
      drawScene(transition.to, eased, 0.78 + 0.22 * eased)
      if (progress < 1) {
        requestDraw()
      } else {
        transition = null
        lastRendered = { view: props.view, galaxy: props.galaxy, system: props.system }
        draw()
      }
      return
    }

    hitTargets = []
    drawScene({ view: props.view, galaxy: props.galaxy, system: props.system }, 1, 1)
    lastRendered = { view: props.view, galaxy: props.galaxy, system: props.system }
  }

  const drawScene = (state: MapState, alpha: number, scale: number): void => {
    if (!ctx) return
    const { width, height } = canvasSize.value
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(width / 2, height / 2)
    ctx.scale(scale, scale)
    ctx.translate(-width / 2, -height / 2)

    if (state.view === 'system') drawSystem(state, alpha === 1)
    else if (state.view === 'region') drawRegion(state, alpha === 1)
    else drawGalaxy(state, alpha === 1)

    ctx.restore()
  }

  const drawSpaceBackground = (context: CanvasRenderingContext2D, width: number, height: number): void => {
    const gradient = context.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.75)
    gradient.addColorStop(0, '#0c1730')
    gradient.addColorStop(0.5, '#071024')
    gradient.addColorStop(1, COLORS.background)
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    // 确定性星尘，避免每帧闪烁
    const count = Math.max(80, Math.floor((width * height) / 11000))
    for (let i = 0; i < count; i += 1) {
      const x = ((i * 7919 + 31) % 10000) / 10000 * width
      const y = ((i * 104729 + 17) % 10000) / 10000 * height
      const radius = i % 7 === 0 ? 1.2 : 0.55
      context.globalAlpha = i % 5 === 0 ? 0.55 : 0.25
      context.fillStyle = i % 11 === 0 ? '#93c5fd' : '#e2e8f0'
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
    }
    context.globalAlpha = 1

    const vignette = context.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.2,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75
    )
    vignette.addColorStop(0, 'rgba(5,10,24,0)')
    vignette.addColorStop(1, 'rgba(5,10,24,0.78)')
    context.fillStyle = vignette
    context.fillRect(0, 0, width, height)
  }

  const drawSystem = (state: MapState, interactive: boolean): void => {
    if (!ctx) return
    const { width, height } = canvasSize.value
    const cx = width / 2 + pan.x
    const cy = height / 2 + pan.y
    const size = Math.min(width, height)
    const orbitBase = size * 0.4 * zoom.value
    const star = currentStar.value

    // 恒星光晕
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.22)
    glow.addColorStop(0, 'rgba(254, 240, 138, 0.8)')
    glow.addColorStop(0.16, 'rgba(251, 191, 36, 0.32)')
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.22, 0, Math.PI * 2)
    ctx.fill()

    // 星体
    ctx.fillStyle = COLORS.star
    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(10, size * 0.045), 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1
    ctx.stroke()

    drawCenteredLabel(star ? systemName(star) : `${state.galaxy}:${state.system}`, cx, cy + size * 0.08, 15, '#fff6d6', '600')
    ctx.fillStyle = COLORS.labelMuted
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`[${state.galaxy}:${state.system}]`, cx, cy + size * 0.08 + 17)

    // 恒星系外围的航线方向指示
    const currentId = systemIdOf(state.galaxy, state.system)
    const adjacent = layout.value.adjacency.get(currentId) ?? []
    ctx.save()
    ctx.setLineDash([4, 7])
    for (const lane of adjacent) {
      const otherId = lane.a === currentId ? lane.b : lane.a
      const other = layout.value.systemIndex.get(otherId)
      if (!other) continue
      const angle = Math.atan2(other.coords.y - (star?.coords.y ?? 0), other.coords.x - (star?.coords.x ?? 0))
      const len = size * 0.46
      ctx.strokeStyle = lane.kind === 'gate' ? 'rgba(167,139,250,0.38)' : 'rgba(125,211,252,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(angle) * size * 0.1, cy + Math.sin(angle) * size * 0.08)
      ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len)
      ctx.stroke()
    }
    ctx.restore()

    const slots = props.slots.length > 0 ? props.slots : Array.from({ length: 10 }, (_, i) => ({ position: i + 1, planet: null, moon: null }))
    const angleOffset = -Math.PI / 2 + 0.2
    slots.forEach((slot, index) => {
      const ratio = (index + 1) / slots.length
      const rx = orbitBase * (0.24 + ratio * 0.75)
      const ry = rx * 0.58
      ctx.strokeStyle = COLORS.orbit
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()

      const angle = angleOffset + index * ((Math.PI * 2) / slots.length)
      const x = cx + Math.cos(angle) * rx
      const y = cy + Math.sin(angle) * ry
      const isSelected = !!slot.planet && slot.planet.id === props.selectedPlanetId
      const scanned = !!discoveredOf(state.galaxy, state.system)
      const showLabel = isOwnPlanet(slot.planet) || scanned || isSelected
      const color = ownerColor(slot.planet)
      const planetRadius = Math.max(3.2, Math.min(7, size * 0.012))

      if (slot.planet) {
        ctx.shadowColor = color
        ctx.shadowBlur = isSelected ? 16 : 8
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, planetRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      } else {
        ctx.fillStyle = 'rgba(100,116,139,0.3)'
        ctx.beginPath()
        ctx.arc(x, y, 2.3, 0, Math.PI * 2)
        ctx.fill()
      }

      if (slot.moon) {
        ctx.fillStyle = '#cbd5e1'
        ctx.beginPath()
        ctx.arc(x + 9, y - 8, 2.1, 0, Math.PI * 2)
        ctx.fill()
      }

      if (showLabel) {
        ctx.fillStyle = isSelected ? COLORS.selected : color
        ctx.font = isSelected ? '600 11px ui-sans-serif, system-ui, sans-serif' : '11px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'left'
        const text = slotLabel(slot)
        ctx.fillText(text.length > 16 ? `${text.slice(0, 15)}…` : text, x + 9, y + 3)
        if (slot.moon) {
          ctx.fillStyle = COLORS.labelMuted
          ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
          ctx.fillText(t('galaxyMap.moon'), x + 9, y + 14)
        }
      }

      if (isSelected) {
        ctx.strokeStyle = COLORS.selected
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(x, y, planetRadius + 5, 0, Math.PI * 2)
        ctx.stroke()
      }

      if (interactive) {
        hitTargets.push({ kind: 'slot', x, y, radius: Math.max(14, planetRadius + 10), slot })
      }
    })

    if (currentStar.value) {
      drawCompass(ctx, width - 36, height - 36, 13, -Math.PI / 2)
    }
  }

  const drawRegion = (state: MapState, interactive: boolean): void => {
    if (!ctx) return
    const { width, height } = canvasSize.value
    const region = layout.value.regions.find(item => item.region === regionOfGalaxy(state.galaxy))
    if (!region) return
    const current = region.systems.find(item => item.index === state.system) ?? region.systems[0]
    if (!current) return
    const cx = width / 2 + pan.x
    const cy = height / 2 + pan.y
    const size = Math.min(width, height)
    const scale = (size * 0.4 * zoom.value) / (LAYOUT_CONFIG.REGION_RADIUS * 1.12)
    const center = region.center
    const project = (point: { x: number; y: number }) => ({
      x: cx + (point.x - center.x) * scale,
      y: cy + (point.y - center.y) * scale * 0.58
    })

    // 星区边界
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(cx, cy, size * 0.47, size * 0.47 * 0.58, 0, 0, Math.PI * 2)
    ctx.stroke()

    const localSystems = new Set(region.systems.map(item => item.id))
    const localLanes = layout.value.lanes.filter(lane => localSystems.has(lane.a) && localSystems.has(lane.b))
    const localGates = layout.value.gates.filter(lane => localSystems.has(lane.a) || localSystems.has(lane.b))

    const drawLane = (lane: { a: string; b: string; kind?: string }) => {
      const a = layout.value.systemIndex.get(lane.a)
      const b = layout.value.systemIndex.get(lane.b)
      if (!a || !b) return
      const pa = project(a.coords)
      const pb = project(b.coords)
      if (Math.max(Math.abs(pa.x - cx), Math.abs(pa.y - cy)) > size * 1.2 && Math.max(Math.abs(pb.x - cx), Math.abs(pb.y - cy)) > size * 1.2) return
      ctx!.strokeStyle = lane.kind === 'gate' ? COLORS.gate : COLORS.lane
      ctx!.lineWidth = lane.kind === 'gate' ? 1.2 : 0.8
      ctx!.setLineDash(lane.kind === 'gate' ? [3, 5] : [])
      ctx!.beginPath()
      ctx!.moveTo(pa.x, pa.y)
      ctx!.lineTo(pb.x, pb.y)
      ctx!.stroke()
    }

    localLanes.forEach(drawLane)
    localGates.forEach(drawLane)
    ctx.setLineDash([])

    const homePosition = gameStore.player.planets.find(planet => !planet.isMoon)?.position
    const scannedCount = regionScannedCount(region)

    for (const system of region.systems) {
      const p = project(system.coords)
      const isCurrent = system.index === state.system
      const isSelected = system.id === props.selectedSystemId
      const discovered = !!discoveredOf(system.galaxy, system.index)
      const color = discovered || isCurrent ? ECONOMY_COLOR[system.economy] ?? COLORS.current : 'rgba(100,116,139,0.55)'
      const radius = isCurrent ? 5.5 : discovered ? 3.8 : 2.5
      if (p.x < -30 || p.y < -30 || p.x > width + 30 || p.y > height + 30) continue

      ctx.shadowColor = color
      ctx.shadowBlur = isCurrent || isSelected ? 14 : 4
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      if (homePosition && homePosition.galaxy === system.galaxy && homePosition.system === system.index) {
        ctx.strokeStyle = COLORS.own
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2)
        ctx.stroke()
      }
      if (isCurrent) {
        ctx.strokeStyle = COLORS.current
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius + 5, 0, Math.PI * 2)
        ctx.stroke()
      }
      if (isSelected) {
        ctx.strokeStyle = COLORS.selected
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius + 8, 0, Math.PI * 2)
        ctx.stroke()
      }

      if (isCurrent || isSelected || discovered) {
        ctx.fillStyle = isCurrent ? '#fef3c7' : discovered ? COLORS.label : COLORS.labelMuted
        ctx.font = isCurrent ? '600 11px ui-sans-serif, system-ui, sans-serif' : '10px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(systemName(system), p.x + 8, p.y + 3)
      }

      if (interactive) hitTargets.push({ kind: 'system', x: p.x, y: p.y, radius: 16, system })
    }

    drawCenteredLabel(`${regionName(region)} · ${t('galaxyMap.regionLabel')}`, cx, 24, 15, COLORS.label, '600')
    ctx.fillStyle = COLORS.labelMuted
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${scannedCount} / ${region.systems.length} ${t('galaxyMap.scannedSystems')}`, cx, 43)
    drawCompass(ctx, width - 36, height - 36, 13, -Math.PI / 2)
  }

  const drawGalaxy = (state: MapState, interactive: boolean): void => {
    if (!ctx) return
    const { width, height } = canvasSize.value
    const cx = width / 2 + pan.x
    const cy = height / 2 + pan.y
    const size = Math.min(width, height)
    const space = LAYOUT_CONFIG.SPACE
    const center = { x: space / 2, y: space / 2 }
    const scale = (size * 0.39 * zoom.value) / (space * 0.47)
    const project = (point: { x: number; y: number }) => ({
      x: cx + (point.x - center.x) * scale,
      y: cy + (point.y - center.y) * scale * 0.58
    })

    // 银河盘面
    const disk = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48)
    disk.addColorStop(0, 'rgba(251, 191, 36, 0.16)')
    disk.addColorStop(0.4, 'rgba(96, 165, 250, 0.08)')
    disk.addColorStop(1, 'rgba(15, 23, 42, 0)')
    ctx.fillStyle = disk
    ctx.beginPath()
    ctx.ellipse(cx, cy, size * 0.48, size * 0.48 * 0.58, 0, 0, Math.PI * 2)
    ctx.fill()

    // 星区之间的星门联系
    const seen = new Set<string>()
    for (const gate of layout.value.gates) {
      const a = layout.value.systemIndex.get(gate.a)
      const b = layout.value.systemIndex.get(gate.b)
      if (!a || !b) continue
      const key = [a.id, b.id].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      const pa = project(layout.value.regions[a.region - 1]?.center ?? a.coords)
      const pb = project(layout.value.regions[b.region - 1]?.center ?? b.coords)
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.18)'
      ctx.lineWidth = 0.9
      ctx.setLineDash([4, 8])
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    for (const region of layout.value.regions) {
      const p = project(region.center)
      const isCurrent = region.region === regionOfGalaxy(state.galaxy)
      const isSelected = region.region === props.selectedRegion
      const scanned = regionScannedCount(region)
      const color = isCurrent ? COLORS.current : scanned > 0 ? '#7dd3fc' : '#64748b'
      const radius = isCurrent ? 8 : 6
      ctx.shadowColor = color
      ctx.shadowBlur = isCurrent || isSelected ? 18 : 6
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      if (isCurrent) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)'
        ctx.lineWidth = 1.3
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius + 5, 0, Math.PI * 2)
        ctx.stroke()
      }
      if (isSelected) {
        ctx.strokeStyle = COLORS.selected
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius + 9, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.fillStyle = isCurrent ? '#fef3c7' : COLORS.labelMuted
      ctx.font = isCurrent ? '600 11px ui-sans-serif, system-ui, sans-serif' : '10px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(regionName(region), p.x + 12, p.y + 3)

      if (interactive) hitTargets.push({ kind: 'region', x: p.x, y: p.y, radius: 17, region })
    }

    drawCenteredLabel(t('galaxyMap.galaxyLabel'), cx, 24, 15, COLORS.label, '600')
    ctx.fillStyle = COLORS.labelMuted
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(t('galaxyMap.galaxyHint'), cx, 43)
    drawCompass(ctx, width - 36, height - 36, 13, -Math.PI / 2)
  }

  const drawCenteredLabel = (
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: string,
    weight = '400'
  ): void => {
    if (!ctx) return
    ctx.font = `${weight} ${fontSize}px ui-sans-serif, system-ui, sans-serif`
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0,0,0,0.75)'
    ctx.shadowBlur = 6
    ctx.fillText(text, x, y)
    ctx.shadowBlur = 0
  }

  const drawCompass = (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    angle: number
  ): void => {
    context.strokeStyle = 'rgba(226,232,240,0.28)'
    context.lineWidth = 1
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.stroke()
    context.strokeStyle = 'rgba(251,191,36,0.75)'
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + Math.cos(angle) * radius * 0.8, y + Math.sin(angle) * radius * 0.8)
    context.stroke()
    context.fillStyle = 'rgba(226,232,240,0.7)'
    context.font = '8px ui-sans-serif, system-ui, sans-serif'
    context.textAlign = 'center'
    context.fillText('N', x, y - radius - 3)
  }

  const hitAt = (x: number, y: number): HitTarget | null => {
    let best: HitTarget | null = null
    let bestDistance = Infinity
    for (const target of hitTargets) {
      const distance = Math.hypot(target.x - x, target.y - y)
      if (distance <= target.radius && distance < bestDistance) {
        best = target
        bestDistance = distance
      }
    }
    return best
  }

  const makeHover = (target: HitTarget, x: number, y: number): HoverInfo => {
    if (target.kind === 'slot') {
      const { slot } = target
      const scanned = slot.planet ? !!discoveredOf(slot.planet.position.galaxy, slot.planet.position.system) : false
      const owner = isOwnPlanet(slot.planet)
        ? t('galaxyView.mine')
        : scanned
          ? npcOfPlanet(slot.planet)?.name ?? (slot.planet?.ownerId ? slot.planet.ownerId : t('galaxyView.emptySlot'))
          : t('galaxyMap.unscanned')
      const lines = [`[${props.galaxy}:${props.system}:${slot.position}]`, owner]
      if (slot.planet && !scanned && !isOwnPlanet(slot.planet)) lines.push(t('galaxyMap.unscanned'))
      if (slot.moon) lines.push(t('galaxyMap.moon'))
      return {
        x: Math.min(x + 14, canvasSize.value.width - 240),
        y: Math.min(y + 14, canvasSize.value.height - 130),
        title: slotLabel(slot),
        subtitle: slot.planet ? t('galaxyMap.planet') : t('galaxyMap.emptyOrbit'),
        lines
      }
    }
    if (target.kind === 'system') {
      const discovered = discoveredOf(target.system.galaxy, target.system.index)
      const lines = [
        `[${target.system.galaxy}:${target.system.index}]`,
        `${t(`galaxy.economy.${target.system.economy}`)} · ${t('galaxyMap.danger')} ${target.system.danger}`,
        `${t('galaxyMap.wealth')} ${target.system.wealth}${target.system.hasStation ? ` · ${t('galaxyMap.station')}` : ''}`,
        discovered ? t('galaxyMap.scanned') : t('galaxyMap.unscanned')
      ]
      return {
        x: Math.min(x + 14, canvasSize.value.width - 240),
        y: Math.min(y + 14, canvasSize.value.height - 130),
        title: systemName(target.system),
        subtitle: `${regionLayout.value ? regionName(regionLayout.value) : ''} · ${t('galaxyMap.system')}`,
        lines
      }
    }
    const lines = [
      `${target.region.systems.length} ${t('galaxyMap.systems')}`,
      `${regionScannedCount(target.region)} ${t('galaxyMap.scannedSystems')}`,
      target.region.region === currentRegion.value ? t('galaxyMap.currentRegion') : t('galaxyMap.region')
    ]
    return {
      x: Math.min(x + 14, canvasSize.value.width - 240),
      y: Math.min(y + 14, canvasSize.value.height - 130),
      title: regionName(target.region),
      subtitle: t('galaxyMap.region'),
      lines
    }
  }

  const updateHover = (x: number, y: number): void => {
    const target = hitAt(x, y)
    hover.value = target ? makeHover(target, x, y) : null
  }

  const onPointerDown = (event: PointerEvent): void => {
    const canvas = canvasRef.value
    if (!canvas) return
    canvas.setPointerCapture(event.pointerId)
    const rect = canvas.getBoundingClientRect()
    pointerState.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top })
    dragOrigin = { x: event.clientX, y: event.clientY }
    moved = false
    if (pointerState.size === 2) {
      const points = [...pointerState.values()]
      pinchDistance = Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y)
    }
  }

  const onPointerMove = (event: PointerEvent): void => {
    const canvas = canvasRef.value
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const previous = pointerState.get(event.pointerId)
    pointerState.set(event.pointerId, point)

    if (pointerState.size === 2) {
      const points = [...pointerState.values()]
      const distance = Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y)
      if (pinchDistance > 0) {
        zoom.value = Math.max(0.7, Math.min(2.6, zoom.value * (distance / pinchDistance)))
        pinchDistance = distance
        requestDraw()
      }
      moved = true
      return
    }

    if (previous && dragOrigin) {
      const dx = point.x - previous.x
      const dy = point.y - previous.y
      if (Math.abs(event.clientX - dragOrigin.x) + Math.abs(event.clientY - dragOrigin.y) > 5) {
        moved = true
        pan = { x: pan.x + dx, y: pan.y + dy }
        hover.value = null
        requestDraw()
        return
      }
    }

    updateHover(point.x, point.y)
  }

  const onPointerUp = (event: PointerEvent): void => {
    const canvas = canvasRef.value
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const wasMoved = moved
    pointerState.delete(event.pointerId)
    if (pointerState.size === 0) {
      dragOrigin = null
      pinchDistance = 0
    }
    if (!wasMoved) {
      const target = hitAt(point.x, point.y)
      if (target?.kind === 'slot') emit('select-slot', target.slot)
      else if (target?.kind === 'system') emit('select-system', target.system)
      else if (target?.kind === 'region') emit('select-region', target.region)
    }
    moved = false
  }

  const onPointerLeave = (): void => {
    if (pointerState.size === 0) hover.value = null
  }

  const onWheel = (event: WheelEvent): void => {
    zoom.value = Math.max(0.7, Math.min(2.6, zoom.value * Math.exp(-event.deltaY * 0.0012)))
    requestDraw()
  }

  const zoomBy = (factor: number): void => {
    zoom.value = Math.max(0.7, Math.min(2.6, zoom.value * factor))
    requestDraw()
  }

  const resetView = (): void => {
    zoom.value = 1
    pan = { x: 0, y: 0 }
    requestDraw()
  }

  defineExpose({ zoomIn: () => zoomBy(1.2), zoomOut: () => zoomBy(1 / 1.2), resetView })

  watch(
    () => props.view,
    view => {
      const from = { ...lastRendered }
      pan = { x: 0, y: 0 }
      zoom.value = 1
      transition = {
        from,
        to: { view, galaxy: props.galaxy, system: props.system },
        startedAt: performance.now()
      }
      requestDraw()
    }
  )

  watch(
    () => [props.galaxy, props.system, props.slots, props.selectedPlanetId],
    () => {
      if (!transition) requestDraw()
    },
    { deep: true }
  )

  onMounted(() => {
    resizeObserver = new ResizeObserver(resize)
    if (wrapRef.value) resizeObserver.observe(wrapRef.value)
    resize()
  })

  onBeforeUnmount(() => {
    if (raf) window.cancelAnimationFrame(raf)
    resizeObserver?.disconnect()
  })
</script>
