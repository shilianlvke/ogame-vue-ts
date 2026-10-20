<template>
  <div class="flex min-h-0 flex-col">
    <!-- 搜索 -->
    <div class="shrink-0 p-2">
      <div class="relative">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input v-model="search" class="h-8 pl-8 text-xs" :placeholder="t('players.searchPlaceholder')" />
      </div>
    </div>

    <!-- 玩家列表 -->
    <ScrollArea class="min-h-0 flex-1">
      <div class="space-y-0.5 px-1 pb-2">
        <button
          v-for="player in filteredPlayers"
          :key="player.id"
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/70 disabled:cursor-default disabled:opacity-100"
          :class="selectedId === player.id ? 'bg-muted' : ''"
          :title="player.id === myId ? player.name : t('chat.mentionHint')"
          :disabled="player.id === myId"
          @click="emit('select', player)"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            :style="avatarStyle(player.id)"
          >
            {{ initials(player.name) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1">
              <span class="truncate text-xs font-medium">{{ player.name }}</span>
              <Badge v-if="player.id === myId" variant="outline" class="h-4 shrink-0 px-1 text-[9px]">
                {{ t('players.me') }}
              </Badge>
            </span>
            <span class="mt-0.5 flex items-center gap-1 text-[10px]" :class="player.online ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="player.online ? 'bg-green-500' : 'bg-muted-foreground/50'" />
              <span class="shrink-0">{{ player.online ? t('players.online') : t('players.offline') }}</span>
              <span class="truncate text-muted-foreground">
                · {{ formatNumber(player.points) }} {{ t('players.points') }} · {{ player.planetCount }} {{ t('players.planets') }}
              </span>
            </span>
          </span>
        </button>
        <p v-if="filteredPlayers.length === 0" class="px-2 py-8 text-center text-[11px] text-muted-foreground">
          {{ players.length === 0 ? t('chat.noPlayers') : t('players.selectPlayer') }}
        </p>
      </div>
    </ScrollArea>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { Search } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Input } from '@/components/ui/input'
  import { ScrollArea } from '@/components/ui/scroll-area'
  import { useI18n } from '@/composables/useI18n'
  import { formatNumber } from '@/utils/format'
  import type { PlayerPublicProfile } from '@/core/protocol'

  const props = defineProps<{
    players: PlayerPublicProfile[]
    myId: string
    selectedId?: string | null
  }>()

  const emit = defineEmits<{
    select: [player: PlayerPublicProfile]
  }>()

  const { t } = useI18n()
  const search = ref('')

  const filteredPlayers = computed(() => {
    const keyword = search.value.trim().toLowerCase()
    if (!keyword) return props.players
    return props.players.filter(
      player => player.name.toLowerCase().includes(keyword) || player.id.toLowerCase().includes(keyword)
    )
  })

  const avatarStyle = (id: string): Record<string, string> => {
    let hash = 0
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360
    return { backgroundColor: `hsl(${hash} 55% 42%)` }
  }

  const initials = (name: string): string => (name.trim().slice(0, 2) || '?').toUpperCase()
</script>
