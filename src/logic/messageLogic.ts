/**
 * 消息 / 通知集合操作
 *
 * 这些数组都属于服务端权威数据（随 `patch.reports` 或 `patch.self` 下发）。
 * UI 不能直接 splice / 清空，否则下一份补丁会把旧数据带回来。
 * 所有写操作统一经过 `messages.*` 命令，服务端与单机共用同一套实现。
 */

import type { Player } from '@/types/game'

/** 允许通过命令清理/删除/标记已读的通知集合 */
export const MESSAGE_COLLECTIONS = [
  'battleReports',
  'spyReports',
  'missionReports',
  'spiedNotifications',
  'questNotifications',
  'incomingFleetAlerts',
  'chatMessages'
] as const

export type MessageCollection = (typeof MESSAGE_COLLECTIONS)[number]

interface MessageLike {
  id?: string
  read?: boolean
}

const asRecord = (player: Player): Record<string, unknown> => player as unknown as Record<string, unknown>

export const isMessageCollection = (value: string): value is MessageCollection =>
  (MESSAGE_COLLECTIONS as readonly string[]).includes(value)

const getMessages = (player: Player, collection: MessageCollection): MessageLike[] | undefined => {
  const value = asRecord(player)[collection]
  return Array.isArray(value) ? (value as MessageLike[]) : undefined
}

/** 清空指定通知集合（就地清空，保持数组引用） */
export const clearMessages = (player: Player, collections: readonly MessageCollection[]): void => {
  for (const collection of collections) {
    const messages = getMessages(player, collection)
    if (messages && messages.length > 0) {
      messages.splice(0, messages.length)
    }
  }
}

/** 删除单条通知，返回是否真的删除了 */
export const deleteMessage = (player: Player, collection: MessageCollection, id: string): boolean => {
  const messages = getMessages(player, collection)
  if (!messages) return false

  const index = messages.findIndex(message => message.id === id)
  if (index < 0) return false

  messages.splice(index, 1)
  return true
}

/** 标记通知为已读；省略 id 时标记集合内全部 */
export const markMessagesRead = (
  player: Player,
  collections: readonly MessageCollection[],
  id?: string
): void => {
  for (const collection of collections) {
    const messages = getMessages(player, collection)
    if (!messages) continue

    for (const message of messages) {
      if (id !== undefined && message.id !== id) continue
      if (!message.read) message.read = true
    }
  }
}
