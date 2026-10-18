/**
 * NPC 名称生成与旧名迁移
 *
 * 历史：这里曾按语言维护了 8 套名字库（中文"将军某某"、俄文、日文…）。
 * 但共享宇宙里同一个 NPC 对所有玩家必须是同一个名字，
 * 按语言生成会导致"服务端语言决定全服 NPC 名字"。
 *
 * 现在统一走 [nameGenerator](./nameGenerator.ts) 的英文程序化命名（无人深空风格）。
 * `countOldFormatNPCs` / `updateNPCName` 保留给「旧存档改名」弹窗使用：
 * 把存档里遗留的本地化名字一次性替换成新的英文名。
 */
import type { NPC } from '@/types/game'
import { generateCommanderName } from './nameGenerator'

/** 新格式：两个英文单词（首字母大写），如 `Vex Arano` */
const GENERATED_NAME = /^[A-Z][a-z]+ [A-Z][a-z]+$/

/** 生成 NPC 名字（忽略 locale，名字与语言无关） */
export const generateNPCName = (npcId: string, _locale?: string): string => generateCommanderName(npcId)

/** 名字是否已是新格式 */
export const isGeneratedName = (name: string): boolean => GENERATED_NAME.test(name)

/** 统计旧格式（本地化）NPC 数量 */
export const countOldFormatNPCs = (npcs: NPC[], _locale?: string): number =>
  npcs.filter(npc => !isGeneratedName(npc.name)).length

/** 把某个 NPC 的名字更新为新格式 */
export const updateNPCName = (npcId: string, _locale?: string): string => generateCommanderName(npcId)
