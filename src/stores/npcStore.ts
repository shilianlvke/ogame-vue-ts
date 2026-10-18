import { defineStore } from 'pinia'
import type { NPC } from '@/types/game'
import pkg from '../../package.json'
import { encryptData, decryptData } from '@/utils/crypto'
import { saveStorage } from '@/services/saveStorage'

/**
 * NPC Store
 * 瀛樺偍鍜岀鐞嗘墍鏈塏PC鏁版嵁
 */
export const useNPCStore = defineStore('npc', {
  state: () => ({
    npcs: [] as NPC[],
    lastGrowthCheck: {} as Record<string, number> // npcId -> timestamp
  }),
  persist: {
    key: `${pkg.name}-npcs`,
    storage: saveStorage,
    serializer: {
      serialize: state => encryptData(state),
      deserialize: value => decryptData(value)
    }
  }
})
