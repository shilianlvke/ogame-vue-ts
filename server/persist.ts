/**
 * 世界存档：读取 / 原子写入
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseState, serializeState } from './state'
import type { ServerState } from './state'

/** 读取存档；不存在或损坏时返回 null */
export const loadWorld = (file: string): ServerState | null => {
  if (!existsSync(file)) return null
  try {
    return parseState(readFileSync(file, 'utf8'))
  } catch (error) {
    console.error('[persist] 读取存档失败', error)
    return null
  }
}

/** 原子写入存档（先写临时文件再重命名，避免写一半断电损坏） */
export const saveWorld = (file: string, state: ServerState): boolean => {
  try {
    mkdirSync(dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    writeFileSync(tmp, serializeState(state), 'utf8')
    renameSync(tmp, file)
    return true
  } catch (error) {
    console.error('[persist] 写入存档失败', error)
    return false
  }
}
