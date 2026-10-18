<template>
  <div class="relative h-[calc(100vh-3rem)] w-full overflow-hidden rounded-xl border border-border bg-background">
    <canvas
      ref="canvasRef"
      class="absolute inset-0 h-full w-full touch-none"
      :class="dragging ? 'cursor-grabbing' : 'cursor-crosshair'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel.prevent="onWheel"
    />

    <!-- 渐变遮罩：模拟"视野有限"的沉浸感 -->
    <div class="pointer-events-none absolute inset-0" :style="vignetteStyle" />

    <!-- 顶部 -->
    <div class="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4">
      <div>
        <h1 class="text-lg font-semibold text-foreground">银河 · 飞行视图（预览）</h1>
        <p class="mt-0.5 text-xs text-muted-foreground">
          拖拽环顾 · W/S 前进后退 · A/D 平移 · Q/E 升降 · Shift 加速 · 滚轮调速
        </p>
      </div>
      <div class="pointer-events-auto flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" class="border-border bg-background/70 text-foreground" @click="preset('home')">
          母星
        </Button>
        <Button variant="outline" size="sm" class="border-border bg-background/70 text-foreground" @click="preset('panorama')">
          银河全景
        </Button>
        <Button variant="outline" size="sm" class="border-border bg-background/70 text-foreground" @click="preset('cruise')">
          旋臂巡航
        </Button>
        <Button variant="outline" size="sm" class="border-border bg-background/70 text-foreground" @click="preset('core')">
          银心
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="border-border bg-background/70 text-foreground"
          @click="showLanes = !showLanes"
        >
          {{ showLanes ? '隐藏航线' : '显示航线' }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="border-border bg-background/70 text-foreground"
          @click="showFleetRoutes = !showFleetRoutes"
        >
          {{ showFleetRoutes ? '隐藏舰队' : '显示舰队' }}
        </Button>
        <Button variant="outline" size="sm" class="border-border bg-background/70 text-foreground" @click="router.push('/galaxy')">
          返回星系
        </Button>
      </div>
    </div>

    <!-- 选中恒星系详情 -->
    <div
      v-if="selectedSystem"
      class="pointer-events-auto absolute right-4 top-24 w-72 rounded-xl border border-border bg-card/95 p-4 text-sm text-foreground shadow-xl backdrop-blur"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="truncate text-base font-semibold">{{ selectedName }}</div>
          <div class="text-xs text-muted-foreground">{{ selectedSystem.id }}</div>
        </div>
        <Button variant="ghost" size="icon" class="h-7 w-7 shrink-0 text-muted-foreground" @click="selectSystem(null)">✕</Button>
      </div>

      <div class="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary" class="text-[11px]">{{ t(`galaxy.economy.${selectedSystem.economy}`) }}</Badge>
        <Badge variant="outline" class="text-[11px]">危险 {{ selectedSystem.danger }}</Badge>
        <Badge variant="outline" class="text-[11px]">繁荣 {{ selectedSystem.wealth }}</Badge>
        <Badge v-if="selectedSystem.hasStation" variant="secondary" class="text-[11px]">空间站</Badge>
      </div>

      <div class="mt-3 space-y-1 text-xs text-muted-foreground">
        <div v-if="selectedGate">星门：{{ selectedGateLabel }} · 过路费 {{ selectedGate.toll }} 重氢</div>
        <div v-if="selectedSignal && selectedRecord && !selectedRecord.signalClaimed" class="flex items-center justify-between gap-2">
          <span>未知信号：{{ SIGNAL_LABEL[selectedSignal.kind] }}</span>
          <Button
            size="sm"
            variant="outline"
            class="h-6 px-2 text-[11px]"
            @click="selectedSignal.kind === 'wormhole' ? warpSignal() : collectSignal()"
          >
            {{ selectedSignal.kind === 'wormhole' ? '穿越' : '领取' }}
          </Button>
        </div>
        <div v-else-if="selectedSignal && selectedRecord?.signalClaimed" class="text-slate-500">信号已回收</div>
        <div>距离 {{ selectedDistance }} u</div>
        <div v-if="selectedRecord">已发现 · 扫描 {{ selectedRecord.scans }} 次</div>
        <div v-else>未扫描 · 需要探测卫星</div>
      </div>

      <div class="mt-3 flex gap-2">
        <Button size="sm" class="flex-1" @click="scanSelected">扫描</Button>
      </div>

      <div class="mt-2 flex gap-2">
        <Input v-model="renameDraft" :maxlength="24" placeholder="命名该恒星系" class="h-8" />
        <Button size="sm" variant="outline" @click="renameSelected">命名</Button>
      </div>

      <div class="mt-3 border-t border-border pt-3">
        <div class="mb-1 text-xs text-muted-foreground">行星轨道</div>
        <div class="max-h-40 space-y-1 overflow-y-auto pr-1">
          <div
            v-for="orbit in selectedOrbits"
            :key="orbit.orbit"
            class="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs"
            :class="
              orbit.owner === 'self'
                ? 'bg-primary/10 text-foreground'
                : orbit.owner === 'empty'
                  ? 'text-muted-foreground'
                  : 'bg-muted text-foreground'
            "
          >
            <span class="shrink-0">轨道 {{ orbit.orbit }}</span>
            <span class="truncate">{{ orbit.label }}</span>
            <span class="shrink-0 text-[10px] text-muted-foreground">{{ orbit.biome }}</span>
          </div>
        </div>
        <Button size="sm" variant="outline" class="mt-2 w-full" @click="openInGalaxyView">在星系页操作</Button>
      </div>
    </div>

    <!-- 底部 HUD -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-4 text-xs text-muted-foreground">
      <div class="space-y-0.5">
        <div class="text-foreground">速度 {{ Math.round(speed) }} u/s · 视距 {{ Math.round(viewRadius) }} u</div>
        <div>距银心 {{ Math.round(distanceToCore) }} u · 可见恒星系 {{ visibleCount }} / {{ systems.length }}</div>
      </div>
      <div class="text-right">
        <div>{{ fps }} fps</div>
        <div class="text-muted-foreground">坐标系：银河盘面 · 深度仅视觉</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useGameStore } from '@/stores/gameStore'
  import { useUniverseStore } from '@/stores/universeStore'
  import { useNPCStore } from '@/stores/npcStore'
  import { useNetStore } from '@/stores/netStore'
  import { regionOfGalaxy } from '@/config/galaxyConfig'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { Badge } from '@/components/ui/badge'
  import { toast } from 'vue-sonner'
  import { dispatchCommand } from '@/core/runtime'
  import { useI18n } from '@/composables/useI18n'
  import { DEFAULT_LAYOUT_SEED, LAYOUT_CONFIG } from '@/config/galaxyConfig'
  import { buildCycleLayout, getPlanetProfile } from '@/logic/galaxyGen'
  import { hashString, mulberry32 } from '@/utils/random'
  import { buildGateInfos, gatewaySystemOf } from '@/logic/gateLogic'
  import { signalOf } from '@/logic/signalLogic'
  import { buildBackdropStars, diskDepth, fogAlpha, movedCamera, projectInView, spiralWarp } from '@/logic/galaxyFlight'
  import type { FlightCamera, Vec3 } from '@/logic/galaxyFlight'
  import type { EconomyType } from '@/types/galaxy'

  const router = useRouter()
  const gameStore = useGameStore()
  const universeStore = useUniverseStore()
  const npcStore = useNPCStore()
  const netStore = useNetStore()
  const { t } = useI18n()

  const SPACE = LAYOUT_CONFIG.SPACE
  const CENTER = SPACE / 2
  /** 旋臂扭曲强度（弧度）：越大旋臂越明显 */
  const TWIST = 6.5
  const TAN_HALF_FOV = 0.7

  /** 夜间：亮色星体；白天：深色星体（保证白底对比度） */
  const ECONOMY_COLOR_DARK: Record<EconomyType, string> = {
    mining: '#f59e0b',
    industrial: '#94a3b8',
    tech: '#38bdf8',
    trade: '#34d399',
    agriculture: '#84cc16',
    military: '#f43f5e'
  }

  const ECONOMY_COLOR_LIGHT: Record<EconomyType, string> = {
    mining: '#b45309',
    industrial: '#475569',
    tech: '#0369a1',
    trade: '#047857',
    agriculture: '#4d7c0f',
    military: '#be123c'
  }

  /** 当前主题（跟随 html.dark） */
  const isDark = ref(true)
  /** 直接从 CSS 变量读主题色，主题被自定义时星图也能跟上 */
  const cssVars = ref({ background: '', foreground: '', muted: '', border: '', primary: '' })

  const readTheme = () => {
    isDark.value = document.documentElement.classList.contains('dark')
    const style = getComputedStyle(document.documentElement)
    const read = (name: string) => style.getPropertyValue(name).trim()
    cssVars.value = {
      background: read('--background'),
      foreground: read('--foreground'),
      muted: read('--muted-foreground'),
      border: read('--border'),
      primary: read('--primary')
    }
  }

  /** 主题色板：基础色直接读 CSS 变量，星体色按明暗切换 */
  const palette = computed(() => {
    const dark = isDark.value
    return {
      background: cssVars.value.background || (dark ? 'oklch(0.1 0.015 264.695)' : 'oklch(0.95 0.008 85)'),
      foreground: cssVars.value.foreground || (dark ? 'oklch(0.984 0.003 247.858)' : 'oklch(0.3 0.02 85)'),
      muted: cssVars.value.muted || (dark ? 'oklch(0.604 0.04 256.788)' : 'oklch(0.5 0.02 85)'),
      border: cssVars.value.border || (dark ? 'oklch(0.25 0.025 260.031)' : 'oklch(0.86 0.012 85)'),
      primary: cssVars.value.primary || (dark ? 'oklch(0.729 0.113 255.508)' : 'oklch(0.35 0.03 240)'),
      lane: dark ? '#7dd3fc' : '#0369a1',
      gate: dark ? '#a78bfa' : '#6d28d9',
      dust: dark ? '#93c5fd' : '#64748b',
      armStar: dark ? '#cfe3ff' : '#334155',
      backdrop: dark ? '#cbd5e1' : '#94a3b8',
      selection: dark ? '#fbbf24' : '#b45309',
      core: dark
        ? ['rgba(255, 255, 250, 1)', 'rgba(255, 244, 214, 0.95)', 'rgba(255, 214, 150, 0.55)', 'rgba(255, 170, 90, 0.18)']
        : ['rgba(120, 53, 15, 0.95)', 'rgba(180, 83, 9, 0.75)', 'rgba(217, 119, 6, 0.4)', 'rgba(245, 158, 11, 0.12)'],
      economy: dark ? ECONOMY_COLOR_DARK : ECONOMY_COLOR_LIGHT
    }
  })

  const layout = buildCycleLayout(DEFAULT_LAYOUT_SEED, gameStore.player.cycle ?? 1)

  /** 视觉位置：旋臂扭曲 + 盘面厚度（玩法坐标不受影响） */
  const systems = layout.regions
    .flatMap(region => region.systems)
    .map(system => {
      const warped = spiralWarp(system.coords.x, system.coords.y, SPACE, TWIST)
      const radius = Math.hypot(warped.x - CENTER, warped.y - CENTER)
      return {
        id: system.id,
        economy: system.economy,
        x: warped.x,
        y: warped.y,
        z: diskDepth(layout.seed, system.id, radius),
        radius
      }
    })

  /** 沿旋臂铺的装饰星：让星团连成连续的旋臂（纯视觉，不参与玩法） */
  const armStars = systems.flatMap(system =>
    Array.from({ length: 3 }, (_, k) => {
      const rand = mulberry32(hashString(`${layout.seed}:${system.id}:${k}`))
      return {
        x: system.x + (rand() - 0.5) * 2200,
        y: system.y + (rand() - 0.5) * 2200,
        z: system.z + (rand() - 0.5) * 700
      }
    })
  )

  /** 盘面尘埃（只做视觉纹理） */
  const dust: Vec3[] = Array.from({ length: 900 }, (_, i) => {
    const angle = (i * 2.399963229728653) % (Math.PI * 2)
    const radius = 1200 + ((i * 7919) % 26000)
    return {
      x: CENTER + Math.cos(angle) * radius,
      y: CENTER + Math.sin(angle) * radius,
      z: (((i * 104729) % 200) - 100) * 4
    }
  })

  const backdrop = buildBackdropStars(700, 52000, 20261018)

  /** 视觉坐标查表：航线两端都用同一套扭曲后的坐标 */
  /** 星门归属表（确定性） */
  const gateInfos = buildGateInfos(layout)
  const GATE_OWNER_COLOR: Record<string, string> = {
    neutral: '#a78bfa',
    miners_guild: '#f59e0b',
    deep_council: '#a78bfa',
    free_fleet: '#38bdf8',
    swarm: '#f43f5e'
  }

  const allSystemIds = layout.regions.flatMap(region => region.systems.map(system => system.id))
  const SIGNAL_LABEL: Record<string, string> = { derelict: '残骸', ruin: '遗迹', wormhole: '虫洞' }

  const selectedSignal = computed(() =>
    selectedId.value ? signalOf(layout.seed, selectedId.value, allSystemIds) : null
  )

  const warpSignal = () => {
    if (!selectedId.value) return
    const result = dispatchCommand({ type: 'signal.warp', systemId: selectedId.value })
    if (!result.ok) {
      toast.error(result.reason ? t(result.reason) : '无法穿越')
      return
    }
    toast.success('虫洞穿越成功，目标星系已标记')
  }

  const collectSignal = () => {
    if (!selectedId.value) return
    const result = dispatchCommand({ type: 'signal.collect', systemId: selectedId.value })
    if (!result.ok) {
      toast.error(result.reason ? t(result.reason) : '无法领取')
      return
    }
    toast.success('信号已回收')
  }

  const selectedGate = computed(() => (selectedId.value ? gateInfos[selectedId.value] : undefined))
  const selectedGateLabel = computed(() => {
    const gate = selectedGate.value
    if (!gate) return ''
    return gate.owner === 'neutral' ? '中立' : t(`faction.${gate.owner}`)
  })

  /** 玩家母星在视觉空间中的位置（找不到就回退到巡航视角） */
  const homeVisual = computed(() => {
    const planet = gameStore.player.planets.find(item => !item.isMoon)
    if (!planet) return undefined
    const cycle = gameStore.player.cycle ?? 1
    const id = `${cycle}:${regionOfGalaxy(planet.position.galaxy)}:${planet.position.system}`
    return visualById.get(id)
  })


  const visualById = new Map(systems.map(system => [system.id, system]))

  interface VisualLane {
    a: { x: number; y: number; z: number }
    b: { x: number; y: number; z: number }
    aId: string
    bId: string
    gate: boolean
  }

  const toVisualLanes = (lanes: Array<{ a: string; b: string }>, gate: boolean): VisualLane[] =>
    lanes.flatMap(lane => {
      const a = visualById.get(lane.a)
      const b = visualById.get(lane.b)
      return a && b ? [{ a: { x: a.x, y: a.y, z: a.z }, b: { x: b.x, y: b.y, z: b.z }, aId: lane.a, bId: lane.b, gate }] : []
    })

  const visualLanes: VisualLane[] = [...toVisualLanes(layout.lanes, false), ...toVisualLanes(layout.gates, true)]

  /** NPC 商队（来自快照，按时间插值移动） */
  const caravanDots = computed(() =>
    (gameStore.caravans ?? [])
      .map(caravan => {
        const from = visualById.get(caravan.fromSystemId)
        const to = visualById.get(caravan.toSystemId)
        if (!from || !to) return null
        const span = Math.max(1, caravan.arriveAt - caravan.departAt)
        const t = Math.max(0, Math.min(1, (Date.now() - caravan.departAt) / span))
        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t }
      })
      .filter((dot): dot is NonNullable<typeof dot> => Boolean(dot))
  )

  /** 自己舰队的剩余航线（多段任务） */
  const fleetRoutes = computed(() =>
    gameStore.player.fleetMissions
      .filter(mission => mission.status === 'outbound' && mission.route && mission.route.length > 1)
      .map(mission => ({
        id: mission.id,
        points: (mission.route ?? [])
          .slice(mission.routeIndex ?? 0)
          .map(leg => visualById.get(leg.systemId))
          .filter((point): point is NonNullable<typeof point> => Boolean(point))
      }))
      .filter(route => route.points.length > 1)
  )

  // ---------------------------------------------------------------- 相机
  const camera = ref<FlightCamera>({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 })
  const speed = ref(900)
  const viewRadius = ref(30000)
  const fps = ref(60)
  const visibleCount = ref(0)
  const distanceToCore = ref(0)
  const dragging = ref(false)
  const showLanes = ref(true)
  const showFleetRoutes = ref(true)
  const selectedId = ref<string | null>(null)
  const renameDraft = ref('')
  /** 每帧投影结果，用于点击拾取 */
  let pickTargets: Array<{ id: string; x: number; y: number; radius: number }> = []

  const selectedSystem = computed(() => (selectedId.value ? layout.systemIndex.get(selectedId.value) : undefined))
  const selectedRecord = computed(() =>
    selectedId.value ? gameStore.player.discoveredSystems?.[selectedId.value] : undefined
  )
  const selectedName = computed(() => selectedRecord.value?.name ?? selectedSystem.value?.name ?? '')
  const selectedDistance = computed(() => {
    const system = systems.find(item => item.id === selectedId.value)
    if (!system) return 0
    return Math.round(Math.hypot(system.x - camera.value.x, system.y - camera.value.y, system.z - camera.value.z))
  })

  const selectSystem = (id: string | null) => {
    selectedId.value = id
    renameDraft.value = ''
  }

  /** 选中恒星系的 10 条轨道：归属 / 名称 / 地貌 */
  const selectedOrbits = computed(() => {
    const system = selectedSystem.value
    if (!system) return []
    const cycle = gameStore.player.cycle ?? 1
    const region = regionOfGalaxy(system.galaxy)
    const seed = layout.seed

    return Array.from({ length: 10 }, (_, index) => {
      const orbit = index + 1
      const own = gameStore.player.planets.find(
        planet =>
          planet.position.galaxy === system.galaxy &&
          planet.position.system === system.index &&
          planet.position.position === orbit
      )
      const key = `${system.galaxy}:${system.index}:${orbit}`
      const planet = own ?? (universeStore.planets[key] as typeof own | undefined)
      const profile = getPlanetProfile(seed, cycle, region, system.index, orbit)

      let owner: 'self' | 'npc' | 'player' | 'empty' = 'empty'
      let label = '空闲轨道'
      if (planet && planet.ownerId) {
        const ownerId = planet.ownerId
        if (ownerId === gameStore.player.id) {
          owner = 'self'
          label = planet.name
        } else if (ownerId.startsWith('npc_')) {
          owner = 'npc'
          label = npcStore.npcs.find(npc => npc.id === ownerId)?.name ?? planet.name
        } else {
          owner = 'player'
          label = netStore.players.find(player => player.id === ownerId)?.name ?? planet.name
        }
      }

      return { orbit, owner, label, biome: t(`galaxy.biome.${profile.biome}`) }
    })
  })

  const openInGalaxyView = () => {
    const system = selectedSystem.value
    if (!system) return
    router.push({ path: '/galaxy', query: { galaxy: String(system.galaxy), system: String(system.index) } })
  }

  const homePlanet = computed(() => gameStore.player.planets.find(planet => !planet.isMoon))

  const scanInFlight = ref(false)

  const scanSelected = () => {
    if (scanInFlight.value) return
    scanInFlight.value = true
    window.setTimeout(() => (scanInFlight.value = false), 800)

    const planet = homePlanet.value
    const system = selectedSystem.value
    if (!planet || !system) return
    const result = dispatchCommand({ type: 'galaxy.scan', planetId: planet.id, targetSystemId: system.id })
    if (!result.ok) {
      toast.error(result.reason ? t(result.reason) : t('errors.unknown'))
    } else if (!netStore.isOnline) {
      // 联机模式下服务端可能拒绝，成功提示会与 reject 提示冲突，交给补丁反馈
      toast.success(`已扫描 ${system.name}`)
    }
  }

  const renameSelected = () => {
    const system = selectedSystem.value
    if (!system) return
    const name = renameDraft.value.trim()
    if (name.length < 2) {
      toast.error(t('errors.renameTooShort'))
      return
    }
    const result = dispatchCommand({ type: 'galaxy.rename', systemId: system.id, name })
    if (!result.ok) {
      toast.error(result.reason ? t(result.reason) : t('errors.unknown'))
    } else {
      toast.success(`已命名为 ${name}`)
      renameDraft.value = ''
    }
  }

  const vignetteStyle = computed(() => ({
    background: `radial-gradient(circle at 50% 50%, transparent 45%, ${palette.value.background} 100%)`
  }))

  const preset = (kind: 'home' | 'panorama' | 'cruise' | 'core'): boolean => {
    if (kind === 'home') {
      const home = homeVisual.value
      if (!home) return false
      // 俯视母星：水平只偏一点，高度拉高，避免"贴地平视"的仰望感
      const offset = 0.9
      const distance = 3600
      camera.value = {
        x: home.x + Math.cos(offset) * distance,
        y: home.y + Math.sin(offset) * distance,
        z: home.z + 8200,
        yaw: offset + Math.PI,
        pitch: -1.05
      }
      viewRadius.value = 32000
      speed.value = 1200
      return true
    }

    if (kind === 'panorama') {
      // 银心正上方俯视：yaw 不影响，pitch 接近 -90^
      camera.value = { x: CENTER, y: CENTER, z: 76000, yaw: 0, pitch: -1.45 }
      // 全景要把整个银河装进来：视距必须大于相机到最远恒星的距离
      viewRadius.value = 220000
      speed.value = 2600
    } else if (kind === 'cruise') {
      const angle = 0.7
      camera.value = {
        x: CENTER + Math.cos(angle) * 13000,
        y: CENTER + Math.sin(angle) * 13000,
        z: 9200,
        yaw: angle + Math.PI,
        pitch: -0.66
      }
      viewRadius.value = 32000
      speed.value = 1400
    } else {
      camera.value = { x: CENTER + 4200, y: CENTER - 1800, z: 2600, yaw: Math.PI * 0.35, pitch: -0.3 }
      viewRadius.value = 24000
      speed.value = 700
    }
    return true
  }

  // ---------------------------------------------------------------- 画布
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let rafId = 0
  let observer: ResizeObserver | null = null
  let themeObserver: MutationObserver | null = null
  let lastFrameAt = 0
  let frameCount = 0
  let fpsWindowStart = 0

  const keys = new Set<string>()

  const resize = () => {
    const canvas = canvasRef.value
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    width = Math.max(1, Math.floor(rect.width))
    height = Math.max(1, Math.floor(rect.height))
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx = canvas.getContext('2d')
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const render = (dt: number) => {
    if (!ctx) return
    const cam = camera.value

    // 键盘移动
    const boost = keys.has('shift') ? 4 : 1
    const step = speed.value * boost * dt
    let forwardAmount = 0
    let strafeAmount = 0
    let verticalAmount = 0
    if (keys.has('w') || keys.has('arrowup')) forwardAmount += step
    if (keys.has('s') || keys.has('arrowdown')) forwardAmount -= step
    if (keys.has('d') || keys.has('arrowright')) strafeAmount += step
    if (keys.has('a') || keys.has('arrowleft')) strafeAmount -= step
    if (keys.has('e')) verticalAmount += step
    if (keys.has('q')) verticalAmount -= step
    if (forwardAmount || strafeAmount || verticalAmount) {
      const moved = movedCamera(cam, forwardAmount, strafeAmount, verticalAmount)
      // 限制活动范围，避免飞丢
      const dx = moved.x - CENTER
      const dy = moved.y - CENTER
      // 边界要覆盖全景起点（r≈0, z=76000），否则一移动就会被瞬移拉回
      const r = Math.hypot(dx, dy)
      if (r > 90000) {
        moved.x = CENTER + (dx / r) * 90000
        moved.y = CENTER + (dy / r) * 90000
      }
      moved.z = Math.max(-60000, Math.min(90000, moved.z))
      camera.value = moved
    }

    const view = { width, height }

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = palette.value.background
    ctx.fillRect(0, 0, width, height)

    // 背景星（世界坐标，飞行有视差）
    ctx.fillStyle = palette.value.backdrop
    for (const star of backdrop) {
      const point = projectInView({ x: star.x + CENTER, y: star.y + CENTER, z: star.z }, camera.value, view, TAN_HALF_FOV)
      if (!point) continue
      const size = Math.min(2, Math.max(0.6, star.size * 0.8))
      ctx.globalAlpha = Math.min(0.9, 0.2 + 30000 / Math.max(20000, point.distance))
      ctx.fillRect(point.x, point.y, size, size)
    }
    ctx.globalAlpha = 1

    // 银心光晕
    const corePoint = projectInView({ x: CENTER, y: CENTER, z: 0 }, camera.value, view, TAN_HALF_FOV)
    distanceToCore.value = Math.hypot(camera.value.x - CENTER, camera.value.y - CENTER, camera.value.z)
    if (corePoint) {
      const glowRadius = Math.min(430, Math.max(24, 95000 / Math.max(400, corePoint.depth)))
      const gradient = ctx.createRadialGradient(corePoint.x, corePoint.y, 0, corePoint.x, corePoint.y, glowRadius)
      const coreStops = palette.value.core
      gradient.addColorStop(0, coreStops[0]!)
      gradient.addColorStop(0.12, coreStops[1]!)
      gradient.addColorStop(0.35, coreStops[2]!)
      gradient.addColorStop(0.7, coreStops[3]!)
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(corePoint.x, corePoint.y, glowRadius, 0, Math.PI * 2)
      ctx.fill()
    }

    // 盘面尘埃
    ctx.fillStyle = palette.value.dust
    for (const mote of dust) {
      const point = projectInView(mote, camera.value, view, TAN_HALF_FOV)
      if (!point || point.distance > viewRadius.value * 1.2) continue
      const alpha = fogAlpha(point.distance, viewRadius.value * 1.2) * 0.18
      if (alpha <= 0.01) continue
      ctx.globalAlpha = alpha
      ctx.fillRect(point.x, point.y, 1, 1)
    }
    ctx.globalAlpha = 1

    // 航线：近处更清晰，星门用紫色加粗
    if (showLanes.value) {
      for (const lane of visualLanes) {
        const pa = projectInView(lane.a, camera.value, view, TAN_HALF_FOV)
        if (!pa) continue
        const pb = projectInView(lane.b, camera.value, view, TAN_HALF_FOV)
        if (!pb) continue

        const nearA = pa.distance <= viewRadius.value
        const nearB = pb.distance <= viewRadius.value
        if (!nearA && !nearB) continue

        // 只要有一端在视距内就画，并把另一端裁剪到视距边界（避免出现横贯屏幕的长线）
        let ax = pa.x
        let ay = pa.y
        let bx = pb.x
        let by = pb.y
        if (nearA !== nearB) {
          const near = nearA ? pa : pb
          const far = nearA ? pb : pa
          const t = (viewRadius.value - near.distance) / (far.distance - near.distance)
          const cutX = near.x + (far.x - near.x) * t
          const cutY = near.y + (far.y - near.y) * t
          if (nearA) {
            bx = cutX
            by = cutY
          } else {
            ax = cutX
            ay = cutY
          }
        }

        const alpha = fogAlpha(Math.min(pa.distance, pb.distance), viewRadius.value) * (lane.gate ? 0.5 : 0.22)
        if (alpha < 0.02) continue

        ctx.globalAlpha = alpha
        const gateOwner = lane.gate ? gateInfos[gatewaySystemOf({ a: lane.aId, b: lane.bId })]?.owner : undefined
        ctx.strokeStyle = lane.gate
          ? GATE_OWNER_COLOR[gateOwner ?? 'neutral'] ?? palette.value.gate
          : palette.value.lane
        ctx.lineWidth = lane.gate ? 1.5 : 0.9
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // NPC 商队：金色光点
    ctx.fillStyle = '#fcd34d'
    for (const dot of caravanDots.value) {
      const projected = projectInView(dot, camera.value, view, TAN_HALF_FOV)
      if (!projected || projected.distance > viewRadius.value) continue
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.arc(projected.x, projected.y, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // 舰队航线：金色折线，标出剩余路径
    if (showFleetRoutes.value && fleetRoutes.value.length > 0) {
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 1.8
      for (const route of fleetRoutes.value) {
        for (let i = 1; i < route.points.length; i += 1) {
          const pa = projectInView(route.points[i - 1]!, camera.value, view, TAN_HALF_FOV)
          const pb = projectInView(route.points[i]!, camera.value, view, TAN_HALF_FOV)
          if (!pa || !pb) continue
          const alpha = Math.max(0.15, fogAlpha(Math.min(pa.distance, pb.distance), viewRadius.value)) * 0.85
          ctx.globalAlpha = alpha
          ctx.beginPath()
          ctx.moveTo(pa.x, pa.y)
          ctx.lineTo(pb.x, pb.y)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }

    // 旋臂装饰星（填充盘面）
    ctx.fillStyle = palette.value.armStar
    for (const star of armStars) {
      const point = projectInView(star, camera.value, view, TAN_HALF_FOV)
      if (!point || point.distance > viewRadius.value) continue
      const alpha = fogAlpha(point.distance, viewRadius.value) * 0.5
      if (alpha <= 0.02) continue
      ctx.globalAlpha = alpha
      const size = point.depth < 8000 ? 2.4 : 1.6
      ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size)
    }
    ctx.globalAlpha = 1

    // 恒星系：远→近
    pickTargets = []
    const projected: Array<{ id: string; x: number; y: number; depth: number; distance: number; color: string }> = []
    for (const system of systems) {
      const point = projectInView(system, camera.value, view, TAN_HALF_FOV)
      if (!point || point.distance > viewRadius.value) continue
      projected.push({ ...point, color: palette.value.economy[system.economy], id: system.id })
    }
    projected.sort((a, b) => b.depth - a.depth)
    visibleCount.value = projected.length

    for (const item of projected) {
      const alpha = Math.max(0.45, fogAlpha(item.distance, viewRadius.value))
      // 恒星需要"像个天体"：近处 14px、远处保底 4px（之前最远只有 2px，看起来就是像素点）
      const radius = Math.max(4, Math.min(14, 16000 / item.depth))

      // 外层光晕
      ctx.globalAlpha = alpha * 0.2
      ctx.fillStyle = item.color
      ctx.beginPath()
      ctx.arc(item.x, item.y, radius * 3, 0, Math.PI * 2)
      ctx.fill()

      // 星体
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(item.x, item.y, radius, 0, Math.PI * 2)
      ctx.fill()

      pickTargets.push({ id: item.id, x: item.x, y: item.y, radius })

      // 星核（白色高光，让它像"恒星"而不是色点）
      ctx.globalAlpha = alpha * 0.8
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(item.x, item.y, radius * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // 母星标记：脉冲双环 + 文字，方便定位
    const homeMarker = homeVisual.value
    if (homeMarker) {
      const homePoint = projectInView(homeMarker, camera.value, view, TAN_HALF_FOV)
      if (homePoint && homePoint.distance <= viewRadius.value) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400)
        ctx.strokeStyle = '#34d399'
        ctx.lineWidth = 1.6
        ctx.globalAlpha = 0.85
        ctx.beginPath()
        ctx.arc(homePoint.x, homePoint.y, 10 + pulse * 3, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 0.45
        ctx.beginPath()
        ctx.arc(homePoint.x, homePoint.y, 15 + pulse * 4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 0.95
        ctx.fillStyle = '#34d399'
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('母星', homePoint.x, homePoint.y - 18)
        ctx.textAlign = 'start'
        ctx.globalAlpha = 1
      }
    }

    // 选中环
    if (selectedId.value) {
      const hit = pickTargets.find(item => item.id === selectedId.value)
      if (hit) {
        ctx.strokeStyle = palette.value.selection
        ctx.lineWidth = 1.5
        ctx.globalAlpha = 0.9
        ctx.beginPath()
        ctx.arc(hit.x, hit.y, hit.radius + 6, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
  }

  const loop = (now: number) => {
    rafId = requestAnimationFrame(loop)
    if (document.hidden) return
    const dt = lastFrameAt ? Math.min(0.05, (now - lastFrameAt) / 1000) : 0.016
    lastFrameAt = now
    render(dt)

    frameCount += 1
    if (!fpsWindowStart) fpsWindowStart = now
    if (now - fpsWindowStart >= 500) {
      fps.value = Math.round((frameCount * 1000) / (now - fpsWindowStart))
      frameCount = 0
      fpsWindowStart = now
    }
  }

  // ---------------------------------------------------------------- 交互
  let lastX = 0
  let lastY = 0

  let downX = 0
  let downY = 0

  const onPointerDown = (event: PointerEvent) => {
    dragging.value = true
    downX = event.clientX
    downY = event.clientY
    lastX = event.clientX
    lastY = event.clientY
    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging.value) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    camera.value.yaw -= dx * 0.004
    camera.value.pitch = Math.max(-1.52, Math.min(1.52, camera.value.pitch - dy * 0.004))
  }

  const onPointerUp = (event: PointerEvent) => {
    dragging.value = false
    // 位移很小才算点击，避免拖动旋转时误选
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 4) return

    const rect = (event.target as HTMLElement).getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    let best: { id: string; distance: number } | null = null
    for (const target of pickTargets) {
      const distance = Math.hypot(target.x - x, target.y - y)
      if (distance <= Math.max(14, target.radius + 8) && (!best || distance < best.distance)) {
        best = { id: target.id, distance }
      }
    }
    selectSystem(best ? best.id : null)
  }

  const onWheel = (event: WheelEvent) => {
    speed.value = Math.max(150, Math.min(6000, speed.value * (1 + event.deltaY * 0.0012)))
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'q', 'e', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      keys.add(key)
      event.preventDefault()
    }
  }

  const onKeyUp = (event: KeyboardEvent) => {
    keys.delete(event.key.toLowerCase())
  }

  onMounted(() => {
    if (!preset('home')) preset('cruise')
    resize()
    observer = new ResizeObserver(resize)
    if (canvasRef.value) observer.observe(canvasRef.value)
    readTheme()
    themeObserver = new MutationObserver(() => {
      readTheme()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    fpsWindowStart = performance.now()
    rafId = requestAnimationFrame(loop)
  })

  onBeforeUnmount(() => {
    if (rafId) cancelAnimationFrame(rafId)
    observer?.disconnect()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    themeObserver?.disconnect()
  })
</script>
