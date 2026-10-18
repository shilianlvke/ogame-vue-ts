/**
 * 存档存储层（IndexedDB 优先，localStorage 兜底）
 *
 * 为什么需要它：
 * 单机存档原先直接放 localStorage，12 个周目估算要 9MB，而浏览器配额通常只有 5MB。
 * 这里把存储换成 IndexedDB（配额按磁盘比例，几百 MB 起），同时保持 API 与
 * localStorage 一致，让 Pinia 的持久化插件与导出/导入逻辑无需改成异步。
 *
 * 工作方式：
 * 1. 启动时 `initSaveStorage()` 把 IDB 里的数据**一次性读进内存**，之后再同步读；
 * 2. 所有写入先落内存，再异步批量写回 IDB（200ms 去抖）；
 * 3. 首次启动会把 localStorage 里的旧存档迁移到 IDB，迁移成功后删除旧键；
 * 4. 没有 IndexedDB 的环境（Node 冒烟测试、老浏览器）自动退回 localStorage。
 */
import pkg from '../../package.json'

const DB_NAME = `${pkg.name}-save`
const DB_VERSION = 1
const STORE_NAME = 'kv'
const LEGACY_PREFIX = pkg.name
const FLUSH_DELAY = 200

let database: IDBDatabase | null = null
let ready = false
let flushTimer: ReturnType<typeof setTimeout> | null = null
let clearRequested = false

const memory = new Map<string, string>()
const pending = new Map<string, string | null>()

const supportsIndexedDb = (): boolean => typeof indexedDB !== 'undefined'
const supportsLocalStorage = (): boolean => typeof localStorage !== 'undefined'

const openDatabase = (): Promise<IDBDatabase | null> =>
  new Promise(resolve => {
    if (!supportsIndexedDb()) {
      resolve(null)
      return
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })

const readAll = (db: IDBDatabase): Promise<Array<[string, string]>> =>
  new Promise(resolve => {
    const out: Array<[string, string]> = []
    try {
      const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME)
      const cursor = store.openCursor()
      cursor.onsuccess = () => {
        const current = cursor.result
        if (current) {
          out.push([String(current.key), String(current.value)])
          current.continue()
        } else {
          resolve(out)
        }
      }
      cursor.onerror = () => resolve(out)
    } catch {
      resolve(out)
    }
  })

const flushPending = (db: IDBDatabase): Promise<void> =>
  new Promise(resolve => {
    const entries = [...pending.entries()]
    const doClear = clearRequested
    pending.clear()
    clearRequested = false
    if (entries.length === 0 && !doClear) {
      resolve()
      return
    }
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      if (doClear) store.clear()
      for (const [key, value] of entries) {
        if (value === null) store.delete(key)
        else store.put(value, key)
      }
      tx.oncomplete = () => resolve()
      const restore = () => {
        for (const [key, value] of entries) pending.set(key, value)
        if (doClear) clearRequested = true
        resolve()
      }
      tx.onerror = restore
      tx.onabort = restore
    } catch {
      for (const [key, value] of entries) pending.set(key, value)
      resolve()
    }
  })

const scheduleFlush = (): void => {
  if (!database) return
  if (flushTimer !== null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    if (database) void flushPending(database)
  }, FLUSH_DELAY)
}

/** 读取 localStorage 里属于本应用的旧存档 */
const readLegacyKeys = (): Array<[string, string]> => {
  if (!supportsLocalStorage()) return []
  const out: Array<[string, string]> = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(LEGACY_PREFIX)) continue
    const value = localStorage.getItem(key)
    if (value !== null) out.push([key, value])
  }
  return out
}

/**
 * 启动时调用一次：打开 IDB、预载到内存、迁移旧存档。
 * 无 IDB 环境直接返回（后续读写走 localStorage）。
 */
export const initSaveStorage = async (): Promise<void> => {
  database = await openDatabase()
  if (!database) {
    ready = true
    return
  }

  const existing = await readAll(database)
  for (const [key, value] of existing) memory.set(key, value)

  // 旧存档迁移：只迁移 IDB 里还没有的键
  const legacy = readLegacyKeys().filter(([key]) => !memory.has(key))
  if (legacy.length > 0) {
    for (const [key, value] of legacy) {
      memory.set(key, value)
      pending.set(key, value)
    }
    await flushPending(database)
    for (const [key] of legacy) localStorage.removeItem(key)
  }

  ready = true
  if (typeof window !== 'undefined') {
    // 关页面/切后台时尽量把待写数据落盘
    window.addEventListener('pagehide', () => {
      if (database) void flushPending(database)
    })
  }
}

/** 立即把待写数据落盘（导出前、手动存档时可用） */
export const flushSaveStorage = async (): Promise<void> => {
  if (database) await flushPending(database)
}

/** 是否已在使用 IndexedDB（用于设置页展示） */
export const isUsingIndexedDb = (): boolean => database !== null

/**
 * 与 localStorage 同形的存储对象：Pinia 持久化插件与现有导出/导入逻辑可直接用
 */
export const saveStorage = {
  getItem(key: string): string | null {
    if (ready && database) return memory.get(key) ?? null
    return supportsLocalStorage() ? localStorage.getItem(key) : null
  },
  setItem(key: string, value: string): void {
    memory.set(key, value)
    if (ready && database) {
      pending.set(key, value)
      scheduleFlush()
      return
    }
    if (supportsLocalStorage()) localStorage.setItem(key, value)
  },
  removeItem(key: string): void {
    memory.delete(key)
    if (ready && database) {
      pending.set(key, null)
      scheduleFlush()
      return
    }
    if (supportsLocalStorage()) localStorage.removeItem(key)
  },
  /** 清空本应用的存档（不会动其它站点的数据） */
  clear(): void {
    memory.clear()
    pending.clear()
    clearRequested = true
    if (database) {
      scheduleFlush()
      return
    }
    if (supportsLocalStorage()) {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (key && key.startsWith(LEGACY_PREFIX)) keys.push(key)
      }
      keys.forEach(key => localStorage.removeItem(key))
    }
  },
  get length(): number {
    return memory.size
  },
  key(index: number): string | null {
    return [...memory.keys()][index] ?? null
  }
}
