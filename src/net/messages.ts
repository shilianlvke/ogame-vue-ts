/**
 * 联机相关的提示文案
 *
 * 语言包里的 `online.*` 段负责具体翻译，这里只做「错误码 / 状态 → i18n key」的映射。
 */
export type Translator = (key: string, params?: Record<string, string | number>) => string

/** 服务端认证 / 连接错误码 → 可读文案 */
export const describeNetError = (raw: string | undefined | null, t: Translator): string => {
  if (!raw) return ''
  switch (raw) {
    case 'auth:wrong_password':
      return t('online.error.wrongPassword')
    case 'auth:name_taken':
      return t('online.error.nameTaken')
    case 'auth:password_required':
      return t('online.error.passwordRequired')
    case 'session:replaced':
      return t('online.error.replaced')
    case 'invalid_url':
      return t('online.error.invalidUrl')
    default:
      return raw
  }
}

/** 联机状态 → 可读文案 */
export const describeNetStatus = (status: string, t: Translator): string => t(`online.status.${status}`)
