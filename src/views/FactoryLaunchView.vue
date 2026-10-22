<template>
  <div :class="props.embedded ? '' : 'container mx-auto p-4 sm:p-6'">
    <!-- 概览 -->
    <div class="mb-4 grid gap-3 sm:mb-6 sm:grid-cols-3">
      <Card>
        <CardContent class="flex items-center justify-between p-3 sm:p-4">
          <div class="flex items-center gap-2 text-sm font-medium">
            <RotateCcw class="h-4 w-4 text-primary" />当前周目
          </div>
          <div class="text-sm font-medium tabular-nums">第 {{ store.cycle.cycle }} 周目 / 12</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="flex items-center justify-between p-3 sm:p-4">
          <div class="flex items-center gap-2 text-sm font-medium">
            <Rocket class="h-4 w-4 text-primary" />累计发射
          </div>
          <div class="text-sm font-medium tabular-nums">{{ store.cycle.launchCount }} 次</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="flex items-center justify-between p-3 sm:p-4">
          <div class="flex items-center gap-2 text-sm font-medium">
            <PackageCheck class="h-4 w-4 text-primary" />火箭就绪
          </div>
          <div class="text-sm font-medium tabular-nums">{{ store.factory.rockets ?? 0 }} 枚</div>
        </CardContent>
      </Card>
    </div>

    <!-- 火箭装配 -->
    <Card class="mb-5">
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-1.5 text-sm">
          <FactoryIcon id="rocketSilo" size="md" class="text-foreground" />火箭发射井
        </CardTitle>
        <CardDescription class="text-xs">
          {{ siloSlots }} 槽并行装配 · 每枚火箭 = 火箭部件 ×{{ ROCKET_PARTS }}（{{ ROCKET_ASSEMBLY_SECONDS }} 秒）
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-2">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <MaterialToken id="rocketPart" :amount="rocketParts" size="xs" />
          <span class="text-muted-foreground">火箭就绪 <span class="text-foreground tabular-nums">{{ store.factory.rockets ?? 0 }}</span></span>
          <span v-if="siloSlots === 0" class="text-muted-foreground">尚未建造发射井</span>
        </div>
        <div v-for="silo in silos" :key="silo.id" class="space-y-1 rounded-md border p-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium">发射井 Lv{{ silo.level }} · {{ silo.slots.length }} 槽</span>
            <span class="text-muted-foreground">{{ rocketParts >= ROCKET_PARTS ? '装配中' : '缺火箭部件' }}</span>
          </div>
          <div class="grid grid-cols-4 gap-1 sm:grid-cols-8">
            <div v-for="(slot, i) in silo.slots" :key="i" class="h-1.5 overflow-hidden rounded bg-muted">
              <div class="h-full bg-primary transition-all" :style="{ width: `${(slot.progress * 100).toFixed(0)}%` }" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 载荷选择 -->
    <div class="mb-2 text-sm font-medium">载荷配置</div>
    <div class="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Card v-for="p in payloads" :key="p.id" :class="owned(p.id) < 1 ? 'opacity-60' : ''">
        <CardHeader class="pb-2">
          <CardTitle class="flex items-center justify-between text-sm">
            <span class="flex items-center gap-1.5">
              <component :is="p.icon" class="h-4 w-4 text-primary" />{{ p.name }}
            </span>
            <Badge variant="outline" class="text-[10px]">持有 {{ owned(p.id) }}</Badge>
          </CardTitle>
          <CardDescription class="text-xs">{{ p.desc }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-2">
          <div class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <MaterialToken v-for="(n, id) in p.cost" :key="id" :id="id as MaterialId" :amount="n" size="xs" />
          </div>
          <template v-if="p.id === 'dataCore'">
            <Select v-model="selectedTech">
              <SelectTrigger class="h-8"><SelectValue placeholder="选择继承科技" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in store.factory.techs" :key="t" :value="t">{{ TECH_MAP[t].name }}</SelectItem>
              </SelectContent>
            </Select>
          </template>
          <template v-else-if="p.id === 'industrialSeed'">
            <Select v-model="selectedBuilding">
              <SelectTrigger class="h-8"><SelectValue placeholder="选择保留建筑" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="b in store.factory.buildings" :key="b.id" :value="b.id">{{ BUILDINGS[b.type].name }} Lv{{ b.level }}</SelectItem>
              </SelectContent>
            </Select>
          </template>
          <div v-else class="text-xs text-muted-foreground">{{ p.id === 'seedPod' ? '发射必需，自动携带' : '持有即自动携带' }}</div>
        </CardContent>
      </Card>
    </div>

    <!-- 发射与重置预览 -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="text-sm">发射火箭</CardTitle>
        <CardDescription class="text-xs">发射即进入下一周目，按重置表处理全部资产</CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <div class="grid gap-2 sm:grid-cols-2">
          <div class="rounded-md border p-2">
            <div class="mb-1 text-xs font-medium text-primary">保留</div>
            <div class="text-[11px] leading-5 text-muted-foreground">
              装备、工程服、无限研究、循环残片、暗物质、星币、成就、矿石方案
            </div>
          </div>
          <div class="rounded-md border p-2">
            <div class="mb-1 text-xs font-medium text-destructive">清零</div>
            <div class="text-[11px] leading-5 text-muted-foreground">
              建筑（除工业种子）、库存（除物资舱）、科技（除数据核心）、载荷、前哨、波次记录、派系声望减半
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button :disabled="!canLaunch" @click="launch">
            <Rocket class="h-4 w-4" />发射进入第 {{ nextCycleLabel }} 周目
          </Button>
          <span v-if="!canLaunch" class="text-xs text-muted-foreground">
            {{ (store.factory.rockets ?? 0) < 1 ? '缺少火箭' : '缺少种子舱' }}
          </span>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { toast } from 'vue-sonner'
  import { Database, Map, Package, PackageCheck, Rocket, RotateCcw, Sprout, Factory } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
  import MaterialToken from '@/components/factory/MaterialToken.vue'
  import FactoryIcon from '@/components/factory/FactoryIcon.vue'
  import { useFactoryStore } from '@/stores/factoryStore'
  import { BUILDINGS } from '@/config/factory/buildings'
  import { TECH_MAP } from '@/config/factory/techs'
  import { ROCKET_ASSEMBLY_SECONDS, ROCKET_PARTS } from '@/config/factory/balance'
  import { nextCycle } from '@/logic/factory/cycle'
  import type { MaterialId, PayloadId, TechId } from '@/types/factory'

  const props = defineProps<{ embedded?: boolean }>()
  const store = useFactoryStore()

  const selectedTech = ref<TechId | ''>('')
  const selectedBuilding = ref('')

  const payloads = [
    { id: 'seedPod' as PayloadId, name: '种子舱', desc: '解锁下一周目（必需）', icon: Sprout, cost: { steel: 100 } },
    { id: 'dataCore' as PayloadId, name: '数据核心', desc: '继承 1 项科技', icon: Database, cost: { processingUnit: 50 } },
    { id: 'industrialSeed' as PayloadId, name: '工业种子', desc: '保留 1 座建筑实例的等级', icon: Factory, cost: { lowDensityStructure: 50 } },
    { id: 'cargoPod' as PayloadId, name: '物资舱', desc: '下一周目初始材料 ×1 万', icon: Package, cost: { steel: 500 } },
    { id: 'starChart' as PayloadId, name: '星图阵列', desc: '继承全部已发现星系', icon: Map, cost: { processingUnit: 200, solarPanel: 50 } }
  ]

  const silos = computed(() => store.factory.buildings.filter(b => b.type === 'rocketSilo'))
  const siloSlots = computed(() => silos.value.reduce((a, b) => a + b.slots.length, 0))
  const rocketParts = computed(() => store.factory.stock.rocketPart ?? 0)
  const canLaunch = computed(() => (store.factory.rockets ?? 0) >= 1 && (store.factory.payloads.seedPod ?? 0) >= 1)
  const nextCycleLabel = computed(() => nextCycle(store.cycle.cycle))

  function owned(id: PayloadId): number {
    return store.factory.payloads[id] ?? 0
  }

  function launch() {
    const selection = {
      tech: selectedTech.value || undefined,
      buildingInstanceId: selectedBuilding.value || undefined
    }
    const result = store.launchRocket(selection)
    if (result.ok) {
      toast.success(`已发射，进入第 ${store.cycle.cycle} 周目`)
      selectedTech.value = ''
      selectedBuilding.value = ''
    } else {
      toast.error(result.reason ?? '发射失败')
    }
  }
</script>
