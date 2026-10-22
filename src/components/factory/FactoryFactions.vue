<template>
  <Card class="mb-5">
    <CardHeader class="pb-2">
      <div class="flex cursor-pointer items-center justify-between gap-2" @click="open = !open">
        <CardTitle class="flex items-center gap-2 text-sm">
          <Handshake class="h-4 w-4 text-primary" />派系
        </CardTitle>
        <ChevronDown class="h-4 w-4 text-muted-foreground transition-transform" :class="open ? 'rotate-180' : ''" />
      </div>
    </CardHeader>
    <CardContent v-if="open" class="space-y-4">
      <!-- 四条声望 -->
      <div class="grid gap-2 sm:grid-cols-2">
        <div v-for="f in factions" :key="f.id" class="rounded-md border p-2">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5 text-sm font-medium">
              <component :is="f.icon" class="h-4 w-4 text-primary" />{{ f.name }}
            </span>
            <span class="text-xs tabular-nums text-muted-foreground">{{ store.repOf(f.id) }} / 1000</span>
          </div>
          <Progress :model-value="(store.repOf(f.id) / 1000) * 100" class="mt-1.5 h-1.5" />
          <div class="mt-1 text-[11px] text-muted-foreground">{{ f.effect }}</div>
        </div>
      </div>

      <!-- 深核议会蓝图 -->
      <div class="rounded-md border p-3">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium">深核议会 · 破损蓝图</span>
          <span class="text-xs text-muted-foreground">剩余 {{ remainingBlueprints }} / {{ BLUEPRINT_TOTAL }} · 持有 {{ blueprintCount }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button size="sm" :disabled="remainingBlueprints <= 0 || store.darkMatter < blueprintPriceNow" @click="buyBlueprint">
            购买（{{ blueprintPriceNow }} 暗物质）
          </Button>
          <div class="flex flex-1 items-center gap-1.5">
            <Select v-model="blueprintTech">
              <SelectTrigger class="h-8 min-w-[10rem] flex-1"><SelectValue placeholder="选择立即完成的科技" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in blueprintTechs" :key="t.id" :value="t.id">{{ t.name }}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" :disabled="!blueprintTech || blueprintCount < 1" @click="useBlueprint">使用蓝图</Button>
          </div>
        </div>
      </div>

      <!-- 自由舰队事件 -->
      <div class="rounded-md border p-3">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium">自由舰队 · 委托</span>
          <span class="text-xs text-muted-foreground">
            活跃 {{ store.freeFleetEvents.length }} / {{ EVENT_MAX_ACTIVE }}
            <span v-if="cooldownLeft > 0" class="text-destructive">· 冷却 {{ Math.ceil(cooldownLeft / 60) }} 分</span>
          </span>
        </div>
        <div class="grid gap-2 sm:grid-cols-3">
          <div v-for="t in eventTypes" :key="t" class="rounded-md border p-2">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">{{ eventMeta(t).name }}</span>
              <Badge :variant="eventMeta(t).rep >= 0 ? 'outline' : 'destructive'" class="text-[10px]">声望 {{ eventMeta(t).rep > 0 ? '+' : '' }}{{ eventMeta(t).rep }}</Badge>
            </div>
            <div class="mt-0.5 text-[11px] text-muted-foreground">{{ eventMeta(t).desc }}</div>
            <Button size="sm" class="mt-1.5 w-full" :disabled="cooldownLeft > 0 || store.freeFleetEvents.length >= EVENT_MAX_ACTIVE || ((t === 'caravan' || t === 'raid') && !hasCombat)" @click="start(t)">
              领取
            </Button>
          </div>
        </div>
        <div v-if="store.freeFleetEvents.length" class="mt-2 space-y-1">
          <div v-for="ev in store.freeFleetEvents" :key="ev.id" class="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
            <span class="font-medium">{{ eventMeta(ev.type).name }}</span>
            <span class="text-muted-foreground">
              {{ ev.doneAt <= store.lastTickAt ? '已完成' : `剩余 ${Math.ceil((ev.doneAt - store.lastTickAt) / 60)} 分` }}
            </span>
            <span class="ml-auto text-muted-foreground">
              <MaterialToken v-for="(n, id) in ev.reward" :key="id" :id="id as MaterialId" :amount="n" size="xs" />
            </span>
            <Button size="sm" class="h-6 px-2 text-[11px]" :disabled="ev.doneAt > store.lastTickAt" @click="claim(ev.id)">领取</Button>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { toast } from 'vue-sonner'
  import { Bug, Building2, ChevronDown, Handshake, Ship } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
  import { Progress } from '@/components/ui/progress'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
  import MaterialToken from '@/components/factory/MaterialToken.vue'
  import { useFactoryStore } from '@/stores/factoryStore'
  import { TECHS } from '@/config/factory/techs'
  import { blueprintPrice, BLUEPRINT_TOTAL, EVENT_MAX_ACTIVE, eventMeta, hasCombatShip, type FactionId, type FreeFleetEventType } from '@/logic/factory/factions'
  import type { MaterialId, TechId } from '@/types/factory'

  const store = useFactoryStore()
  const open = ref(false)
  const blueprintTech = ref<TechId | ''>('')

  const factions: { id: FactionId; name: string; icon: unknown; effect: string }[] = [
    { id: 'minersGuild', name: '矿业公会', icon: Handshake, effect: '手续费随声望 3% → 1%' },
    { id: 'deepCouncil', name: '深核议会', icon: Building2, effect: '蓝图折扣、稀有蓝图' },
    { id: 'freeFleet', name: '自由舰队', icon: Ship, effect: '委托奖励提升' },
    { id: 'rustSwarm', name: '锈群', icon: Bug, effect: '掉落数量提升' }
  ]

  const eventTypes: FreeFleetEventType[] = ['caravan', 'raid', 'escort']

  const remainingBlueprints = computed(() => BLUEPRINT_TOTAL - store.blueprintsPurchased)
  const blueprintCount = computed(() => store.factory.stock.damagedBlueprint ?? 0)
  const blueprintPriceNow = computed(() => blueprintPrice(store.repOf('deepCouncil')))
  const cooldownLeft = computed(() => Math.max(0, store.eventCooldownUntil - store.lastTickAt))
  const hasCombat = computed(() => hasCombatShip(store.ships))

  const blueprintTechs = computed(() => TECHS.filter(t => !store.factory.techs.includes(t.id) && t.requires.every(r => store.factory.techs.includes(r))))

  function buyBlueprint() {
    const r = store.buyBlueprint()
    if (r.ok) toast.success(`已购入破损蓝图（${r.price} 暗物质）`)
    else toast.error(r.reason ?? '购买失败')
  }

  function useBlueprint() {
    if (!blueprintTech.value) return
    if (store.useBlueprint(blueprintTech.value)) {
      toast.success('科技已完成')
      blueprintTech.value = ''
    } else {
      toast.error('无法使用蓝图')
    }
  }

  function start(t: FreeFleetEventType) {
    const r = store.startEvent(t)
    if (r.ok) toast.success(`已领取 ${eventMeta(t).name}`)
    else toast.error(r.reason ?? '领取失败')
  }

  function claim(id: string) {
    if (store.claimEvent(id)) toast.success('委托奖励已领取')
  }
</script>
