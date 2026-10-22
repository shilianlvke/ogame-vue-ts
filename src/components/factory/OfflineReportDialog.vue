<template>
  <Dialog :open="store.offlineSeconds !== null" @update:open="v => !v && store.dismissOffline()">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Clock class="h-4 w-4 text-primary" />离线结算
        </DialogTitle>
        <DialogDescription v-if="!report">
          离开 {{ formatDuration(store.offlineSeconds ?? 0) }}，结算上限 12 小时。
        </DialogDescription>
      </DialogHeader>

      <div v-if="!report" class="space-y-3">
        <div class="rounded-md border p-2 text-xs text-muted-foreground">
          离线超过 12 小时的部分默认不结算，可消耗 100 暗物质延长 12 小时。
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button @click="settle(0)">结算 12 小时</Button>
          <Button
            v-if="canExtend"
            variant="outline"
            :disabled="store.darkMatter < 100"
            @click="settle(OFFLINE_EXTEND_HOURS)"
          >
            延长 12 小时（100 暗物质）
          </Button>
          <Button variant="ghost" @click="store.dismissOffline()">关闭</Button>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div class="grid grid-cols-2 gap-2 text-center text-xs">
          <div class="rounded-md border p-2">
            <div class="text-muted-foreground">结算时长</div>
            <div class="font-medium tabular-nums">{{ formatDuration(report.seconds) }}</div>
          </div>
          <div class="rounded-md border p-2">
            <div class="text-muted-foreground">材料变化</div>
            <div class="font-medium tabular-nums" :class="report.materialsGained >= 0 ? 'text-primary' : 'text-destructive'">
              {{ sign(report.materialsGained) }}{{ formatNum(report.materialsGained) }}
            </div>
          </div>
          <div class="rounded-md border p-2">
            <div class="text-muted-foreground">星币变化</div>
            <div class="font-medium tabular-nums">{{ sign(report.creditsGained) }}{{ formatNum(report.creditsGained) }}</div>
          </div>
          <div class="rounded-md border p-2">
            <div class="text-muted-foreground">完成科技</div>
            <div class="font-medium tabular-nums">{{ report.techsGained }} 项</div>
          </div>
        </div>
        <div class="flex justify-end">
          <Button @click="store.dismissOffline()">确定</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { toast } from 'vue-sonner'
  import { Clock } from 'lucide-vue-next'
  import { Button } from '@/components/ui/button'
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import { useFactoryStore } from '@/stores/factoryStore'
  import { OFFLINE_EXTEND_HOURS } from '@/config/factory/balance'
  import { formatDuration, offlineCapSeconds, type OfflineReport } from '@/logic/factory/offline'

  const store = useFactoryStore()
  const report = ref<OfflineReport | null>(null)

  const canExtend = computed(() => (store.offlineSeconds ?? 0) > offlineCapSeconds(0))

  function settle(extendHours: number) {
    if (extendHours > 0) {
      if (!store.payOfflineExtend()) {
        toast.error('暗物质不足')
        return
      }
    }
    report.value = store.applyOffline(extendHours)
  }

  function sign(n: number): string {
    return n > 0 ? '+' : ''
  }

  function formatNum(n: number): string {
    if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`
    if (Number.isInteger(n)) return String(n)
    return n.toFixed(2)
  }
</script>
