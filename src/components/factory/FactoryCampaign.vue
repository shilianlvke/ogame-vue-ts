<template>
  <Card class="mb-5">
    <CardHeader class="pb-2">
      <div class="flex items-center justify-between gap-2">
        <CardTitle class="flex flex-wrap items-center gap-2 text-sm">
          <Flag class="h-4 w-4 text-primary" />战役任务
          <Badge variant="secondary" class="text-[10px]">第 {{ currentChapter }} 章 · {{ chapterName }}</Badge>
          <span class="text-xs font-normal text-muted-foreground">{{ claimedCount }} / 130 已领取</span>
        </CardTitle>
        <Button variant="ghost" size="sm" class="h-7 gap-1 px-2 text-xs" @click="open = !open">
          {{ open ? '收起' : '查看全图' }}
          <ChevronDown class="h-3.5 w-3.5 transition-transform" :class="open ? 'rotate-180' : ''" />
        </Button>
      </div>
    </CardHeader>

    <!-- 当前任务 -->
    <CardContent v-if="current" class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-muted-foreground">{{ current.id }}</span>
          <span class="text-sm font-medium">{{ current.name }}</span>
        </div>
        <Button v-if="statusOf(current) === 'ready'" size="sm" @click="claim(current.id)">领取奖励</Button>
      </div>
      <div class="space-y-1.5">
        <div>
          <div class="mb-0.5 flex justify-between text-[11px] text-muted-foreground">
            <span>主目标：{{ goalLabel(current.main) }}</span>
            <span class="tabular-nums">{{ progressText(current.main) }}</span>
          </div>
          <Progress :model-value="percentOf(current.main)" class="h-1.5" />
        </div>
        <div v-for="(g, i) in current.sub" :key="i" class="flex items-center gap-2 text-[11px]" :class="met(g) ? 'text-muted-foreground line-through' : 'text-foreground'">
          <CheckCircle2 v-if="met(g)" class="h-3.5 w-3.5 text-primary" />
          <Circle v-else class="h-3.5 w-3.5 text-muted-foreground" />
          <span>子目标：{{ goalLabel(g) }}</span>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span class="shrink-0">奖励</span>
        <template v-for="(r, i) in rewardLabels(current.reward)" :key="i">
          <Badge variant="outline" class="text-[10px]">{{ r }}</Badge>
        </template>
      </div>
    </CardContent>
    <CardContent v-else class="text-xs text-muted-foreground">
      全部任务已完成
    </CardContent>

    <!-- 战役全图 -->
    <CardContent v-if="open" class="space-y-4 border-t pt-3">
      <div v-for="ch in chapters" :key="ch.number" :class="ch.number === currentChapter ? '' : 'opacity-80'">
        <div class="mb-1 flex items-center gap-2">
          <h4 class="text-sm font-medium">第 {{ ch.number }} 章 · {{ ch.name }}</h4>
          <span class="text-[11px] text-muted-foreground">{{ claimedIn(ch.number) }} / {{ ch.quests.length }}</span>
        </div>
        <div class="space-y-1">
          <div v-for="quest in ch.quests" :key="quest.id" class="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
            <span class="w-8 shrink-0 tabular-nums text-muted-foreground">{{ quest.id }}</span>
            <span class="min-w-0 flex-1 truncate font-medium" :class="statusOf(quest) === 'locked' ? 'text-muted-foreground' : ''">{{ quest.name }}</span>
            <span class="hidden truncate text-muted-foreground sm:inline">{{ goalLabel(quest.main) }}</span>
            <Badge :variant="statusVariant(statusOf(quest))" class="shrink-0 text-[10px]">{{ statusLabel(statusOf(quest)) }}</Badge>
            <Button v-if="statusOf(quest) === 'ready'" size="sm" class="h-6 px-2 text-[11px]" @click="claim(quest.id)">领取</Button>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { toast } from 'vue-sonner'
  import { CheckCircle2, ChevronDown, Circle, Flag } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
  import { Progress } from '@/components/ui/progress'
  import { useFactoryStore } from '@/stores/factoryStore'
  import { CAMPAIGN_CHAPTERS, CAMPAIGN_QUESTS } from '@/config/factory/campaign'
  import { goalProgress, questStatus, isGoalMet, type QuestStatus } from '@/logic/factory/campaign'
  import { MATERIALS } from '@/config/factory/materials'
  import { BUILDINGS } from '@/config/factory/buildings'
  import { TECH_MAP } from '@/config/factory/techs'
  import { RECIPE_MAP } from '@/config/factory/recipes'
  import type { CampaignGoal, CampaignQuest, CampaignReward, EquipmentId, PayloadId, SuitTier } from '@/types/factory'

  const store = useFactoryStore()
  const open = ref(false)

  const claimed = computed(() => new Set(store.campaignClaimed))
  const claimedCount = computed(() => store.campaignClaimed.length)

  const chapters = CAMPAIGN_CHAPTERS

  function statusOf(quest: CampaignQuest): QuestStatus {
    return questStatus(quest, store.campaignContext, claimed.value)
  }

  const current = computed(() => {
    for (const q of CAMPAIGN_QUESTS) {
      const s = statusOf(q)
      if (s === 'active' || s === 'ready') return q
    }
    return null
  })

  const currentChapter = computed(() => current.value?.chapter ?? 1)
  const chapterName = computed(() => chapters.find(c => c.number === currentChapter.value)?.name ?? '')

  function claimedIn(chapter: number): number {
    return CAMPAIGN_QUESTS.filter(q => q.chapter === chapter && claimed.value.has(q.id)).length
  }

  function met(goal: CampaignGoal): boolean {
    return isGoalMet(goal, store.campaignContext)
  }

  function progressText(goal: CampaignGoal): string {
    const { current, target } = goalProgress(goal, store.campaignContext)
    if (goal.type === 'produce') return `${current.toFixed(2)} / ${target}/s`
    return `${formatNum(current)} / ${formatNum(target)}`
  }

  function percentOf(goal: CampaignGoal): number {
    const { current, target } = goalProgress(goal, store.campaignContext)
    return target > 0 ? Math.min(100, (current / target) * 100) : 0
  }

  function claim(id: string) {
    if (store.claimReward(id)) toast.success('奖励已领取')
  }

  const PAYLOAD_NAME: Record<PayloadId, string> = {
    seedPod: '种子舱',
    dataCore: '数据核心',
    industrialSeed: '工业种子',
    cargoPod: '物资舱',
    starChart: '星图阵列'
  }
  const EQUIPMENT_NAME: Record<EquipmentId, string> = {
    personalSolar: '太阳能板（个人）',
    personalBattery: '电池（个人）',
    exoskeleton: '外骨骼',
    personalRobot: '个人机器人',
    portableReactor: '便携核反应堆'
  }
  const SUIT_NAME: Record<SuitTier, string> = { basic: '基础工程服', reinforced: '强化工程服', modular: '模块化工程服' }

  function goalLabel(goal: CampaignGoal): string {
    const t = String(goal.target)
    switch (goal.type) {
      case 'produce':
        return `${MATERIALS[t as keyof typeof MATERIALS]?.name ?? t} ≥ ${goal.amount}/s`
      case 'building':
        return `${BUILDINGS[t as keyof typeof BUILDINGS]?.name ?? t} × ${goal.amount}`
      case 'buildingLevel':
        return `${BUILDINGS[t as keyof typeof BUILDINGS]?.name ?? t} ≥ ${goal.amount}`
      case 'buildingTotal':
        return `建筑总数 ≥ ${goal.amount}`
      case 'material':
        return `${MATERIALS[t as keyof typeof MATERIALS]?.name ?? t} ≥ ${formatNum(goal.amount)}`
      case 'payload':
        return `${PAYLOAD_NAME[t as PayloadId] ?? t} ≥ ${goal.amount}`
      case 'ship':
        return `${t} ≥ ${goal.amount}`
      case 'research':
        return TECH_MAP[t as keyof typeof TECH_MAP]?.name ?? t
      case 'wave':
        return `第 ${t} 波`
      case 'outpost':
        return `前哨 ≥ ${goal.amount}`
      case 'routeCapacity':
        return `航线运力 ≥ ${formatNum(goal.amount)}`
      case 'cycle':
        return `周目 ≥ ${goal.amount}`
      case 'launch':
        return `发射火箭`
    }
  }

  function rewardLabels(reward: CampaignReward): string[] {
    const out: string[] = []
    for (const [k, v] of Object.entries(reward.materials ?? {})) out.push(`${MATERIALS[k as keyof typeof MATERIALS]?.name ?? k} ×${formatNum(v ?? 0)}`)
    for (const [k, v] of Object.entries(reward.payloads ?? {})) out.push(`${PAYLOAD_NAME[k as PayloadId]} ×${v ?? 0}`)
    for (const [k, v] of Object.entries(reward.equipment ?? {})) out.push(`${EQUIPMENT_NAME[k as EquipmentId]} ×${v ?? 0}`)
    for (const [k, v] of Object.entries(reward.ships ?? {})) out.push(`${k} ×${v ?? 0}`)
    for (const [k, v] of Object.entries(reward.buildings ?? {})) out.push(`${BUILDINGS[k as keyof typeof BUILDINGS]?.name ?? k} ×${v ?? 0}`)
    for (const [k, v] of Object.entries(reward.buildingLevels ?? {})) out.push(`${BUILDINGS[k as keyof typeof BUILDINGS]?.name ?? k} +${v ?? 0} 级`)
    if (reward.darkMatter) out.push(`暗物质 ×${reward.darkMatter}`)
    for (const r of reward.unlockRecipes ?? []) out.push(`解锁 ${RECIPE_MAP[r]?.name ?? r}`)
    for (const [k, v] of Object.entries(reward.recipeBonus ?? {})) out.push(`${RECIPE_MAP[k]?.name ?? k} +${Math.round((v ?? 0) * 100)}%`)
    if (reward.moduleSlotBonus) out.push(`模块槽位 +${reward.moduleSlotBonus}`)
    if (reward.suit) out.push(SUIT_NAME[reward.suit])
    return out
  }

  function statusLabel(s: QuestStatus): string {
    return { locked: '未解锁', active: '进行中', ready: '可领取', claimed: '已领取' }[s]
  }
  function statusVariant(s: QuestStatus): 'secondary' | 'destructive' | 'outline' | 'default' {
    if (s === 'ready') return 'default'
    if (s === 'claimed') return 'secondary'
    return 'outline'
  }
  function formatNum(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
    if (Number.isInteger(n)) return String(n)
    return n.toFixed(1)
  }
</script>
