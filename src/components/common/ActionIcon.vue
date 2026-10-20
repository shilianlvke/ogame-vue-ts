<template>
  <span :class="[sizes[size], 'inline-block shrink-0 bg-current']" :style="maskStyle" aria-hidden="true" />
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  interface Props {
    type: 'upgrade' | 'demolish'
    size?: 'sm' | 'md' | 'lg'
  }

  const props = withDefaults(defineProps<Props>(), {
    size: 'md'
  })

  const base = import.meta.env.BASE_URL
  const icons = {
    upgrade: `${base}svg/upgrade.svg`,
    demolish: `${base}svg/demolish.svg`
  }

  const sizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  // 图标本身是 SVG 轮廓，使用 mask + bg-current 让颜色跟随按钮文字/禁用态
  const maskStyle = computed(() => {
    const url = `url("${icons[props.type]}")`
    return {
      maskImage: url,
      WebkitMaskImage: url,
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskPosition: 'center',
      maskSize: 'contain',
      WebkitMaskSize: 'contain'
    }
  })
</script>
