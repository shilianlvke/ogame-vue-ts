/**
 * Node 测试环境的最小浏览器垫片
 *
 * `scripts/server-smoke.ts` 会直接跑客户端的 Pinia store（真实代码路径），
 * 而 store 在模块加载时就会读取 `localStorage`。在 Node 里补一个内存实现即可。
 *
 * 必须在其它 import 之前被引用（ESM 按 import 顺序求值）。
 */
const memory = new Map<string, string>()

const memoryStorage: Storage = {
  get length() {
    return memory.size
  },
  clear: () => memory.clear(),
  getItem: (key: string) => memory.get(key) ?? null,
  key: (index: number) => [...memory.keys()][index] ?? null,
  removeItem: (key: string) => {
    memory.delete(key)
  },
  setItem: (key: string, value: string) => {
    memory.set(key, String(value))
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true
  })
}

if (typeof globalThis.location === 'undefined') {
  Object.defineProperty(globalThis, 'location', {
    value: {
      protocol: 'http:',
      hostname: '127.0.0.1',
      host: '127.0.0.1:25122',
      port: '25122',
      href: 'http://127.0.0.1:25122/',
      reload: () => {
        throw new Error('location.reload is not available in Node tests')
      }
    },
    configurable: true,
    writable: true
  })
}

export {}
