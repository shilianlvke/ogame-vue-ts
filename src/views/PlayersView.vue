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

    <div
      v-else
      class="grid gap-4 lg:h-[calc(100vh-9rem)] lg:grid-cols-[260px_minmax(0,1fr)_300px]"
    >
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
                <span class="mt-0.5 flex items-center gap-1 text-[11px]" :class="player.online ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'">
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
            <CardTitle class="flex items-center gap-2 text-base">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                :style="avatarStyle(selectedPeer.id)"
              >
                {{ initials(selectedPeer.name) }}
              </span>
              <span class="truncate">{{ selectedPeer.name }}</span>
              <span class="flex items-center gap-1 text-xs font-normal" :class="selectedPeer.online ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'">
                <span class="h-1.5 w-1.5 rounded-full" :class="selectedPeer.online ? 'bg-green-500' : 'bg-muted-foreground/50'" />
                {{ selectedPeer.online ? t('players.online') : t('players.offline') }}
              </span>
            </CardTitle>
          </CardHeader>

          <ScrollArea class="min-h-0 flex-1">
            <div class="space-y-3 p-4">
              <div
                v-for="message in privateMessages"
                :key="message.id"
                class="flex"
                :class="message.fromId === myId ? 'justify-end' : 'justify-start'"
              >
                <div class="max-w-[78%]">
                  <div
                    class="rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words"
                    :class="message.fromId === myId ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted'"
                  >
                    {{ message.text }}
                  </div>
                  <div class="mt-1 text-[10px] text-muted-foreground" :class="message.fromId === myId ? 'text-right' : ''">
                    {{ formatMessageTime(message.timestamp) }}
                  </div>
                </div>
              </div>
              <p v-if="privateMessages.length === 0" class="py-10 text-center text-xs text-muted-foreground">
                {{ t('players.noMessages') }}
              </p>
              <div ref="bottomRef" />
            </div>
          </ScrollArea>

          <div class="shrink-0 border-t p-3">
            <div class="flex gap-2">
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

      <!-- 玩家详情 / 交易 -->
      <Card class="flex min-h-[360px] flex-col overflow-hidden lg:min-h-0">
        <CardHeader class="shrink-0 pb-2">
          <CardTitle class="flex items-center gap-2 text-base">
            <ArrowLeftRight class="h-4 w-4 text-primary" />
            {{ t('players.tradeTitle') }}
          </CardTitle>
        </CardHeader>
        <ScrollArea class="min-h-0 flex-1">
          <div class="space-y-4 p-4">
            <template v-if="selectedPeer">
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-lg bg-muted/50 p-2">
                  <div class="text-muted-foreground">{{ t('players.points') }}</div>
                  <div class="font-medium">{{ formatNumber(selectedPeer.points) }}</div>
                </div>
                <div class="rounded-lg bg-muted/50 p-2">
                  <div class="text-muted-foreground">{{ t('players.planets') }}</div>
                  <div class="font-medium">{{ selectedPeer.planetCount }}</div>
                </div>
                <div class="col-span-2 rounded-lg bg-muted/50 p-2">
                  <div class="text-muted-foreground">{{ t('players.lastSeen') }}</div>
                  <div class="font-medium">{{ lastSeenText(selectedPeer) }}</div>
                </div>
              </div>

              <Separator />

              <div class="space-y-2">
                <div class="text-xs font-medium">{{ t('players.tradeOffer') }}</div>
                <div class="grid grid-cols-3 gap-1.5">
                  <Input v-model.number="tradeOffer.metal" type="number" min="0" step="1" placeholder="M" />
                  <Input v-model.number="tradeOffer.crystal" type="number" min="0" step="1" placeholder="C" />
                  <Input v-model.number="tradeOffer.deuterium" type="number" min="0" step="1" placeholder="D" />
                </div>
                <div class="text-xs font-medium">{{ t('players.tradeRequest') }}</div>
                <div class="grid grid-cols-3 gap-1.5">
                  <Input v-model.number="tradeRequest.metal" type="number" min="0" step="1" placeholder="M" />
                  <Input v-model.number="tradeRequest.crystal" type="number" min="0" step="1" placeholder="C" />
                  <Input v-model.number="tradeRequest.deuterium" type="number" min="0" step="1" placeholder="D" />
                </div>
                <Button class="w-full" size="sm" @click="sendTradeOffer">
                  <ArrowLeftRight class="mr-2 h-4 w-4" />
                  {{ t('players.tradeSend') }}
                </Button>
              </div>
            </template>
            <p v-else class="py-4 text-center text-xs text-muted-foreground">{{ t('players.selectPlayer') }}</p>

            <Separator />

            <div class="space-y-2">
              <div class="text-xs font-medium">{{ t('players.tradeIncoming') }}</div>
              <div v-for="trade in incomingTrades" :key="trade.id" class="space-y-2 rounded-lg border p-2 text-xs">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-medium">{{ trade.fromName }}</span>
                  <span class="text-[10px] text-muted-foreground">→ {{ t('players.me') }}</span>
                </div>
                <div class="text-[11px] text-muted-foreground">
                  {{ t('players.tradeOffer') }}: {{ resourceSummary(trade.offer) }}
                </div>
                <div class="text-[11px] text-muted-foreground">
                  {{ t('players.tradeRequest') }}: {{ resourceSummary(trade.request) }}
                </div>
                <div class="flex gap-2">
                  <Button size="sm" class="flex-1" @click="respondTrade(trade, 'accept')">{{ t('players.tradeAccept') }}</Button>
                  <Button size="sm" variant="outline" class="flex-1" @click="respondTrade(trade, 'decline')">{{ t('players.tradeDecline') }}</Button>
                </div>
              </div>
              <p v-if="incomingTrades.length === 0" class="text-[11px] text-muted-foreground">{{ t('players.tradeEmpty') }}</p>
            </div>

            <div class="space-y-2">
              <div class="text-xs font-medium">{{ t('players.tradeOutgoing') }}</div>
              <div v-for="trade in outgoingTrades" :key="trade.id" class="space-y-2 rounded-lg border p-2 text-xs">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-medium">{{ trade.toName }}</span>
                  <Button size="sm" variant="outline" class="h-6 px-2 text-[10px]" @click="cancelTrade(trade)">
                    {{ t('players.tradeCancel') }}
                  </Button>
                </div>
                <div class="text-[11px] text-muted-foreground">
                  {{ t('players.tradeOffer') }}: {{ resourceSummary(trade.offer) }}
                </div>
                <div class="text-[11px] text-muted-foreground">
                  {{ t('players.tradeRequest') }}: {{ resourceSummary(trade.request) }}
                </div>
              </div>
              <p v-if="outgoingTrades.length === 0" class="text-[11px] text-muted-foreground">{{ t('players.tradeEmpty') }}</p>
            </div>
          </div>
        </ScrollArea>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, reactive, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { ArrowLeftRight, MessageCircle, Search, Send, Users } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  import { Input } from '@/components/ui/input'
  import { ScrollArea } from '@/components/ui/scroll-area'
  import { Separator } from '@/components/ui/separator'
  import { useGameStore } from '@/stores/gameStore'
  import { useNetStore } from '@/stores/netStore'
  import { useI18n } from '@/composables/useI18n'
  import { dispatchCommand } from '@/core/runtime'
  import { MAX_CHAT_LENGTH } from '@/core/commands'
  import { emptyTradeResources } from '@/logic/playerTradeLogic'
  import { formatNumber } from '@/utils/format'
  import { toast } from 'vue-sonner'
  import type { PlayerPublicProfile } from '@/core/protocol'
  import type { PlayerTradeOffer, PlayerTradeResources } from '@/types/game'

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

  const tradeOffer = reactive<PlayerTradeResources>(emptyTradeResources())
  const tradeRequest = reactive<PlayerTradeResources>(emptyTradeResources())

  const players = computed(() =>
    [...netStore.players].sort(
      (a, b) => Number(b.online) - Number(a.online) || b.points - a.points || a.name.localeCompare(b.name)
    )
  )

  const filteredPlayers = computed(() => {
    const keyword = search.value.trim().toLowerCase()
    if (!keyword) return players.value
    return players.value.filter(player => player.name.toLowerCase().includes(keyword) || player.id.toLowerCase().includes(keyword))
  })

  const selectedPeer = computed(() => players.value.find(player => player.id === selectedPeerId.value) ?? null)

  const chatMessages = computed(() => gameStore.player.chatMessages ?? [])

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

  const pendingTrades = computed(() =>
    (gameStore.player.playerTrades ?? []).filter(
      trade => trade.status === 'pending' && trade.expiresAt > Date.now()
    )
  )
  const incomingTrades = computed(() => pendingTrades.value.filter(trade => trade.toId === myId.value))
  const outgoingTrades = computed(() => pendingTrades.value.filter(trade => trade.fromId === myId.value))

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
    return chatMessages.value.filter(
      message => message.fromId === player.id && message.toId === myId.value && message.timestamp > since
    ).length
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

  const lastSeenText = (player: PlayerPublicProfile): string => {
    if (player.online) return t('players.online')
    if (!player.lastSeenAt) return t('players.offline')
    return new Date(player.lastSeenAt).toLocaleString()
  }

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

  const resetTradeForm = (): void => {
    Object.assign(tradeOffer, emptyTradeResources())
    Object.assign(tradeRequest, emptyTradeResources())
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
    if (!peer) return
    const total =
      tradeOffer.metal + tradeOffer.crystal + tradeOffer.deuterium + tradeRequest.metal + tradeRequest.crystal + tradeRequest.deuterium
    if (total <= 0) {
      toast.error(t('players.tradeInvalid'))
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
    resetTradeForm()
  }

  const respondTrade = (trade: PlayerTradeOffer, action: 'accept' | 'decline'): void => {
    const result = dispatchCommand({ type: 'player.trade.respond', offerId: trade.id, action })
    if (!result.ok) toast.error(t(result.reason ?? 'errors.unknown'))
  }

  const cancelTrade = (trade: PlayerTradeOffer): void => {
    const result = dispatchCommand({ type: 'player.trade.cancel', offerId: trade.id })
    if (!result.ok) toast.error(t(result.reason ?? 'errors.unknown'))
  }

  watch(
    () => netStore.players,
    list => {
      if (selectedPeerId.value && !list.some(player => player.id === selectedPeerId.value)) {
        selectedPeerId.value = null
      }
      if (!selectedPeerId.value) {
        const first = list.find(player => player.id !== myId.value && player.online) ?? list.find(player => player.id !== myId.value)
        if (first) selectPeer(first)
      }
    },
    { immediate: true }
  )

  watch(
    () => privateMessages.value.length,
    () => {
      if (!selectedPeerId.value) return
      readAt.value[selectedPeerId.value] = Date.now()
      void scrollToBottom()
    }
  )
</script>
