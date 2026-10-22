import type { CampaignReward } from '@/types/factory'

/**
 * 成就，对应规划书 §10.7。成就只承载非进度类里程碑，即时发放、不重置。
 */

export interface AchievementDef {
  id: string
  name: string
  desc: string
  reward: CampaignReward
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstMine', name: '第一步', desc: '建成第一座矿井', reward: { materials: { ironPlate: 100 } } },
  { id: 'fullLoad', name: '满负荷', desc: '全部生产槽位连续 10 分钟无空转', reward: { darkMatter: 50 } },
  { id: 'zeroLoss', name: '零损失', desc: '通过任一精英波且防线未受损', reward: { materials: { rustAlloy: 20 } } },
  { id: 'minimal', name: '极简', desc: '建筑实例总数 ≤ 20 时发射火箭', reward: { darkMatter: 300 } },
  { id: 'collector', name: '收藏家', desc: '同时持有全部 62 种材料各 ≥1', reward: { darkMatter: 100 } },
  { id: 'powerOut', name: '断电', desc: '经历一次满足率 ≤ 20% 的欠压并恢复', reward: { materials: { efficiencyModule: 5 } } },
  { id: 'salvager', name: '拆解工', desc: '累计拆解 1000 个锈群残骸', reward: { materials: { neuralCord: 10 } } },
  { id: 'miner', name: '星际矿工', desc: '5 座前哨同时运转', reward: { ships: { 大型货船: 4 } } },
  { id: 'cycler', name: '循环者', desc: '完成第 12 周目', reward: { darkMatter: 2000 } },
  { id: 'rustSlayer', name: '锈群克星', desc: '累计击杀 100 万锈群 HP', reward: { materials: { rustCore: 5 } } },
  { id: 'calculator', name: '精算师', desc: '单配方实际产能达到理论值的 99% 以上', reward: { materials: { productivityModule: 5 } } },
  { id: 'bankrupt', name: '破产', desc: '全部材料库存归零后 1 小时内恢复到 10 万', reward: { darkMatter: 200 } }
]

export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]))
