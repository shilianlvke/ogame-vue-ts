<template>
  <div class="container mx-auto flex h-[calc(100svh-3.75rem)] flex-col gap-4 overflow-hidden p-4 sm:p-6">
    <!-- 玩家排名概览 -->
    <div class="flex items-center gap-4 p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10">
      <Crown class="h-5 w-5 text-yellow-500 shrink-0" />
      <span class="text-sm text-muted-foreground">{{ t('ranking.yourRanking') }}</span>
      <span class="text-xl font-bold">#{{ playerRank }}</span>
      <span class="text-sm text-muted-foreground">/ {{ rankingData.length }}</span>
      <span class="ml-auto text-lg font-bold text-primary">{{ formatNumber(playerScore) }}</span>
    </div>

    <!-- 分类标签 -->
    <Tabs v-model="activeCategory" class="flex min-h-0 w-full flex-1 flex-col">
      <TabsList class="w-full grid shrink-0 grid-cols-5 h-10">
        <TabsTrigger v-for="category in categories" :key="category.value" :value="category.value" class="text-xs sm:text-sm">
          <component :is="getCategoryIcon(category.value)" class="h-4 w-4 mr-1 hidden sm:inline" />
          {{ t(`ranking.categories.${category.value}`) }}
        </TabsTrigger>
      </TabsList>

      <!-- 排行榜列表：仅此区域滚动 -->
      <TabsContent
        v-for="category in categories"
        :key="category.value"
        :value="category.value"
        data-ranking-scroll
        class="mt-4 min-h-0 overflow-y-auto pb-20"
        @scroll.passive="handleRankingScroll"
      >
        <Table container-class="overflow-visible">
          <TableHeader class="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-background">
            <TableRow>
              <TableHead class="w-16 text-center">#</TableHead>
              <TableHead>{{ t('ranking.name') }}</TableHead>
              <TableHead>{{ t(`ranking.categories.${activeCategory}`) }}</TableHead>
              <TableHead>{{ t('ranking.planets') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="(entry, index) in visibleRanking"
              :key="entry.id"
              :data-player-row="entry.isPlayer ? 'true' : undefined"
              :class="{ 'bg-primary/5': entry.isPlayer }"
            >
              <TableCell class="text-center">
                <div
                  class="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold mx-auto"
                  :class="getRankBadgeClass(getActualRank(index))"
                >
                  {{ getActualRank(index) }}
                </div>
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-1">
                  <span class="font-medium truncate" :class="{ 'text-primary': entry.isPlayer }">
                    {{ entry.name }}
                  </span>
                  <Badge v-if="entry.isPlayer" variant="outline" class="text-[10px] px-1 shrink-0">
                    {{ t('ranking.you') }}
                  </Badge>
                </div>
              </TableCell>
              <TableCell class="font-mono">
                {{ formatNumber(entry.scores[activeCategory]) }}
              </TableCell>
              <TableCell class="table-cell">
                <div class="flex items-center gap-1 text-muted-foreground">
                  <Globe class="h-4 w-4" />
                  {{ entry.planetCount }}
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-if="rankingData.length === 0">
              <TableCell class="text-center text-muted-foreground py-8">
                {{ t('ranking.noData') }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <!-- 末页留白：让最后一名的玩家也能滚动到列表中央 -->
        <div v-if="playerRank !== '-' && visibleEnd >= sortedRanking.length" class="h-[45vh]" aria-hidden="true" />
      </TabsContent>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, ref, watch } from 'vue'
  import { useGameStore } from '@/stores/gameStore'
  import { useNPCStore } from '@/stores/npcStore'
  import { useI18n } from '@/composables/useI18n'
  import { formatNumber } from '@/utils/format'
  import { Badge } from '@/components/ui/badge'
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
  import { RankingCategory, type RankingEntry } from '@/types/game'
  import { createRankingEntry, getRanking } from '@/logic/rankingLogic'
  import { useNetStore } from '@/stores/netStore'
  import { Crown, Globe, Trophy, Building2, FlaskConical, Rocket, Shield } from 'lucide-vue-next'

  const { t } = useI18n()
  const gameStore = useGameStore()
  const npcStore = useNPCStore()
  const netStore = useNetStore()

  const activeCategory = ref<RankingCategory>(RankingCategory.Total)

  // 连续滚动加载窗口（不是分页）
  const LOAD_CHUNK = 20
  const visibleStart = ref(0)
  const visibleEnd = ref(LOAD_CHUNK)

  const categories = [
    { value: RankingCategory.Total },
    { value: RankingCategory.Building },
    { value: RankingCategory.Research },
    { value: RankingCategory.Fleet },
    { value: RankingCategory.Defense }
  ]

  // 获取排行榜数据
  const rankingData = computed<RankingEntry[]>(() => {
    const entries = getRanking(gameStore.player, npcStore.npcs, activeCategory.value)

    // 联机模式：并入其他真人玩家（积分由服务端计算后随档案下发）
    for (const profile of netStore.players) {
      if (profile.id === gameStore.player.id) continue
      entries.push(createRankingEntry(profile.id, profile.name, false, profile.scores, profile.planetCount))
    }

    return entries
  })

  // 按当前类别排序的排行榜
  const sortedRanking = computed(() => {
    return [...rankingData.value].sort((a, b) => b.scores[activeCategory.value] - a.scores[activeCategory.value])
  })

  // 当前滚动窗口，滚动到顶/底时继续加载
  const visibleRanking = computed(() => sortedRanking.value.slice(visibleStart.value, visibleEnd.value))

  // 获取实际排名（考虑窗口偏移）
  const getActualRank = (index: number): number => visibleStart.value + index + 1

  const getActiveScroller = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('[data-ranking-scroll][data-state="active"]') ??
    document.querySelector<HTMLElement>('[data-ranking-scroll]:not([hidden])')

  const scrollPlayerToCenter = (): void => {
    const scroller = getActiveScroller()
    if (!scroller) return
    const playerRow = scroller.querySelector<HTMLElement>('[data-player-row="true"]')
    if (!playerRow) {
      scroller.scrollTop = 0
      return
    }
    const containerRect = scroller.getBoundingClientRect()
    const rowRect = playerRow.getBoundingClientRect()
    scroller.scrollTop += rowRect.top - containerRect.top - containerRect.height / 2 + rowRect.height / 2
  }

  const centerWindowOnPlayer = async (): Promise<void> => {
    const total = sortedRanking.value.length
    const playerIndex = sortedRanking.value.findIndex(entry => entry.isPlayer)
    let start = playerIndex >= 0 ? Math.max(0, playerIndex - Math.floor(LOAD_CHUNK / 2)) : 0
    let end = Math.min(total, start + LOAD_CHUNK)
    if (end >= total) start = Math.max(0, end - LOAD_CHUNK)
    visibleStart.value = start
    visibleEnd.value = end
    await nextTick()
    await nextTick()
    scrollPlayerToCenter()
    // 末页留白和行高在下一帧才稳定，再校正一次，确保玩家真正位于列表中央
    window.setTimeout(scrollPlayerToCenter, 80)
  }

  const handleRankingScroll = (event: Event): void => {
    const scroller = event.currentTarget as HTMLElement
    if (!scroller) return
    const total = sortedRanking.value.length

    if (scroller.scrollTop <= 24 && visibleStart.value > 0) {
      const previousHeight = scroller.scrollHeight
      const previousTop = scroller.scrollTop
      visibleStart.value = Math.max(0, visibleStart.value - LOAD_CHUNK)
      void nextTick(() => {
        scroller.scrollTop = previousTop + scroller.scrollHeight - previousHeight
      })
      return
    }

    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 24 && visibleEnd.value < total) {
      visibleEnd.value = Math.min(total, visibleEnd.value + LOAD_CHUNK)
    }
  }

  // 切换分类时重新定位玩家，并重置滚动窗口
  watch(activeCategory, () => {
    void centerWindowOnPlayer()
  })

  onMounted(() => {
    void centerWindowOnPlayer()
  })

  // 玩家当前排名
  const playerRank = computed(() => {
    const index = sortedRanking.value.findIndex(entry => entry.isPlayer)
    return index >= 0 ? index + 1 : '-'
  })

  // 玩家当前积分
  const playerScore = computed(() => {
    const playerEntry = rankingData.value.find(entry => entry.isPlayer)
    return playerEntry?.scores[activeCategory.value] || 0
  })

  // 获取类别图标
  const getCategoryIcon = (category: RankingCategory) => {
    switch (category) {
      case RankingCategory.Total:
        return Trophy
      case RankingCategory.Building:
        return Building2
      case RankingCategory.Research:
        return FlaskConical
      case RankingCategory.Fleet:
        return Rocket
      case RankingCategory.Defense:
        return Shield
    }
  }

  // 获取排名徽章样式
  const getRankBadgeClass = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500 text-yellow-950'
      case 2:
        return 'bg-gray-400 text-gray-900'
      case 3:
        return 'bg-amber-600 text-amber-100'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }
</script>
