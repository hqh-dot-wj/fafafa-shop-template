import { Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StoreProductAuditStatus } from '@prisma/client';
import { Api } from 'src/common/decorators/api.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { CurrentTenant } from 'src/common/tenant/tenant.decorator';
import { User } from 'src/common/decorators/user.decorator';
import { LogOperation } from 'src/module/common/operation-log/log-operation.decorator';
import {
  BizOperationActions,
  BizOperationTargetTypes,
} from 'src/module/common/operation-log/biz-operation-log.constants';
import { StoreProductService } from './product.service';
import { StockAlertService } from './stock-alert.service';
import {
  BatchApproveAuditDto,
  BatchImportProductDto,
  BatchStoreProductDto,
  BatchUpdateProductPriceDto,
  ImportExcelDto,
  ImportTemplateQueryDto,
  ListTemplateVersionDto,
  OperationIdDto,
  RejectStoreProductDto,
  ImportProductDto,
  ListMarketProductDto,
  ListStoreProductDto,
  RemoveProductDto,
  StockAlertConfigDto,
  UpdateProductBaseDto,
  UpdateProductPriceDto,
} from './dto';
import { MarketProductVo, StoreProductVo, MarketProductDetailVo } from './vo';
import { BatchOperationResult } from '../common/dto/batch-operation-result.dto';
import { Response } from 'express';
import { StoreProductQueryFallbackService } from './store-product-query-fallback.service';

const ONE_MINUTE_MS = 60_000;
const parseRateLimit = (raw: string | undefined, fallback: number, min = 10, max = 50_000): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
};

const ADMIN_STORE_PRODUCT_LIST_LIMIT = parseRateLimit(
  process.env.ADMIN_STORE_PRODUCT_LIST_RATE_LIMIT,
  1_200,
  50,
  50_000,
);
const ADMIN_STORE_PRODUCT_IMPORT_LIMIT = parseRateLimit(
  process.env.ADMIN_STORE_PRODUCT_IMPORT_EXCEL_RATE_LIMIT,
  1_200,
  50,
  20_000,
);
const ADMIN_STORE_PRODUCT_IMPORT_BATCH_LIMIT = parseRateLimit(
  process.env.ADMIN_STORE_PRODUCT_IMPORT_BATCH_RATE_LIMIT,
  600,
  10,
  20_000,
);

const DRAFT_LIST_AUDIT_STATUSES = new Set<string>([StoreProductAuditStatus.DRAFT, StoreProductAuditStatus.REJECTED]);

@ApiTags('店铺-商品管理')
@ApiBearerAuth('Authorization')
@Controller('store')
export class StoreProductController {
  constructor(
    private readonly productService: StoreProductService,
    private readonly stockAlertService: StockAlertService,
    private readonly storeProductQueryFallbackService: StoreProductQueryFallbackService,
  ) {}

  private withApprovedProductScope(query: ListStoreProductDto): ListStoreProductDto {
    query.auditStatus = StoreProductAuditStatus.APPROVED;
    return query;
  }

  private withDraftProductScope(query: ListStoreProductDto): ListStoreProductDto {
    const requestedAuditStatus = query.auditStatus || '';
    query.auditStatus = DRAFT_LIST_AUDIT_STATUSES.has(requestedAuditStatus)
      ? requestedAuditStatus
      : StoreProductAuditStatus.DRAFT;

    return query;
  }

  private withPendingReviewScope(query: ListStoreProductDto): ListStoreProductDto {
    query.auditStatus = StoreProductAuditStatus.PENDING;
    return query;
  }

