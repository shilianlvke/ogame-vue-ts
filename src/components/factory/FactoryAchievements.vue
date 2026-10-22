<template>
  <Card class="mb-5">
    <CardHeader class="pb-2">
      <div class="flex cursor-pointer items-center justify-between gap-2" @click="open = !open">
        <CardTitle class="flex flex-wrap items-center gap-2 text-sm">
          <Trophy class="h-4 w-4 text-primary" />成就
          <span class="text-xs font-normal text-muted-foreground">{{ store.achievements.length }} / {{ ACHIEVEMENTS.length }}</span>
        </CardTitle>
        <ChevronDown class="h-4 w-4 text-muted-foreground transition-transform" :class="open ? 'rotate-180' : ''" />
      </div>
    </CardHeader>
    <CardContent v-if="open" class="space-y-2">
      <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="a in ACHIEVEMENTS" :key="a.id" class="rounded-md border p-2" :class="unlocked.has(a.id) ? '' : 'opacity-60'">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium">{{ a.name }}</span>
            <Badge :variant="unlocked.has(a.id) ? 'secondary' : 'outline'" class="text-[10px]">{{ unlocked.has(a.id) ? '已解锁' : '未解锁' }}</Badge>
          </div>
          <div class="mt-0.5 text-[11px] text-muted-foreground">{{ a.desc }}</div>
          <div v-if="progressOf(a.id)" class="mt-1.5">
            <Progress :model-value="progressOf(a.id)!.percent" class="h-1" />
            <div class="mt-0.5 text-right text-[10px] tabular-nums text-muted-foreground">{{ progressOf(a.id)!.text }}</div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { ChevronDown, Trophy } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
  import { Progress } from '@/components/ui/progress'
  import { useFactoryStore } from '@/stores/factoryStore'
  import { ACHIEVEMENTS } from '@/config/factory/achievements'

  const store = useFactoryStore()
  const open = ref(false)

  const unlocked = computed(() => new Set(store.achievements))

  function progressOf(id: string): { percent: number; text: string } | null {
    const s = store.achStats
    if (id === 'fullLoad') return { percent: Math.min(100, (s.fullLoadSeconds / 600) * 100), text: `${Math.floor(s.fullLoadSeconds / 60)} / 10 分钟` }
    if (id === 'salvager') return { percent: Math.min(100, (s.salvagedWreck / 1000) * 100), text: `${Math.floor(s.salvagedWreck)} / 1000 残骸` }
    if (id === 'rustSlayer') return { percent: Math.min(100, (s.rustHpKilled / 1_000_000) * 100), text: `${Math.floor(s.rustHpKilled)} / 100 万` }
    return null
  }
</script>
