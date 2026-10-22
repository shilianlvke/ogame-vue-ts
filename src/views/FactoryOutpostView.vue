<template>
  <div :class="props.embedded ? '' : 'container mx-auto p-4 sm:p-6'">
    <!-- 舰船 -->
    <div class="mb-2 flex items-center gap-2">
      <h3 class="text-sm font-medium">舰船池</h3>
      <span class="text-xs text-muted-foreground">总货舱 {{ store.totalCargo() }} · 分配 {{ assignedCargo }}</span>
    </div>
    <div class="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <Card v-for="(def, name) in SHIP_COSTS" :key="name" :class="!def.hull && !def.weapon ? '' : ''">
        <CardContent class="space-y-2 p-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{{ name }}</span>
            <Badge variant="secondary" class="text-[10px]">{{ store.ships[name] ?? 0 }}</Badge>
          </div>
          <div class="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span v-if="def.hull">舰体 {{ def.hull }}</span>
            <span v-if="def.thruster">推进 {{ def.thruster }}</span>
            <span v-if="def.weapon">武器 {{ def.weapon }}</span>
            <span v-if="def.shield">护盾 {{ def.shield }}</span>
            <span v-if="def.cargo" class="text-primary">货舱 {{ def.cargo }}</span>
          </div>
          <Button size="sm" class="w-full" :disabled="!affordShip(def)" @click="onBuildShip(name)">建造</Button>
        </CardContent>
      </Card>
    </div>

    <!-- 前哨 -->
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-medium">采矿前哨</h3>
        <span class="text-xs text-muted-foreground">{{ store.outposts.length }} / {{ MAX_OUTPOSTS }}</span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Input v-model="newName" class="h-8 w-32" placeholder="前哨名称" />
        <Select v-model="newOre">
          <SelectTrigger class="h-8 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="ore in OUTPOST_ORES" :key="ore" :value="ore">{{ MATERIALS[ore].name }}</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" :disabled="store.outposts.length >= MAX_OUTPOSTS" @click="onColonize">殖民</Button>
      </div>
    </div>
    <div v-if="!store.outposts.length" class="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
      先建造一艘殖民船，再派遣建立前哨
    </div>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Card v-for="op in store.outposts" :key="op.id">
        <CardHeader class="pb-2">
          <CardTitle class="flex items-center justify-between text-sm">
            <span class="flex items-center gap-1.5">
              <FactoryIcon :id="op.ore" size="md" class="text-foreground" />{{ op.name }}
            </span>
            <Badge variant="outline" class="text-[10px]">{{ MATERIALS[op.ore].name }}</Badge>
          </CardTitle>
          <CardDescription class="text-xs">
            矿脉 {{ formatNumber(op.reserve) }} / {{ formatNumber(op.reserveMax) }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="grid grid-cols-3 gap-2 text-center text-xs">
            <div class="rounded-md border p-2">
              <div class="text-muted-foreground">产量</div>
              <div class="font-medium tabular-nums">{{ yieldRate(op).toFixed(1) }}/s</div>
            </div>
            <div class="rounded-md border p-2">
              <div class="text-muted-foreground">待运</div>
              <div class="font-medium tabular-nums">{{ formatNumber(op.stock) }}</div>
            </div>
            <div class="rounded-md border p-2">
              <div class="text-muted-foreground">运回</div>
              <div class="font-medium tabular-nums">{{ (transportRate(op) / 60).toFixed(1) }}/s</div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-muted-foreground">矿井 {{ op.mineSlots }} 槽</span>
            <span class="text-xs text-muted-foreground">仓库 Lv{{ op.warehouseLevel }}</span>
            <span class="text-xs text-muted-foreground">太阳能 Lv{{ op.solarLevel }}</span>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" @click="store.buildOutpostMine(op.id)">矿井 +1</Button>
            <Button size="sm" variant="outline" @click="store.buildOutpostWarehouse(op.id)">仓库 +1</Button>
            <Button size="sm" variant="outline" @click="store.buildOutpostSolar(op.id)">太阳能 +1</Button>
          </div>

          <div class="flex items-center gap-2">
            <span class="w-16 shrink-0 text-xs text-muted-foreground">运力分配</span>
            <Input
              :model-value="String(op.cargo)"
              type="number"
              min="0"
              class="h-8"
              @change="onCargoInput(op.id, $event)"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { toast } from 'vue-sonner'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Input } from '@/components/ui/input'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
  import FactoryIcon from '@/components/factory/FactoryIcon.vue'
  import { useFactoryStore } from '@/stores/factoryStore'
  import { MATERIALS } from '@/config/factory/materials'
  import { MAX_OUTPOSTS, SHIP_COSTS } from '@/config/factory/balance'
  import { OUTPOST_ORES, outpostYieldRate, transportRatePerMinute, type Outpost } from '@/logic/factory/outposts'
  import type { MaterialId } from '@/types/factory'

  const props = defineProps<{ embedded?: boolean }>()
  const store = useFactoryStore()

  const newName = ref('前哨')
  const newOre = ref<MaterialId>(OUTPOST_ORES[0]!)

  const assignedCargo = computed(() => store.outposts.reduce((a, o) => a + o.cargo, 0))

  function affordShip(def: (typeof SHIP_COSTS)[string]): boolean {
    const parts: Partial<Record<MaterialId, number>> = {
      hullFrame: def.hull,
      thrusterAssembly: def.thruster,
      weaponAssembly: def.weapon,
      shieldAssembly: def.shield
    }
    return Object.entries(parts).every(([k, v]) => (store.factory.stock[k as MaterialId] ?? 0) >= (v as number))
  }

  function onBuildShip(name: string) {
    if (!store.buildShip(name)) toast.error('零件不足')
  }

  function onColonize() {
    if (!store.colonize(newName.value.trim() || '前哨', newOre.value)) {
      toast.error(store.outposts.length >= MAX_OUTPOSTS ? '前哨数量已达上限' : '需要一艘殖民船')
    }
  }

  function onCargo(id: string, value: number) {
    store.assignCargo(id, Number.isFinite(value) ? value : 0)
  }

  function onCargoInput(id: string, event: unknown) {
    onCargo(id, Number((event as Event).target ? ((event as Event).target as HTMLInputElement).value : 0))
  }

  function yieldRate(op: Outpost): number {
    return outpostYieldRate(op)
  }

  function transportRate(op: Outpost): number {
    return transportRatePerMinute(op)
  }

  function formatNumber(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
    return String(Math.round(n))
  }
</script>
