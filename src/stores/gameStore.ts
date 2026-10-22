import { defineStore } from 'pinia'
import type {
  Planet,
  Player,
  BuildQueueItem,
  FleetMission,
  BattleResult,
  SpyReport,
  Officer,
  SpiedNotification,
  IncomingFleetAlert,
  MissileAttack,
  AchievementStats,
  AchievementProgress,
  WebDAVConfig
} from '@/types/game'
import { TechnologyType, OfficerType } from '@/types/game'
import { initializeAchievementStats, initializeAchievements } from '@/logic/achievementLogic'
import type { Locale } from '@/locales'
import pkg from '../../package.json'
import { encryptData, decryptData } from '@/utils/crypto'
import { saveStorage } from '@/services/saveStorage'

export const useGameStore = defineStore('game', {
  state: () => ({
    gameTime: Date.now(),
    isPaused: false,
    gameSpeed: 1,
    caravans: [] as Array<{ id: string; fromSystemId: string; toSystemId: string; departAt: number; arriveAt: number }>,
    battleToFinish: true, // 鎴樻枟鍒板簳妯″紡锛歠alse=缁忓吀妯″紡(6鍥炲悎骞冲眬)锛宼rue=鎴樻枟鍒板簳(鏈€澶?00鍥炲悎)
    player: {
      id: 'player1',
      name: '',
      planets: [] as Planet[],
      technologies: {} as Record<TechnologyType, number>,
      officers: {} as Record<OfficerType, Officer>,
      researchQueue: [] as BuildQueueItem[],
      waitingResearchQueue: [],
      fleetMissions: [] as FleetMission[],
      missileAttacks: [] as MissileAttack[],
      battleReports: [] as BattleResult[],
      spyReports: [] as SpyReport[],
      spiedNotifications: [] as SpiedNotification[],
      missionReports: [],
      incomingFleetAlerts: [] as IncomingFleetAlert[],
      points: 0,
      bonusPoints: 0,
      isGMEnabled: false, // 鏄庣‘璁剧疆 GM 妯″紡榛樿涓?false
      lastVersionCheckTime: 0, // 鏈€鍚庝竴娆℃鏌ョ増鏈殑鏃堕棿鎴筹紝榛樿涓?
      achievementStats: initializeAchievementStats() as AchievementStats,
      achievements: initializeAchievements() as Record<string, AchievementProgress>
    } as Player,
    currentPlanetId: '',
    isDark: '',
    locale: 'zh-CN' as Locale,
    notificationSettings: {
      browser: false,
      inApp: true,
      suppressInFocus: false,
      types: {
        construction: true,
        research: true,
        unlock: true
      }
    },
    webdavConfig: null as WebDAVConfig | null
  }),
  actions: {
    async requestBrowserPermission(): Promise<boolean> {
      if (!('Notification' in window)) return false

      if (Notification.permission === 'granted') return true

      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
  },
  getters: {
    currentPlanet(): Planet | undefined {
      return this.player.planets.find(p => p.id === this.currentPlanetId)
    },
    getMoonForPlanet(): (planetId: string) => Planet | undefined {
      return (planetId: string) => {
        return this.player.planets.find(p => p.parentPlanetId === planetId && p.isMoon)
      }
    }
  },
  persist: {
    key: pkg.name,
    storage: saveStorage,
    serializer: {
      serialize: state => encryptData(state),
      deserialize: value => decryptData(value)
    }
  }
})
