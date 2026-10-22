import {
  Battery,
  Blocks,
  Box,
  Boxes,
  Bug,
  Cable,
  Cog,
  Cpu,
  Crosshair,
  Droplet,
  Fan,
  Flame,
  FlaskConical,
  Frame,
  Gem,
  Hexagon,
  Layers,
  Minus,
  Radiation,
  Rocket,
  Route,
  Scroll,
  Shield,
  Sun,
  Target,
  Triangle,
  Wind
} from 'lucide-vue-next'
import type { Component } from 'vue'

/**
 * 材料图标。全部使用 lucide 线性图标，与项目现有图标风格一致。
 * 键名对应 MaterialDef.icon。
 */
export const MATERIAL_ICONS: Record<string, Component> = {
  gem: Gem,
  plate: Layers,
  brick: Blocks,
  flame: Flame,
  gear: Cog,
  cable: Cable,
  cpu: Cpu,
  pipe: Route,
  stick: Minus,
  wind: Wind,
  droplet: Droplet,
  box: Box,
  engine: Fan,
  battery: Battery,
  module: Boxes,
  frame: Frame,
  rocket: Rocket,
  sun: Sun,
  radiation: Radiation,
  flask: FlaskConical,
  ammo: Target,
  wall: Blocks,
  crosshair: Crosshair,
  shield: Shield,
  bug: Bug,
  scroll: Scroll,
  shard: Triangle,
  core: Hexagon,
  wreck: Bug
}

/** 材料按等级取色，保持全局一套配色 */
export const TIER_COLOR: Record<string, string> = {
  T0: 'text-muted-foreground',
  T1: 'text-muted-foreground',
  T2: 'text-primary',
  T3: 'text-primary',
  T4: 'text-cyan-600 dark:text-cyan-400',
  T5: 'text-amber-600 dark:text-amber-400',
  T6: 'text-emerald-600 dark:text-emerald-400',
  T7: 'text-violet-600 dark:text-violet-400',
  T8: 'text-rose-600 dark:text-rose-400',
  T9: 'text-sky-600 dark:text-sky-400',
  T10: 'text-orange-600 dark:text-orange-400'
}
