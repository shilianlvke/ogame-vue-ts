<template>
  <img
    :src="icons[type]"
    :class="[sizes[size], 'inline-block shrink-0 object-contain select-none']"
    alt=""
    aria-hidden="true"
    draggable="false"
  />
</template>

<script setup lang="ts">
  interface Props {
    type: 'metal' | 'crystal' | 'deuterium' | 'darkMatter' | 'energy'
    size?: 'sm' | 'md' | 'lg'
  }

  withDefaults(defineProps<Props>(), {
    size: 'md'
  })

  // 图标使用 public/svg 下的线性图标，颜色与原来的资源色块保持一致：
  // slate-500 / cyan-500 / green-500 / purple-700 / yellow-500（Tailwind v4）
  const base = import.meta.env.BASE_URL

  const icons = {
    metal: `${base}svg/metal.svg`,
    crystal: `${base}svg/crystal.svg`,
    deuterium: `${base}svg/fuel.svg`,
    darkMatter: `${base}svg/darkmatter.svg`,
    energy: `${base}svg/power.svg`
  }

  // 线性图标比原来的色块需要略大一点，12px 下细节会糊在一起
  const sizes = {
    sm: 'w-3.5 h-3.5 min-w-3.5 min-h-3.5',
    md: 'w-[18px] h-[18px] min-w-[18px] min-h-[18px]',
    lg: 'w-[22px] h-[22px] min-w-[22px] min-h-[22px]'
  }
</script>
