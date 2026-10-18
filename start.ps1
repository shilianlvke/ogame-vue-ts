# 一键启动：构建前后端并启动服务端
#
# 用法：
#   .\start.ps1                      # 普通启动
#   .\start.ps1 -MaxAccount admin:pass   # 同时创建内置满级账号
#   .\start.ps1 -NoStart             # 只构建，不启动
#
# 关键点：前端产物（docs/）和服务端产物（server-dist/）一起重建，
# 避免出现「服务端是新代码、浏览器还在跑旧 JS」的情况。

param(
  [string]$MaxAccount = '',
  [int]$Port = 25122,
  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }

Step '1/3 构建前端（docs/）'
pnpm run build
if ($LASTEXITCODE -ne 0) { throw '前端构建失败' }

Step '2/3 构建服务端（server-dist/）'
pnpm run build:node-server
if ($LASTEXITCODE -ne 0) { throw '服务端构建失败' }

if ($NoStart) {
  Write-Host "`n构建完成（未启动）。启动命令：node server-dist/main.js" -ForegroundColor Green
  exit 0
}

if ($MaxAccount) {
  $env:MAX_ACCOUNT = $MaxAccount
  Write-Host "内置满级账号：$MaxAccount" -ForegroundColor Yellow
}
$env:PORT = "$Port"

Step "3/3 启动服务端 http://localhost:$Port"
Write-Host @"
------------------------------------------------------------
  打开地址： http://localhost:$Port
  首次访问请按 Ctrl+Shift+R 强制刷新（绕过 Service Worker 缓存）
  若仍看到旧界面：F12 → Application → Service Workers → Unregister
------------------------------------------------------------
"@ -ForegroundColor DarkGray

node server-dist/main.js
