/**
 * 与框架无关的翻译工具
 *
 * 客户端原本在 `useI18n` 里内联实现，服务端也需要同一套逻辑
 * （任务报告、战斗报告的文案是在结算时按玩家语言生成的）。
 */
import type { TranslateFn } from './types'

/**
 * 按点分路径取翻译，支持 `{name}` 形式的参数替换。
 * 找不到时返回 key 本身（与原有行为一致）。
 */
export const translate = (messages: unknown, key: string, params?: Record<string, string | number>): string => {
  const keys = key.split('.')
  let value: unknown = messages

  for (const k of keys) {
    if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[k]
    } else {
      return key
    }
  }

  let result = typeof value === 'string' ? value : key

  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue))
    })
  }

  return result
}

/** 用一份语言包创建翻译函数 */
export const createTranslator = (messages: unknown): TranslateFn => (key, params) => translate(messages, key, params)
