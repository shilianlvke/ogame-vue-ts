<template>
  <div :class="props.embedded ? '' : 'container mx-auto p-4 sm:p-6'">
    <!-- 状态条 -->
    <div class="mb-4 grid gap-3 sm:mb-6 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="pb-2">
          <CardDescription class="flex items-center gap-1.5 text-xs">
            <Zap class="h-3.5 w-3.5" /> 电力满足率
          </CardDescription>
          <CardTitle class="text-lg tabular-nums">{{ (ratio * 100).toFixed(0) }}%</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress :model-value="ratio * 100" class="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardDescription class="flex items-center gap-1.5 text-xs">
            <Warehouse class="h-3.5 w-3.5" /> 仓储上限
          </CardDescription>
          <CardTitle class="text-lg tabular-nums">{{ formatNumber(storage) }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-xs text-muted-foreground">每种物品</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardDescription class="flex items-center gap-1.5 text-xs">
            <Factory class="h-3.5 w-3.5" /> 建筑实例
          </CardDescription>
          <CardTitle class="text-lg tabular-nums">{{ store.factory.buildings.length }} / {{ MAX_INSTANCES }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-xs text-muted-foreground">{{ runningCount }} 座运行中</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardDescription class="flex items-center gap-1.5 text-xs">
            <FlaskConical class="h-3.5 w-3.5" /> 已完成科技
          </CardDescription>
          <CardTitle class="text-lg tabular-nums">{{ store.factory.techs.length }} / 42</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-xs text-muted-foreground">{{ store.factory.techs.length ? '研究推进中' : '尚未开始研究' }}</div>
        </CardContent>
      </Card>
    </div>

    <!-- 战役任务 -->
    <FactoryCampaign />

    <!-- 诊断面板 -->
    <FactoryDiagnostics />

    <!-- 建筑分组 -->
    <div v-for="group in groups" :key="group.name" class="mb-5">
      <div class="mb-2 flex items-center gap-2">
        <h3 class="text-sm font-medium">{{ group.name }}</h3>
        <span class="text-xs text-muted-foreground">{{ group.items.length }} 种</span>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card v-for="b in group.items" :key="b.id" :class="locked(b.id) ? 'opacity-70' : ''">
          <CardHeader class="pb-3">
            <div class="flex items-start justify-between gap-2">
              <CardTitle class="flex items-center gap-1.5 text-sm sm:text-base"><FactoryIcon :id="b.id" size="md" class="text-foreground" />{{ b.name }}</CardTitle>
              <div class="flex shrink-0 items-center gap-1">
                <Badge v-if="locked(b.id)" variant="outline" class="gap-1 text-[10px]">
                  <Lock class="h-3 w-3" />{{ techName(b.unlockedBy) }}
                </Badge>
                <Badge v-else variant="secondary" class="text-[10px]">已建 {{ countOf(b.id) }}</Badge>
              </div>
            </div>
            <CardDescription class="text-xs">{{ b.description }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <MaterialToken v-for="(n, id) in b.baseCost" :key="id" :id="id as MaterialId" :amount="n" size="xs" />
            </div>

            <div class="flex flex-wrap items-center gap-1.5">
              <Button size="sm" :disabled="locked(b.id) || !affordable(b.baseCost) || countOf(b.id) >= MAX_INSTANCES_PER_TYPE" @click="onBuild(b.id)">
                <Plus class="h-3.5 w-3.5" />新建
              </Button>
              <Button
                v-for="inst in instancesOf(b.id)"
                :key="inst.id"
                variant="outline"
                size="sm"
                class="font-mono text-xs"
                :class="inst.enabled ? '' : 'text-muted-foreground line-through'"
                @click="openInstance(inst.id)"
              >
                Lv{{ inst.level }}
              </Button>
              <span v-if="countOf(b.id) >= MAX_INSTANCES_PER_TYPE" class="text-[11px] text-muted-foreground">已达 8 座上限</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <InstancePanel v-model:open="panelOpen" :instance-id="activeId" />
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { Factory, FlaskConical, Lock, Plus, Warehouse, Zap } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Progress } from '@/components/ui/progress'
  import MaterialToken from '@/components/factory/MaterialToken.vue'
  import FactoryIcon from '@/components/factory/FactoryIcon.vue'
  import InstancePanel from '@/components/factory/InstancePanel.vue'
  import FactoryDiagnostics from '@/components/factory/FactoryDiagnostics.vue'
  import FactoryCampaign from '@/components/factory/FactoryCampaign.vue'
  import { useFactoryStore } from '@/stores/factoryStore'
  import { BUILDINGS, BUILDING_GROUP } from '@/config/factory/buildings'
  import { TECH_MAP } from '@/config/factory/techs'
  import { MAX_INSTANCES, MAX_INSTANCES_PER_TYPE } from '@/config/factory/balance'
  import { storageCap } from '@/logic/factory/engine'
  import type { BuildingId, MaterialId } from '@/types/factory'

  const props = defineProps<{ embedded?: boolean }>()
  const store = useFactoryStore()

  const panelOpen = ref(false)
  const activeId = ref<string | null>(null)

  const ratio = computed(() => store.factory.powerRatio ?? 1)
  const storage = computed(() => storageCap(store.factory))
  const runningCount = computed(() => store.factory.buildings.filter(b => b.enabled).length)

  const groups = computed(() => {
    const order = ['采掘', '冶炼', '制造', '电力', '科研', '军事', '物流', '特殊']
    const map = new Map<string, typeof BUILDINGS[BuildingId][]>()
    for (const b of Object.values(BUILDINGS)) {
      const g = BUILDING_GROUP[b.id] ?? '特殊'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(b)
    }
    return order.filter(name => map.has(name)).map(name => ({ name, items: map.get(name)! }))
  })

  function locked(id: BuildingId): boolean {
    const def = BUILDINGS[id]
    if (def.defaultUnlocked) return false
    return !def.unlockedBy || !store.factory.techs.includes(def.unlockedBy)
  }

  function techName(id?: string): string {
    if (!id) return '未解锁'
    return TECH_MAP[id as keyof typeof TECH_MAP]?.name ?? '未解锁'
  }

  function countOf(id: BuildingId): number {
    return store.factory.buildings.filter(b => b.type === id).length
  }

  function instancesOf(id: BuildingId) {
    return store.factory.buildings.filter(b => b.type === id)
  }

  function affordable(cost: Partial<Record<MaterialId, number>>): boolean {
    return Object.entries(cost).every(([id, n]) => (store.factory.stock[id as MaterialId] ?? 0) >= (n as number))
  }

  function onBuild(id: BuildingId) {
    store.build(id)
  }

  function openInstance(id: string) {
    activeId.value = id
    panelOpen.value = true
  }

  function formatNumber(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
    return String(n)
  }

  // 每秒结算一次
  let timer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    store.normalize()
    timer = setInterval(() => store.advance(1), 1000)
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })
</script>
