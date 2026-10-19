<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="outline" size="icon" class="relative">
        <MessageCircle class="h-4 w-4" />
        <Badge
          v-if="unread > 0"
          variant="destructive"
          class="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse"
        >
          {{ unread > 9 ? '9+' : unread }}
        </Badge>
      </Button>
    </PopoverTrigger>

    <PopoverContent class="w-80 p-0 sm:w-96" align="end">
      <div class="flex items-center justify-between border-b p-3">
        <h3 class="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle class="h-4 w-4 text-primary" />
          {{ t('chat.title') }}
        </h3>
        <Badge variant="secondary" class="text-[10px]">{{ t('chat.channel') }}</Badge>
      </div>

      <ScrollArea class="h-64">
        <div class="px-3 pb-2 pt-1">
          <div v-for="message in messages" :key="message.id" class="py-1 text-sm">
            <div class="flex items-baseline gap-1">
              <span class="font-medium" :class="message.fromId === myId ? 'text-primary' : ''">
                {{ message.fromName }}
              </span>
              <span class="text-[10px] text-muted-foreground">{{ formatTime(message.timestamp) }}</span>
            </div>
            <p class="whitespace-pre-wrap break-words">{{ message.text }}</p>
          </div>
          <p v-if="messages.length === 0" class="py-8 text-center text-xs text-muted-foreground">
            {{ t('chat.empty') }}
          </p>
          <div ref="bottomRef" />
        </div>
      </ScrollArea>

      <div class="flex gap-2 border-t p-2">
        <Input
          v-model="draft"
          :maxlength="MAX_CHAT_LENGTH"
          :placeholder="t('chat.placeholder')"
          @keydown.enter.prevent="send"
        />
        <Button size="icon" :disabled="!canSend" @click="send">
          <Send class="h-4 w-4" />
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
  import { ScrollArea } from '@/components/ui/scroll-area'
  import { MessageCircle, Send } from 'lucide-vue-next'
  import { useGameStore } from '@/stores/gameStore'
  import { useI18n } from '@/composables/useI18n'
  import { MAX_CHAT_LENGTH } from '@/core/commands'
  import { dispatchCommand } from '@/core/runtime'

  const gameStore = useGameStore()
  const { t } = useI18n()

  const open = ref(false)
  const draft = ref('')
  const cooling = ref(false)
  const lastSeenAt = ref(Date.now())
  const bottomRef = ref<HTMLElement | null>(null)

  const myId = computed(() => gameStore.player.id)
  // 只显示公共频道；私聊统一放在“玩家”页面，避免这里把私聊内容当成公共消息展示
  const messages = computed(() =>
    (gameStore.player.chatMessages ?? []).filter(message => !message.toId).slice(-60)
  )
  const unread = computed(
    () => messages.value.filter(message => message.fromId !== myId.value && message.timestamp > lastSeenAt.value).length
  )
  const canSend = computed(() => draft.value.trim().length > 0 && !cooling.value)

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const scrollToBottom = async () => {
    await nextTick()
    bottomRef.value?.scrollIntoView({ block: 'end' })
  }

  const send = () => {
    const text = draft.value.trim()
    if (!text || cooling.value) return

    dispatchCommand({ type: 'chat.send', text })

    draft.value = ''
    cooling.value = true
    // 与服务端的 1 秒冷却对齐，避免点了没反应
    setTimeout(() => {
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

  watch(
    () => messages.value.length,
    () => {
      if (open.value) void scrollToBottom()
    }
  )
</script>