  /**
   * 选品中心列表
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Api({ summary: '选品中心列表', type: MarketProductVo, isPager: true })
  @RequirePermission('store:product:list')
  @Throttle({ default: { limit: ADMIN_STORE_PRODUCT_LIST_LIMIT, ttl: ONE_MINUTE_MS } })
  @Post('market/list')
  getMarketList(@CurrentTenant() tenantId: string, @Body() query: ListMarketProductDto) {
    return this.productService.getMarketList(tenantId, query);
  }

  /**
   * 选品中心商品详情
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Api({ summary: '选品中心-商品详情', type: MarketProductDetailVo })
  @RequirePermission('store:product:query')
  @Get('market/detail/:productId')
  getMarketDetail(@CurrentTenant() tenantId: string, @Param('productId') productId: string) {
    return this.productService.getMarketDetail(tenantId, productId);
  }

  /**
   * 导入商品
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Api({ summary: '导入商品' })
  @RequirePermission('store:product:import')
  @Post('product/import')
  importProduct(@Body() dto: ImportProductDto, @CurrentTenant() tenantId: string) {
    return this.productService.importProduct(tenantId, dto);
  }

  @Api({ summary: '下载商品导入模板' })
  @RequirePermission('store:product:import')
  @Get('product/import-template')
  async downloadImportTemplate(
    @CurrentTenant() tenantId: string,
    @Query() query: ImportTemplateQueryDto,
    @Res() res: Response,
  ) {
    return this.productService.downloadImportTemplate(tenantId, query, res);
  }

  @Api({ summary: '获取分类可用模板版本' })
  @RequirePermission('store:product:query')
  @Get('product/template-versions')
  getTemplateVersions(@Query() query: ListTemplateVersionDto) {
    return this.productService.getTemplateVersions(query.categoryId);
  }

  @Api({ summary: '批量导入 Excel（支持 fileBase64 或 rows）' })
  @RequirePermission('store:product:import')
  @Throttle({ default: { limit: ADMIN_STORE_PRODUCT_IMPORT_LIMIT, ttl: ONE_MINUTE_MS } })
  @Post('product/import-excel')
  importExcel(@CurrentTenant() tenantId: string, @Body() dto: ImportExcelDto) {
    return this.productService.importExcel(tenantId, dto);
  }

  @Api({ summary: '查询导入任务回执' })
  @RequirePermission('store:product:query')
  @Get('product/import-jobs/:jobId')
  getImportJob(@CurrentTenant() tenantId: string, @Param('jobId') jobId: string) {
    return this.productService.getImportJob(tenantId, jobId);
  }

  /**
   * 批量导入商品
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Api({ summary: '批量导入商品', type: BatchOperationResult })
  @RequirePermission('store:product:import')
  @Throttle({ default: { limit: ADMIN_STORE_PRODUCT_IMPORT_BATCH_LIMIT, ttl: ONE_MINUTE_MS } })
  @Post('product/import/batch')
  batchImportProducts(@Body() dto: BatchImportProductDto, @CurrentTenant() tenantId: string) {
    return this.productService.batchImportProducts(tenantId, dto);
  }

  /**
   * 店铺商品列表
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Api({ summary: '店铺商品列表', type: StoreProductVo, isPager: true })
  @RequirePermission('store:product:list')
  @Throttle({ default: { limit: ADMIN_STORE_PRODUCT_LIST_LIMIT, ttl: ONE_MINUTE_MS } })
  @Post('product/list')
  async findAll(
    @CurrentTenant() tenantId: string,
    @Body() query: ListStoreProductDto,
    @Headers() headers: Record<string, unknown>,
  ) {
    // 正式门店商品列表只承载已审核通过商品；草稿/待审/驳回由独立页面处理，避免经营页混入审核流。
    const scopedQuery = this.withApprovedProductScope(query);
    return await this.storeProductQueryFallbackService.getOrLoadListResult(
      {
        headers,
        body: scopedQuery as unknown as Record<string, unknown>,
        path: '/store/product/list',
      },
      () => this.productService.findAll(tenantId, scopedQuery),
    );
  }

  @Api({ summary: '草稿箱列表', type: StoreProductVo, isPager: true })
  @RequirePermission('store:product:list')
  @Throttle({ default: { limit: ADMIN_STORE_PRODUCT_LIST_LIMIT, ttl: ONE_MINUTE_MS } })
  @Post('product/draft/list')
  async draftList(
    @CurrentTenant() tenantId: string,
    @Body() query: ListStoreProductDto,
    @Headers() headers: Record<string, unknown>,
  ) {
    // 草稿箱只允许草稿与驳回商品，页面上的编辑/提审操作都以这个边界为准。
    const scopedQuery = this.withDraftProductScope(query);
    return await this.storeProductQueryFallbackService.getOrLoadListResult(
      {
        headers,
        body: scopedQuery as unknown as Record<string, unknown>,
        path: '/store/product/draft/list',
      },
      () => this.productService.findAll(tenantId, scopedQuery),
    );
  }

  @Api({ summary: '审核中心列表', type: StoreProductVo, isPager: true })
  @RequirePermission('store:product:list')
  @Throttle({ default: { limit: ADMIN_STORE_PRODUCT_LIST_LIMIT, ttl: ONE_MINUTE_MS } })
  @Post('product/review/list')
  async reviewList(
    @CurrentTenant() tenantId: string,
    @Body() query: ListStoreProductDto,
    @Headers() headers: Record<string, unknown>,
  ) {
    // 审核中心聚焦待审核队列；已通过进入门店商品，已驳回回到草稿箱。
    const scopedQuery = this.withPendingReviewScope(query);
    return await this.storeProductQueryFallbackService.getOrLoadListResult(
      {
        headers,
        body: scopedQuery as unknown as Record<string, unknown>,
        path: '/store/product/review/list',
      },
      () => this.productService.findAll(tenantId, scopedQuery),
    );
  }

  /**
   * 更新商品价格
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Api({ summary: '更新商品价格' })
  @RequirePermission('store:product:update')
  @LogOperation({
    action: BizOperationActions.STORE_PRODUCT_UPDATE_PRICE,
    targetType: BizOperationTargetTypes.STORE_PRODUCT,
    targetIdBodyKey: 'tenantSkuId',
    detailBodyKeys: ['price', 'stock', 'distRate', 'distMode', 'pointsRatio', 'isPromotionProduct'],
  })
  @Post('product/update-price')
  updateProductPrice(@Body() dto: UpdateProductPriceDto, @CurrentTenant() tenantId: string) {
    return this.productService.updateProductPrice(tenantId, dto);
  }

  /**
   * 批量调价
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Api({ summary: '批量调价', type: BatchOperationResult })
  @RequirePermission('store:product:update')
  @Post('product/update-price/batch')
  batchUpdateProductPrice(@Body() dto: BatchUpdateProductPriceDto, @CurrentTenant() tenantId: string) {
    return this.productService.batchUpdateProductPrice(tenantId, dto);
  }

  @Api({ summary: '批量预校验改价改分佣', type: BatchOperationResult })
  @RequirePermission('store:product:update')
  @Post('product/sku/batch-validate')
  batchValidateSkuPriceCommission(@Body() dto: BatchUpdateProductPriceDto, @CurrentTenant() tenantId: string) {
    return this.productService.batchValidateSkuPriceCommission(tenantId, dto);
  }

  @Api({ summary: '批量改价改分佣', type: BatchOperationResult })
  @RequirePermission('store:product:update')
  @LogOperation({
    action: BizOperationActions.STORE_PRODUCT_BATCH_UPSERT_PRICE_COMMISSION,
    targetType: BizOperationTargetTypes.STORE_PRODUCT,
    targetIdBodyKey: 'items',
    detailBodyKeys: ['items'],
  })
  @Post('product/sku/batch-upsert-price-commission')
  batchUpsertSkuPriceCommission(@Body() dto: BatchUpdateProductPriceDto, @CurrentTenant() tenantId: string) {
    return this.productService.batchUpsertSkuPriceCommission(tenantId, dto);
  }

  /**
   * 更新商品基础信息
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Api({ summary: '更新商品基础信息' })
  @RequirePermission('store:product:update')
  @LogOperation({
    action: BizOperationActions.STORE_PRODUCT_UPDATE_BASE,
    targetType: BizOperationTargetTypes.STORE_PRODUCT,
    targetIdBodyKey: 'id',
    detailBodyKeys: ['status', 'customTitle', 'overrideRadius'],
  })
  @Post('product/update-base')
  updateProductBase(@Body() dto: UpdateProductBaseDto, @CurrentTenant() tenantId: string) {
    return this.productService.updateProductBase(tenantId, dto);
  }

  /**
   * 移除店铺商品
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Api({ summary: '移除店铺商品' })
  @RequirePermission('store:product:update')
  @LogOperation({
    action: BizOperationActions.STORE_PRODUCT_REMOVE,
    targetType: BizOperationTargetTypes.STORE_PRODUCT,
    targetIdBodyKey: 'id',
  })
  @Post('product/remove')
  removeProduct(@Body() dto: RemoveProductDto, @CurrentTenant() tenantId: string) {
    return this.productService.removeProduct(tenantId, dto);
  }

  @Api({ summary: '批量移除店铺商品', type: BatchOperationResult })
  @RequirePermission('store:product:update')
  @LogOperation({
    action: BizOperationActions.STORE_PRODUCT_REMOVE,
    targetType: BizOperationTargetTypes.STORE_PRODUCT,
    targetIdBodyKey: 'items',
    detailBodyKeys: ['items'],
  })
  @Post('product/remove/batch')
  batchRemoveProduct(@Body() dto: BatchStoreProductDto, @CurrentTenant() tenantId: string) {
    return this.productService.batchRemoveProducts(tenantId, dto);
  }

  @Api({ summary: '提交商品审核' })
  @RequirePermission('store:product:update')
  @LogOperation({
    action: BizOperationActions.STORE_PRODUCT_SUBMIT_AUDIT,
    targetType: BizOperationTargetTypes.STORE_PRODUCT,
    targetIdParam: 'id',
  })
  @Post('product/:id/submit-audit')
  submitAudit(@Param('id') id: string, @CurrentTenant() tenantId: string, @Body() dto?: OperationIdDto) {
    return this.productService.submitAudit(tenantId, id, dto?.operationId);
  }

  @Api({ summary: '批量提交商品审核', type: BatchOperationResult })
  @RequirePermission('store:product:update')
  @LogOperation({
    action: BizOperationActions.STORE_PRODUCT_SUBMIT_AUDIT,
    targetType: BizOperationTargetTypes.STORE_PRODUCT,
    targetIdBodyKey: 'items',
    detailBodyKeys: ['items'],
  })
  @Post('product/submit-audit/batch')
  batchSubmitAudit(@Body() dto: BatchStoreProductDto, @CurrentTenant() tenantId: string) {
    return this.productService.batchSubmitAudit(tenantId, dto);
  }

  @Api({ summary: '审核通过' })
  @RequirePermission('store:product:audit')
  @LogOperation({
    action: BizOperationActions.STORE_PRODUCT_APPROVE_AUDIT,
    targetType: BizOperationTargetTypes.STORE_PRODUCT,
    targetIdParam: 'id',
  })
  @Post('product/:id/audit/approve')
  approveAudit(@Param('id') id: string, @User('userId') userId: string, @Body() dto?: OperationIdDto) {
    return this.productService.approveAudit(id, userId, dto?.operationId);
  }

  @Api({ summary: '批量审核通过', type: BatchOperationResult })
  @RequirePermission('store:product:audit')
  @LogOperation({
    action: BizOperationActions.STORE_PRODUCT_BATCH_APPROVE_AUDIT,
    targetType: BizOperationTargetTypes.STORE_PRODUCT,
    targetIdBodyKey: 'items',
    detailBodyKeys: ['items'],
  })
  @Post('product/audit/approve/batch')
  batchApproveAudit(@Body() dto: BatchApproveAuditDto, @User('userId') userId: string) {
    return this.productService.batchApproveAudit(dto, userId);
  }

  @Api({ summary: '审核驳回' })
  @RequirePermission('store:product:audit')
  @LogOperation({
    action: BizOperationActions.STORE_PRODUCT_REJECT_AUDIT,
    targetType: BizOperationTargetTypes.STORE_PRODUCT,
    targetIdParam: 'id',
    detailBodyKeys: ['reason'],
  })
  @Post('product/:id/audit/reject')
  rejectAudit(@Param('id') id: string, @Body() dto: RejectStoreProductDto, @User('userId') userId: string) {
    return this.productService.rejectAudit(id, userId, dto.reason, dto.operationId);
  }

  /**
   * 获取库存预警阈值
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Api({ summary: '获取库存预警阈值' })
  @RequirePermission('store:product:query')
  @Get('product/stock-alert/config')
  getStockAlertConfig(@CurrentTenant() tenantId: string) {
    return this.stockAlertService.getThreshold(tenantId);
  }

  /**
   * 设置库存预警阈值
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Api({ summary: '设置库存预警阈值' })
  @RequirePermission('store:product:update')
  @Post('product/stock-alert/config')
  setStockAlertConfig(@Body() dto: StockAlertConfigDto, @CurrentTenant() tenantId: string) {
    return this.stockAlertService.setThreshold(tenantId, dto);
  }
}
