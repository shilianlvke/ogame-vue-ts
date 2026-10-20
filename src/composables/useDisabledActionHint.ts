import { toast } from 'vue-sonner'

// 同一时间只保留一个“为什么不可用”的提示；快速连点不会堆叠。
let lastShownAt = 0
const COOLDOWN_MS = 1200

export const useDisabledActionHint = () => {
  const notifyDisabled = (actionLabel: string, reason: string): void => {
    const now = Date.now()
    if (now - lastShownAt < COOLDOWN_MS) return
    lastShownAt = now

    toast.info(actionLabel, {
      id: 'base-disabled-action',
      description: reason,
      duration: 2600
    })
  }

  return { notifyDisabled }
}
