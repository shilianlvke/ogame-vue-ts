<template>
  <span class="inline-flex items-center gap-1 whitespace-nowrap" :class="sizeClass">
    <FactoryIcon :id="props.id" :size="props.size === 'md' ? 'md' : 'sm'" :class="TIER_COLOR[tier]" />
    <span class="text-muted-foreground">{{ name }}</span>
    <span v-if="amount !== undefined" class="font-medium text-foreground tabular-nums">{{ format(amount) }}</span>
  </span>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import FactoryIcon from '@/components/factory/FactoryIcon.vue'
  import { MATERIALS } from '@/config/factory/materials'
  import { TIER_COLOR } from '@/config/factory/icons'
  import type { MaterialId } from '@/types/factory'

  const props = withDefaults(
    defineProps<{
      id: MaterialId
      amount?: number
      size?: 'xs' | 'sm' | 'md'
      hideName?: boolean
    }>(),
    { size: 'sm' }
  )

  const def = computed(() => MATERIALS[props.id])
  const tier = computed(() => def.value.tier)
  const name = computed(() => (props.hideName ? '' : def.value.name))

  const sizeClass = computed(() => (props.size === 'xs' ? 'text-[11px]' : props.size === 'md' ? 'text-sm' : 'text-xs'))

  function format(n: number): string {
    if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`
    if (Number.isInteger(n)) return String(n)
    return n.toFixed(1)
  }
</script>
