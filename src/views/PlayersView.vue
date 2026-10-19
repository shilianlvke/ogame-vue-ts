<template>
  <div class="container mx-auto p-3 sm:p-6">
    <!-- 单机 / 未连接 -->
    <div v-if="!netStore.isOnline" class="mx-auto mt-10 max-w-xl">
      <Card>
        <CardContent class="flex flex-col items-center gap-4 py-10 text-center">
          <MessageCircle class="h-12 w-12 text-muted-foreground" />
          <div class="space-y-1">
            <h2 class="text-xl font-semibold">{{ t('players.onlineOnly') }}</h2>
            <p class="text-sm text-muted-foreground">{{ t('players.onlineOnlyDesc') }}</p>
          </div>
          <Button @click="router.push('/')">{{ t('players.backHome') }}</Button>
        </CardContent>
      </Card>
    </div>

    <div v-else class="grid gap-4 lg:h-[calc(100vh-9rem)] lg:grid-cols-[280px_minmax(0,1fr)]">
      <!-- 联系人 -->
      <Card class="flex min-h-[320px] flex-col overflow-hidden lg:min-h-0">
        <CardHeader class="shrink-0 pb-2">
          <CardTitle class="flex items-center justify-between gap-2 text-base">
            <span class="flex items-center gap-2">
              <Users class="h-4 w-4 text-primary" />
              {{ t('nav.players') }}
            </span>
            <Badge variant="secondary" class="text-[10px]">
              {{ netStore.playerCount }} / {{ netStore.totalPlayerCount }}
            </Badge>
          </CardTitle>
          <CardDescription class="text-xs">{{ t('players.subtitle') }}</CardDescription>
        </CardHeader>
        <div class="shrink-0 border-y p-2">
          <div class="relative">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" class="pl-8" :placeholder="t('players.searchPlaceholder')" />
          </div>
        </div>
        <ScrollArea class="min-h-0 flex-1">
          <div class="space-y-1 p-2">
            <button
              v-for="player in filteredPlayers"
              :key="player.id"
              type="button"
              class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/70"
              :class="selectedPeerId === player.id ? 'bg-muted' : ''"
              :disabled="player.id === myId"
              @click="selectPeer(player)"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                :style="avatarStyle(player.id)"
              >
                {{ initials(player.name) }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5">
                  <span class="truncate text-sm font-medium">{{ player.name }}</span>
                  <Badge v-if="player.id === myId" variant="outline" class="h-4 px-1 text-[10px]">
                    {{ t('players.me') }}
                  </Badge>
                </span>
                <span
                  class="mt-0.5 flex items-center gap-1 text-[11px]"
                  :class="player.online ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="player.online ? 'bg-green-500' : 'bg-muted-foreground/50'" />
                  {{ player.online ? t('players.online') : t('players.offline') }}
                </span>
              </span>
              <Badge v-if="unreadCount(player) > 0" variant="destructive" class="h-4 min-w-4 px-1 text-[10px]">
                {{ unreadCount(player) > 99 ? '99+' : unreadCount(player) }}
              </Badge>
            </button>
            <p v-if="filteredPlayers.length === 0" class="px-2 py-8 text-center text-xs text-muted-foreground">
              {{ t('players.selectPlayer') }}
            </p>
          </div>
        </ScrollArea>
      </Card>

      <!-- 聊天窗口 -->
      <Card class="flex min-h-[420px] min-w-0 flex-col overflow-hidden lg:min-h-0">
        <template v-if="selectedPeer">
          <CardHeader class="shrink-0 border-b py-3">
            <CardTitle class="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                :style="avatarStyle(selectedPeer.id)"
              >
                {{ initials(selectedPeer.name) }}
              </span>
              <span class="truncate">{{ selectedPeer.name }}</span>
              <span
                class="flex items-center gap-1 text-xs font-normal"
                :class="selectedPeer.online ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'"
              >
                <span class="h-1.5 w-1.5 rounded-full" :class="selectedPeer.online ? 'bg-green-500' : 'bg-muted-foreground/50'" />
                {{ selectedPeer.online ? t('players.online') : t('players.offline') }}
              </span>
              <span class="ml-auto text-[11px] font-normal text-muted-foreground">
                {{ t('players.points') }} {{ formatNumber(selectedPeer.points) }} ·
                {{ t('players.planets') }} {{ selectedPeer.planetCount }}
              </span>
            </CardTitle>
          </CardHeader>

          <ScrollArea class="min-h-0 flex-1">
            <div class="space-y-3 p-4">
              <template v-for="item in timeline" :key="item.key">
                <!-- 普通私聊消息 -->
                <div
                  v-if="item.kind === 'message'"
                  class="flex"
                  :class="item.message.fromId === myId ? 'justify-end' : 'justify-start'"
                >
                  <div class="max-w-[78%]">
                    <div
                      class="rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words"
                      :class="item.message.fromId === myId ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted'"
                    >
                      {{ item.message.text }}
                    </div>
                    <div class="mt-1 text-[10px] text-muted-foreground" :class="item.message.fromId === myId ? 'text-right' : ''">
                      {{ formatMessageTime(item.message.timestamp) }}
                    </div>
                  </div>
                </div>

                <!-- 交易卡片 -->
                <div v-else class="flex" :class="item.trade.fromId === myId ? 'justify-end' : 'justify-start'">
                  <div
                    class="w-full max-w-[320px] cursor-pointer rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-muted/30"
                    @click="openTradeDetail(item.trade)"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-1.5 text-xs font-semibold">
                        <ArrowLeftRight class="h-3.5 w-3.5 text-primary" />
                        {{ t('players.tradeTitle') }}
                      </div>
                      <Badge :variant="tradeStatusVariant(item.trade)" class="h-4 px-1.5 text-[10px]">
                        {{ tradeStatusLabel(item.trade) }}
                      </Badge>
                    </div>

                    <div class="mt-2 space-y-1 text-[11px]">
                      <div class="flex justify-between gap-2">
                        <span class="text-muted-foreground">{{ t('players.tradeOffer') }}</span>
                        <span class="text-right">{{ resourceSummary(item.trade.offer) }}</span>
                      </div>
                      <div class="flex justify-between gap-2">
                        <span class="text-muted-foreground">{{ t('players.tradeRequest') }}</span>
                        <span class="text-right">{{ resourceSummary(item.trade.request) }}</span>
                      </div>
                      <div class="flex justify-between gap-2 text-[10px] text-muted-foreground">
                        <span>{{ t('players.tradeLossLabel') }}</span>
                        <span class="text-amber-600 dark:text-amber-400">{{ item.trade.lossPercent ?? 0 }}%</span>
                      </div>
                    </div>

                    <div class="mt-2 flex items-center justify-between gap-2">
                      <span class="text-[10px] text-muted-foreground">{{ formatMessageTime(item.trade.createdAt) }}</span>
                      <span class="text-[10px] text-primary">{{ t('players.tradeViewDetails') }}</span>
                    </div>

                    <div
                      v-if="isIncomingPending(item.trade) || isOutgoingPending(item.trade)"
                      class="mt-2 flex gap-2 border-t pt-2"
                    >
                      <template v-if="isIncomingPending(item.trade)">
                        <Button
                          size="sm"
                          variant="outline"
                          class="h-7 flex-1 px-2 text-[11px]"
                          :disabled="!myTradeStatus.unlocked"
                          @click.stop="respondTrade(item.trade, 'decline')"
                        >
                          {{ t('players.tradeDecline') }}
                        </Button>
                        <Button
                          size="sm"
                          class="h-7 flex-1 px-2 text-[11px]"
                          :disabled="!myTradeStatus.unlocked"
                          @click.stop="respondTrade(item.trade, 'accept')"
                        >
                          {{ t('players.tradeAccept') }}
                        </Button>
                      </template>
                      <Button
                        v-else
                        size="sm"
                        variant="outline"
                        class="h-7 px-2 text-[11px]"
                        @click.stop="cancelTrade(item.trade)"
                      >
                        {{ t('players.tradeCancel') }}
                      </Button>
                    </div>
                  </div>
                </div>
              </template>

              <p v-if="timeline.length === 0" class="py-10 text-center text-xs text-muted-foreground">
                {{ t('players.noMessages') }}
              </p>
              <div ref="bottomRef" />
            </div>
          </ScrollArea>

          <!-- 输入框上方工具栏：交易是第一个功能，后续可继续加图标 -->
          <div class="shrink-0 border-t">
            <div class="flex items-center gap-1 px-3 pt-2">
              <Button
                variant="ghost"
                size="sm"
                class="h-8 gap-1.5 px-2 text-xs"
                :title="t('players.tradeTitle')"
                :disabled="!tradeAvailable"
                @click="openTradeDialog"
              >
                <ArrowLeftRight class="h-4 w-4" />
                {{ t('players.tradeTitle') }}
              </Button>
              <span v-if="selectedPeer && !tradeAvailable" class="text-[10px] text-amber-600 dark:text-amber-400">
                {{
                  !myTradeStatus.unlocked
                    ? t('players.tradeLockedHint', {
                        building: t('buildings.spaceport'),
                        tech: t('technologies.hyperspaceTransfer')
                      })
                    : t('players.tradeTargetLockedHint', { name: selectedPeer.name })
                }}
              </span>
            </div>
            <div class="flex gap-2 p-3 pt-2">
              <Input
                v-model="draft"
                :maxlength="MAX_CHAT_LENGTH"
                :placeholder="t('players.messagePlaceholder')"
                @keydown.enter.prevent="send"
              />
              <Button size="icon" :disabled="!canSend" @click="send">
                <Send class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </template>

        <div v-else class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <MessageCircle class="h-10 w-10 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">{{ t('players.selectPlayer') }}</p>
        </div>
      </Card>
    </div>

    <!-- 发起交易弹框 -->
    <Dialog v-model:open="tradeDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('players.tradeTitle') }}</DialogTitle>
          <DialogDescription>
            {{ selectedPeer ? t('players.tradeWith', { name: selectedPeer.name }) : '' }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <div class="flex items-center gap-1.5 text-sm font-medium">
              <ArrowLeftRight class="h-4 w-4 text-primary" />
              {{ t('players.tradeOffer') }}
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div v-for="resourceType in tradeResourceTypes" :key="`offer-${resourceType}`" class="space-y-1">
                <div class="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ResourceIcon :type="resourceType" size="sm" />
                  {{ t(`resources.${resourceType}`) }}
                </div>
                <Input v-model.number="tradeOffer[resourceType]" type="number" min="0" step="1" />
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center gap-1.5 text-sm font-medium">
              <ArrowLeftRight class="h-4 w-4 rotate-180 text-primary" />
              {{ t('players.tradeRequest') }}
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div v-for="resourceType in tradeResourceTypes" :key="`request-${resourceType}`" class="space-y-1">
                <div class="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ResourceIcon :type="resourceType" size="sm" />
                  {{ t(`resources.${resourceType}`) }}
                </div>
                <Input v-model.number="tradeRequest[resourceType]" type="number" min="0" step="1" />
              </div>
            </div>
          </div>

          <div class="space-y-1 rounded-lg bg-muted/50 p-3 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="text-muted-foreground">{{ t('players.tradeLossLabel') }}</span>
              <span class="font-medium text-amber-600 dark:text-amber-400">{{ tradeLossPercent }}%</span>
            </div>
            <p class="text-[11px] text-muted-foreground">
              {{ t('players.tradeLossHint', { building: myTradeStatus.spaceportLevel, tech: myTradeStatus.techLevel }) }}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="tradeDialogOpen = false">{{ t('common.cancel') }}</Button>
          <Button :disabled="!tradeFormValid" @click="sendTradeOffer">
            <ArrowLeftRight class="mr-2 h-4 w-4" />
            {{ t('players.tradeSend') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 交易详情弹框 -->
    <Dialog v-model:open="tradeDetailOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('players.tradeDetails') }}</DialogTitle>
          <DialogDescription>
            {{ selectedTrade ? t('players.tradeWith', { name: tradePartnerName(selectedTrade) }) : '' }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="selectedTrade" class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium">{{ selectedTrade.fromName }} → {{ selectedTrade.toName }}</span>
            <Badge :variant="tradeStatusVariant(selectedTrade)">{{ tradeStatusLabel(selectedTrade) }}</Badge>
          </div>

          <div class="grid gap-2 text-sm">
            <div class="rounded-lg bg-muted/50 p-3">
              <div class="mb-1 text-muted-foreground">{{ t('players.tradeOffer') }}</div>
              <div>{{ resourceSummary(selectedTrade.offer) }}</div>
            </div>
            <div class="rounded-lg bg-muted/50 p-3">
              <div class="mb-1 text-muted-foreground">{{ t('players.tradeRequest') }}</div>
              <div>{{ resourceSummary(selectedTrade.request) }}</div>
            </div>
            <div class="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-xs">
              <span class="text-muted-foreground">{{ t('players.tradeLossLabel') }}</span>
              <span class="font-medium text-amber-600 dark:text-amber-400">
                {{ selectedTrade.lossPercent ?? 0 }}%
              </span>
            </div>
          </div>

          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ formatDateTime(selectedTrade.createdAt) }}</span>
            <span>{{ formatDateTime(selectedTrade.expiresAt) }}</span>
          </div>

          <p v-if="isIncomingPending(selectedTrade)" class="text-xs text-muted-foreground">
            {{ t('players.tradePendingIncoming') }}
          </p>
          <p v-else-if="isOutgoingPending(selectedTrade)" class="text-xs text-muted-foreground">
            {{ t('players.tradePendingOutgoing') }}
          </p>
        </div>

        <DialogFooter class="flex-wrap">
          <Button variant="outline" @click="tradeDetailOpen = false">{{ t('common.close') }}</Button>
          <template v-if="selectedTrade && isIncomingPending(selectedTrade)">
            <Button
              variant="outline"
              :disabled="!myTradeStatus.unlocked"
              @click="respondTrade(selectedTrade, 'decline')"
            >
              {{ t('players.tradeDecline') }}
            </Button>
            <Button :disabled="!myTradeStatus.unlocked" @click="respondTrade(selectedTrade, 'accept')">
              {{ t('players.tradeAccept') }}
            </Button>
          </template>
          <Button
            v-else-if="selectedTrade && isOutgoingPending(selectedTrade)"
            variant="outline"
            @click="cancelTrade(selectedTrade)"
          >
            {{ t('players.tradeCancel') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, reactive, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { ArrowLeftRight, MessageCircle, Search, Send, Users } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
  } from '@/components/ui/dialog'
  import { Input } from '@/components/ui/input'
  import { ScrollArea } from '@/components/ui/scroll-area'
  import ResourceIcon from '@/components/common/ResourceIcon.vue'
  import { useGameStore } from '@/stores/gameStore'
  import { useNetStore } from '@/stores/netStore'
  import { useI18n } from '@/composables/useI18n'
  import { dispatchCommand } from '@/core/runtime'
  import { MAX_CHAT_LENGTH } from '@/core/commands'
  import { emptyTradeResources, getPlayerTradeStatus } from '@/logic/playerTradeLogic'
  import { formatNumber } from '@/utils/format'
  import { toast } from 'vue-sonner'
  import type { PlayerPublicProfile } from '@/core/protocol'
  import type { ChatMessage, PlayerTradeOffer, PlayerTradeResources } from '@/types/game'

  const router = useRouter()
  const gameStore = useGameStore()
  const netStore = useNetStore()
  const { t } = useI18n()

  const myId = computed(() => netStore.playerId || gameStore.player.id)
  const search = ref('')
  const selectedPeerId = ref<string | null>(null)
  const draft = ref('')
  const cooling = ref(false)
  const bottomRef = ref<HTMLElement | null>(null)
  const readAt = ref<Record<string, number>>({})

  const tradeResourceTypes = ['metal', 'crystal', 'deuterium'] as const
  const tradeOffer = reactive<PlayerTradeResources>(emptyTradeResources())
  const tradeRequest = reactive<PlayerTradeResources>(emptyTradeResources())
  const tradeDialogOpen = ref(false)
  const tradeDetailOpen = ref(false)
  const selectedTradeId = ref<string | null>(null)

  const players = computed(() =>
    [...netStore.players].sort(
      (a, b) => Number(b.online) - Number(a.online) || b.points - a.points || a.name.localeCompare(b.name)
    )
  )

  const filteredPlayers = computed(() => {
    const keyword = search.value.trim().toLowerCase()
    if (!keyword) return players.value
    return players.value.filter(
      player => player.name.toLowerCase().includes(keyword) || player.id.toLowerCase().includes(keyword)
    )
  })

  const selectedPeer = computed(() => players.value.find(player => player.id === selectedPeerId.value) ?? null)
  const myTradeStatus = computed(() => getPlayerTradeStatus(gameStore.player))
  const tradeAvailable = computed(
    () => myTradeStatus.value.unlocked && selectedPeer.value?.tradeUnlocked === true
  )
  const tradeLossPercent = computed(() =>
    Math.max(myTradeStatus.value.lossPercent, selectedPeer.value?.tradeLossPercent ?? 0)
  )
  const chatMessages = computed(() => gameStore.player.chatMessages ?? [])
  const playerTrades = computed(() => gameStore.player.playerTrades ?? [])

  const privateMessages = computed(() => {
    const peerId = selectedPeerId.value
    if (!peerId) return []
    return chatMessages.value
      .filter(
        message =>
          !!message.toId &&
          ((message.fromId === myId.value && message.toId === peerId) ||
            (message.fromId === peerId && message.toId === myId.value))
      )
      .sort((a, b) => a.timestamp - b.timestamp)
  })

  const tradesWithPeer = computed(() => {
    const peerId = selectedPeerId.value
    if (!peerId) return []
    return playerTrades.value.filter(
      trade =>
        (trade.fromId === myId.value && trade.toId === peerId) ||
        (trade.fromId === peerId && trade.toId === myId.value)
    )
  })

  type TimelineItem =
    | { kind: 'message'; key: string; timestamp: number; message: ChatMessage }
    | { kind: 'trade'; key: string; timestamp: number; trade: PlayerTradeOffer }

  const timeline = computed<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...privateMessages.value.map<TimelineItem>(message => ({
        kind: 'message',
        key: `message-${message.id}`,
        timestamp: message.timestamp,
        message
      })),
      ...tradesWithPeer.value.map<TimelineItem>(trade => ({
        kind: 'trade',
        key: `trade-${trade.id}`,
        timestamp: trade.createdAt,
        trade
      }))
    ]
    return items.sort((a, b) => a.timestamp - b.timestamp)
  })

  const selectedTrade = computed(
    () => playerTrades.value.find(trade => trade.id === selectedTradeId.value) ?? null
  )

  const tradeFormValid = computed(() => {
    const total = tradeResourceTypes.reduce(
      (sum, resourceType) =>
        sum + (Number(tradeOffer[resourceType]) || 0) + (Number(tradeRequest[resourceType]) || 0),
      0
    )
    return total > 0
  })

  const canSend = computed(
    () => netStore.isOnline && !!selectedPeer.value && draft.value.trim().length > 0 && !cooling.value
  )

  const selectPeer = (player: PlayerPublicProfile): void => {
    if (player.id === myId.value) return
    selectedPeerId.value = player.id
    readAt.value[player.id] = Date.now()
    void scrollToBottom()
  }

  const unreadCount = (player: PlayerPublicProfile): number => {
    if (player.id === myId.value) return 0
    const since = readAt.value[player.id] ?? 0
    const unreadMessages = chatMessages.value.filter(
      message => message.fromId === player.id && message.toId === myId.value && message.timestamp > since
    ).length
    const unreadTrades = playerTrades.value.filter(
      trade =>
        trade.fromId === player.id &&
        trade.toId === myId.value &&
        trade.createdAt > since &&
        trade.status === 'pending'
    ).length
    return unreadMessages + unreadTrades
  }

  const avatarStyle = (id: string): Record<string, string> => {
    let hash = 0
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360
    return { backgroundColor: `hsl(${hash} 55% 42%)` }
  }

  const initials = (name: string): string => (name.trim().slice(0, 2) || '?').toUpperCase()

  const formatMessageTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const formatDateTime = (timestamp: number): string => new Date(timestamp).toLocaleString()

  const scrollToBottom = async (): Promise<void> => {
    await nextTick()
    bottomRef.value?.scrollIntoView({ block: 'end' })
  }

  const send = (): void => {
    const peer = selectedPeer.value
    const text = draft.value.trim()
    if (!peer || !text || cooling.value) return

    const result = dispatchCommand({ type: 'chat.send', text, toPlayerId: peer.id })
    if (!result.ok) {
      toast.error(t(result.reason ?? 'errors.unknown'))
      return
    }

    draft.value = ''
    cooling.value = true
    readAt.value[peer.id] = Date.now()
    window.setTimeout(() => {
      cooling.value = false
    }, 1100)
    void scrollToBottom()
  }

  const openTradeDialog = (): void => {
    if (!selectedPeer.value) return
    if (!myTradeStatus.value.unlocked) {
      toast.error(t('players.tradeLocked'))
      return
    }
    if (selectedPeer.value.tradeUnlocked !== true) {
      toast.error(t('players.tradeTargetLocked'))
      return
    }
    Object.assign(tradeOffer, emptyTradeResources())
    Object.assign(tradeRequest, emptyTradeResources())
    tradeDialogOpen.value = true
  }

  const resourceSummary = (resources: PlayerTradeResources): string => {
    const parts: string[] = []
    if (resources.metal > 0) parts.push(`${t('resources.metal')} ${formatNumber(resources.metal)}`)
    if (resources.crystal > 0) parts.push(`${t('resources.crystal')} ${formatNumber(resources.crystal)}`)
    if (resources.deuterium > 0) parts.push(`${t('resources.deuterium')} ${formatNumber(resources.deuterium)}`)
    return parts.length > 0 ? parts.join(' · ') : '-'
  }

  const sendTradeOffer = (): void => {
    const peer = selectedPeer.value
    if (!peer || !tradeFormValid.value) return
    if (!tradeAvailable.value) {
      toast.error(t('players.tradeLocked'))
      return
    }

    const result = dispatchCommand({
      type: 'player.trade.create',
      toPlayerId: peer.id,
      offer: { ...tradeOffer },
      request: { ...tradeRequest }
    })
    if (!result.ok) {
      toast.error(t(result.reason ?? 'errors.unknown'))
      return
    }

    toast.success(t('players.tradeSent'))
    tradeDialogOpen.value = false
    void scrollToBottom()
  }

  const isIncomingPending = (trade: PlayerTradeOffer): boolean =>
    trade.toId === myId.value && trade.status === 'pending' && trade.expiresAt > Date.now()

  const isOutgoingPending = (trade: PlayerTradeOffer): boolean =>
    trade.fromId === myId.value && trade.status === 'pending' && trade.expiresAt > Date.now()

  const respondTrade = (trade: PlayerTradeOffer, action: 'accept' | 'decline'): void => {
    const result = dispatchCommand({ type: 'player.trade.respond', offerId: trade.id, action })
    if (!result.ok) {
      toast.error(t(result.reason ?? 'errors.unknown'))
      return
    }
    tradeDetailOpen.value = false
  }

  const cancelTrade = (trade: PlayerTradeOffer): void => {
    const result = dispatchCommand({ type: 'player.trade.cancel', offerId: trade.id })
    if (!result.ok) {
      toast.error(t(result.reason ?? 'errors.unknown'))
      return
    }
    tradeDetailOpen.value = false
  }

  const openTradeDetail = (trade: PlayerTradeOffer): void => {
    selectedTradeId.value = trade.id
    tradeDetailOpen.value = true
  }

  const tradePartnerName = (trade: PlayerTradeOffer): string =>
    trade.fromId === myId.value ? trade.toName : trade.fromName

  const tradeStatusLabel = (trade: PlayerTradeOffer): string => {
    if (trade.status === 'pending' && trade.expiresAt <= Date.now()) return t('players.tradeExpired')
    switch (trade.status) {
      case 'pending':
        return trade.toId === myId.value
          ? t('players.tradePendingIncoming')
          : t('players.tradePendingOutgoing')
      case 'accepted':
        return t('players.tradeAccepted')
      case 'declined':
        return t('players.tradeDeclined')
      case 'cancelled':
        return t('players.tradeCancelled')
      default:
        return t('players.tradeExpired')
    }
  }

  const tradeStatusVariant = (trade: PlayerTradeOffer): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (trade.status === 'accepted') return 'default'
    if (trade.status === 'declined') return 'destructive'
    if (trade.status === 'pending' && trade.expiresAt > Date.now()) return 'secondary'
    return 'outline'
  }

  watch(
    () => netStore.players,
    list => {
      if (selectedPeerId.value && !list.some(player => player.id === selectedPeerId.value)) {
        selectedPeerId.value = null
      }
      if (!selectedPeerId.value) {
        const first =
          list.find(player => player.id !== myId.value && player.online) ??
          list.find(player => player.id !== myId.value)
        if (first) selectPeer(first)
      }
    },
    { immediate: true }
  )

  watch(
    () => timeline.value.length,
    () => {
      if (!selectedPeerId.value) return
      readAt.value[selectedPeerId.value] = Date.now()
      void scrollToBottom()
    }
  )
</script>
