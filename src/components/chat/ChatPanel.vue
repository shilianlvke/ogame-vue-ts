<template>
  <!-- 右下角入口 -->
  <Button variant="outline" size="icon" class="relative" :title="t('chat.title')" @click="open = !open">
    <MessageCircle class="h-4 w-4" />
    <Badge
      v-if="triggerUnread > 0"
      variant="destructive"
      class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center p-0 text-xs animate-pulse"
    >
      {{ triggerUnread > 9 ? '9+' : triggerUnread }}
    </Badge>
  </Button>

  <!-- QQ 风格：右下角玩家 + 银河频道浮框 -->
  <Teleport to="body">
    <Transition name="chat-dock">
      <div
        v-if="open"
        class="fixed bottom-4 right-4 z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl"
        :style="panelStyle"
      >
        <!-- 顶部标题栏 -->
        <div class="flex h-9 shrink-0 items-center justify-between bg-muted/60 px-3">
          <div class="flex min-w-0 items-center gap-2">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
              <Gamepad2 class="h-3 w-3" />
            </span>
            <span class="truncate text-xs font-medium text-foreground">{{ gameStore.player.name }}</span>
            <span class="flex shrink-0 items-center gap-1 text-[10px]" :class="netStore.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'">
              <span class="h-1.5 w-1.5 rounded-full" :class="netStore.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/50'" />
              {{ netStore.isOnline ? t('players.online') : t('players.offline') }}
            </span>
          </div>
          <div class="flex shrink-0 items-center gap-0.5">
            <button type="button" class="qq-titlebar-btn qq-mobile-only relative" :title="t('chat.title')" @click="showChat">
              <MessageCircle class="h-3.5 w-3.5" />
              <span v-if="groupUnread > 0" class="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-destructive" />
            </button>
            <button type="button" class="qq-titlebar-btn" :title="t('common.close')" @click="open = false">
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div class="flex min-h-0 flex-1">
          <!-- 左侧功能栏（桌面） -->
          <nav class="hidden w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-muted/60 py-2 sm:flex">
            <button
              type="button"
              class="rail-btn"
              :class="{ 'rail-btn-active': section === 'friends' }"
              :title="t('nav.players')"
              @click="selectRail('friends')"
            >
              <Users class="h-5 w-5" />
            </button>
            <button
              type="button"
              class="rail-btn relative"
              :class="{ 'rail-btn-active': section === 'groups' }"
              :title="t('chat.groups')"
              @click="selectRail('groups')"
            >
              <UsersRound class="h-5 w-5" />
              <span v-if="groupUnread > 0" class="rail-badge">{{ groupUnread > 9 ? '9+' : groupUnread }}</span>
            </button>
            <div class="mt-auto">
              <button type="button" class="rail-btn" disabled :title="t('chat.tradeDisabled')">
                <ArrowLeftRight class="h-5 w-5" />
              </button>
            </div>
          </nav>

          <!-- 好友 / 群聊列表 -->
          <aside
            class="w-full shrink-0 flex-col border-r border-border bg-muted/30 sm:flex sm:w-64"
            :class="mobilePane === 'list' ? 'flex' : 'hidden'"
          >
            <div class="shrink-0 p-2">
              <div class="relative">
                <Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  v-model="search"
                  class="h-8 border-border bg-background pl-8 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/60"
                  :placeholder="t('players.searchPlaceholder')"
                />
                <button
                  type="button"
                  class="absolute right-1.5 top-1.5 flex h-5 w-5 cursor-not-allowed items-center justify-center rounded text-muted-foreground/70"
                  disabled
                  :title="t('common.soon')"
                >
                  <Plus class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <!-- 好友 / 群聊切换 -->
            <div class="mx-2 mb-1 grid shrink-0 grid-cols-2 gap-1 rounded-md bg-card p-0.5 text-[11px]">
              <button
                type="button"
                class="rounded px-2 py-1 transition-colors"
                :class="section === 'friends' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="switchSection('friends')"
              >
                {{ t('nav.players') }}
                <span class="ml-0.5 text-[9px] text-muted-foreground">{{ players.length }}</span>
              </button>
              <button
                type="button"
                class="rounded px-2 py-1 transition-colors"
                :class="section === 'groups' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'"
                @click="switchSection('groups')"
              >
                {{ t('chat.groups') }}
                <span class="ml-0.5 text-[9px] text-muted-foreground">1</span>
              </button>
            </div>

            <!-- 玩家列表 -->
            <PlayerRoster
              v-if="section === 'friends'"
              :players="filteredPlayers"
              :my-id="myId"
              :selected-id="selectedPlayerId"
              :empty-key="rosterEmptyKey"
              class="min-h-0 flex-1"
              @select="openPlayerProfile"
            />

            <!-- 群聊列表 -->
            <ScrollArea v-else class="min-h-0 flex-1">
              <div class="space-y-0.5 p-1">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
                  :class="mainView === 'chat' ? 'bg-accent' : ''"
                  @click="showChat"
                >
                  <span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <UsersRound class="h-5 w-5 text-primary" />
                    <span v-if="groupUnread > 0" class="rail-badge">{{ groupUnread > 9 ? '9+' : groupUnread }}</span>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center justify-between gap-2">
                      <span class="truncate text-[13px] font-medium text-foreground">{{ t('chat.title') }}</span>
                      <span class="shrink-0 text-[10px] text-muted-foreground">{{ lastMessageTime }}</span>
                    </span>
                    <span class="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span class="truncate">{{ lastMessagePreview }}</span>
                    </span>
                  </span>
                </button>
                <p class="px-2 py-6 text-center text-[10px] text-muted-foreground/70">{{ t('chat.groupHint') }}</p>
              </div>
            </ScrollArea>
          </aside>

          <!-- 主区域 -->
          <section
            class="min-w-0 flex-1 flex-col bg-card sm:flex"
            :class="mobilePane === 'main' ? 'flex' : 'hidden'"
          >
            <!-- 玩家资料卡（QQ 资料页） -->
            <template v-if="mainView === 'profile' && selectedPlayer">
              <div class="flex h-11 shrink-0 items-center border-b border-border px-2">
                <button
                  type="button"
                  class="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  :title="t('common.back')"
                  @click="backFromProfile"
                >
                  <ChevronLeft class="h-4 w-4" />
                  {{ t('common.back') }}
                </button>
              </div>

              <div class="min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-10">
                <div class="flex flex-col items-center">
                  <div class="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/50 via-primary/15 to-transparent p-1">
                    <div
                      class="flex h-full w-full items-center justify-center rounded-full text-2xl font-semibold text-primary-foreground"
                      :style="avatarStyle(selectedPlayer.id)"
                    >
                      {{ initials(selectedPlayer.name) }}
                    </div>
                  </div>
                  <div class="mt-3 flex items-center gap-2">
                    <h2 class="max-w-[220px] truncate text-lg font-semibold text-foreground">{{ selectedPlayer.name }}</h2>
                    <span
                      class="rounded px-1.5 py-0.5 text-[10px]"
                      :class="selectedPlayer.online ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
                    >
                      {{ selectedPlayer.online ? t('players.online') : t('players.offline') }}
                    </span>
                  </div>
                  <p class="mt-1 max-w-full truncate text-[11px] text-muted-foreground">ID: {{ selectedPlayer.id }}</p>

                  <div class="mt-8 w-full max-w-sm space-y-1 text-sm">
                    <div class="flex items-center gap-3 border-b border-border py-3">
                      <Info class="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span class="w-14 shrink-0 text-muted-foreground">{{ t('players.profileIntro') }}</span>
                      <span class="min-w-0 flex-1 truncate text-foreground">
                        {{ t('players.commander') }} · {{ selectedPlayer.online ? t('players.online') : t('players.offline') }}
                      </span>
                    </div>
                    <div class="flex items-center gap-3 border-b border-border py-3">
                      <Coins class="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span class="w-14 shrink-0 text-muted-foreground">{{ t('players.points') }}</span>
                      <span class="min-w-0 flex-1 truncate text-foreground">{{ formatNumber(selectedPlayer.points) }}</span>
                    </div>
                    <div class="flex items-center gap-3 border-b border-border py-3">
                      <Globe class="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span class="w-14 shrink-0 text-muted-foreground">{{ t('players.planets') }}</span>
                      <span class="min-w-0 flex-1 truncate text-foreground">{{ selectedPlayer.planetCount }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-border p-3">
                <button type="button" class="profile-btn" disabled :title="t('common.soon')">
                  {{ t('players.share') }}
                </button>
                <button type="button" class="profile-btn" disabled :title="t('common.soon')">
                  {{ t('players.addToGroup') }}
                </button>
                <button type="button" class="profile-btn-primary" @click="messageSelectedPlayer">
                  {{ t('players.sendMessage') }}
                </button>
              </div>
            </template>

            <!-- 银河频道群聊 -->
            <template v-else>
              <div class="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
                <div class="flex min-w-0 items-center gap-2">
                  <button type="button" class="rail-btn qq-mobile-only" :title="t('common.back')" @click="openRoster">
                    <ChevronLeft class="h-5 w-5" />
                  </button>
                  <span class="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 sm:flex">
                    <UsersRound class="h-4 w-4 text-primary" />
                  </span>
                  <div class="min-w-0">
                    <div class="flex items-baseline gap-1">
                      <h3 class="truncate text-sm font-semibold text-foreground">{{ t('chat.title') }}</h3>
                      <span class="text-xs text-muted-foreground">({{ players.length }})</span>
                    </div>
                    <p class="truncate text-[10px] text-muted-foreground">
                      {{ onlineCount }} {{ t('players.online') }} · {{ t('chat.groupHint') }}
                    </p>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-0.5">
                  <button type="button" class="rail-btn" :title="t('nav.players')" @click="openRoster">
                    <Users class="h-4 w-4" />
                  </button>
                  <button type="button" class="rail-btn" disabled :title="t('common.soon')">
                    <Bell class="h-4 w-4" />
                  </button>
                  <button type="button" class="rail-btn" disabled :title="t('common.soon')">
                    <Settings class="h-4 w-4" />
                  </button>
                  <button type="button" class="rail-btn" disabled :title="t('common.soon')">
                    <MoreHorizontal class="h-4 w-4" />
                  </button>
                </div>
              </div>

              <ScrollArea class="min-h-0 flex-1">
                <div class="space-y-4 px-4 py-4">
                  <template v-for="message in messages" :key="message.id">
                    <div class="flex gap-2" :class="message.fromId === myId ? 'flex-row-reverse' : ''">
                      <span
                        class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-primary-foreground"
                        :style="avatarStyle(message.fromId)"
                      >
                        {{ initials(message.fromName) }}
                      </span>
                      <div class="min-w-0 max-w-[75%]">
                        <div
                          class="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground"
                          :class="message.fromId === myId ? 'justify-end' : ''"
                        >
                          <span class="text-muted-foreground">{{ message.fromName }}</span>
                          <span>{{ formatTime(message.timestamp) }}</span>
                        </div>
                        <div
                          class="whitespace-pre-wrap break-words rounded-md px-3 py-2 text-sm leading-relaxed"
                          :class="message.fromId === myId ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'"
                        >
                          {{ message.text }}
                        </div>
                      </div>
                    </div>
                  </template>
                  <p v-if="messages.length === 0" class="py-16 text-center text-xs text-muted-foreground">
                    {{ t('chat.empty') }}
                  </p>
                  <div ref="bottomRef" />
                </div>
              </ScrollArea>

              <div class="shrink-0 border-t border-border">
                <div class="flex flex-wrap items-center gap-1 px-2 pt-1.5">
                  <button type="button" class="trade-btn" disabled :title="t('chat.tradeDisabled')">
                    <ArrowLeftRight class="h-3.5 w-3.5" />
                    {{ t('players.tradeTitle') }}
                  </button>
                  <span class="mr-1 text-[10px] text-muted-foreground/70">{{ t('chat.tradeDisabled') }}</span>
                  <span class="mx-1 h-4 w-px bg-border" />
                  <button type="button" class="tool-btn" disabled :title="t('common.soon')"><Smile class="h-4 w-4" /></button>
                  <button type="button" class="tool-btn" disabled :title="t('common.soon')"><Scissors class="h-4 w-4" /></button>
                  <button type="button" class="tool-btn" disabled :title="t('common.soon')"><Folder class="h-4 w-4" /></button>
                  <button type="button" class="tool-btn" disabled :title="t('common.soon')"><ImageIcon class="h-4 w-4" /></button>
                  <button type="button" class="tool-btn" disabled :title="t('common.soon')"><Mic class="h-4 w-4" /></button>
                  <button type="button" class="tool-btn" disabled :title="t('common.soon')"><MessageSquare class="h-4 w-4" /></button>
                  <span v-if="!netStore.isOnline" class="ml-auto text-[10px] text-amber-600 dark:text-amber-400">{{ t('chat.offline') }}</span>
                </div>
                <div class="flex items-center gap-2 p-2">
                  <Input
                    ref="inputRef"
                    v-model="draft"
                    :maxlength="MAX_CHAT_LENGTH"
                    :placeholder="t('chat.placeholder')"
                    class="h-9 border-0 bg-muted text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
                    @keydown.enter.prevent="send"
                  />
                  <button type="button" class="chat-send-btn" :disabled="!canSend" @click="send">
                    {{ t('chat.send') }}
                    <ChevronDown class="h-3 w-3 opacity-70" />
                  </button>
                </div>
              </div>
            </template>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
  import { useRoute } from 'vue-router'
  import { useMediaQuery } from '@vueuse/core'
  import {
    ArrowLeftRight,
    Bell,
    ChevronDown,
    ChevronLeft,
    Coins,
    Folder,
    Gamepad2,
    Globe,
    Image as ImageIcon,
    Info,
    MessageCircle,
    MessageSquare,
    Mic,
    MoreHorizontal,
    Plus,
    Scissors,
    Search,
    Settings,
    Smile,
    Users,
    UsersRound,
    X
  } from 'lucide-vue-next'
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
  import { formatNumber } from '@/utils/format'
  import type { PlayerPublicProfile } from '@/core/protocol'

  type Section = 'friends' | 'groups'
  type MainView = 'chat' | 'profile'
  type MobilePane = 'list' | 'main'

  const route = useRoute()
  const gameStore = useGameStore()
  const netStore = useNetStore()
  const { t } = useI18n()
  const isMobile = useMediaQuery('(max-width: 639px)')

  // 旧 /players 入口会带 chat=1 跳转过来，直接展开浮框
  const open = ref(route.query.chat === '1')
  const section = ref<Section>('friends')
  const mainView = ref<MainView>('chat')
  const mobilePane = ref<MobilePane>('main')
  const search = ref('')
  const selectedPlayerId = ref<string | null>(null)
  const draft = ref('')
  const cooling = ref(false)
  const lastSeenAt = ref(Date.now())
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

  const filteredPlayers = computed(() => {
    const keyword = search.value.trim().toLowerCase()
    if (!keyword) return players.value
    return players.value.filter(
      player => player.name.toLowerCase().includes(keyword) || player.id.toLowerCase().includes(keyword)
    )
  })

  const rosterEmptyKey = computed(() => (players.value.length === 0 ? 'chat.noPlayers' : 'players.selectPlayer'))
  const selectedPlayer = computed(() => players.value.find(player => player.id === selectedPlayerId.value) ?? null)
  const onlineCount = computed(() => netStore.playerCount)

  // 只显示银河公共频道；私聊与交易不再出现在浮框中
  const messages = computed(() =>
    (gameStore.player.chatMessages ?? []).filter(message => !message.toId).slice(-80)
  )
  const lastMessage = computed(() => messages.value[messages.value.length - 1] ?? null)
  const lastMessagePreview = computed(() => lastMessage.value?.text ?? t('chat.empty'))
  const lastMessageTime = computed(() => (lastMessage.value ? formatTime(lastMessage.value.timestamp) : ''))

  const groupUnread = computed(
    () => messages.value.filter(message => message.fromId !== myId.value && message.timestamp > lastSeenAt.value).length
  )
  const triggerUnread = computed(() => (open.value ? 0 : groupUnread.value))
  const viewingGroup = computed(
    () => open.value && mainView.value === 'chat' && (!isMobile.value || mobilePane.value === 'main')
  )

  const canSend = computed(() => netStore.isOnline && draft.value.trim().length > 0 && !cooling.value)

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const avatarStyle = (id: string): Record<string, string> => {
    let hash = 0
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360
    return { backgroundColor: `hsl(${hash} 55% 42%)` }
  }

  const initials = (name: string): string => (name.trim().slice(0, 2) || '?').toUpperCase()

  const scrollToBottom = async (): Promise<void> => {
    await nextTick()
    bottomRef.value?.scrollIntoView({ block: 'end' })
  }

  const focusInput = (): void => {
    const el = inputRef.value?.$el
    if (el instanceof HTMLInputElement) el.focus()
  }

  const markGroupRead = (): void => {
    lastSeenAt.value = Date.now()
  }

  const switchSection = (next: Section): void => {
    section.value = next
    if (next === 'groups' && !isMobile.value) {
      mainView.value = 'chat'
      markGroupRead()
      void scrollToBottom()
    }
    if (isMobile.value) mobilePane.value = 'list'
  }

  const selectRail = (next: Section): void => {
    if (next === 'groups') {
      showChat()
      return
    }
    section.value = 'friends'
    if (isMobile.value) mobilePane.value = 'list'
  }

  const openRoster = (): void => {
    section.value = 'friends'
    if (isMobile.value) mobilePane.value = 'list'
  }

  const showChat = (): void => {
    section.value = 'groups'
    mainView.value = 'chat'
    if (isMobile.value) mobilePane.value = 'main'
    markGroupRead()
    void scrollToBottom()
  }

  const openPlayerProfile = (player: PlayerPublicProfile): void => {
    selectedPlayerId.value = player.id
    mainView.value = 'profile'
    if (isMobile.value) mobilePane.value = 'main'
  }

  const backFromProfile = (): void => {
    mainView.value = 'chat'
    if (isMobile.value) mobilePane.value = 'list'
  }

  // 资料卡“发消息”：回到群聊并插入 @昵称
  const messageSelectedPlayer = (): void => {
    const player = selectedPlayer.value
    if (!player) return

    mainView.value = 'chat'
    if (isMobile.value) mobilePane.value = 'main'

    const token = `@${player.name} `
    if (!draft.value.trim()) {
      draft.value = token
    } else {
      draft.value = draft.value.endsWith(' ') ? `${draft.value}${token}` : `${draft.value} ${token}`
    }

    markGroupRead()
    void nextTick(() => {
      void scrollToBottom()
      focusInput()
    })
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
    markGroupRead()
    void scrollToBottom()
  }

  // 旧 /players 入口跳转时自动展开
  watch(
    () => route.query.chat,
    value => {
      if (value === '1') open.value = true
    }
  )

  // 打开浮框默认回到群聊
  watch(
    open,
    isOpen => {
      if (!isOpen) return
      mobilePane.value = 'main'
      mainView.value = 'chat'
      markGroupRead()
      void scrollToBottom()
    },
    { immediate: true }
  )

  // 正在看群聊时，新消息自动已读并滚动到底部
  watch(
    viewingGroup,
    visible => {
      if (!visible) return
      markGroupRead()
      void scrollToBottom()
    }
  )

  watch(
    () => lastMessage.value?.id,
    () => {
      if (!viewingGroup.value) return
      markGroupRead()
      void scrollToBottom()
    }
  )

  // 选中的玩家离开列表时退回群聊
  watch(selectedPlayer, player => {
    if (!player && mainView.value === 'profile') mainView.value = 'chat'
  })
</script>

<style scoped>
  @media (min-width: 640px) {
    .qq-mobile-only {
      display: none !important;
    }
  }

  .chat-dock-enter-active,
  .chat-dock-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .chat-dock-enter-from,
  .chat-dock-leave-to {
    opacity: 0;
    transform: translateY(8px);
  }

  .qq-titlebar-btn {
    display: flex;
    height: 24px;
    width: 24px;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--muted-foreground);
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .qq-titlebar-btn:hover {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  .rail-btn {
    display: flex;
    height: 36px;
    width: 36px;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: var(--muted-foreground);
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .rail-btn:hover:not(:disabled) {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  .rail-btn:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .rail-btn-active {
    background: color-mix(in oklab, var(--primary) 14%, transparent);
    color: var(--primary);
  }

  .rail-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    display: flex;
    min-width: 16px;
    height: 16px;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: var(--destructive);
    padding: 0 3px;
    font-size: 9px;
    line-height: 1;
    color: var(--destructive-foreground);
  }

  .profile-btn {
    height: 32px;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: transparent;
    padding: 0 18px;
    font-size: 12px;
    color: var(--muted-foreground);
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .profile-btn:hover:not(:disabled) {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  .profile-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .profile-btn-primary {
    height: 32px;
    border-radius: 5px;
    background: var(--primary);
    padding: 0 22px;
    font-size: 12px;
    font-weight: 500;
    color: var(--primary-foreground);
    transition: filter 0.15s ease;
  }

  .profile-btn-primary:hover {
    filter: brightness(1.05);
  }

  .trade-btn {
    display: inline-flex;
    height: 26px;
    cursor: not-allowed;
    align-items: center;
    gap: 4px;
    border-radius: 4px;
    padding: 0 6px;
    font-size: 11px;
    color: var(--muted-foreground);
    opacity: 0.6;
  }

  .tool-btn {
    display: flex;
    height: 26px;
    width: 26px;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--muted-foreground);
  }

  .tool-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .chat-send-btn {
    display: inline-flex;
    height: 36px;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    border-radius: 6px;
    background: var(--primary);
    padding: 0 14px;
    font-size: 13px;
    color: var(--primary-foreground);
    white-space: nowrap;
    transition: filter 0.15s ease;
  }

  .chat-send-btn:hover:not(:disabled) {
    filter: brightness(1.05);
  }

  .chat-send-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
