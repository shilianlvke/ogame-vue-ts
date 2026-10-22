<template>
  <div class="container mx-auto flex h-[calc(100svh-3.75rem)] flex-col overflow-hidden p-4 sm:p-6">
    <!-- 标签切换 -->
    <Tabs v-model="activeTab" class="flex min-h-0 w-full flex-1 flex-col">
      <TabsList class="grid w-full shrink-0 grid-cols-3">
        <TabsTrigger v-for="tab in tabs" :key="tab.value" :value="tab.value" class="flex items-center justify-center gap-1 px-2">
          <component :is="tab.icon" class="h-3 w-3 sm:h-4 sm:w-4" />
          <span class="text-xs sm:text-sm truncate">{{ tab.label }}</span>
          <Badge v-if="tab.unreadCount > 0" variant="destructive" class="ml-1 text-xs">
            {{ tab.unreadCount }}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <!-- 清空消息按钮：固定在 tabs 下方 -->
      <div class="mt-3 flex shrink-0 items-center justify-end">
        <Popover v-model:open="showClearPopover">
          <PopoverTrigger as-child>
            <Button variant="outline" size="sm" class="gap-2">
              <Trash2 class="h-4 w-4" />
              {{ t('messagesView.clearMessages') }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-80">
            <div class="space-y-4">
              <div class="space-y-2">
                <h4 class="font-medium leading-none">{{ t('messagesView.clearMessageTypes') }}</h4>
              </div>
              <div class="space-y-3">
                <div v-for="option in clearOptionFields" :key="option.key" class="flex items-center space-x-2">
                  <Checkbox :id="`clear-${option.key}`" v-model="clearOptions[option.key]" />
                  <label :for="`clear-${option.key}`" class="text-sm cursor-pointer">
                    {{ t(`messagesView.${option.labelKey}`) }} ({{ option.count }})
                  </label>
                </div>
              </div>
              <Button @click="clearSelectedMessages" class="w-full" :disabled="!hasSelectedAny">
                {{ t('messagesView.clearNow') }}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <!-- 战斗报告列表 -->
      <TabsContent value="battles" class="mt-4 min-h-0 space-y-2 overflow-y-auto pb-20">
        <Empty v-if="gameStore.player.battleReports.length === 0" class="border rounded-lg">
          <EmptyContent>
            <Sword class="h-10 w-10 text-muted-foreground" />
            <EmptyDescription>{{ t('messagesView.noBattleReports') }}</EmptyDescription>
          </EmptyContent>
        </Empty>

        <Card
          v-for="report in sortedBattleReports"
          :key="report.id"
          @click="openBattleReport(report)"
          class="cursor-pointer hover:shadow-md transition-shadow"
        >
          <CardHeader class="pb-3">
            <div class="flex justify-between items-center gap-2">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <Sword class="h-4 w-4 shrink-0" />
                <CardTitle class="text-base sm:text-lg">{{ t('messagesView.battleReport') }}</CardTitle>
                <Badge v-if="!report.read" variant="default" class="text-xs">{{ t('messagesView.unread') }}</Badge>
                <Badge :variant="getBattleResultVariant(report)" class="text-xs">
                  {{ getBattleResultText(report) }}
                </Badge>
              </div>
              <Button @click.stop="deleteBattleReport(report.id)" variant="ghost" size="icon" class="h-8 w-8 shrink-0">
                <X class="h-4 w-4" />
              </Button>
            </div>
            <CardDescription class="text-xs sm:text-sm">
              {{ formatDate(report.timestamp) }}
            </CardDescription>
          </CardHeader>
        </Card>
      </TabsContent>

      <!-- 间谍报告列表 -->
      <TabsContent value="spy" class="mt-4 min-h-0 space-y-2 overflow-y-auto pb-20">
        <Empty v-if="gameStore.player.spyReports.length === 0" class="border rounded-lg">
          <EmptyContent>
            <Eye class="h-10 w-10 text-muted-foreground" />
            <EmptyDescription>{{ t('messagesView.noSpyReports') }}</EmptyDescription>
          </EmptyContent>
        </Empty>

        <!-- 侦查报告 -->
        <Card
          v-for="report in sortedSpyReports"
          :key="report.id"
          @click="openSpyReport(report)"
          class="cursor-pointer hover:shadow-md transition-shadow"
        >
          <CardHeader class="pb-3">
            <div class="flex justify-between items-center gap-2">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <Eye class="h-4 w-4 shrink-0" />
                <CardTitle class="text-base sm:text-lg">{{ t('messagesView.spyReport') }}</CardTitle>
                <Badge v-if="!report.read" variant="default" class="text-xs">{{ t('messagesView.unread') }}</Badge>
                <Badge variant="outline" class="text-xs">{{ report.targetPlanetName || report.targetPlanetId }}</Badge>
              </div>
              <Button @click.stop="deleteSpyReport(report.id)" variant="ghost" size="icon" class="h-8 w-8 shrink-0">
                <X class="h-4 w-4" />
              </Button>
            </div>
            <CardDescription class="text-xs sm:text-sm">
              {{ formatDate(report.timestamp) }}
            </CardDescription>
          </CardHeader>
        </Card>
      </TabsContent>

      <!-- 任务报告列表 -->
      <TabsContent value="missions" class="mt-4 min-h-0 space-y-2 overflow-y-auto pb-20">
        <Empty v-if="sortedMissionReports.length === 0" class="border rounded-lg">
          <EmptyContent>
            <Package class="h-10 w-10 text-muted-foreground" />
            <EmptyDescription>{{ t('messagesView.noMissionReports') }}</EmptyDescription>
          </EmptyContent>
        </Empty>

        <Card
          v-for="report in sortedMissionReports"
          :key="report.id"
          @click="openMissionReport(report)"
          class="cursor-pointer hover:shadow-md transition-shadow"
        >
          <CardHeader class="pb-3">
            <div class="flex justify-between items-center gap-2">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <Package class="h-4 w-4 shrink-0" />
                <CardTitle class="text-base sm:text-lg">{{ getMissionTypeName(report.missionType) }}</CardTitle>
                <Badge v-if="!report.read" variant="default" class="text-xs">{{ t('messagesView.unread') }}</Badge>
                <Badge :variant="report.success ? 'default' : 'destructive'" class="text-xs">
                  {{ report.success ? t('messagesView.success') : t('messagesView.failed') }}
                </Badge>
              </div>
              <Button @click.stop="deleteMissionReport(report.id)" variant="ghost" size="icon" class="h-8 w-8 shrink-0">
                <X class="h-4 w-4" />
              </Button>
            </div>
            <CardDescription class="text-xs sm:text-sm">
              {{ report.originPlanetName }} →
              {{
                report.targetPlanetName ||
                `[${report.targetPosition.galaxy}:${report.targetPosition.system}:${report.targetPosition.position}]`
              }}
              · {{ formatDate(report.timestamp) }}
            </CardDescription>
          </CardHeader>
        </Card>
      </TabsContent>
    </Tabs>

    <!-- 固定底部分页 -->
    <FixedPagination v-model:page="currentPage[activeTab]" :total-pages="getPaginationConfig(activeTab).totalPages" />

    <!-- 战斗报告对话框 -->
    <BattleReportDialog v-model:open="showBattleDialog" :report="selectedBattleReport" />

    <!-- 间谍报告对话框 -->
    <SpyReportDialog v-model:open="showSpyDialog" :report="selectedSpyReport" />

    <!-- 任务报告对话框 -->
    <MissionReportDialog v-model:open="showMissionDialog" :report="selectedMissionReport" />
  </div>
</template>

<script setup lang="ts">
  import { useGameStore } from '@/stores/gameStore'
  import { useI18n } from '@/composables/useI18n'
  import { computed, ref } from 'vue'
  import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
  import { Button } from '@/components/ui/button'
  import { Badge } from '@/components/ui/badge'
  import { FixedPagination } from '@/components/ui/pagination'
  import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
  import { Checkbox } from '@/components/ui/checkbox'
  import BattleReportDialog from '@/components/dialogs/BattleReportDialog.vue'
  import SpyReportDialog from '@/components/dialogs/SpyReportDialog.vue'
  import MissionReportDialog from '@/components/dialogs/MissionReportDialog.vue'
  import { formatDate } from '@/utils/format'
  import { X, Sword, Eye, Package, Trash2 } from 'lucide-vue-next'
  import { Empty, EmptyContent, EmptyDescription } from '@/components/ui/empty'
  import type { BattleResult, SpyReport, MissionReport } from '@/types/game'
  import { MissionType } from '@/types/game'
  import { dispatchCommand } from '@/core/runtime'
  import type { MessageCollection } from '@/logic/messageLogic'
  import { toast } from 'vue-sonner'

  const gameStore = useGameStore()
  const { t } = useI18n()
  const activeTab = ref<'battles' | 'spy' | 'missions'>('battles')

  // 清空消息功能
  const showClearPopover = ref(false)
  type ClearOptionKey = 'battles' | 'spyReports' | 'missionReports'
  const clearOptions = ref<Record<ClearOptionKey, boolean>>({
    battles: false,
    spyReports: false,
    missionReports: false
  })

  const clearOptionCollections: Record<ClearOptionKey, MessageCollection> = {
    battles: 'battleReports',
    spyReports: 'spyReports',
    missionReports: 'missionReports'
  }

  // 清空消息选项配置
  const clearOptionFields = computed(() => [
    { key: 'battles' as ClearOptionKey, labelKey: 'clearBattleReports', count: gameStore.player.battleReports.length },
    { key: 'spyReports' as ClearOptionKey, labelKey: 'clearSpyReports', count: gameStore.player.spyReports.length },
    { key: 'missionReports' as ClearOptionKey, labelKey: 'clearMissionReports', count: gameStore.player.missionReports?.length || 0 }
  ])

  const hasSelectedAny = computed(() => {
    return Object.values(clearOptions.value).some(v => v)
  })

  const clearSelectedMessages = () => {
    const collections = (Object.keys(clearOptions.value) as ClearOptionKey[])
      .filter(key => clearOptions.value[key])
      .map(key => clearOptionCollections[key])

    if (collections.length === 0) return

    // 走命令层：联机模式下清理必须写服务端，否则新通知到达时旧通知会随补丁回来
    const result = dispatchCommand({ type: 'messages.clear', collections })
    if (!result.ok) {
      toast.error(t(result.reason ?? 'errors.unknown'))
      return
    }

    // 重置选项
    clearOptions.value = {
      battles: false,
      spyReports: false,
      missionReports: false
    }

    // 关闭popover
    showClearPopover.value = false

    // 显示成功提示
    toast.success(t('messagesView.clearSuccess'))
  }

  const markMessageRead = (collection: MessageCollection, id: string) => {
    dispatchCommand({ type: 'messages.markRead', collections: [collection], id })
  }

  const removeMessage = (collection: MessageCollection, id: string) => {
    dispatchCommand({ type: 'messages.delete', collection, id })
  }

  // 分页状态
  const ITEMS_PER_PAGE = 10
  const currentPage = ref({
    battles: 1,
    spy: 1,
    missions: 1
  })

  // 对话框状态
  const showBattleDialog = ref(false)
  const showSpyDialog = ref(false)
  const showMissionDialog = ref(false)
  const selectedBattleReport = ref<BattleResult | null>(null)
  const selectedSpyReport = ref<SpyReport | null>(null)
  const selectedMissionReport = ref<MissionReport | null>(null)

  // 排序后的战斗报告（最新的在前）- 全部数据
  const allBattleReports = computed(() => {
    return [...gameStore.player.battleReports].sort((a, b) => b.timestamp - a.timestamp)
  })

  // 排序后的间谍报告（最新的在前）- 全部数据
  const allSpyReports = computed(() => {
    return [...gameStore.player.spyReports].sort((a, b) => b.timestamp - a.timestamp)
  })

  // 排序后的任务报告（最新的在前）- 全部数据
  const allMissionReports = computed(() => {
    if (!gameStore.player.missionReports) {
      return []
    }
    return [...gameStore.player.missionReports].sort((a, b) => b.timestamp - a.timestamp)
  })

  // 战斗报告分页
  const battleReportsTotalPages = computed(() => Math.ceil(allBattleReports.value.length / ITEMS_PER_PAGE))
  const sortedBattleReports = computed(() => {
    const start = (currentPage.value.battles - 1) * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return allBattleReports.value.slice(start, end)
  })

  // 侦查报告分页
  const spyReportsTotalPages = computed(() => Math.ceil(allSpyReports.value.length / ITEMS_PER_PAGE))
  const sortedSpyReports = computed(() => {
    const start = (currentPage.value.spy - 1) * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return allSpyReports.value.slice(start, end)
  })

  // 任务报告分页
  const missionReportsTotalPages = computed(() => Math.ceil(allMissionReports.value.length / ITEMS_PER_PAGE))
  const sortedMissionReports = computed(() => {
    const start = (currentPage.value.missions - 1) * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return allMissionReports.value.slice(start, end)
  })

  // 未读战斗报告数量
  const unreadBattles = computed(() => {
    return gameStore.player.battleReports.filter(r => !r.read).length
  })

  // 未读间谍报告数量
  const unreadSpyReports = computed(() => {
    return gameStore.player.spyReports.filter(r => !r.read).length
  })

  // 未读任务报告数量
  const unreadMissionReports = computed(() => {
    if (!gameStore.player.missionReports) {
      return 0
    }
    return gameStore.player.missionReports.filter(r => !r.read).length
  })

  // 标签页配置
  const tabs = computed(() => [
    {
      value: 'battles',
      icon: Sword,
      label: t('messagesView.battles'),
      unreadCount: unreadBattles.value
    },
    {
      value: 'spy',
      icon: Eye,
      label: t('messagesView.spy'),
      unreadCount: unreadSpyReports.value
    },
    {
      value: 'missions',
      icon: Package,
      label: t('messagesView.missions'),
      unreadCount: unreadMissionReports.value
    }
  ])

  // 分页配置
  type PageKey = 'battles' | 'spy' | 'missions'
  const paginationConfigs = computed(() => ({
    battles: {
      totalPages: battleReportsTotalPages.value
    },
    spy: {
      totalPages: spyReportsTotalPages.value
    },
    missions: {
      totalPages: missionReportsTotalPages.value
    }
  }))

  // 获取指定标签页的分页配置
  const getPaginationConfig = (key: PageKey) => paginationConfigs.value[key]

  // 判断战斗结果Badge颜色
  const getBattleResultVariant = (report: BattleResult): 'default' | 'destructive' | 'secondary' => {
    if (report.winner === 'draw') {
      return 'secondary'
    }

    // 判断玩家是攻击方还是防守方
    const isPlayerAttacker = report.attackerId === gameStore.player.id
    const playerWon = isPlayerAttacker ? report.winner === 'attacker' : report.winner === 'defender'

    return playerWon ? 'default' : 'destructive'
  }

  // 获取战斗结果文本
  const getBattleResultText = (report: BattleResult): string => {
    if (report.winner === 'draw') {
      return t('messagesView.draw')
    }

    // 判断玩家是攻击方还是防守方
    const isPlayerAttacker = report.attackerId === gameStore.player.id
    const playerWon = isPlayerAttacker ? report.winner === 'attacker' : report.winner === 'defender'

    return playerWon ? t('messagesView.victory') : t('messagesView.defeat')
  }

  // 打开战斗报告
  const openBattleReport = (report: BattleResult) => {
    selectedBattleReport.value = report
    showBattleDialog.value = true
    markMessageRead('battleReports', report.id)
  }

  // 打开间谍报告
  const openSpyReport = (report: SpyReport) => {
    selectedSpyReport.value = report
    showSpyDialog.value = true
    markMessageRead('spyReports', report.id)
  }

  // 删除战斗报告
  const deleteBattleReport = (reportId: string) => {
    removeMessage('battleReports', reportId)
  }

  // 删除间谍报告
  const deleteSpyReport = (reportId: string) => {
    removeMessage('spyReports', reportId)
  }

  // 获取任务类型名称
  const getMissionTypeName = (missionType: string): string => {
    const typeMap: Record<string, string> = {
      [MissionType.Attack]: t('fleetView.attack'),
      [MissionType.Transport]: t('fleetView.transport'),
      [MissionType.Colonize]: t('fleetView.colonize'),
      [MissionType.Spy]: t('fleetView.spy'),
      [MissionType.Deploy]: t('fleetView.deploy'),
      [MissionType.Expedition]: t('fleetView.expedition'),
      [MissionType.Recycle]: t('fleetView.recycle'),
      [MissionType.Destroy]: t('fleetView.destroy'),
      [MissionType.MissileAttack]: t('galaxyView.missileAttack'),
      [MissionType.HarvestDarkMatter]: t('fleetView.harvestDarkMatter'),
      [MissionType.Station]: t('fleetView.station')
    }
    return typeMap[missionType] || missionType
  }

  // 打开任务报告
  const openMissionReport = (report: MissionReport) => {
    markMessageRead('missionReports', report.id)
    // 设置选中的报告并打开详情对话框
    selectedMissionReport.value = report
    showMissionDialog.value = true
  }

  // 删除任务报告
  const deleteMissionReport = (reportId: string) => {
    removeMessage('missionReports', reportId)
  }
</script>
