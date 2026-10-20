<template>
  <!-- 右下角入口 -->
  <Button variant="outline" size="icon" class="relative" :title="t('chat.title')" @click="open = !open">
    <MessageCircle class="h-4 w-4" />
    <Badge
      v-if="unread > 0"
      variant="destructive"
      class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center p-0 text-xs animate-pulse"
    >
      {{ unread > 9 ? '9+' : unread }}
    </Badge>
  </Button>

  <!-- 玩家 + 银河频道浮框 -->
  <Teleport to="body">
    <Transition name="chat-dock">
      <div
        v-if="open"
        class="fixed bottom-4 right-4 z-50 flex flex-col overflow-hidden rounded-xl border bg-card shadow-2xl"
        :style="panelStyle"
      >
        <!-- 标题栏 -->
        <div class="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <div class="flex min-w-0 items-center gap-2">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <MessageCircle class="h-4 w-4 text-primary" />
            </div>
            <div class="min-w-0">
              <h3 class="truncate text-sm font-semibold">{{ t('chat.title') }}</h3>
              <p class="truncate text-[11px] text-muted-foreground">{{ t('chat.groupHint') }}</p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Badge variant="secondary" class="text-[10px]">{{ t('chat.channel') }}</Badge>
            <Badge variant="outline" class="text-[10px]">{{ netStore.playerCount }}/{{ netStore.totalPlayerCount }}</Badge>
            <Button variant="ghost" size="icon" class="h-7 w-7" :title="t('common.close')" @click="open = false">
              <X class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <!-- 移动端玩家列表（默认折叠，给聊天留空间） -->
        <div class="shrink-0 border-b sm:hidden">
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-2 text-xs font-medium"
            @click="mobileRosterOpen = !mobileRosterOpen"
          >
            <span class="flex items-center gap-2">
              <Users class="h-4 w-4" />
              {{ t('nav.players') }}
              <Badge variant="secondary" class="text-[10px]">{{ netStore.playerCount }}/{{ netStore.totalPlayerCount }}</Badge>
            </span>
            <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': mobileRosterOpen }" />
          </button>
          <div v-if="mobileRosterOpen" class="h-40 overflow-hidden border-t">
            <PlayerRoster
              :players="players"
              :my-id="myId"
              :selected-id="selectedPlayerId"
              class="h-full"
              @select="mentionPlayer"
            />
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col sm:flex-row">
          <!-- 桌面端玩家列表 -->
          <aside class="hidden w-72 shrink-0 flex-col border-r sm:flex">
            <div class="flex shrink-0 items-center justify-between px-3 pb-1 pt-3">
              <span class="flex items-center gap-1.5 text-xs font-semibold">
                <Users class="h-3.5 w-3.5" />
                {{ t('nav.players') }}
              </span>
              <Badge variant="secondary" class="text-[10px]">{{ netStore.playerCount }}/{{ netStore.totalPlayerCount }}</Badge>
            </div>
            <PlayerRoster
              :players="players"
              :my-id="myId"
              :selected-id="selectedPlayerId"
              class="min-h-0 flex-1"
              @select="mentionPlayer"
            />
          </aside>

          <!-- 银河频道群聊 -->
          <section class="flex min-h-0 min-w-0 flex-1 flex-col">
            <ScrollArea class="min-h-0 flex-1">
              <div class="space-y-3 p-4">
                <template v-for="message in messages" :key="message.id">
                  <div class="flex" :class="message.fromId === myId ? 'justify-end' : 'justify-start'">
                    <div class="max-w-[80%]">
                      <div
                        class="mb-1 flex items-baseline gap-2 text-[11px] text-muted-foreground"
                        :class="message.fromId === myId ? 'justify-end' : ''"
                      >
                        <span class="font-medium text-foreground/80">{{ message.fromName }}</span>
                        <span>{{ formatTime(message.timestamp) }}</span>
                      </div>
                      <div
                        class="whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm"
                        :class="message.fromId === myId ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted'"
                      >
                        {{ message.text }}
                      </div>
                    </div>
                  </div>
                </template>
                <p v-if="messages.length === 0" class="py-10 text-center text-xs text-muted-foreground">
                  {{ t('chat.empty') }}
                </p>
                <div ref="bottomRef" />
              </div>
            </ScrollArea>

            <!-- 工具栏 + 输入框 -->
            <div class="shrink-0 border-t">
              <div class="flex flex-wrap items-center gap-2 px-3 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 cursor-not-allowed gap-1.5 px-2 text-xs opacity-50"
                  disabled
                  :title="t('chat.tradeDisabled')"
                >
                  <ArrowLeftRight class="h-4 w-4" />
                  {{ t('players.tradeTitle') }}
                </Button>
                <span class="text-[10px] text-muted-foreground">{{ t('chat.tradeDisabled') }}</span>
                <span v-if="!netStore.isOnline" class="ml-auto text-[10px] text-amber-600 dark:text-amber-400">
                  {{ t('chat.offline') }}
                </span>
              </div>
              <div class="flex gap-2 p-3 pt-2">
                <Input
                  ref="inputRef"
                  v-model="draft"
                  :maxlength="MAX_CHAT_LENGTH"
                  :placeholder="t('chat.placeholder')"
                  @keydown.enter.prevent="send"
                />
                <Button size="icon" :disabled="!canSend" @click="send">
                  <Send class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
  import { useRoute } from 'vue-router'
  import { ArrowLeftRight, ChevronDown, MessageCircle, Send, Users, X } from 'lucide-vue-next'
  import { toast } from 'vue-sonner'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { ScrollArea } from '@/components/ui/scroll-area'
  import PlayerRoster from '@/components/chat/PlayerRoster.vue'
  import { useGameStore } from '@/stores/gameStore'
  import { useNetStore } from '@/stores/netStore'
  import { useI18n } from '@/composables/useI18n'
  import { MAX_CHAT_LENGTH } from '@/core/commands'
  import { dispatchCommand } from '@/core/runtime'
  import type { PlayerPublicProfile } from '@/core/protocol'

  const route = useRoute()
  const gameStore = useGameStore()
  const netStore = useNetStore()
  const { t } = useI18n()

  // 旧 /players 入口会带 chat=1 跳转过来，直接展开浮框
  const open = ref(route.query.chat === '1')
  const mobileRosterOpen = ref(false)
  const draft = ref('')
  const cooling = ref(false)
  const lastSeenAt = ref(Date.now())
  const selectedPlayerId = ref<string | null>(null)
  const bottomRef = ref<HTMLElement | null>(null)
  const inputRef = ref<ComponentPublicInstance | null>(null)

  const panelStyle = {
    width: 'min(920px, calc(100vw - 2rem))',
    height: 'min(560px, calc(100svh - 6rem))'
  }

  const myId = computed(() => netStore.playerId || gameStore.player.id)

  // 玩家列表：在线优先，其次按积分和昵称排序
  const players = computed(() =>
    [...netStore.players].sort(
      (a, b) => Number(b.online) - Number(a.online) || b.points - a.points || a.name.localeCompare(b.name)
    )
  )

  // 只显示银河公共频道；私聊与交易不再出现在浮框中
  const messages = computed(() =>
    (gameStore.player.chatMessages ?? []).filter(message => !message.toId).slice(-60)
  )

  const unread = computed(() => {
    if (open.value) return 0
    return messages.value.filter(message => message.fromId !== myId.value && message.timestamp > lastSeenAt.value).length
  })

  const canSend = computed(
    () => netStore.isOnline && draft.value.trim().length > 0 && !cooling.value
  )

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const scrollToBottom = async (): Promise<void> => {
    await nextTick()
    bottomRef.value?.scrollIntoView({ block: 'end' })
  }

  const focusInput = (): void => {
    const el = inputRef.value?.$el
    if (el instanceof HTMLInputElement) el.focus()
  }

  // 点击玩家：插入 @昵称，群聊里用于点名
  const mentionPlayer = (player: PlayerPublicProfile): void => {
    if (player.id === myId.value) return
    selectedPlayerId.value = player.id
    const token = `@${player.name} `
    if (!draft.value.trim()) {
      draft.value = token
    } else {
      draft.value = draft.value.endsWith(' ') ? `${draft.value}${token}` : `${draft.value} ${token}`
    }
    void nextTick(focusInput)
  }

  const send = (): void => {
    const text = draft.value.trim()
    if (!text || cooling.value) return
    if (!netStore.isOnline) {
      toast.error(t('chat.offline'))
      return
    }

    const result = dispatchCommand({ type: 'chat.send', text })
    if (!result.ok) {
      toast.error(t(result.reason ?? 'errors.unknown'))
      return
    }

    draft.value = ''
    cooling.value = true
    // 与服务端的 1 秒冷却对齐，避免点了没反应
    window.setTimeout(() => {
      cooling.value = false
    }, 1100)
    lastSeenAt.value = Date.now()
    void scrollToBottom()
  }

  // 打开面板即视为已读，并滚到最新
  watch(open, isOpen => {
    if (!isOpen) return
    lastSeenAt.value = Date.now()
    void scrollToBottom()
  })

  // 旧 /players 入口跳转时自动展开
  watch(
    () => route.query.chat,
    value => {
      if (value === '1') open.value = true
    }
  )

  watch(
    () => messages.value[messages.value.length - 1]?.id,
    () => {
      if (!open.value) return
      lastSeenAt.value = Date.now()
      void scrollToBottom()
    }
  )

  // 默认选中一名在线玩家，便于列表高亮
  watch(
    players,
    list => {
      if (selectedPlayerId.value && list.some(player => player.id === selectedPlayerId.value)) return
      selectedPlayerId.value = list.find(player => player.id !== myId.value && player.online)?.id ?? null
    },
    { immediate: true }
  )
</script>

<style scoped>
  .chat-dock-enter-active,
  .chat-dock-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .chat-dock-enter-from,
  .chat-dock-leave-to {
    opacity: 0;
    transform: translateY(8px);
  }
</style>
