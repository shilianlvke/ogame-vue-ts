import { defineStore } from 'pinia'
import type { Planet, DebrisField } from '@/types/game'
import pkg from '../../package.json'
import { encryptData, decryptData } from '@/utils/crypto'
import { saveStorage } from '@/services/saveStorage'

/**
 * 瀹囧畽鍦板浘 Store
 * 瀛樺偍瀹囧畽涓殑鎵€鏈夋槦鐞冨拰娈嬮鍦?
 * 浣跨敤鏅€?localStorage 瀛樺偍锛屼笉鍔犲瘑锛堝湴鍥炬暟鎹槸闈欐€?鍏变韩鏁版嵁锛?
 */
export const useUniverseStore = defineStore('universe', {
  state: () => ({
    // 瀹囧畽鏄熺悆鍦板浘锛歬ey 鏍煎紡涓?"galaxy:system:position"
    planets: {} as Record<string, Planet>,
    // 娈嬮鍦猴細key 鏍煎紡涓?"galaxy:system:position"
    debrisFields: {} as Record<string, DebrisField>
  }),
  persist: {
    key: `${pkg.name}-universe`,
    storage: saveStorage,
    serializer: {
      serialize: state => encryptData(state),
      deserialize: value => decryptData(value)
    }
  }
})
