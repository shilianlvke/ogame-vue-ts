/**
 * 周目排行榜（P6 收尾）
 *
 * 按 `cycle` 分组、按积分降序排名；不同周目互不影响。
 */
import type { Player } from '@/types/game'

export interface CycleRankingRow {
  playerId: string
  name: string
  cycle: number
  points: number
  rank: number
}

/** 单个周目的排名 */
export const rankCycle = (players: Player[], cycle: number): CycleRankingRow[] =>
  players
    .filter(player => (player.cycle ?? 1) === cycle)
    .slice()
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .map((player, index) => ({
      playerId: player.id,
      name: player.name,
      cycle,
      points: player.points ?? 0,
      rank: index + 1
    }))

/** 所有周目的排名（key = cycle） */
export const buildCycleRankings = (players: Player[]): Record<number, CycleRankingRow[]> => {
  const cycles = new Set<number>(players.map(player => player.cycle ?? 1))
  const result: Record<number, CycleRankingRow[]> = {}
  for (const cycle of cycles) result[cycle] = rankCycle(players, cycle)
  return result
}
