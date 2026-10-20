<template>
  <div class="container mx-auto flex h-[calc(100svh-3.75rem)] flex-col overflow-hidden p-4 sm:p-6">
    <!-- 四段式滑槽切换：建筑 / 研究 / 船坞 / 防御 -->
    <div
      class="relative mb-4 grid h-9 w-full shrink-0 grid-cols-4 rounded-lg bg-muted p-[3px] text-muted-foreground sm:mb-6"
      role="tablist"
      :aria-label="t('nav.base')"
    >
      <span
        class="pointer-events-none absolute inset-y-[3px] left-[3px] w-[calc((100%-6px)/4)] rounded-md border border-border bg-background shadow-md transition-transform duration-300 ease-out"
        :style="{ transform: `translateX(${activeIndex * 100}%)` }"
        aria-hidden="true"
      />
      <button
        v-for="(tab, index) in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.key"
        :tabindex="activeTab === tab.key ? 0 : -1"
        class="relative z-10 flex h-[calc(100%-1px)] min-w-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs font-medium whitespace-nowrap transition-all sm:text-sm"
        :class="activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'"
        @click="selectTab(tab.key)"
        @keydown.right.prevent="selectTab(adjacentTab(index, 1))"
        @keydown.left.prevent="selectTab(adjacentTab(index, -1))"
      >
        <component :is="tab.icon" class="hidden h-4 w-4 shrink-0 sm:block" />
        <span class="truncate">{{ t(tab.labelKey) }}</span>
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto pr-1">
      <KeepAlive>
        <component :is="activeComponent" :embedded="true" />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, type Component } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Building2, FlaskConical, Ship, Shield } from 'lucide-vue-next'
  import BuildingsView from '@/views/BuildingsView.vue'
  import ResearchView from '@/views/ResearchView.vue'
  import ShipyardView from '@/views/ShipyardView.vue'
  import DefenseView from '@/views/DefenseView.vue'
  import { useI18n } from '@/composables/useI18n'

  type BaseTab = 'buildings' | 'research' | 'shipyard' | 'defense'

  interface TabDefinition {
    key: BaseTab
    labelKey: string
    icon: Component
    component: Component
  }

  const tabs: TabDefinition[] = [
    { key: 'buildings', labelKey: 'nav.buildings', icon: Building2, component: BuildingsView },
    { key: 'research', labelKey: 'nav.research', icon: FlaskConical, component: ResearchView },
    { key: 'shipyard', labelKey: 'nav.shipyard', icon: Ship, component: ShipyardView },
    { key: 'defense', labelKey: 'nav.defense', icon: Shield, component: DefenseView }
  ]

  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()

  const activeTab = computed<BaseTab>(() => {
    const value = String(route.query.tab ?? 'buildings')
    return tabs.some(tab => tab.key === value) ? (value as BaseTab) : 'buildings'
  })

  const activeIndex = computed(() => tabs.findIndex(tab => tab.key === activeTab.value))
  const activeComponent = computed(() => tabs.find(tab => tab.key === activeTab.value)!.component)

  const adjacentTab = (index: number, offset: number): BaseTab => {
    const next = (index + offset + tabs.length) % tabs.length
    return tabs[next]!.key
  }

  const selectTab = (tab: BaseTab): void => {
    if (tab === activeTab.value) return
    void router.replace({ path: '/base', query: { ...route.query, tab } })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
</script>
