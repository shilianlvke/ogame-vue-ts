<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <ScrollableDialogContent v-if="instance" container-class="sm:max-w-2xl max-h-[88vh]">
      <template #header>
        <DialogHeader>
          <DialogTitle class="flex flex-wrap items-center gap-2">
            {{ def.name }}
            <Badge variant="secondary">Lv {{ instance.level }}</Badge>
            <Badge v-if="isMiner" variant="outline">{{ instance.coalMode ? '燃煤' : '电驱' }}</Badge>
            <Badge v-else-if="def.coalPerSlot" variant="outline">燃煤</Badge>
            <Badge v-else-if="instance.coalMode" variant="outline">燃煤</Badge>
          </DialogTitle>
          <DialogDescription>{{ def.description }}</DialogDescription>
        </DialogHeader>
      </template>

      <!-- 状态与操作 -->
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" @click="store.toggleBuilding(instance.id)">
          {{ instance.enabled ? '停用' : '启用' }}
        </Button>
        <Button v-if="canToggleCoal" variant="outline" size="sm" @click="store.toggleCoalMode(instance.id)">
          切换为{{ instance.coalMode ? '电驱' : '燃煤' }}
        </Button>
        <Button variant="outline" size="sm" :disabled="instance.level >= MAX_LEVEL" @click="onUpgrade">
          升级至 Lv{{ Math.min(instance.level + 1, MAX_LEVEL) }}
          <span class="ml-1 text-xs text-muted-foreground">{{ costText(upgradeCost(def.id, instance.level + 1)) }}</span>
        </Button>
        <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" @click="onDemolish">拆除</Button>
      </div>

      <!-- 采掘：矿种分配 -->
      <div v-if="isMiner" class="space-y-3">
        <div class="text-sm font-medium">矿种分配</div>
        <div v-for="(slot, index) in instance.slots" :key="index" class="flex items-center gap-2 rounded-md border p-2">
          <span class="w-12 shrink-0 text-xs text-muted-foreground">槽 {{ index + 1 }}</span>
          <Select :model-value="slot.recipeId ?? 'none'" @update:model-value="v => onOre(index, String(v))">
            <SelectTrigger class="h-8 flex-1">
              <SelectValue placeholder="空闲" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">空闲</SelectItem>
              <SelectItem v-for="ore in oreOptions" :key="ore" :value="ore">{{ MATERIALS[ore].name }}</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" class="shrink-0 text-[10px]">{{ STATUS_LABEL[slot.status] }}</Badge>
        </div>
      </div>

      <!-- 生产：按类别折叠的配方分配 -->
      <div v-else-if="def.categories.length" class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium">配方分配</div>
          <div class="text-xs text-muted-foreground">{{ usedSlots }} / {{ instance.slots.length }} 槽</div>
        </div>

        <div v-if="!assignments.length" class="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          暂无配方，从下方选择添加
        </div>

        <div v-for="row in assignments" :key="row.recipeId" class="rounded-md border p-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">{{ row.name }}</span>
              <Badge variant="outline" class="text-[10px]">{{ CATEGORY_LABEL[row.category] }}</Badge>
            </div>
            <div class="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" @click="onCount(row.recipeId, row.count - 1)">
                <Minus class="h-3 w-3" />
              </Button>
              <span class="w-8 text-center text-sm tabular-nums">{{ row.count }}</span>
              <Button variant="outline" size="icon-sm" @click="onCount(row.recipeId, row.count + 1)">
                <Plus class="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span v-for="(amount, id) in row.inputs" :key="id">
              <MaterialToken :id="id as MaterialId" :amount="amount" size="xs" />
            </span>
            <span>→</span>
            <span v-for="(amount, id) in row.outputs" :key="id">
              <MaterialToken :id="id as MaterialId" :amount="amount" size="xs" />
            </span>
            <span class="ml-auto">理论 {{ row.rate }}</span>
          </div>
        </div>

        <div class="flex flex-wrap items-end gap-2 rounded-md border bg-muted/40 p-2">
          <div v-if="def.categories.length > 1" class="w-32">
            <div class="mb-1 text-[11px] text-muted-foreground">类别</div>
            <Select v-model="pickCategory">
              <SelectTrigger class="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="c in def.categories" :key="c" :value="c">{{ CATEGORY_LABEL[c] }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="min-w-[10rem] flex-1">
            <div class="mb-1 text-[11px] text-muted-foreground">配方</div>
            <Select v-model="pickRecipe">
              <SelectTrigger class="h-8"><SelectValue placeholder="选择配方" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="r in pickableRecipes" :key="r.id" :value="r.id">{{ r.name }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" :disabled="!pickRecipe || freeSlots <= 0" @click="onAdd">分配 1 槽</Button>
        </div>
      </div>

      <!-- 模块 -->
      <div v-if="def.moduleSlots" class="mt-4 space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium">模块</div>
          <div class="text-xs text-muted-foreground">{{ instance.modules.length }} / {{ moduleCapacity }}</div>
        </div>
        <div class="grid gap-2 sm:grid-cols-3">
          <div v-for="m in MODULE_META" :key="m.type" class="rounded-md border p-2">
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="font-medium">{{ m.name }}</span>
              <span class="text-muted-foreground">{{ m.effect }}</span>
            </div>
            <div class="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" @click="onModule(m.type, countOf(m.type) - 1)">
                <Minus class="h-3 w-3" />
              </Button>
              <span class="w-6 text-center text-sm tabular-nums">{{ countOf(m.type) }}</span>
              <Button variant="outline" size="icon-sm" @click="onModule(m.type, countOf(m.type) + 1)">
                <Plus class="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ScrollableDialogContent>
  </Dialog>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { Minus, Plus } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Dialog, DialogDescription, DialogHeader, DialogTitle, ScrollableDialogContent } from '@/components/ui/dialog'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
  import MaterialToken from '@/components/factory/MaterialToken.vue'
  import { useFactoryStore } from '@/stores/factoryStore'
  import { BUILDINGS } from '@/config/factory/buildings'
  import { MATERIALS, MINEABLE } from '@/config/factory/materials'
  import { RECIPE_MAP } from '@/config/factory/recipes'
  import { MAX_LEVEL } from '@/config/factory/balance'
  import { upgradeCost } from '@/logic/factory/engine'
  import type { BuildingId, MaterialId, ModuleType, RecipeCategory, SlotStatus } from '@/types/factory'

  const props = defineProps<{ open: boolean; instanceId: string | null }>()
  const emit = defineEmits<{ 'update:open': [boolean] }>()

  const store = useFactoryStore()

  const instance = computed(() => store.factory.buildings.find(b => b.id === props.instanceId) ?? null)
  const def = computed(() => BUILDINGS[(instance.value?.type ?? 'mine') as BuildingId])
  const isMiner = computed(() => Boolean(def.value.yieldPerSlot))
  const canToggleCoal = computed(() => def.value.canElectrify || def.value.coalPerSlot)
  const oreOptions = computed(() => (def.value.id === 'oilWell' ? (['crudeOil'] as MaterialId[]) : MINEABLE))

  const STATUS_LABEL: Record<SlotStatus, string> = {
    running: '运行',
    starved: '断料',
    blocked: '堵塞',
    undervolt: '欠压',
    throttled: '限流',
    idle: '空闲'
  }

  const CATEGORY_LABEL: Record<RecipeCategory, string> = {
    smelt: '冶炼',
    craft: '制造',
    chem: '化工',
    oil: '炼油',
    science: '科技包',
    military: '军事',
    salvage: '拆解',
    payload: '载荷',
    equipment: '装备'
  }

  const MODULE_META: { type: ModuleType; name: string; effect: string }[] = [
    { type: 'speed', name: '速度模块', effect: '速度 +20%' },
    { type: 'productivity', name: '产能模块', effect: '产出 +10%' },
    { type: 'efficiency', name: '效率模块', effect: '能耗 −30%' }
  ]

  const pickCategory = ref<RecipeCategory>(def.value.categories[0] ?? 'craft')
  const pickRecipe = ref('')

  watch(
    () => props.instanceId,
    () => {
      pickCategory.value = def.value.categories[0] ?? 'craft'
      pickRecipe.value = ''
    }
  )
  watch(pickCategory, () => {
    pickRecipe.value = ''
  })

  const moduleCapacity = computed(() => Math.floor((instance.value?.level ?? 1) / 4) + (store.factory.techs.includes('robotLogistics') ? 1 : 0))
  const usedSlots = computed(() => instance.value?.slots.filter(s => s.recipeId).length ?? 0)
  const freeSlots = computed(() => (instance.value?.slots.length ?? 0) - usedSlots.value)

  /** 已分配配方聚合 */
  const assignments = computed(() => {
    const inst = instance.value
    if (!inst) return []
    const map = new Map<string, number>()
    for (const slot of inst.slots) {
      if (!slot.recipeId) continue
      map.set(slot.recipeId, (map.get(slot.recipeId) ?? 0) + 1)
    }
    return [...map.entries()].map(([recipeId, count]) => {
      const recipe = RECIPE_MAP[recipeId]
      const speed = def.value.speed ?? 1
      const ratePerSlot = recipe ? 1 / recipe.time : 0
      return {
        recipeId,
        name: recipe?.name ?? recipeId,
        category: (recipe?.category ?? 'craft') as RecipeCategory,
        inputs: recipe?.inputs ?? {},
        outputs: recipe?.outputs ?? {},
        count,
        rate: `${(ratePerSlot * count * speed).toFixed(2)}/s`
      }
    })
  })

  const pickableRecipes = computed(() =>
    Object.values(RECIPE_MAP).filter(r => def.value.categories.includes(r.category) && (!r.unlockedBy || store.factory.techs.includes(r.unlockedBy)))
  )

  // 选择类别后过滤
  const recipesInCategory = computed(() => pickableRecipes.value.filter(r => r.category === pickCategory.value))

  watch(recipesInCategory, list => {
    if (!list.some(r => r.id === pickRecipe.value)) pickRecipe.value = list[0]?.id ?? ''
  })

  function onAdd() {
    if (!instance.value || !pickRecipe.value) return
    const current = instance.value.slots.filter(s => s.recipeId === pickRecipe.value).length
    store.assign(instance.value.id, pickRecipe.value, current + 1)
  }

  function onCount(recipeId: string, count: number) {
    if (!instance.value) return
    store.assign(instance.value.id, recipeId, Math.max(0, count))
  }

  function onOre(index: number, ore: string) {
    if (!instance.value) return
    store.assignOre(instance.value.id, index, ore === 'none' ? null : (ore as MaterialId))
  }

  function onUpgrade() {
    if (instance.value) store.upgrade(instance.value.id)
  }

  function onDemolish() {
    if (!instance.value) return
    store.demolish(instance.value.id)
    emit('update:open', false)
  }

  function countOf(type: ModuleType) {
    return instance.value?.modules.filter(m => m === type).length ?? 0
  }

  function onModule(type: ModuleType, count: number) {
    if (instance.value) store.setModule(instance.value.id, type, count)
  }

  function costText(cost: Partial<Record<MaterialId, number>>): string {
    return Object.entries(cost)
      .map(([id, n]) => `${MATERIALS[id as MaterialId].name}${n}`)
      .join(' ')
  }
</script>
