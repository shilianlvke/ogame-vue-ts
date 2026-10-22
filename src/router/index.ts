import { createRouter, createWebHashHistory } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import pkg from '../../package.json'

/** 是否处于联机模式（读取独立的联机配置键，避免依赖 store 初始化顺序） */
const isOnlineMode = (): boolean => {
  try {
    const raw = localStorage.getItem(`${pkg.name}-online`)
    return raw ? JSON.parse(raw).enabled === true : false
  } catch {
    return false
  }
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/overview', name: 'overview', component: () => import('@/views/OverviewView.vue') },
    { path: '/base', name: 'base', component: () => import('@/views/BaseView.vue') },
    { path: '/buildings', redirect: { path: '/base', query: { tab: 'buildings' } } },
    { path: '/research', redirect: { path: '/base', query: { tab: 'research' } } },
    { path: '/shipyard', redirect: { path: '/base', query: { tab: 'shipyard' } } },
    { path: '/defense', redirect: { path: '/base', query: { tab: 'defense' } } },
    { path: '/market', redirect: { path: '/base', query: { tab: 'market' } } },
    { path: '/launch', redirect: { path: '/base', query: { tab: 'launch' } } },
    { path: '/fleet', name: 'fleet', component: () => import('@/views/FleetView.vue') },
    { path: '/officers', name: 'officers', component: () => import('@/views/OfficersView.vue') },
    { path: '/battle-simulator', name: 'battle-simulator', component: () => import('@/views/BattleSimulatorView.vue') },
    { path: '/messages', name: 'messages', component: () => import('@/views/MessagesView.vue') },
    { path: '/galaxy', name: 'galaxy', component: () => import('@/views/GalaxyView.vue') },
    { path: '/starmap', redirect: '/galaxy' },
    // 玩家、排行、成就已并入总览页：保留旧地址跳转，避免书签失效
    { path: '/players', redirect: { path: '/overview', query: { chat: '1' } } },
    { path: '/achievements', redirect: '/overview' },
    { path: '/campaign', name: 'campaign', component: () => import('@/views/CampaignView.vue') },
    { path: '/ranking', redirect: '/overview' },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/gm', name: 'gm', component: () => import('@/views/GMView.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') }
  ]
})

// 路由守卫：首页是「模式选择」页，始终可访问；其它页面需要先同意隐私协议
router.beforeEach((to, _from, next) => {
  // 联机模式下禁用 GM 面板（调试后门不能出现在线上环境）
  if (to.path === '/gm' && isOnlineMode()) {
    next('/overview')
    return
  }

  // 首页：单机 / 联机入口，永远放行
  if (to.path === '/') {
    next()
    return
  }

  const gameStore = useGameStore()

  // 其余页面：未同意隐私协议则回到首页
  if (!gameStore.player.privacyAgreed) {
    next('/')
    return
  }

  next()
})

export default router
