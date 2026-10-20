<template>
  <div class="flex min-h-0 flex-col">
    <ScrollArea class="min-h-0 flex-1">
      <div class="space-y-0.5 p-1">
        <button
          v-for="player in players"
          :key="player.id"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-100"
          :class="selectedId === player.id ? 'bg-accent' : ''"
          :title="player.id === myId ? player.name : t('chat.mentionHint')"
          :disabled="player.id === myId"
          @click="emit('select', player)"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-primary-foreground"
            :style="avatarStyle(player.id)"
          >
            {{ initials(player.name) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1">
              <span class="truncate text-[13px] font-medium text-foreground">{{ player.name }}</span>
              <span v-if="player.id === myId" class="shrink-0 rounded border border-border px-1 text-[9px] text-muted-foreground">
                {{ t('players.me') }}
              </span>
            </span>
            <span class="mt-0.5 flex items-center gap-1 text-[10px]">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="player.online ? 'bg-emerald-500' : 'bg-muted-foreground/50'" />
              <span class="shrink-0" :class="player.online ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'">
                {{ player.online ? t('players.online') : t('players.offline') }}
              </span>
              <span class="truncate text-muted-foreground">
                · {{ formatNumber(player.points) }} {{ t('players.points') }} · {{ player.planetCount }} {{ t('players.planets') }}
              </span>
            </span>
          </span>
        </button>
        <p v-if="players.length === 0" class="px-2 py-8 text-center text-[11px] text-muted-foreground">
          {{ t(emptyKey) }}
        </p>
      </div>
    </ScrollArea>
  </div>
</template>

<script setup lang="ts">
  import { ScrollArea } from '@/components/ui/scroll-area'
  import { useI18n } from '@/composables/useI18n'
  import { formatNumber } from '@/utils/format'
  import type { PlayerPublicProfile } from '@/core/protocol'

  withDefaults(
    defineProps<{
      players: PlayerPublicProfile[]
      myId: string
      selectedId?: string | null
      emptyKey?: string
    }>(),
    {
      selectedId: null,
      emptyKey: 'chat.noPlayers'
    }
  )

  const emit = defineEmits<{
    select: [player: PlayerPublicProfile]
  }>()

  const { t } = useI18n()

  const avatarStyle = (id: string): Record<string, string> => {
    let hash = 0
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360
    return { backgroundColor: `hsl(${hash} 55% 42%)` }
  }

  const initials = (name: string): string => (name.trim().slice(0, 2) || '?').toUpperCase()
</script>
