# 将本机构建的镜像 tar 传到 ECS 并 docker load（绕过 GHCR push）
param(
  [Parameter(Mandatory = $true)]
  [string] $Tag,
  [string] $DeployHost = "8.136.218.38",
  [string] $SshUser = "root",
  [string] $Namespace = "ghcr.io/hqh-dot-wj/o2o-mall-project"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$tmpdir = Join-Path $RepoRoot "deploy/.image-tars"
New-Item -ItemType Directory -Force -Path $tmpdir | Out-Null

$images = @("landing", "admin", "h5", "backend")
foreach ($img in $images) {
  $tar = Join-Path $tmpdir "$img-$Tag.tar"
  Write-Host "`n========== $img =========="
  Write-Host "docker save..."
  docker save "${Namespace}/${img}:${Tag}" -o $tar
  $mb = [math]::Round((Get-Item $tar).Length / 1MB, 1)
  Write-Host "scp ($mb MB)..."
  scp -o BatchMode=yes $tar "${SshUser}@${DeployHost}:/tmp/$img-$Tag.tar"
  Write-Host "docker load on ECS..."
  ssh -o BatchMode=yes "${SshUser}@${DeployHost}" "docker load -i /tmp/$img-$Tag.tar && rm -f /tmp/$img-$Tag.tar"
  Remove-Item $tar -Force
  ssh -o BatchMode=yes "${SshUser}@${DeployHost}" "docker tag ${Namespace}/${img}:${Tag} ${Namespace}/${img}:latest"
  Write-Host "OK: $img"
}
Write-Host "`n全部镜像已同步到 ECS (latest)"
