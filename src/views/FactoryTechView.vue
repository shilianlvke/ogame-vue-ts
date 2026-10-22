<template>
  <div :class="props.embedded ? '' : 'container mx-auto p-4 sm:p-6'">
    <!-- 概览 -->
    <div class="mb-4 flex flex-wrap items-center gap-3 sm:mb-6">
      <Card class="flex-1 min-w-[14rem]">
        <CardContent class="flex items-center justify-between p-3 sm:p-4">
          <div class="flex items-center gap-2 text-sm font-medium">
            <FlaskConical class="h-4 w-4 text-primary" />实验室槽位
          </div>
          <div class="text-sm tabular-nums">
            <span class="font-medium">{{ boundSlots }}</span>
            <span class="text-muted-foreground"> / {{ totalLabSlots }}</span>
          </div>
        </CardContent>
      </Card>
      <Card class="flex-1 min-w-[14rem]">
        <CardContent class="flex items-center justify-between p-3 sm:p-4">
          <div class="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 class="h-4 w-4 text-primary" />已完成科技
          </div>
          <div class="text-sm tabular-nums">
            <span class="font-medium">{{ doneCount }}</span>
            <span class="text-muted-foreground"> / 42</span>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 进行中的研究 -->
    <div v-if="activeResearch.length" class="mb-4 grid gap-3 sm:mb-6 md:grid-cols-2 xl:grid-cols-3">
      <Card v-for="row in activeResearch" :key="row.techId">
        <CardHeader class="pb-2">
          <CardTitle class="flex items-center justify-between text-sm">
            <span>{{ row.name }}</span>
            <Badge variant="outline" class="text-[10px]">{{ row.slots }} 槽</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-2">
          <Progress :model-value="row.percent" class="h-2" />
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ row.progress }} / {{ row.cost }}</span>
            <Button variant="ghost" size="sm" class="h-6 px-2 text-xs" @click="cancel(row.techId)">取消</Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 六层科技 -->
    <div v-for="layer in [1, 2, 3, 4, 5, 6]" :key="layer" class="mb-5">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <h3 class="text-sm font-medium">第 {{ layer }} 层</h3>
        <div class="flex items-center gap-1.5">
          <MaterialToken v-for="p in layerPacks(layer)" :key="p" :id="p" size="xs" hide-name />
        </div>
        <span class="text-xs text-muted-foreground">{{ TECHS.filter(t => t.layer === layer).length }} 项</span>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card v-for="tech in TECHS.filter(t => t.layer === layer)" :key="tech.id" :class="statusOf(tech).done ? '' : 'opacity-90'">
          <CardHeader class="pb-2">
            <div class="flex items-start justify-between gap-2">
              <CardTitle class="flex items-center gap-1.5 text-sm sm:text-base">
                <span class="text-xs tabular-nums text-muted-foreground">#{{ tech.index }}</span>
                {{ tech.name }}
              </CardTitle>
              <Badge v-if="statusOf(tech).done" variant="secondary" class="text-[10px]">已完成</Badge>
              <Badge v-else-if="statusOf(tech).researching" variant="outline" class="text-[10px] text-primary">研究中</Badge>
              <Badge v-else-if="statusOf(tech).available" variant="outline" class="text-[10px]">可研究</Badge>
              <Badge v-else variant="outline" class="text-[10px] text-muted-foreground">前置不足</Badge>
            </div>
          </CardHeader>
          <CardContent class="space-y-2">
            <div class="text-xs text-muted-foreground">
              研究单位 <span class="font-medium text-foreground tabular-nums">{{ tech.cost }}</span>
            </div>
            <div v-if="tech.requires.length" class="flex flex-wrap items-center gap-1.5 text-xs">
              <span class="text-muted-foreground">前置</span>
              <Badge v-for="r in tech.requires" :key="r" variant="outline" class="text-[10px]" :class="doneSet.has(r) ? 'text-primary' : 'text-muted-foreground'">
                {{ TECH_MAP[r].name }}
              </Badge>
            </div>
            <div class="text-xs leading-relaxed text-muted-foreground">
              解锁：<span class="text-foreground">{{ tech.unlocks.join('、') }}</span>
            </div>

            <Progress v-if="statusOf(tech).researching" :model-value="statusOf(tech).percent" class="h-1.5" />

            <div class="pt-1">
              <Button
                v-if="statusOf(tech).available"
                size="sm"
                :disabled="boundSlots >= totalLabSlots || totalLabSlots === 0"
                @click="start(tech.id)"
              >
                开始研究
              </Button>
              <span v-else-if="!statusOf(tech).done && !statusOf(tech).researching" class="text-xs text-muted-foreground">
                {{ totalLabSlots === 0 ? '需要先建造实验室' : '完成前置后解锁' }}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- 无限研究 -->
    <div class="mb-5">
      <div class="mb-2 flex items-center gap-2">
        <h3 class="text-sm font-medium">无限研究</h3>
        <Badge v-if="!infiniteUnlocked" variant="outline" class="gap-1 text-[10px] text-muted-foreground">
          <Lock class="h-3 w-3" />完成「无限研究」后解锁
        </Badge>
      </div>
      <div v-if="infiniteUnlocked" class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card v-for="meta in INFINITE_RESEARCH" :key="meta.id">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm">{{ meta.name }}</CardTitle>
            <CardDescription class="text-xs">{{ meta.effect }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-2">
            <div class="text-xs text-muted-foreground">
              等级 <span class="font-medium text-foreground tabular-nums">{{ levelOf(meta.id) }}</span>
              · 本次 <span class="font-medium text-foreground tabular-nums">{{ costOf(meta) }}</span> 单位/包
            </div>
            <Button size="sm" :disabled="!affordInfinite(meta)" @click="buy(meta.id)">升级</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { CheckCircle2, FlaskConical, Lock } from 'lucide-vue-next'
  import { toast } from 'vue-sonner'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Progress } from '@/components/ui/progress'
  import MaterialToken from '@/components/factory/MaterialToken.vue'
  import { useFactoryStore } from '@/stores/factoryStore'
  import { INFINITE_RESEARCH, LAYER_PACKS, TECH_MAP, TECHS } from '@/config/factory/techs'
  import type { InfiniteResearchId, MaterialId, TechId } from '@/types/factory'

  const props = defineProps<{ embedded?: boolean }>()
  const store = useFactoryStore()

  const doneSet = computed(() => new Set(store.factory.techs))
  const doneCount = computed(() => store.factory.techs.length)

  const totalLabSlots = computed(() =>
    store.factory.buildings.filter(b => b.type === 'lab' && b.enabled).reduce((a, b) => a + b.slots.length, 0)
  )
  const boundSlots = computed(() =>
    store.factory.buildings.filter(b => b.type === 'lab').reduce((a, b) => a + b.slots.filter(s => s.techId).length, 0)
  )

  const infiniteUnlocked = computed(() => store.factory.techs.includes('infiniteResearch'))

  function layerPacks(layer: number): MaterialId[] {
    return (LAYER_PACKS[layer] as MaterialId[]) ?? []
  }

  function statusOf(tech: (typeof TECHS)[number]) {
    const done = store.factory.techs.includes(tech.id)
    const progress = store.factory.researchProgress[tech.id] ?? 0
    const researching = !done && progress > 0
    const available = !done && !researching && tech.requires.every(r => store.factory.techs.includes(r))
    return { done, researching, available, progress, percent: Math.min(100, (progress / tech.cost) * 100), cost: tech.cost }
  }

  const activeResearch = computed(() =>
    TECHS.map(t => ({ ...t, ...statusOf(t) }))
      .filter(t => t.researching)
      .map(t => ({ techId: t.id, name: t.name, cost: t.cost, progress: Math.floor(t.progress), percent: t.percent, slots: slotCountOf(t.id) }))
  )

  function slotCountOf(techId: TechId): number {
    return store.factory.buildings.filter(b => b.type === 'lab').reduce((a, b) => a + b.slots.filter(s => s.techId === techId).length, 0)
  }

  function start(techId: TechId) {
    if (!store.startResearch(techId)) {
      toast.error('没有空闲的实验室槽位')
    }
  }

  function cancel(techId: TechId) {
    for (const inst of store.factory.buildings) {
      if (inst.type !== 'lab') continue
      inst.slots.forEach((slot, index) => {
        if (slot.techId === techId) store.cancelResearch(inst.id, index)
      })
    }
  }

  function levelOf(id: InfiniteResearchId): number {
    return store.factory.infiniteResearch[id]
  }

  function costOf(meta: (typeof INFINITE_RESEARCH)[number]): number {
    return Math.round(meta.baseCost * Math.pow(meta.growth, levelOf(meta.id)))
  }

  const ALL_PACKS: MaterialId[] = ['automationPack', 'logisticPack', 'chemicalPack', 'militaryPack', 'productionPack', 'utilityPack']

  function affordInfinite(meta: (typeof INFINITE_RESEARCH)[number]): boolean {
    const cost = costOf(meta)
    return ALL_PACKS.every(p => (store.factory.stock[p] ?? 0) >= cost)
  }

  function buy(id: InfiniteResearchId) {
    if (!store.buyInfinite(id)) toast.error('科技包不足')
  }
</script>
