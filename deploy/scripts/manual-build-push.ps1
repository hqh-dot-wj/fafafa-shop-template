# 使用 Docker Desktop 本机构建并推送 GHCR（Actions 不可用时的手动发布第 1 步）
# 用法（仓库根目录）：
#   pwsh deploy/scripts/manual-build-push.ps1
#   pwsh deploy/scripts/manual-build-push.ps1 -Tag manual-20260524
#   pwsh deploy/scripts/manual-build-push.ps1 -Namespace ghcr.io/your-user/repo -PushLatest

param(
  [string] $Tag = "manual-$(Get-Date -Format 'yyyyMMdd-HHmm')",
  [string] $Namespace = "",
  [switch] $PushLatest,
  [switch] $SkipPush
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "未找到 docker 命令。请先启动 Docker Desktop。"
}

$ciEnv = Join-Path $RepoRoot "deploy/ci.env"
if (-not $Namespace -and (Test-Path $ciEnv)) {
  foreach ($line in Get-Content $ciEnv) {
    if ($line -match '^\s*REGISTRY_NAMESPACE=(.+)$') {
      $Namespace = $Matches[1].Trim()
      break
    }
  }
}
if (-not $Namespace) {
  $Namespace = Read-Host "请输入 REGISTRY_NAMESPACE（如 ghcr.io/owner/repo，须小写）"
}

$Namespace = $Namespace.ToLower()
Write-Host "==> 镜像前缀: $Namespace"
Write-Host "==> 标签: $Tag"
Write-Host "==> 构建上下文: $RepoRoot"
Write-Host ""

Push-Location $RepoRoot
try {
  $images = @(
    @{
      Name   = "backend"
      File   = "deploy/docker/backend.Dockerfile"
      Args   = @()
    },
    @{
      Name   = "admin"
      File   = "deploy/docker/admin.Dockerfile"
      Args   = @(
        "--build-arg", "VITE_BASE_URL=/admin/",
        "--build-arg", "VITE_SERVICE_BASE_URL=",
        "--build-arg", "VITE_APP_BASE_API=/api",
        "--build-arg", "VITE_HTTP_PROXY=N"
      )
    },
    @{
      Name   = "h5"
      File   = "deploy/docker/h5.Dockerfile"
      Args   = @(
        "--build-arg", "VITE_SERVER_BASEURL=/api",
        "--build-arg", "VITE_APP_PUBLIC_BASE=/h5/"
      )
    },
    @{
      Name   = "landing"
      File   = "deploy/docker/landing.Dockerfile"
      Args   = @()
    }
  )

  foreach ($img in $images) {
    $fullTag = "${Namespace}/$($img.Name):${Tag}"
    Write-Host "==> 构建 $($img.Name) -> $fullTag"
    $buildArgs = @("build", "-f", $img.File) + $img.Args + @("-t", $fullTag)
    if ($PushLatest) {
      $buildArgs += @("-t", "${Namespace}/$($img.Name):latest")
    }
    $buildArgs += "."
    & docker @buildArgs
    if ($LASTEXITCODE -ne 0) { throw "构建失败: $($img.Name)" }
  }

  if ($SkipPush) {
    Write-Host "==> 已跳过 push（-SkipPush）"
  } else {
    Write-Host ""
    Write-Host "==> 推送到 GHCR（需已 docker login ghcr.io）..."
    foreach ($img in $images) {
      & docker push "${Namespace}/$($img.Name):${Tag}"
      if ($LASTEXITCODE -ne 0) { throw "推送失败: $($img.Name)" }
      if ($PushLatest) {
        & docker push "${Namespace}/$($img.Name):latest"
        if ($LASTEXITCODE -ne 0) { throw "推送 latest 失败: $($img.Name)" }
      }
    }
  }

  Write-Host ""
  Write-Host "完成。请在服务器部署时使用："
  Write-Host "  export IMAGE_TAG=$Tag"
  Write-Host "  export REGISTRY_NAMESPACE=$Namespace"
}
finally {
  Pop-Location
}
