<template>
  <span class="inline-flex items-center gap-1 whitespace-nowrap" :class="sizeClass">
    <component :is="icon" class="shrink-0" :class="[iconClass, TIER_COLOR[tier]]" />
    <span class="text-muted-foreground">{{ name }}</span>
    <span v-if="amount !== undefined" class="font-medium text-foreground tabular-nums">{{ format(amount) }}</span>
  </span>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { MATERIALS } from '@/config/factory/materials'
  import { MATERIAL_ICONS, TIER_COLOR } from '@/config/factory/icons'
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
  const icon = computed(() => MATERIAL_ICONS[def.value.icon] ?? MATERIAL_ICONS.box)
  const tier = computed(() => def.value.tier)
  const name = computed(() => (props.hideName ? '' : def.value.name))

  const sizeClass = computed(() => (props.size === 'xs' ? 'text-[11px]' : props.size === 'md' ? 'text-sm' : 'text-xs'))
  const iconClass = computed(() => (props.size === 'xs' ? 'h-3 w-3' : props.size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'))

  function format(n: number): string {
    if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`
    if (Number.isInteger(n)) return String(n)
    return n.toFixed(1)
  }
</script>
