<template>
  <Card class="mb-5">
    <CardHeader class="pb-2">
      <div class="flex cursor-pointer items-center justify-between gap-2" @click="open = !open">
        <CardTitle class="flex flex-wrap items-center gap-2 text-sm">
          <Activity class="h-4 w-4 text-primary" />诊断面板
          <span class="text-xs font-normal text-muted-foreground">每 2 秒刷新</span>
        </CardTitle>
        <div class="flex items-center gap-2">
          <Badge v-if="counts.starved" variant="outline" class="text-[10px] text-amber-600 dark:text-amber-400">断料 {{ counts.starved }}</Badge>
          <Badge v-if="counts.blocked" variant="destructive" class="text-[10px]">堵塞 {{ counts.blocked }}</Badge>
          <Badge v-if="counts.running" variant="secondary" class="text-[10px]">正常 {{ counts.running }}</Badge>
          <ChevronDown class="h-4 w-4 text-muted-foreground transition-transform" :class="open ? 'rotate-180' : ''" />
        </div>
      </div>
    </CardHeader>
    <CardContent v-if="open" class="space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="grid grid-cols-[minmax(8rem,1.4fr)_4.5rem_4.5rem_3.5rem_minmax(6rem,1fr)] items-center gap-2 px-2 text-[11px] text-muted-foreground">
          <span>配方</span>
          <span class="text-right">理论/s</span>
          <span class="text-right">实际/s</span>
          <span class="text-center">状态</span>
          <span>缺失项</span>
        </div>
        <Select v-model="filter">
          <SelectTrigger class="h-7 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem v-for="(label, key) in STATUS_LABEL" :key="key" :value="key">{{ label }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="max-h-[22rem] overflow-y-auto pr-1">
        <div v-for="row in visible" :key="row.recipeId" class="grid grid-cols-[minmax(8rem,1.4fr)_4.5rem_4.5rem_3.5rem_minmax(6rem,1fr)] items-center gap-2 border-b px-2 py-1.5 text-xs last:border-b-0">
          <span class="flex min-w-0 items-center gap-1.5">
            <FactoryIcon v-if="row.icon" :id="row.icon" size="sm" class="shrink-0 text-foreground" />
            <span class="truncate font-medium">{{ row.name }}</span>
            <span class="shrink-0 text-[10px] text-muted-foreground">{{ row.slots }} 槽</span>
          </span>
          <span class="text-right tabular-nums">{{ row.theoretical.toFixed(2) }}</span>
          <span class="text-right tabular-nums">{{ displayOf(row.recipeId) }}</span>
          <Badge :variant="statusVariant(row.status)" class="justify-self-center text-[10px]">{{ STATUS_LABEL[row.status] }}</Badge>
          <span class="truncate text-muted-foreground" :title="row.missing.join('、')">{{ row.missing.join('、') || '—' }}</span>
        </div>
        <div v-if="!visible.length" class="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
          没有符合筛选的配方
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
  import { Activity, ChevronDown } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
  import FactoryIcon from '@/components/factory/FactoryIcon.vue'
  import { useFactoryStore } from '@/stores/factoryStore'
  import { recipeDiagnostics } from '@/logic/factory/diagnostics'
  import type { SlotStatus } from '@/types/factory'

  const store = useFactoryStore()

  const open = ref(false)
  const filter = ref<'all' | SlotStatus>('all')

  const STATUS_LABEL: Record<SlotStatus, string> = {
    running: '正常',
    starved: '断料',
    blocked: '堵塞',
    undervolt: '欠压',
    throttled: '限流',
    idle: '无槽位'
  }

  const rows = computed(() => recipeDiagnostics(store.factory))
  const visible = computed(() => rows.value.filter(r => filter.value === 'all' || r.status === filter.value))

  const counts = computed(() => {
    const out: Record<string, number> = {}
    for (const r of rows.value) out[r.status] = (out[r.status] ?? 0) + 1
    return out
  })

  /** 实际产能补间显示值 */
  const displayed = reactive<Record<string, number>>({})

  function displayOf(recipeId: string): string {
    return (displayed[recipeId] ?? 0).toFixed(2)
  }

  function refresh() {
    for (const row of rows.value) {
      const target = row.actual
      const prev = displayed[row.recipeId] ?? target
      displayed[row.recipeId] = prev + (target - prev) * 0.5
    }
  }

  let timer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    timer = setInterval(refresh, 2000)
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  function statusVariant(status: SlotStatus): 'secondary' | 'destructive' | 'outline' {
    if (status === 'running') return 'secondary'
    if (status === 'blocked') return 'destructive'
    return 'outline'
  }
</script>
