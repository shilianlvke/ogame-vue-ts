<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('players.tradeTitle') }}</DialogTitle>
        <DialogDescription>
          {{ peer ? t('players.tradeWith', { name: peer.name }) : '' }}
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
              <Input v-model.number="offer[resourceType]" type="number" min="0" step="1" />
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
              <Input v-model.number="request[resourceType]" type="number" min="0" step="1" />
            </div>
          </div>
        </div>

        <div class="space-y-1 rounded-lg bg-muted/50 p-3 text-xs">
          <div class="flex items-center justify-between gap-2">
            <span class="text-muted-foreground">{{ t('players.tradeLossLabel') }}</span>
            <span class="font-medium text-amber-600 dark:text-amber-400">{{ lossPercent }}%</span>
          </div>
          <p class="text-[11px] text-muted-foreground">
            {{ t('players.tradeLossHint', { building: myTradeStatus.spaceportLevel, tech: myTradeStatus.techLevel }) }}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="isOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="!formValid || !myTradeStatus.unlocked" @click="sendTradeOffer">
          <ArrowLeftRight class="mr-2 h-4 w-4" />
          {{ t('players.tradeSend') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
  import { computed, reactive, watch } from 'vue'
  import { ArrowLeftRight } from 'lucide-vue-next'
  import { toast } from 'vue-sonner'
  import { Button } from '@/components/ui/button'
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import { Input } from '@/components/ui/input'
  import ResourceIcon from '@/components/common/ResourceIcon.vue'
  import { useGameStore } from '@/stores/gameStore'
  import { useI18n } from '@/composables/useI18n'
  import { dispatchCommand } from '@/core/runtime'
  import { emptyTradeResources, getPlayerTradeStatus } from '@/logic/playerTradeLogic'
  import type { PlayerPublicProfile } from '@/core/protocol'
  import type { PlayerTradeResources } from '@/types/game'

  const props = defineProps<{
    open: boolean
    peer: PlayerPublicProfile | null
  }>()

  const emit = defineEmits<{
    'update:open': [value: boolean]
    sent: []
  }>()

  const { t } = useI18n()
  const gameStore = useGameStore()

  const tradeResourceTypes = ['metal', 'crystal', 'deuterium'] as const
  const offer = reactive<PlayerTradeResources>(emptyTradeResources())
  const request = reactive<PlayerTradeResources>(emptyTradeResources())

  const myTradeStatus = computed(() => getPlayerTradeStatus(gameStore.player))
  const lossPercent = computed(() => Math.max(myTradeStatus.value.lossPercent, props.peer?.tradeLossPercent ?? 0))
  const formValid = computed(
    () =>
      tradeResourceTypes.reduce(
        (sum, resourceType) => sum + (Number(offer[resourceType]) || 0) + (Number(request[resourceType]) || 0),
        0
      ) > 0
  )

  const isOpen = computed({
    get: () => props.open,
    set: value => emit('update:open', value)
  })

  watch(
    () => props.open,
    open => {
      if (!open) return
      Object.assign(offer, emptyTradeResources())
      Object.assign(request, emptyTradeResources())
    }
  )

  const sendTradeOffer = (): void => {
    const peer = props.peer
    if (!peer || !formValid.value) return
    if (!myTradeStatus.value.unlocked) {
      toast.error(t('players.tradeLocked'))
      return
    }
    if (peer.tradeUnlocked !== true) {
      toast.error(t('players.tradeTargetLocked'))
      return
    }

    const result = dispatchCommand({
      type: 'player.trade.create',
      toPlayerId: peer.id,
      offer: { ...offer },
      request: { ...request }
    })
    if (!result.ok) {
      toast.error(t(result.reason ?? 'errors.unknown'))
      return
    }

    toast.success(t('players.tradeSent'))
    isOpen.value = false
    emit('sent')
  }
</script>
