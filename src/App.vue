<template>
  <!-- 首页：无侧边栏/头部 -->
  <RouterView v-if="isHomePage" />

  <!-- 其他页面：完整布局（含侧边栏） -->
  <SidebarProvider v-else :open="sidebarOpen" @update:open="handleSidebarOpenChange">
    <Sidebar collapsible="icon">
      <!-- 标志 -->
      <SidebarHeader class="border-b">
        <button
          type="button"
          class="flex w-full items-center justify-center p-4 transition-colors hover:bg-muted/50 group-data-[collapsible=icon]:p-2"
          :title="t('online.mainMenu')"
          @click="router.push('/')"
        >
          <img src="@/assets/logo.svg" class="w-10 group-data-[collapsible=icon]:w-8" />
          <h1 class="text-xl font-bold ml-2 group-data-[collapsible=icon]:hidden">{{ pkg.title }}</h1>
        </button>
      </SidebarHeader>

      <SidebarContent>
        <!-- 星球信息 -->
        <SidebarGroup v-if="planet" class="border-b group-data-[collapsible=icon]:hidden">
          <div class="px-4 py-3 space-y-2 text-sm">
            <!-- 星球切换器 -->
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  data-tutorial="planet-selector"
                  variant="outline"
                  class="w-full justify-between h-auto px-3 py-2.5 border-2 hover:bg-accent hover:border-primary transition-colors"
                >
                  <div class="flex items-start gap-2.5 flex-1 min-w-0">
                    <Globe class="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                    <div class="flex-1 min-w-0 text-left">
                      <div class="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                        {{ t('planet.currentPlanet') }}
                      </div>
                      <div class="flex items-center gap-1.5 mb-0.5">
                        <span class="truncate font-semibold text-sm">
                          {{ planet.name }}
                          [{{ planet.position.galaxy }}:{{ planet.position.system }}:{{ planet.position.position }}]
                        </span>
                        <Badge v-if="planet.isMoon" variant="secondary" class="text-[10px] px-1 py-0 h-4">
                          {{ t('planet.moon') }}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <ChevronsUpDown class="h-4 w-4 shrink-0 text-muted-foreground ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-70 p-0" side="bottom" align="start">
                <div class="p-2">
                  <div class="px-2 py-1.5 mb-1 text-xs font-semibold text-muted-foreground">
                    {{ t('planet.switchPlanet') }}
                  </div>
                  <div class="space-y-0.5 max-h-80 overflow-y-auto">
                    <div v-for="p in gameStore.player.planets" :key="p.id" class="flex items-center gap-1">
                      <Button
                        @click="switchToPlanet(p.id)"
                        :variant="p.id === planet.id ? 'secondary' : 'ghost'"
                        class="flex-1 justify-start h-auto py-2 px-2"
                        size="sm"
                      >
                        <div class="flex items-start gap-2 w-full min-w-0">
                          <Globe class="h-4 w-4 shrink-0 mt-0.5" :class="p.id === planet.id ? 'text-primary' : ''" />
                          <div class="flex-1 min-w-0 text-left">
                            <div class="flex items-center gap-1.5 mb-0.5">
                              <span class="truncate font-medium text-sm">
                                {{ p.name }}
                                [{{ p.position.galaxy }}:{{ p.position.system }}:{{ p.position.position }}]
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                class="h-2 w-2 p-0 shrink-0"
                                @click.stop="openRenameDialog(p.id, p.name)"
                                :title="t('planet.renamePlanet')"
                              >
                                <Pencil class="h-2 w-2" />
                              </Button>
                              <Badge v-if="p.isMoon" variant="outline" class="text-[10px] px-1 py-0 h-4">
                                {{ t('planet.moon') }}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <!-- 玩家积分显示 -->
            <div class="bg-muted/50 rounded-lg p-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-muted-foreground">{{ t('player.points') }}</span>
                <span class="text-sm font-bold text-primary">{{ formatNumber(gameStore.player.points) }}</span>
              </div>
            </div>
            <!-- 月球切换按钮 -->
            <div v-if="hasMoon || planet.isMoon" class="flex gap-1">
              <Button v-if="planet.isMoon" @click="switchToParentPlanet" variant="outline" size="sm" class="w-full text-xs h-7">
                {{ t('planet.backToPlanet') }}
              </Button>
              <Button v-else-if="moon" @click="switchToMoon" variant="outline" size="sm" class="w-full text-xs h-7">
                {{ t('planet.switchToMoon') }}
              </Button>
            </div>
          </div>
        </SidebarGroup>

        <!-- 导航菜单 -->
        <SidebarGroup data-tutorial="navigation">
          <SidebarMenu>
            <SidebarMenuItem v-for="item in navItems" :key="item.path">
              <SidebarMenuButton
                :data-nav-path="item.path"
                :is-active="$route.path === item.path"
                :tooltip="item.name.value"
                :disabled="!isFeatureUnlocked(item.path)"
                @click="navigateTo(item.path)"
              >
                <component :is="item.icon" />
                <span>{{ item.name.value }}</span>
                <!-- 未读消息数量 -->
                <SidebarMenuBadge
                  v-if="item.path === '/messages' && unreadMessagesCount > 0"
                  class="bg-destructive text-destructive-foreground"
                >
                  {{ unreadMessagesCount }}
                </SidebarMenuBadge>
                <!-- 正在执行的舰队任务数量 -->
                <SidebarMenuBadge v-if="item.path === '/fleet' && activeFleetMissionsCount > 0" class="bg-primary text-primary-foreground">
                  {{ activeFleetMissionsCount }}
                </SidebarMenuBadge>
                <SidebarMenuBadge
                  v-if="item.path === '/players' && pendingPlayerTradesCount > 0"
                  class="bg-destructive text-destructive-foreground"
                >
                  {{ pendingPlayerTradesCount }}
                </SidebarMenuBadge>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <!-- 底部设置 -->
      <SidebarFooter class="border-t">
        <SidebarMenu>
          <!-- 语言切换 -->
          <SidebarMenuItem>
            <Popover>
              <PopoverTrigger as-child>
                <SidebarMenuButton :tooltip="localeNames[gameStore.locale]">
                  <Languages />
                  <span>{{ localeNames[gameStore.locale] }}</span>
                </SidebarMenuButton>
              </PopoverTrigger>
              <PopoverContent
                class="w-48 p-2"
                :side="sidebarOpen || innerWidth < 768 ? 'top' : 'right'"
                :align="sidebarOpen || innerWidth < 768 ? 'center' : 'end'"
              >
                <div class="space-y-1">
                  <Button
                    v-for="locale in locales"
                    :key="locale"
                    @click="gameStore.locale = locale"
                    :variant="gameStore.locale === locale ? 'secondary' : 'ghost'"
                    class="w-full justify-start"
                    size="sm"
                  >
                    {{ localeNames[locale] }}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </SidebarMenuItem>

          <!-- 夜间模式切换 -->
          <SidebarMenuItem>
            <SidebarMenuButton @click="isDark = !isDark" :tooltip="isDark ? t('sidebar.lightMode') : t('sidebar.darkMode')">
              <Sun v-if="isDark" />
              <Moon v-else />
              <span>{{ isDark ? t('sidebar.lightMode') : t('sidebar.darkMode') }}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <!-- 折叠按钮 -->
          <SidebarMenuItem class="hidden sm:inline">
            <SidebarMenuButton @click="toggleSidebar" :tooltip="sidebarOpen ? t('sidebar.collapse') : t('sidebar.expand')">
              <ChevronsLeft class="group-data-[state=collapsed]:rotate-180 transition-transform" />
              <span>{{ t('sidebar.collapse') }}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>

    <!-- 主内容区 -->
    <SidebarInset>
      <div class="flex flex-col h-full" :class="Capacitor.isNativePlatform() ? 'pt-[80px]' : 'pt-[60px]'">
        <!-- 顶部资源栏 - 固定定位 -->
        <header
          v-if="planet"
          ref="header"
          class="fixed top-0 right-0 left-0 z-40 bg-card border-b px-4 sm:px-6 shadow-md"
          :class="[
            sidebarOpen ? 'lg:left-[var(--sidebar-width)]' : 'lg:left-[var(--sidebar-width-icon)]',
            Capacitor.isNativePlatform() ? 'py-6' : 'py-3'
          ]"
        >
          <div class="flex flex-col gap-3">
            <!-- 第一行：菜单、资源预览、状态 -->
            <div
              class="grid items-center gap-3 sm:gap-6"
              style="grid-template-columns: auto 1fr auto"
              :class="{
                'relative top-3': Capacitor.isNativePlatform()
              }"
            >
              <!-- 左侧：汉堡菜单（移动端）/ 占位（PC端） -->
              <div>
                <SidebarTrigger class="lg:hidden" data-tutorial="mobile-menu" />
              </div>

              <!-- 资源显示 - PC端居中，移动端可折叠 -->
              <!-- 关键：min-w-0 + overflow-hidden，避免横向滚动内容溢出覆盖左侧菜单按钮 -->
              <div class="min-w-0 overflow-hidden">
                <div
                  class="resource-bar flex items-center gap-3 sm:gap-6 justify-start sm:justify-center"
                  :class="[resourceBarExpanded ? 'hidden' : 'overflow-x-auto']"
                >
                  <div v-for="resourceType in resourceTypes" :key="resourceType.key" class="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <ResourceIcon :type="resourceType.key" size="md" />
                    <div class="min-w-0">
                      <!-- 电力显示：当前储量/最大容量，净产量/小时 -->
                      <template v-if="resourceType.key === 'energy'">
                        <p
                          class="text-xs sm:text-sm font-medium truncate"
                          :class="getResourceColor(planet.resources.energy, capacity?.energy || Infinity)"
                        >
                          {{ formatNumber(planet.resources.energy) }} /
                          {{ formatNumber(capacity?.energy || 0) }}
                        </p>
                        <p
                          class="text-[10px] sm:text-xs truncate"
                          :class="netEnergy >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                        >
                          {{ netEnergy >= 0 ? '+' : '' }}{{ formatNumber(Math.round(netEnergy / 60)) }}/{{ t('resources.perMinute') }}
                        </p>
                      </template>
                      <!-- 其他资源统一显示：当前值/容量 -->
                      <template v-else>
                        <p
                          class="text-xs sm:text-sm font-medium truncate"
                          :class="getResourceColor(planet.resources[resourceType.key], capacity?.[resourceType.key] || Infinity)"
                        >
                          {{ formatNumber(planet.resources[resourceType.key]) }} /
                          {{ formatNumber(capacity?.[resourceType.key] || 0) }}
                        </p>
                        <p class="text-[10px] sm:text-xs text-muted-foreground truncate">
                          +{{ formatNumber(Math.round((production?.[resourceType.key] || 0) / 60)) }}/{{ t('resources.perMinute') }}
                        </p>
                      </template>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 右侧：队列通知 + 展开按钮 -->
              <div class="flex items-center gap-2 sm:gap-3 shrink-0 justify-end">
                <!-- 移动端展开按钮 -->
                <Button @click="resourceBarExpanded = !resourceBarExpanded" variant="ghost" size="sm" class="lg:hidden h-8 w-8 p-0">
                  <ChevronDown v-if="!resourceBarExpanded" class="h-4 w-4" />
                  <ChevronUp v-else class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <!-- 展开的资源详情（仅移动端且展开时显示） - absolute定位覆盖在内容上，带过渡动画 -->
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 -translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-2"
        >
          <div
            v-if="planet && resourceBarExpanded"
            class="fixed right-0 left-0 z-30 bg-card border-b px-4 py-3 shadow-md lg:hidden"
            :class="[
              sidebarOpen ? 'lg:left-[var(--sidebar-width)]' : 'lg:left-[var(--sidebar-width-icon)]',
              Capacitor.isNativePlatform() ? 'top-[80px]' : 'top-[60px]'
            ]"
          >
            <div class="grid grid-cols-2 gap-3">
              <div v-for="resourceType in resourceTypes" :key="resourceType.key" class="bg-muted/50 rounded-lg p-2.5">
                <div class="flex items-center justify-center gap-2 mb-1.5">
                  <ResourceIcon :type="resourceType.key" size="md" />
                  <span class="text-xs font-medium text-muted-foreground">{{ t(`resources.${resourceType.key}`) }}</span>
                </div>
                <div class="space-y-0.5 text-center">
                  <!-- 电力显示：当前储量，容量，净产量/分钟 -->
                  <template v-if="resourceType.key === 'energy'">
                    <p class="text-sm font-semibold" :class="getResourceColor(planet.resources.energy, capacity?.energy || Infinity)">
                      {{ formatNumber(planet.resources.energy) }}
                    </p>
                    <p class="text-[10px] text-muted-foreground">
                      {{ t('resources.capacity') }}: {{ formatNumber(capacity?.energy || 0) }}
                    </p>
                    <p
                      class="text-[10px]"
                      :class="netEnergy >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                    >
                      {{ t('resources.production') }}: {{ netEnergy >= 0 ? '+' : '' }}{{ formatNumber(Math.round(netEnergy / 60)) }}/{{
                        t('resources.perMinute')
                      }}
                    </p>
                  </template>
                  <!-- 其他资源统一显示：当前值/容量 -->
                  <template v-else>
                    <p
                      class="text-sm font-semibold"
                      :class="getResourceColor(planet.resources[resourceType.key], capacity?.[resourceType.key] || Infinity)"
                    >
                      {{ formatNumber(planet.resources[resourceType.key]) }}
                    </p>
                    <p class="text-[10px] text-muted-foreground">
                      {{ t('resources.capacity') }}: {{ formatNumber(capacity?.[resourceType.key] || 0) }}
                    </p>
                    <p class="text-[10px] text-muted-foreground">
                      {{ t('resources.production') }}: +{{ formatNumber(Math.round((production?.[resourceType.key] || 0) / 60)) }}/{{
                        t('resources.perMinute')
                      }}
                    </p>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- 即将到来的敌对舰队警告 -->
        <IncomingFleetAlerts @open-panel="openEnemyAlertPanel" />

        <!-- 低电量警告 -->
        <LowEnergyWarning />

        <!-- 矿脉储量警告 -->
        <OreDepositWarning />

        <!-- 内容区域 -->
        <main class="flex-1">
          <Transition name="page" mode="out-in">
            <div :key="$route.fullPath" class="h-full">
              <!-- 背景动画开启时 -->
              <template v-if="gameStore.player.backgroundEnabled">
                <StarsBackground v-if="isDark" :factor="0.05" :speed="50" star-color="#fff" class="h-full">
                  <div class="relative z-10 h-full">
                    <RouterView />
                  </div>
                </StarsBackground>

                <div v-else class="relative h-full w-full overflow-hidden">
                  <div class="relative z-10 h-full">
                    <RouterView />
                  </div>

                  <ParticlesBg class="absolute inset-0 z-0" :quantity="100" :ease="100" color="#000" :staticity="10" refresh />
                </div>
              </template>

              <!-- 背景动画关闭时 -->
              <div v-else class="h-full">
                <RouterView />
              </div>
            </div>
          </Transition>
        </main>
      </div>
    </SidebarInset>

    <!-- 右下角固定通知按钮 -->
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2" :class="{ 'bottom-15': Capacitor.isNativePlatform() }">
      <!-- 返回顶部 -->
      <BackToTop />
      <!-- 队列通知 -->
      <QueueNotifications />

      <!-- 外交通知 -->
      <DiplomaticNotifications />

      <!-- 敌方警报 -->
      <EnemyAlertNotifications ref="enemyAlertNotificationsRef" />

      <!-- 银河频道（仅联机模式） -->
      <ChatPanel v-if="netStore.enabled" />
    </div>

    <!-- 确认对话框 -->
    <AlertDialog :open="confirmDialogOpen" @update:open="confirmDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ confirmDialogTitle }}</AlertDialogTitle>
          <AlertDialogDescription class="whitespace-pre-line">
            {{ confirmDialogMessage }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction @click="handleConfirmDialogConfirm">{{ t('common.confirm') }}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <!-- 详情弹窗 -->
    <DetailDialog />
    <!-- 更新弹窗 -->
    <UpdateDialog v-model:open="showUpdateDialog" :version-info="updateInfo" />
    <!-- 弱引导提示系统 -->
    <HintToast />
    <!-- Toast 通知 -->
    <Sonner position="top-center" />
    <!-- 重命名星球对话框 -->
    <Dialog v-model:open="renameDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('planet.renamePlanetTitle') }}</DialogTitle>
          <DialogDescription class="sr-only">{{ t('planet.renamePlanetTitle') }}</DialogDescription>
        </DialogHeader>
        <div class="py-4">
          <Input v-model="newPlanetName" :placeholder="t('planet.planetNamePlaceholder')" @keyup.enter="confirmRenamePlanet" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="renameDialogOpen = false">
            {{ t('common.cancel') }}
          </Button>
          <Button @click="confirmRenamePlanet" :disabled="!newPlanetName.trim()">
            {{ t('planet.rename') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </SidebarProvider>

  <!-- Android 退出确认对话框 -->
  <AlertDialog v-model:open="exitDialogOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('common.exitConfirmTitle') }}</AlertDialogTitle>
        <AlertDialogDescription>{{ t('common.exitConfirmMessage') }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <AlertDialogAction @click="exitApp">{{ t('common.confirm') }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- NPC 名称更新确认对话框 -->
  <AlertDialog v-model:open="npcNameUpdateDialogOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('settings.npcNameUpdateTitle') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('settings.npcNameUpdateMessage', { count: oldFormatNPCCount }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="handleSkipNPCNameUpdate">{{ t('settings.npcNameUpdateCancel') }}</AlertDialogCancel>
        <AlertDialogAction @click="handleUpdateNPCNames">{{ t('settings.npcNameUpdateConfirm') }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
  import { onMounted, onUnmounted, computed, ref, watch } from 'vue'
  import { RouterView, useRouter } from 'vue-router'
  import { useGameStore } from '@/stores/gameStore'
  import { useUniverseStore } from '@/stores/universeStore'
  import { useNPCStore } from '@/stores/npcStore'
  import { useNetStore } from '@/stores/netStore'
  import { useTheme } from '@/composables/useTheme'
  import { useI18n } from '@/composables/useI18n'
  import { useGameConfig } from '@/composables/useGameConfig'
  import { localeNames, detectBrowserLocale, type Locale } from '@/locales'
  import { Button } from '@/components/ui/button'
  import { Badge } from '@/components/ui/badge'
  import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
  import { Input } from '@/components/ui/input'
  import IncomingFleetAlerts from '@/components/notifications/IncomingFleetAlerts.vue'
  import LowEnergyWarning from '@/components/notifications/LowEnergyWarning.vue'
  import OreDepositWarning from '@/components/notifications/OreDepositWarning.vue'
  import DiplomaticNotifications from '@/components/notifications/DiplomaticNotifications.vue'
  import EnemyAlertNotifications from '@/components/notifications/EnemyAlertNotifications.vue'
  import QueueNotifications from '@/components/notifications/QueueNotifications.vue'
  import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger
  } from '@/components/ui/sidebar'
  import ResourceIcon from '@/components/common/ResourceIcon.vue'
  import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
  } from '@/components/ui/alert-dialog'
  import DetailDialog from '@/components/dialogs/DetailDialog.vue'
  import UpdateDialog from '@/components/dialogs/UpdateDialog.vue'
  import HintToast from '@/components/notifications/HintToast.vue'
  import BackToTop from '@/components/common/BackToTop.vue'
  import ChatPanel from '@/components/chat/ChatPanel.vue'
  import Sonner from '@/components/ui/sonner/Sonner.vue'
  import { BuildingType, TechnologyType, ShipType, DefenseType } from '@/types/game'
  import type { VersionInfo } from '@/utils/versionCheck'
  import { formatNumber, getResourceColor } from '@/utils/format'
  import { scaleNumber, scaleResources } from '@/utils/speed'
  import {
    Moon,
    Sun,
    Home,
    Building2,
    Rocket,
    Mail,
    Globe,
    Users,
    Swords,
    Languages,
    Settings,
    Wrench,
    ChevronsLeft,
    ChevronsUpDown,
    ChevronDown,
    ChevronUp,
    Handshake,
    MessageCircle,
    Pencil,
    Trophy,
    Crown,
    Scroll
  } from 'lucide-vue-next'
  import * as gameLogic from '@/logic/gameLogic'
  import * as campaignLogic from '@/logic/campaignLogic'
  import * as planetLogic from '@/logic/planetLogic'
  import * as officerLogic from '@/logic/officerLogic'
  import * as resourceLogic from '@/logic/resourceLogic'
  import * as publicLogic from '@/logic/publicLogic'
  import * as oreDepositLogic from '@/logic/oreDepositLogic'
  import { countOldFormatNPCs, updateNPCName } from '@/logic/npcNameGenerator'
  // 无头核心：游戏推进逻辑（可同时在浏览器与 Node 服务端运行）
  import { createWorld as createGameWorld } from '@/core/world'
  import { tick } from '@/core/engine'
  import { generateNpcPlanets } from '@/core/generate'
  import { createEngineContext } from '@/core/types'
  import type { EngineEvent } from '@/core/types'
  import { setBattleRunner } from '@/core/battleRunner'
  import { workerBattleRunner } from '@/workers/workerBattleRunner'
  import { dispatchCommand, setGameRuntime } from '@/core/runtime'
  import pkg from '../package.json'
  import { toast } from 'vue-sonner'
  import { migrateGameData } from '@/utils/migration'
  import { checkLatestVersion } from '@/utils/versionCheck'
  import { useAppUpdate } from '@/composables/useAppUpdate'
  import { StarsBackground } from '@/components/ui/bg-stars'
  import { ParticlesBg } from '@/components/ui/particles-bg'
  import { App as CapacitorApp } from '@capacitor/app'
  import { Capacitor } from '@capacitor/core'

  // 执行数据迁移（在 store 初始化之前）
  migrateGameData()

  const router = useRouter()
  const gameStore = useGameStore()
  const universeStore = useUniverseStore()
  const npcStore = useNPCStore()
  const netStore = useNetStore()
  const { isDark } = useTheme()
  const { t } = useI18n()
  const { BUILDINGS, TECHNOLOGIES } = useGameConfig()
  const appUpdate = useAppUpdate()
  const enemyAlertNotificationsRef = ref<InstanceType<typeof EnemyAlertNotifications> | null>(null)
  // ConfirmDialog 状态
  const confirmDialogOpen = ref(false)
  const confirmDialogTitle = ref('')
  const confirmDialogMessage = ref('')
  const innerWidth = computed(() => window.innerWidth)
  const confirmDialogAction = ref<(() => void) | null>(null)
  // 更新弹窗状态
  const showUpdateDialog = ref(false)
  const updateInfo = ref<VersionInfo | null>(null)
  // 所有可用的语言选项
  const locales: Locale[] = ['zh-CN', 'zh-TW', 'en', 'de', 'ru', 'es-LA', 'ko', 'ja']
  // 侧边栏状态（不持久化，根据屏幕尺寸初始化）
  // PC端（≥1024px）默认打开，移动端默认关闭
  const sidebarOpen = ref(window.innerWidth >= 1024)
  // 移动端资源栏展开状态
  const resourceBarExpanded = ref(false)

  // 游戏循环定时器
  const gameLoop = ref<ReturnType<typeof setInterval> | null>(null)
  const pointsUpdateInterval = ref<ReturnType<typeof setInterval> | null>(null)
  const konamiCleanup = ref<(() => void) | null>(null)
  const versionCheckInterval = ref<ReturnType<typeof setInterval> | null>(null) // 重命名星球相关状态
  const renameDialogOpen = ref(false)
  const renamingPlanetId = ref<string | null>(null)
  const newPlanetName = ref('')
  // Android 退出确认对话框状态
  const exitDialogOpen = ref(false)
  // NPC 名称更新对话框状态
  const npcNameUpdateDialogOpen = ref(false)
  const oldFormatNPCCount = ref(0)
  // 功能解锁要求配置
  const featureRequirements: Record<string, { building: BuildingType; level: number }> = {
    '/fleet': { building: BuildingType.Shipyard, level: 1 },
    '/officers': { building: BuildingType.Shipyard, level: 1 }
  }

  // 判断是否为首页
  const isHomePage = computed(() => router.currentRoute.value.path === '/')

  // 定义 planet computed（需要在 watch 之前定义）
  const planet = computed(() => gameStore.currentPlanet)

  // 资源类型配置
  const resourceTypes = [
    { key: 'metal' as const },
    { key: 'crystal' as const },
    { key: 'deuterium' as const },
    { key: 'energy' as const },
    { key: 'darkMatter' as const }
  ]

  const navItems = computed(() => [
    { name: computed(() => t('nav.overview')), path: '/overview', icon: Home },
    { name: computed(() => t('nav.base')), path: '/base', icon: Building2 },
    { name: computed(() => t('nav.fleet')), path: '/fleet', icon: Rocket },
    { name: computed(() => t('nav.officers')), path: '/officers', icon: Users },
    { name: computed(() => t('nav.simulator')), path: '/battle-simulator', icon: Swords },
    { name: computed(() => t('nav.galaxy')), path: '/galaxy', icon: Globe },
    { name: computed(() => t('nav.diplomacy')), path: '/diplomacy', icon: Handshake },
    { name: computed(() => t('nav.players')), path: '/players', icon: MessageCircle },
    { name: computed(() => t('nav.achievements')), path: '/achievements', icon: Trophy },
    { name: computed(() => t('nav.campaign')), path: '/campaign', icon: Scroll },
    { name: computed(() => t('nav.ranking')), path: '/ranking', icon: Crown },
    { name: computed(() => t('nav.messages')), path: '/messages', icon: Mail },
    { name: computed(() => t('nav.settings')), path: '/settings', icon: Settings },
    // GM菜单在启用GM模式时显示
    ...(gameStore.player.isGMEnabled ? [{ name: computed(() => t('nav.gm')), path: '/gm', icon: Wrench }] : [])
  ])

  // 使用直接计算，不再缓存
  const production = computed(() => {
    if (!planet.value) return null
    const now = Date.now()
    const bonuses = officerLogic.calculateActiveBonuses(gameStore.player.officers, now)
    const base = resourceLogic.calculateResourceProduction(planet.value, {
      resourceProductionBonus: bonuses.resourceProductionBonus,
      darkMatterProductionBonus: bonuses.darkMatterProductionBonus,
      energyProductionBonus: bonuses.energyProductionBonus
    })
    return scaleResources(base, gameStore.gameSpeed)
  })

  const capacity = computed(() => {
    if (!planet.value) return null
    const now = Date.now()
    const bonuses = officerLogic.calculateActiveBonuses(gameStore.player.officers, now)
    return resourceLogic.calculateResourceCapacity(planet.value, bonuses.storageCapacityBonus)
  })

  // 电力消耗
  const energyConsumption = computed(() => {
    if (!planet.value) return 0
    return scaleNumber(resourceLogic.calculateEnergyConsumption(planet.value), gameStore.gameSpeed)
  })

  // 净电力（产量 - 消耗）
  const netEnergy = computed(() => {
    if (!planet.value || !production.value) return 0
    return production.value.energy - energyConsumption.value
  })

  // 未读消息数量
  const unreadMessagesCount = computed(() => {
    const unreadBattles = gameStore.player.battleReports.filter(r => !r.read).length
    const unreadSpies = gameStore.player.spyReports.filter(r => !r.read).length
    const unreadSpied = gameStore.player.spiedNotifications?.filter(n => !n.read).length || 0
    const unreadMissions = gameStore.player.missionReports?.filter(r => !r.read).length || 0
    const unreadNPCActivity = gameStore.player.npcActivityNotifications?.filter(n => !n.read).length || 0
    const unreadGifts = gameStore.player.giftNotifications?.filter(n => !n.read).length || 0
    const unreadGiftRejected = gameStore.player.giftRejectedNotifications?.filter(n => !n.read).length || 0
    const unreadTradeOffers = gameStore.player.tradeOffers?.filter(o => !o.read).length || 0
    const unreadIntelReports = gameStore.player.intelReports?.filter(r => !r.read).length || 0
    const unreadJointAttacks = gameStore.player.jointAttackInvites?.filter(i => !i.read).length || 0
    return (
      unreadBattles +
      unreadSpies +
      unreadSpied +
      unreadMissions +
      unreadNPCActivity +
      unreadGifts +
      unreadGiftRejected +
      unreadTradeOffers +
      unreadIntelReports +
      unreadJointAttacks
    )
  })

  // 待处理的玩家交易数量
  const pendingPlayerTradesCount = computed(
    () =>
      gameStore.player.playerTrades?.filter(
        trade => trade.toId === gameStore.player.id && trade.status === 'pending'
      ).length ?? 0
  )

  // 正在执行的舰队任务数量（包括飞行中的导弹）
  const activeFleetMissionsCount = computed(() => {
    const fleetMissions = gameStore.player.fleetMissions.filter(m => m.status === 'outbound' || m.status === 'returning').length
    const flyingMissiles = gameStore.player.missileAttacks?.filter(m => m.status === 'flying').length || 0
    return fleetMissions + flyingMissiles
  })

  // 月球相关
  const moon = computed(() => {
    if (!planet.value || planet.value.isMoon) return null
    return gameStore.getMoonForPlanet(planet.value.id)
  })

  const hasMoon = computed(() => !!moon.value)

  const handleNotification = (type: string, itemType: string, level?: number) => {
    const settings = gameStore.notificationSettings
    if (!settings) return

    // 检查主开关
    if (!settings.browser && !settings.inApp) return

    // 检查具体类型开关
    let typeKey: 'construction' | 'research'
    let title = ''
    let body = ''

    if (type === 'building') {
      typeKey = 'construction'
      const buildingType = itemType as BuildingType
      const name = BUILDINGS.value[buildingType]?.name || itemType
      title = t('notifications.constructionComplete')
      body = `${name} Lv ${level}`
    } else if (type === 'technology') {
      typeKey = 'research'
      const technologyType = itemType as TechnologyType
      const name = TECHNOLOGIES.value[technologyType]?.name || itemType
      title = t('notifications.researchComplete')
      body = `${name} Lv ${level}`
    } else {
      return
    }

    if (!settings.types[typeKey as keyof typeof settings.types]) return

    // 浏览器通知
    if (settings.browser && 'Notification' in window && Notification.permission === 'granted') {
      const shouldSuppress = settings.suppressInFocus && document.hasFocus()
      if (!shouldSuppress) {
        new Notification(title, { body, icon: '/favicon.ico' })
      }
    }

    // 页面内 toast 通知
    if (settings.inApp) {
      toast.success(title, { description: body })
    }
  }

  // 处理解锁通知
  const handleUnlockNotification = (unlockedItems: Array<{ type: 'building' | 'technology'; id: string; name: string }>) => {
    const settings = gameStore.notificationSettings
    if (!settings) return

    // 检查主开关和解锁类型开关
    if (!settings.browser && !settings.inApp) return
    if (!settings.types.unlock) return

    unlockedItems.forEach(item => {
      const title = t('notifications.newUnlock')
      const typeLabel = item.type === 'building' ? t('notifications.building') : t('notifications.technology')
      const body = `${typeLabel}: ${item.name}`

      // 浏览器通知
      if (settings.browser && 'Notification' in window && Notification.permission === 'granted') {
        const shouldSuppress = settings.suppressInFocus && document.hasFocus()
        if (!shouldSuppress) {
          new Notification(title, { body, icon: '/favicon.ico' })
        }
      }

      // 页面内 toast 通知
      if (settings.inApp) {
        toast.info(title, { description: body })
      }
    })
  }

  const handleConfirmDialogConfirm = () => {
    if (confirmDialogAction.value) {
      confirmDialogAction.value()
    }
    confirmDialogOpen.value = false
  }

  const initGame = async () => {
    // 联机模式下世界由服务器下发，本地不做任何初始化/迁移
    if (netStore.enabled) return
    const shouldInit = gameLogic.shouldInitializeGame(gameStore.player.planets)
    if (!shouldInit) {
      const now = Date.now()
      // 迁移矿脉储量数据（为没有矿脉数据的星球初始化）
      gameStore.player.planets.forEach(planet => {
        oreDepositLogic.migrateOreDeposits(planet)
      })
      // 迁移NPC星球的矿脉储量
      npcStore.npcs.forEach(npc => {
        npc.planets.forEach(planet => {
          oreDepositLogic.migrateOreDeposits(planet)
        })
      })
      // 迁移宇宙地图中的星球（NPC星球的副本）
      Object.values(universeStore.planets).forEach(planet => {
        oreDepositLogic.migrateOreDeposits(planet)
      })

      // 计算离线收益（直接同步计算，应用游戏速度）
      const bonuses = officerLogic.calculateActiveBonuses(gameStore.player.officers, now)
      const miningTechLevel = gameStore.player.technologies[TechnologyType.MiningTechnology] || 0
      const techBonuses = {
        mineralResearchLevel: gameStore.player.technologies[TechnologyType.MineralResearch] || 0,
        crystalResearchLevel: gameStore.player.technologies[TechnologyType.CrystalResearch] || 0,
        fuelResearchLevel: gameStore.player.technologies[TechnologyType.FuelResearch] || 0
      }
      gameStore.player.planets.forEach(planet => {
        resourceLogic.updatePlanetResources(planet, now, bonuses, gameStore.gameSpeed, miningTechLevel, techBonuses)
      })

      // 只在没有NPC星球时才生成（首次加载已有玩家数据时）
      if (Object.keys(universeStore.planets).length === 0) {
        generateNPCPlanets()
      }

      // 数据迁移：为没有 bonusPoints 的玩家计算奖励积分
      if (gameStore.player.bonusPoints === undefined) {
        // 计算基础积分（建筑、科技、舰船、防御）
        let totalCost = 0
        gameStore.player.planets.forEach(planet => {
          Object.entries(planet.buildings).forEach(([buildingType, level]) => {
            totalCost += publicLogic.calculateBuildingTotalCost(buildingType as BuildingType, level)
          })
          Object.entries(planet.fleet).forEach(([shipType, count]) => {
            totalCost += publicLogic.calculateShipUnitCost(shipType as ShipType) * count
          })
          Object.entries(planet.defense).forEach(([defenseType, count]) => {
            totalCost += publicLogic.calculateDefenseUnitCost(defenseType as DefenseType) * count
          })
        })
        Object.entries(gameStore.player.technologies).forEach(([techType, level]) => {
          totalCost += publicLogic.calculateTechnologyTotalCost(techType as TechnologyType, level)
        })
        const basePoints = Math.floor(totalCost / 1000)
        // bonusPoints = 当前积分 - 基础积分
        gameStore.player.bonusPoints = Math.max(0, gameStore.player.points - basePoints)
      }

      // 迁移旧存档的战役进度（新增章节、旧版本任务状态修复）
      gameStore.player.campaignProgress = campaignLogic.initializeCampaignProgress(gameStore.player)

      // 初始化或更新玩家积分
      gameStore.player.points = publicLogic.calculatePlayerPoints(gameStore.player)

      return
    }
    gameStore.player = gameLogic.initializePlayer(gameStore.player.id, t('common.playerName'))
    const initialPlanet = planetLogic.createInitialPlanet(gameStore.player.id, t('planet.homePlanet'))
    gameStore.player.planets = [initialPlanet]
    gameStore.currentPlanetId = initialPlanet.id
    gameStore.player.campaignProgress = campaignLogic.initializeCampaignProgress(gameStore.player)
    // 新玩家初始化时生成NPC星球
    generateNPCPlanets()
    // 初始化玩家积分
    gameStore.player.points = publicLogic.calculatePlayerPoints(gameStore.player)
  }

  // ============================================================
  // 无头世界 + 引擎驱动
  // ------------------------------------------------------------
  // 游戏推进逻辑已抽取到 src/core 下，浏览器与服务端共用同一套代码。
  // 这里把 Pinia 中的对象引用交给引擎，引擎的就地修改会直接触发响应式更新。
  // ============================================================
  // 浏览器端：战斗计算继续交给 Web Worker，避免阻塞主线程
  setBattleRunner(workerBattleRunner)

  const world = createGameWorld({
    player: gameStore.player,
    planets: universeStore.planets,
    npcs: npcStore.npcs,
    debrisFields: universeStore.debrisFields,
    locale: gameStore.locale,
    gameSpeed: gameStore.gameSpeed,
    battleToFinish: gameStore.battleToFinish
  })

  // 把 store 侧可能变化的字段同步进 World（引擎不直接读取 store）
  const syncWorldFromStores = () => {
    world.player = gameStore.player
    world.locale = gameStore.locale
    world.gameSpeed = gameStore.gameSpeed
    world.battleToFinish = gameStore.battleToFinish
  }

  // 引擎事件 → UI 呈现（浏览器通知 / 应用内 toast）
  const handleEngineEvent = (event: EngineEvent) => {
    switch (event.kind) {
      case 'queueComplete':
        handleNotification(event.category, event.itemType, event.level)
        break
      case 'unlocks':
        handleUnlockNotification(event.items)
        break
      case 'toast': {
        const message = t(event.messageKey, event.messageParams)
        const description = event.descriptionKey ? t(event.descriptionKey, event.descriptionParams) : undefined
        const options = description ? { description } : undefined
        if (event.variant === 'success') toast.success(message, options)
        else if (event.variant === 'error') toast.error(message, options)
        else if (event.variant === 'warning') toast.warning(message, options)
        else toast.info(message, options)
        break
      }
      case 'achievement': {
        const tierName = t(`achievements.tiers.${event.tier}`)
        const achievementName = t(`achievements.names.${event.id}`)
        toast.success(t('achievements.unlocked'), { description: `${achievementName} (${tierName})` })
        break
      }
    }
  }

  const engineContext = createEngineContext({ t, emit: handleEngineEvent })

  // 注册运行时：视图层通过 dispatchCommand 发起操作，不再直接改 store
  setGameRuntime({ world, ctx: engineContext, sync: syncWorldFromStores })

  // 联机模式：引擎事件与命令拒绝都从这里回到 UI
  netStore.setHandlers({
    onEvent: handleEngineEvent,
    onReject: reason => toast.error(t(reason ?? 'errors.unknown')),
    onError: message => toast.error(message)
  })

  const generateNPCPlanets = () => {
    syncWorldFromStores()
    generateNpcPlanets(world, t('planet.planetPrefix'))
  }

  // 防止一次 tick 未结束时重入（战斗结算为异步）
  let isTicking = false

  const updateGame = async () => {
    // 联机模式下世界由服务器推进：本地只更新时间戳供 UI 倒计时使用
    if (netStore.enabled) {
      gameStore.gameTime = Date.now()
      return
    }
    if (gameStore.isPaused || isTicking) return
    isTicking = true
    try {
      const now = Date.now()
      gameStore.gameTime = now
      syncWorldFromStores()
      await tick(world, engineContext, now, 1)
    } finally {
      isTicking = false
    }
  }


  // 打开敌方警报面板
  const openEnemyAlertPanel = () => {
    enemyAlertNotificationsRef.value?.open()
  }

  // 启动游戏循环
  const startGameLoop = () => {
    if (gameStore.isPaused) return
    // 清理旧的定时器
    if (gameLoop.value) {
      clearInterval(gameLoop.value)
    }
    // 游戏循环固定为1秒，避免高倍速时的卡顿
    // gameSpeed 只作用于资源产出和时间消耗的倍率
    const interval = 1000
    // 启动新的游戏循环
    gameLoop.value = setInterval(() => {
      updateGame()
    }, interval)
  }

  // 停止游戏循环
  const stopGameLoop = () => {
    if (gameLoop.value) {
      clearInterval(gameLoop.value)
      gameLoop.value = null
    }
  }

  // 启动积分更新定时器（每10秒更新一次）
  const startPointsUpdate = () => {
    if (pointsUpdateInterval.value) {
      clearInterval(pointsUpdateInterval.value)
    }
    pointsUpdateInterval.value = setInterval(() => {
      // 联机模式的积分由服务端计算并随补丁下发
      if (!gameStore.isPaused && !netStore.enabled) {
        gameStore.player.points = publicLogic.calculatePlayerPoints(gameStore.player)
      }
    }, 10000) // 10秒更新一次
  }

  // 处理取消建造事件
  const handleCancelBuildEvent = (event: CustomEvent) => {
    handleCancelBuild(event.detail)
  }

  // 处理取消研究事件
  const handleCancelResearchEvent = (event: CustomEvent) => {
    handleCancelResearch(event.detail)
  }

  // 科乐美秘籍：上上下下左左右右BA
  const setupKonamiCode = () => {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'b', 'a']
    let konamiIndex = 0
    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果已经激活GM模式，直接返回
      if (gameStore.player.isGMEnabled) return
      // 联机模式下禁用秘籍（调试后门不能出现在线上环境）
      if (netStore.enabled) return

      const key = event.key.toLowerCase()
      // 检查是否匹配当前秘籍序列
      if (key === konamiCode[konamiIndex] || event.key === konamiCode[konamiIndex]) {
        konamiIndex++
        // 如果完成整个秘籍序列
        if (konamiIndex === konamiCode.length) {
          gameStore.player.isGMEnabled = true
          // 显示成功消息
          toast.success(t('common.gmModeActivated'))
          konamiIndex = 0
        }
      } else {
        // 如果按错了键，重置序列
        konamiIndex = 0
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    // 返回清理函数
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }

  // 打开重命名对话框
  const openRenameDialog = (planetId: string, currentName: string) => {
    renamingPlanetId.value = planetId
    newPlanetName.value = currentName
    renameDialogOpen.value = true
  }

  // 确认重命名
  const confirmRenamePlanet = () => {
    if (!renamingPlanetId.value || !newPlanetName.value.trim()) return

    // 必须走命令层：联机模式下直接改本地 store 会被服务端补丁覆盖
    const result = dispatchCommand({
      type: 'planet.rename',
      planetId: renamingPlanetId.value,
      name: newPlanetName.value.trim()
    })
    console.log('[rename] 提交结果', { online: netStore.isOnline, result })

    if (!result.ok) {
      toast.error(t(result.reason ?? 'errors.unknown'))
      return
    }

    renameDialogOpen.value = false
    renamingPlanetId.value = null
    newPlanetName.value = ''
  }

  // 检查功能是否解锁
  const isFeatureUnlocked = (path: string): boolean => {
    const requirement = featureRequirements[path]
    if (!requirement) {
      return true
    }
    const currentLevel = planet.value?.buildings[requirement.building] || 0
    return currentLevel >= requirement.level
  }

  // 切换到月球
  const switchToMoon = () => {
    if (moon.value) {
      gameStore.currentPlanetId = moon.value.id
      router.push('/overview')
    }
  }

  // 切换回母星
  const switchToParentPlanet = () => {
    if (planet.value?.parentPlanetId) {
      gameStore.currentPlanetId = planet.value.parentPlanetId
      router.push('/overview')
    }
  }

  // 切换到指定星球
  const switchToPlanet = (planetId: string) => {
    gameStore.currentPlanetId = planetId
    router.push('/overview')
  }

  const navigateTo = (path: string): void => {
    // 星系页是沉浸式全屏页面，点击入口时先收起菜单，再进入页面
    if (path === '/galaxy') sidebarOpen.value = false
    router.push(path)
  }

  // 切换侧边栏
  const toggleSidebar = () => {
    sidebarOpen.value = !sidebarOpen.value
  }

  // 处理侧边栏打开/关闭状态变化
  const handleSidebarOpenChange = (open: boolean) => {
    sidebarOpen.value = open
  }

  // 取消建造
  const handleCancelBuild = (queueId: string) => {
    confirmDialogTitle.value = t('queue.cancelBuild')
    confirmDialogMessage.value = t('queue.confirmCancel')
    confirmDialogAction.value = () => {
      if (!gameStore.currentPlanet) return false
      return dispatchCommand({
        type: 'building.cancel',
        planetId: gameStore.currentPlanet.id,
        queueId
      }).ok
    }
    confirmDialogOpen.value = true
  }

  // 取消研究
  const handleCancelResearch = (queueId: string) => {
    confirmDialogTitle.value = t('queue.cancelResearch')
    confirmDialogMessage.value = t('queue.confirmCancel')
    confirmDialogAction.value = () => {
      if (!gameStore.currentPlanet) return false
      return dispatchCommand({
        type: 'research.cancel',
        planetId: gameStore.currentPlanet.id,
        queueId
      }).ok
    }
    confirmDialogOpen.value = true
  }

  // 监听暂停状态变化
  watch(
    () => gameStore.isPaused,
    isPaused => {
      if (isPaused) {
        stopGameLoop()
      } else {
        startGameLoop()
      }
    }
  )

  // 初始化游戏
  onMounted(async () => {
    try {
      // 如果是首次访问（没有星球数据），使用浏览器语言自动检测
      const isFirstVisit = gameStore.player.planets.length === 0
      if (isFirstVisit) {
        gameStore.locale = detectBrowserLocale()
      }

      // 联机模式：由服务器下发世界状态，跳过单机初始化（避免覆盖服务器数据）
      const online = netStore.init()
      if (!online) {
        await initGame()
      }

      // 启动游戏循环（联机模式下只更新时间戳，不推进世界）
      startGameLoop()
      // 检测站点是否部署了新构建（版本号或构建时间变化）
      appUpdate.start()
      // 启动积分更新定时器（联机模式积分由服务端计算）
      if (!online) {
        startPointsUpdate()
      }
      // 启动科乐美秘籍监听
      konamiCleanup.value = setupKonamiCode()

      // 添加队列取消事件监听
      window.addEventListener('cancel-build', handleCancelBuildEvent as EventListener)
      window.addEventListener('cancel-research', handleCancelResearchEvent as EventListener)

      // 首次检查版本（被动检测）
      const versionInfo = await checkLatestVersion(gameStore.player.lastVersionCheckTime || 0, (time: number) => {
        gameStore.player.lastVersionCheckTime = time
      })
      if (versionInfo) {
        updateInfo.value = versionInfo
        toast.info(t('settings.newVersionAvailable', { version: versionInfo.version }), {
          duration: Infinity,
          dismissible: true,
          action: {
            label: t('settings.viewUpdate'),
            onClick: () => {
              showUpdateDialog.value = true
            }
          }
        })
      }

      // 检测旧格式 NPC 名称
      if (npcStore.npcs.length > 0) {
        const oldCount = countOldFormatNPCs(npcStore.npcs, gameStore.locale)
        if (oldCount > 0) {
          oldFormatNPCCount.value = oldCount
          npcNameUpdateDialogOpen.value = true
        }
      }

      // Android 返回键退出确认
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            router.back()
          } else {
            exitDialogOpen.value = true
          }
        })
      }

      // 启动版本检查定时器（每5分钟被动检查一次）
      versionCheckInterval.value = setInterval(async () => {
        const versionInfo = await checkLatestVersion(gameStore.player.lastVersionCheckTime || 0, (time: number) => {
          gameStore.player.lastVersionCheckTime = time
        })
        if (versionInfo) {
          updateInfo.value = versionInfo
          toast.info(t('settings.newVersionAvailable', { version: versionInfo.version }), {
            duration: Infinity,
            dismissible: true,
            action: {
              label: t('settings.viewUpdate'),
              onClick: () => {
                showUpdateDialog.value = true
              }
            }
          })
        }
      }, 5 * 60 * 1000)
    } catch (error) {
      console.error('Error during game initialization:', error)
      // 即使初始化失败，也尝试启动基本的游戏循环
      startGameLoop()
    }
  })

  // 清理定时器
  onUnmounted(() => {
    if (gameLoop.value) clearInterval(gameLoop.value)
    if (pointsUpdateInterval.value) clearInterval(pointsUpdateInterval.value)
    if (konamiCleanup.value) konamiCleanup.value()
    if (versionCheckInterval.value) clearInterval(versionCheckInterval.value)
    appUpdate.stop()
    // 移除队列取消事件监听
    window.removeEventListener('cancel-build', handleCancelBuildEvent as EventListener)
    window.removeEventListener('cancel-research', handleCancelResearchEvent as EventListener)
    // 移除 Android 返回键监听
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.removeAllListeners()
    }
  })

  // Android 退出应用
  const exitApp = () => {
    CapacitorApp.exitApp()
  }

  // NPC 名称更新处理
  const handleUpdateNPCNames = () => {
    let updatedCount = 0
    npcStore.npcs.forEach(npc => {
      const newName = updateNPCName(npc.id, gameStore.locale)
      if (newName !== npc.name) {
        npc.name = newName
        updatedCount++
      }
    })
    npcNameUpdateDialogOpen.value = false
    toast.success(t('settings.npcNameUpdateSuccess', { count: updatedCount }))
  }

  const handleSkipNPCNameUpdate = () => {
    npcNameUpdateDialogOpen.value = false
    toast.info(t('settings.npcNameUpdateSkipped'))
  }
</script>

<style scoped>
  /* 平滑滚动 */
  main {
    scroll-behavior: smooth;
  }
</style>
