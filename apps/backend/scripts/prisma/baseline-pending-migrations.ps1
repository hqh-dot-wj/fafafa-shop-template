#Requires -Version 5.1
# 中文说明：当数据库结构已存在但与 _prisma_migrations 不一致时，用本脚本批量
# prisma migrate resolve --applied，把历史迁移标为「已应用」（baseline）。
# 前提：库里的表/列/索引已与这些 migration.sql 的结果一致，否则会「假对齐」。
# 勿在块注释里写含 "#>" 的字符串，否则 PowerShell 会提前结束注释导致脚本语法错误。
# 官方：https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate/baselining
# 用法：cd apps\backend ; .\scripts\prisma\baseline-pending-migrations.ps1
# 自动化加 -Force；若还要标记 biz_operation_log 用 -IncludeBizOperationLog。
param(
  [switch] $Force,
  [switch] $IncludeBizOperationLog
)

$ErrorActionPreference = 'Stop'
$backendRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')

$migrations = @(
  '20251217031315_add_file_management_tables'
  '20251218085631_add_file_management_features'
  '20251218090421_add_file_management_features'
  '20251219070121_test'
  '20251219071104_test1'
  '20251222081401_demo12'
  '20251230000000_manual_system_config'
  '20260117085612_sync_schema'
  '20260119025052_add_oms_tables'
  '20260119060239_add_address_table'
  '20260120025637_add_finance_tables'
  '20260128101918_add_version_to_tenant_sku'
  '20260128104031_add_performance_indexes'
  '20260209032600_add_min_actual_pay_amount_to_coupon_template'
  '20260209040100_add_dist_config_commission_columns'
  '20260209050000_add_is_exchange_product_to_tenant_sku'
  '20260209050100_add_points_ratio_and_is_promotion_to_tenant_sku'
  '20260209060000_add_fin_commission_columns'
  '20260209060100_add_points_to_oms_order_item'
  '20260227100000_add_pms_stock_log'
  '20260227110000_add_sys_notification_log'
  '20260228000000_add_distribution_application_tables'
  '20260304193006_add_fin_wallet_pending_recovery'
  '20260306100000_add_fin_withdrawal_fee_columns'
  '20260306110000_add_sys_dist_product_config'
  '20260306120000_add_sys_dist_level'
  '20260327150000_oms_order_del_flag'
  'add_geo_fence_spatial_index'
)

if ($IncludeBizOperationLog) {
  $migrations += '20260408120000_biz_operation_log'
}

Write-Host "Backend root: $backendRoot" -ForegroundColor Cyan
Write-Host "Will mark $($migrations.Count) migrations as applied." -ForegroundColor Yellow
Write-Host "Confirm DB schema already matches these migrations." -ForegroundColor Red

if (-not $Force) {
  $confirm = Read-Host 'Type YES to continue'
  if ($confirm -ne 'YES') {
    Write-Host 'Cancelled.' -ForegroundColor Gray
    exit 1
  }
}

Set-Location $backendRoot

foreach ($name in $migrations) {
  Write-Host ""
  Write-Host ">>> resolve --applied $name" -ForegroundColor Green
  pnpm exec prisma migrate resolve --applied $name
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed: $name" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Write-Host ""
Write-Host 'Done. Run: pnpm exec prisma migrate status' -ForegroundColor Cyan
Write-Host 'Then: pnpm exec prisma migrate deploy (for future migrations)' -ForegroundColor Cyan
