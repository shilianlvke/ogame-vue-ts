<template>
  <div :class="props.embedded ? '' : 'container mx-auto p-4 sm:p-6'">
    <!-- 概览 -->
    <div class="mb-4 grid gap-3 sm:mb-6 sm:grid-cols-3">
      <Card>
        <CardContent class="flex items-center justify-between p-3 sm:p-4">
          <div class="flex items-center gap-2 text-sm font-medium">
            <Coins class="h-4 w-4 text-primary" />星币
          </div>
          <div class="text-sm font-medium tabular-nums">{{ formatNumber(store.market.credit) }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="flex items-center justify-between p-3 sm:p-4">
          <div class="flex items-center gap-2 text-sm font-medium">
            <Percent class="h-4 w-4 text-primary" />手续费率
          </div>
          <div class="text-sm font-medium tabular-nums">{{ (store.feeRate * 100).toFixed(1) }}%</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="flex items-center justify-between p-3 sm:p-4">
          <div class="flex items-center gap-2 text-sm font-medium">
            <Handshake class="h-4 w-4 text-primary" />矿业公会声望
          </div>
          <div class="text-sm font-medium tabular-nums">{{ Math.floor(store.market.minersGuildRep) }} / 1000</div>
        </CardContent>
      </Card>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>每 60 秒撮合一次</span>
      <span>公会收购价 = 基础价 × 0.95</span>
      <span>公会出售价 = 基础价 × 1.05</span>
      <span>挂单价限基础价 ±50%，7 天未成交自动撤回</span>
    </div>

    <!-- 材料行情 -->
    <div class="mb-2 text-sm font-medium">材料行情</div>
    <div class="mb-6 overflow-hidden rounded-lg border">
      <div v-for="row in rows" :key="row.id">
        <div
          class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm hover:bg-muted/50"
          :class="editorOpen === row.id ? 'bg-muted/40' : ''"
        >
          <div class="flex min-w-[8rem] items-center gap-1.5 font-medium">
            <FactoryIcon :id="row.id" size="md" class="text-foreground" />{{ row.name }}
          </div>
          <span class="text-xs text-muted-foreground">
            持有 <span class="text-foreground tabular-nums">{{ formatNumber(store.factory.stock[row.id] ?? 0) }}</span>
          </span>
          <span class="text-xs text-muted-foreground">
            基础价 <span class="text-foreground tabular-nums">{{ baseOf(row.id) }}</span>
          </span>
          <span class="text-xs text-muted-foreground">
            市场价 <span class="text-foreground tabular-nums">{{ store.priceOf(row.id).toFixed(2) }}</span>
          </span>
          <div class="ml-auto flex gap-1.5">
            <Button size="sm" variant="outline" @click="openEditor(row.id, 'buy')">买入</Button>
            <Button size="sm" variant="outline" @click="openEditor(row.id, 'sell')">卖出</Button>
          </div>
        </div>

        <!-- 挂单编辑行 -->
        <div v-if="editorOpen === row.id" class="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-3 py-2">
          <Badge variant="outline" class="text-[10px]">{{ side === 'buy' ? '买入' : '卖出' }}</Badge>
          <div class="flex items-center gap-1.5 text-xs">
            <span class="text-muted-foreground">单价</span>
            <Input v-model="priceStr" class="h-8 w-24" type="number" min="0" step="0.01" />
          </div>
          <div class="flex items-center gap-1.5 text-xs">
            <span class="text-muted-foreground">数量</span>
            <Input v-model="amountStr" class="h-8 w-24" type="number" min="1" step="1" />
          </div>
          <div class="text-xs text-muted-foreground">
            合计 <span class="text-foreground tabular-nums">{{ totalPreview }}</span>
            <span v-if="side === 'sell'" class="text-foreground tabular-nums">· 手续费 {{ feePreview }}</span>
          </div>
          <div class="ml-auto flex gap-1.5">
            <Button size="sm" @click="submit">挂单</Button>
            <Button size="sm" variant="ghost" @click="closeEditor">取消</Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 我的挂单 -->
    <div class="mb-2 flex items-center gap-2">
      <span class="text-sm font-medium">我的挂单</span>
      <span class="text-xs text-muted-foreground">{{ store.market.orders.length }} 笔 · 占用仓库或冻结星币，撤回返还</span>
    </div>
    <div v-if="!store.market.orders.length" class="mb-6 rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
      暂无挂单
    </div>
    <div v-else class="mb-6 grid gap-2 md:grid-cols-2">
      <Card v-for="o in store.market.orders" :key="o.id">
        <CardContent class="flex flex-wrap items-center gap-2 p-3">
          <FactoryIcon :id="o.material" size="sm" class="text-foreground" />
          <span class="text-sm font-medium">{{ MATERIALS[o.material].name }}</span>
          <Badge variant="outline" class="text-[10px]">{{ o.side === 'buy' ? '买入' : '卖出' }}</Badge>
          <span class="text-xs text-muted-foreground tabular-nums">×{{ formatNumber(o.amount) }} @ {{ o.price }}</span>
          <span class="text-xs text-muted-foreground">{{ leftText(o) }}</span>
          <Button size="sm" variant="ghost" class="ml-auto text-destructive hover:text-destructive" @click="cancel(o.id)">撤回</Button>
        </CardContent>
      </Card>
    </div>

    <!-- 成交记录 -->
    <div class="mb-2 text-sm font-medium">成交记录</div>
    <div v-if="!store.market.log.length" class="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
      暂无成交
    </div>
    <div v-else class="overflow-hidden rounded-lg border">
      <div
        v-for="(e, i) in reversedLog"
        :key="i"
        class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5 text-xs last:border-b-0"
      >
        <FactoryIcon :id="e.material" size="sm" class="text-foreground" />
        <span>{{ e.side === 'buy' ? '买入' : '卖出' }} {{ MATERIALS[e.material].name }} ×{{ formatNumber(e.units) }}</span>
        <span class="tabular-nums text-muted-foreground">@ {{ e.price }}</span>
        <span class="text-muted-foreground">{{ e.counterparty === 'faction' ? '矿业公会' : '玩家挂单' }}</span>
        <span v-if="e.fee > 0" class="ml-auto text-muted-foreground tabular-nums">手续费 {{ e.fee.toFixed(2) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { toast } from 'vue-sonner'
  import { Coins, Handshake, Percent } from 'lucide-vue-next'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Card, CardContent } from '@/components/ui/card'
  import { Input } from '@/components/ui/input'
  import FactoryIcon from '@/components/factory/FactoryIcon.vue'
  import { useFactoryStore } from '@/stores/factoryStore'
  import { MATERIALS } from '@/config/factory/materials'
  import { basePrice, factionBuyPrice, factionSellPrice, tradableMaterials } from '@/config/factory/market'
  import type { MaterialId } from '@/types/factory'
  import type { MarketOrder, OrderSide } from '@/logic/factory/market'

  const props = defineProps<{ embedded?: boolean }>()
  const store = useFactoryStore()

  const rows = tradableMaterials().map(id => ({ id, name: MATERIALS[id].name }))

  const editorOpen = ref<MaterialId | null>(null)
  const side = ref<OrderSide>('buy')
  const priceStr = ref('')
  const amountStr = ref('1')

  const reversedLog = computed(() => [...store.market.log].reverse().slice(0, 12))

  function baseOf(id: MaterialId): string {
    return basePrice(id).toFixed(2)
  }

  function openEditor(id: MaterialId, s: OrderSide) {
    editorOpen.value = id
    side.value = s
    priceStr.value = (s === 'buy' ? factionSellPrice(id) : factionBuyPrice(id)).toFixed(2)
    amountStr.value = '1'
  }

  function closeEditor() {
    editorOpen.value = null
  }

  const priceNum = computed(() => Number(priceStr.value))
  const amountNum = computed(() => Math.floor(Number(amountStr.value)))
  const totalPreview = computed(() =>
    Number.isFinite(priceNum.value) && Number.isFinite(amountNum.value) ? (priceNum.value * amountNum.value).toFixed(2) : '0.00'
  )
  const feePreview = computed(() =>
    Number.isFinite(priceNum.value) && Number.isFinite(amountNum.value)
      ? (priceNum.value * amountNum.value * store.feeRate).toFixed(2)
      : '0.00'
  )

  function submit() {
    if (!editorOpen.value) return
    const material = editorOpen.value
    const result = store.placeOrder(side.value, material, priceNum.value, amountNum.value)
    if (result.ok) {
      toast.success(`挂单已提交：${side.value === 'buy' ? '买入' : '卖出'} ${MATERIALS[material].name} ×${amountNum.value}`)
      closeEditor()
    } else {
      toast.error(result.reason)
    }
  }

  function cancel(id: string) {
    if (store.cancelOrder(id)) toast.success('挂单已撤回')
  }

  function leftText(o: MarketOrder): string {
    const left = o.expiresAt - store.lastTickAt
    const days = Math.floor(left / 86400)
    const hours = Math.floor((left % 86400) / 3600)
    if (days > 0) return `${days} 天 ${hours} 小时后过期`
    if (hours > 0) return `${hours} 小时后过期`
    return `${Math.max(1, Math.floor(left / 60))} 分钟后过期`
  }

  function formatNumber(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
    if (Number.isInteger(n)) return String(n)
    return n.toFixed(2)
  }
</script>
