<template>
  <div class="rounded-lg border border-border bg-muted/40 p-3">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <ArrowLeftRight class="h-3.5 w-3.5 text-primary" />
        {{ t('players.tradeTitle') }}
      </div>
      <Badge :variant="statusVariant" class="h-4 shrink-0 px-1.5 text-[10px]">{{ statusLabel }}</Badge>
    </div>

    <div class="mt-2 space-y-1 text-[11px]">
      <div class="flex justify-between gap-2">
        <span class="text-muted-foreground">{{ t('players.tradeOffer') }}</span>
        <span class="text-right">{{ resourceSummary(myGive) }}</span>
      </div>
      <div class="flex justify-between gap-2">
        <span class="text-muted-foreground">{{ t('players.tradeRequest') }}</span>
        <span class="text-right">{{ resourceSummary(myReceive) }}</span>
      </div>
      <div class="flex justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{{ t('players.tradeLossLabel') }}</span>
        <span class="text-amber-600 dark:text-amber-400">{{ trade.lossPercent ?? 0 }}%</span>
      </div>
    </div>

    <div class="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
      <span class="text-[10px] text-muted-foreground">{{ formatTime(trade.createdAt) }}</span>
      <div v-if="isIncomingPending || isOutgoingPending" class="flex gap-1.5">
        <template v-if="isIncomingPending">
          <Button
            size="sm"
            variant="outline"
            class="h-7 px-2 text-[11px]"
            :disabled="!canRespond"
            @click="emit('respond', trade, 'decline')"
          >
            {{ t('players.tradeDecline') }}
          </Button>
          <Button size="sm" class="h-7 px-2 text-[11px]" :disabled="!canRespond" @click="emit('respond', trade, 'accept')">
            {{ t('players.tradeAccept') }}
          </Button>
        </template>
        <Button v-else size="sm" variant="outline" class="h-7 px-2 text-[11px]" @click="emit('cancel', trade)">
          {{ t('players.tradeCancel') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { ArrowLeftRight } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { useI18n } from '@/composables/useI18n'
  import { formatNumber } from '@/utils/format'
  import type { PlayerTradeOffer, PlayerTradeResources } from '@/types/game'

  const props = defineProps<{
    trade: PlayerTradeOffer
    myId: string
    canRespond: boolean
  }>()

  const emit = defineEmits<{
    respond: [trade: PlayerTradeOffer, action: 'accept' | 'decline']
    cancel: [trade: PlayerTradeOffer]
  }>()

  const { t } = useI18n()

  const isInitiator = computed(() => props.trade.fromId === props.myId)
  const myGive = computed(() => (isInitiator.value ? props.trade.offer : props.trade.request))
  const myReceive = computed(() => (isInitiator.value ? props.trade.request : props.trade.offer))

  const isExpired = computed(() => props.trade.status === 'pending' && props.trade.expiresAt <= Date.now())
  const isIncomingPending = computed(
    () => props.trade.toId === props.myId && props.trade.status === 'pending' && !isExpired.value
  )
  const isOutgoingPending = computed(
    () => props.trade.fromId === props.myId && props.trade.status === 'pending' && !isExpired.value
  )

  const statusLabel = computed(() => {
    if (isExpired.value) return t('players.tradeExpired')
    switch (props.trade.status) {
      case 'pending':
        return props.trade.toId === props.myId ? t('players.tradePendingIncoming') : t('players.tradePendingOutgoing')
      case 'accepted':
        return t('players.tradeAccepted')
      case 'declined':
        return t('players.tradeDeclined')
      case 'cancelled':
        return t('players.tradeCancelled')
      default:
        return t('players.tradeExpired')
    }
  })

  const statusVariant = computed<'default' | 'secondary' | 'destructive' | 'outline'>(() => {
    if (props.trade.status === 'accepted') return 'default'
    if (props.trade.status === 'declined') return 'destructive'
    if (props.trade.status === 'pending' && !isExpired.value) return 'secondary'
    return 'outline'
  })

  const resourceSummary = (resources: PlayerTradeResources): string => {
    const parts: string[] = []
    if (resources.metal > 0) parts.push(`${t('resources.metal')} ${formatNumber(resources.metal)}`)
    if (resources.crystal > 0) parts.push(`${t('resources.crystal')} ${formatNumber(resources.crystal)}`)
    if (resources.deuterium > 0) parts.push(`${t('resources.deuterium')} ${formatNumber(resources.deuterium)}`)
    return parts.length > 0 ? parts.join(' · ') : '-'
  }

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
</script>
