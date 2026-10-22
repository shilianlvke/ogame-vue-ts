<template>
  <div :class="props.embedded ? '' : 'container mx-auto p-4 sm:p-6'">
    <!-- 概览 -->
    <div class="mb-4 grid gap-3 sm:mb-6 sm:grid-cols-3">
      <Card>
        <CardContent class="flex items-center justify-between p-3 sm:p-4">
          <div class="flex items-center gap-2 text-sm font-medium">
            <Activity class="h-4 w-4 text-primary" />扰动等级
          </div>
          <div class="text-sm font-medium tabular-nums">{{ distLevel }} / 8</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="flex items-center justify-between p-3 sm:p-4">
          <div class="flex items-center gap-2 text-sm font-medium">
            <Swords class="h-4 w-4 text-primary" />可挑战最高波次
          </div>
          <div class="text-sm font-medium tabular-nums">第 {{ cap }} 波</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="flex items-center justify-between p-3 sm:p-4">
          <div class="flex items-center gap-2 text-sm font-medium">
            <Shield class="h-4 w-4 text-primary" />防线长度
          </div>
          <div class="text-sm font-medium tabular-nums">{{ line }} 秒</div>
        </CardContent>
      </Card>
    </div>

    <!-- 进行中的战斗 -->
    <Card v-if="battle" class="mb-4 sm:mb-6">
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center justify-between text-sm sm:text-base">
          <span>第 {{ battle.wave }} 波</span>
          <Badge variant="outline" class="text-[10px]">{{ waveKind(battle.wave) }}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <div>
          <div class="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>锈群 HP</span>
            <span class="tabular-nums">{{ formatNumber(battle.hp) }}</span>
          </div>
          <Progress :model-value="hpPercent" class="h-2" />
        </div>
        <div>
          <div class="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>推进进度</span>
            <span class="tabular-nums">{{ (battle.progress * 100).toFixed(0) }}%</span>
          </div>
          <Progress :model-value="battle.progress * 100" class="h-2" />
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span v-for="(n, id) in battle.ammoUsed" :key="id">
            <MaterialToken :id="id as MaterialId" :amount="n" size="xs" />
          </span>
          <Badge v-if="battle.overload" variant="secondary" class="text-[10px]">过载</Badge>
        </div>
        <Button variant="outline" size="sm" class="text-destructive hover:text-destructive" @click="store.abandonWave()">
          放弃（按失败结算）
        </Button>
      </CardContent>
    </Card>

    <!-- 上局结果 -->
    <Card v-if="lastResult" class="mb-4 border-dashed sm:mb-6">
      <CardContent class="flex flex-wrap items-center gap-3 p-3 sm:p-4">
        <Badge :variant="lastResult.won ? 'default' : 'destructive'" class="text-xs">
          第 {{ lastResult.wave }} 波 {{ lastResult.won ? '胜利' : '失败' }}
        </Badge>
        <template v-if="lastResult.drops">
          <span class="text-xs text-muted-foreground">掉落</span>
          <MaterialToken v-for="(n, id) in nonZero(lastResult.drops)" :key="id" :id="id as MaterialId" :amount="n" size="xs" />
        </template>
      </CardContent>
    </Card>

    <!-- 波次列表 -->
    <div class="mb-2 text-sm font-medium">波次</div>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <Card v-for="n in 40" :key="n" :class="n > cap ? 'opacity-50' : ''">
        <CardContent class="space-y-2 p-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">第 {{ n }} 波</span>
            <Badge variant="outline" class="text-[10px]">{{ waveKind(n) }}</Badge>
          </div>
          <div class="text-xs text-muted-foreground">HP {{ formatNumber(waveHpAt(n)) }}</div>
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{{ clearCounts[n] ? `已通过 ${clearCounts[n]} 次` : '未通过' }}</span>
            <span v-if="cooldownLeft(n) > 0" class="text-destructive">{{ Math.ceil(cooldownLeft(n) / 60000) }} 分冷却</span>
          </div>
          <div class="flex gap-1.5">
            <Button size="sm" class="flex-1" :disabled="n > cap || !!battle || cooldownLeft(n) > 0" @click="start(n)">挑战</Button>
            <Button
              size="sm"
              variant="outline"
              :disabled="n > cap || !!battle || cooldownLeft(n) > 0"
              title="立即出结果，奖励 80%"
              @click="auto(n)"
            >
              自动
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { Activity, Shield, Swords } from 'lucide-vue-next'
  import { toast } from 'vue-sonner'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
  import { Progress } from '@/components/ui/progress'
  import MaterialToken from '@/components/factory/MaterialToken.vue'
  import { useFactoryStore } from '@/stores/factoryStore'
  import { defenseLine, disturbanceLevel, isElite, isFlood, waveHp } from '@/logic/factory/waves'
  import type { MaterialId } from '@/types/factory'

  const props = defineProps<{ embedded?: boolean }>()
  const store = useFactoryStore()

  const distLevel = computed(() => disturbanceLevel(store.factory))
  const cap = computed(() => store.waveCap())
  const line = computed(() => defenseLine(store.factory))
  const battle = computed(() => store.wave.battle)
  const lastResult = computed(() => store.wave.lastResult)
  const clearCounts = computed(() => store.wave.clearCounts)

  const hpPercent = computed(() => {
    const b = battle.value
    if (!b) return 0
    const total = waveHp(b.wave, distLevel.value, 1)
    return Math.max(0, Math.min(100, (b.hp / total) * 100))
  })

  function waveKind(n: number): string {
    if (isFlood(n)) return '潮涌'
    if (isElite(n)) return '精英'
    return '普通'
  }

  function waveHpAt(n: number): number {
    return waveHp(n, distLevel.value, 1)
  }

  function cooldownLeft(n: number): number {
    return store.waveCooldownLeft(n)
  }

  function start(n: number) {
    if (!store.startWave(n, false)) toast.error('无法发起该波次')
  }

  function auto(n: number) {
    if (!store.autoWave(n)) toast.error('自动结算失败')
  }

  function nonZero(drops: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(drops)) if (v > 0) out[k] = v
    return out
  }

  function formatNumber(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
    return String(Math.round(n))
  }
</script>
