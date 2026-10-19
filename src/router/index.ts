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
    { path: '/buildings', name: 'buildings', component: () => import('@/views/BuildingsView.vue') },
    { path: '/research', name: 'research', component: () => import('@/views/ResearchView.vue') },
    { path: '/shipyard', name: 'shipyard', component: () => import('@/views/ShipyardView.vue') },
    { path: '/defense', name: 'defense', component: () => import('@/views/DefenseView.vue') },
    { path: '/fleet', name: 'fleet', component: () => import('@/views/FleetView.vue') },
    { path: '/officers', name: 'officers', component: () => import('@/views/OfficersView.vue') },
    { path: '/battle-simulator', name: 'battle-simulator', component: () => import('@/views/BattleSimulatorView.vue') },
    { path: '/messages', name: 'messages', component: () => import('@/views/MessagesView.vue') },
    { path: '/galaxy', name: 'galaxy', component: () => import('@/views/GalaxyView.vue') },
    { path: '/starmap', redirect: '/galaxy' },
    { path: '/diplomacy', name: 'diplomacy', component: () => import('@/views/DiplomacyView.vue') },
    { path: '/players', name: 'players', component: () => import('@/views/PlayersView.vue') },
    { path: '/achievements', name: 'achievements', component: () => import('@/views/AchievementsView.vue') },
    { path: '/campaign', name: 'campaign', component: () => import('@/views/CampaignView.vue') },
    { path: '/ranking', name: 'ranking', component: () => import('@/views/RankingView.vue') },
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
