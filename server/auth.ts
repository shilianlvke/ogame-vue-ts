/**
 * 账号密码哈希
 *
 * 使用 Node 内置 scrypt（无第三方依赖），每个账号独立随机盐。
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 32

/** 生成随机盐 + 密码哈希 */
export const hashPassword = (password: string): { hash: string; salt: string } => {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return { hash, salt }
}

/** 校验密码（常数时间比较） */
export const verifyPassword = (password: string, hash?: string, salt?: string): boolean => {
  if (!hash || !salt) return false
  try {
    const candidate = scryptSync(password, salt, KEY_LENGTH)
    const expected = Buffer.from(hash, 'hex')
    if (candidate.length !== expected.length) return false
    return timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

/** 生成重连令牌 */
export const createToken = (bytes: number = 24): string => randomBytes(bytes).toString('hex')
