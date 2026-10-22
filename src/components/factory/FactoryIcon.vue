<template>
  <span class="inline-block shrink-0 bg-current" :class="sizeClass" :style="maskStyle" aria-hidden="true" />
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { factoryIcon } from '@/config/factory/icons'

  const props = withDefaults(defineProps<{ id: string; size?: 'xs' | 'sm' | 'md' | 'lg' }>(), { size: 'sm' })

  const sizeClass = computed(
    () =>
      ({
        xs: 'h-3 w-3',
        sm: 'h-3.5 w-3.5',
        md: 'h-4 w-4',
        lg: 'h-6 w-6'
      })[props.size]
  )

  const maskStyle = computed(() => {
    const url = `url("${factoryIcon(props.id)}")`
    return {
      maskImage: url,
      WebkitMaskImage: url,
      maskSize: 'contain',
      WebkitMaskSize: 'contain',
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskPosition: 'center'
    }
  })
</script>
