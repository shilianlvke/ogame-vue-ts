/**
 * 静态资源服务：托管构建产物（docs/），并支持 SPA 回退
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
}

/** 构建一个静态文件处理函数 */
export const createStaticHandler = (rootDir: string) => {
  const root = resolve(rootDir)

  return (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    let pathname = decodeURIComponent(url.pathname)
    // 逃生页：清掉 Service Worker 缓存并回到首页
  if (pathname === '/reset-sw') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(`<!doctype html><meta charset="utf-8"><title>reset</title>
<script>
(async () => {
  try { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))) } catch {}
  try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())) } catch {}
  location.replace('/')
})()
</script>重置中…`)
    return
  }

  if (pathname.endsWith('/')) pathname += 'index.html'

    // 去掉开头的斜杠，拼接后校验是否仍在 root 内（防目录穿越）
    const relative = pathname.replace(/^[/\\]+/, '')
    const filePath = resolve(join(root, relative))
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }

    const serveFile = (target: string, status = 200): void => {
      const stat = statSync(target)
      res.statusCode = status
      res.setHeader('Content-Type', MIME_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream')
      res.setHeader('Content-Length', String(stat.size))
      // 带 hash 的静态资源可以长缓存，HTML 不缓存
      if (extname(target) === '.html') {
        res.setHeader('Cache-Control', 'no-cache')
      } else if (target.endsWith(`${sep}version.json`)) {
        // 版本探测文件必须每次走网络，不能被浏览器/CDN 缓存
        res.setHeader('Cache-Control', 'no-store')
      } else if (target.includes(`${sep}assets${sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      }
      createReadStream(target).pipe(res)
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      serveFile(filePath)
      return
    }

    // SPA 回退
    const indexFile = join(root, 'index.html')
    if (existsSync(indexFile)) {
      serveFile(indexFile, 200)
      return
    }

    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Not Found（请先执行 pnpm build 生成 docs/）')
  }
}

/** 输出 JSON 响应 */
export const sendJson = (res: ServerResponse, status: number, payload: unknown): void => {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}
