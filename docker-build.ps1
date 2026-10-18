# 在电脑上构建镜像并导出 tar，便于导入到飞牛等 NAS
#
#   .\docker-build.ps1
#   .\docker-build.ps1 -Tag ogame-vue-ts:1.0 -Out ogame-1.0.tar

param(
  [string]$Tag = 'ogame-vue-ts:latest',
  [string]$Out = 'ogame-vue-ts.tar'
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw '未找到 docker 命令，请先安装 Docker Desktop'
}

Write-Host "==> 构建镜像 $Tag" -ForegroundColor Cyan
docker build -t $Tag .
if ($LASTEXITCODE -ne 0) { throw '镜像构建失败' }

Write-Host "==> 导出 $Out" -ForegroundColor Cyan
docker save $Tag -o $Out
if ($LASTEXITCODE -ne 0) { throw '镜像导出失败' }

$size = [math]::Round((Get-Item $Out).Length / 1MB, 1)
Write-Host "完成：$Out（$size MB）" -ForegroundColor Green
Write-Host "把该文件和 docker-compose.yml 一起上传到 NAS，然后执行："
Write-Host "  docker load -i $Out"
Write-Host "  docker compose up -d"
