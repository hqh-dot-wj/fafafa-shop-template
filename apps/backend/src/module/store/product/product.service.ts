import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, DistributionMode, PublishStatus, ProductType, StoreProductAuditStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Queue } from 'bull';
import * as ExcelJS from 'exceljs';
import { Result, ResponseCode } from 'src/common/response';
import { BusinessException } from 'src/common/exceptions';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { getErrorMessage } from 'src/common/utils/error';
import {
  BatchApproveAuditDto,
  BatchImportProductDto,
  BatchStoreProductDto,
  BatchUpdateProductPriceDto,
  ImportExcelDto,
  ImportExcelRowDto,
  ImportTemplateQueryDto,
  ImportProductDto,
  ListMarketProductDto,
  ListStoreProductDto,
  RemoveProductDto,
  UpdateProductBaseDto,
  UpdateProductPriceDto,
} from './dto';
import { ProfitValidator } from './profit-validator';
import { TenantProductRepository } from './tenant-product.repository';
import { TenantSkuRepository } from './tenant-sku.repository';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { Response } from 'express';
import { createHash, randomUUID } from 'crypto';
import {
  STORE_PRODUCT_IMPORT_JOB,
  STORE_PRODUCT_IMPORT_MAX_FILE_BASE64_CHARS,
  STORE_PRODUCT_IMPORT_MAX_ROWS,
  STORE_PRODUCT_IMPORT_QUEUE_BACKLOG_LIMIT,
  STORE_PRODUCT_IMPORT_QUEUE,
  StoreProductImportDoneResult,
  StoreProductImportJobPayload,
} from './store-product-import.queue.constants';

type TemplateSchemaField = {
  key: string;
  name: string;
  required: boolean;
  columnHeader: string;
};

type ResolvedTemplateVersion = {
  versionId: string;
  version: number;
  templateCode: string;
  fields: TemplateSchemaField[];
};

/**
 * 店铺商品管理服务
 * 处理店铺选品、导入、价格调整、列表查询等逻辑
 */
@Injectable()
export class StoreProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profitValidator: ProfitValidator,
    private readonly tenantProductRepo: TenantProductRepository,
    private readonly tenantSkuRepo: TenantSkuRepository,
    private readonly tenantHelper: TenantHelper,
    @InjectQueue(STORE_PRODUCT_IMPORT_QUEUE)
    private readonly storeProductImportQueue: Queue<StoreProductImportJobPayload>,
  ) {}

  /**
   * 选品中心 - 查询全局商品列表
   * 支持名称搜索、分类筛选、类型筛选，并标记是否已引入
   */
  async getMarketList(tenantId: string, query: ListMarketProductDto) {
    const { name, categoryId, type } = query;

    const where: Prisma.PmsProductWhereInput = {
      publishStatus: PublishStatus.ON_SHELF,
    };

    if (name) where.name = { contains: name };
    if (categoryId) where.categoryId = Number(categoryId);
    if (type) where.type = type as ProductType;

    const [list, total] = await Promise.all([
      this.prisma.pmsProduct.findMany({
        where,
        include: {
          globalSkus: true,
          tenantProducts: {
            where: { tenantId },
          },
        },
        skip: query.skip,
        take: query.take,
        orderBy: { createTime: 'desc' },
      }),
      this.prisma.pmsProduct.count({ where }),
    ]);

    const formatted = list.map((item) => {
      const { tenantProducts, ...rest } = item;
      const orderedSkus = [...(rest.globalSkus || [])].sort(
        (a, b) => Number(a.guidePrice || 0) - Number(b.guidePrice || 0),
      );
      const minPrice = orderedSkus.length > 0 ? Number(orderedSkus[0].guidePrice || 0) : 0;
      const defaultSkuLabel = this.buildDefaultSkuLabel(orderedSkus[0]?.specValues);
      return {
        productId: rest.productId,
        name: rest.name,
        displayName: defaultSkuLabel ? `${rest.name} ${defaultSkuLabel}` : rest.name,
        defaultSkuLabel,
        albumPics: rest.mainImages ? rest.mainImages.join(',') : '',
        type: rest.type,
        hasSku: rest.globalSkus.length > 0,
        price: minPrice,
        isImported: tenantProducts.length > 0,
      };
    });

    return Result.page(formatted, total);
  }

  /**
   * 选品中心 - 获取商品详情 (含SKU)
   */
  async getMarketDetail(tenantId: string, productId: string) {
    const product = await this.prisma.pmsProduct.findUnique({
      where: { productId },
      include: {
        globalSkus: true,
        tenantProducts: {
          where: { tenantId },
        },
      },
    });
    BusinessException.throwIfNull(product, '商品不存在');

    // Check if already imported to set 'isImported' flag if needed,
    // though usually the dialog handles 'isImported' logic by list view status.
    // We focus on returning details here.

    const { tenantProducts, ...rest } = product;
    const orderedSkus = [...(rest.globalSkus || [])].sort((a, b) => Number(a.guidePrice || 0) - Number(b.guidePrice || 0));
    const minPrice = orderedSkus.length > 0 ? Number(orderedSkus[0].guidePrice || 0) : 0;
    const defaultSkuLabel = this.buildDefaultSkuLabel(orderedSkus[0]?.specValues);
    return Result.ok({
      productId: rest.productId,
      name: rest.name,
      displayName: defaultSkuLabel ? `${rest.name} ${defaultSkuLabel}` : rest.name,
      defaultSkuLabel,
      albumPics: rest.mainImages ? rest.mainImages.join(',') : '',
      type: rest.type,
      hasSku: rest.globalSkus.length > 0,
      price: minPrice,
      isImported: tenantProducts.length > 0,
      serviceRadius: rest.serviceRadius ? Number(rest.serviceRadius) : 0,
      globalSkus: rest.globalSkus.map((sku) => ({
        skuId: sku.skuId,
        productId: sku.productId,
        specValues: sku.specValues,
        skuImage: sku.skuImage,
        guidePrice: Number(sku.guidePrice),
        guideRate: Number(sku.guideRate),
        distMode: sku.distMode,
        costPrice: Number(sku.costPrice),
      })),
    });
  }

  /**
   * 导入商品到店铺
   *
   * @description
   * 将全局商品库中的商品导入到当前店铺,包括商品基础信息和SKU配置。
   * 导入后商品默认为下架状态,需手动上架。
   *
   * @param tenantId - 当前租户ID
   * @param dto - 导入参数
   * @param dto.productId - 全局商品ID
   * @param dto.overrideRadius - 覆盖服务半径(米),null表示使用全局配置
   * @param dto.skus - SKU配置列表
   * @returns 创建的店铺商品记录
   *
   * @throws BusinessException
   * - 商品不存在: 全局商品ID无效
   * - 无效SKU: SKU ID不属于该商品
   * - 利润校验失败: 价格设置导致亏损
   *
   * @transaction 使用数据库事务保证原子性
   * @concurrency 使用 upsert 防止并发重复导入
   *
   * @example
   * await importProduct('tenant123', {
   *   productId: 'prod001',
   *   overrideRadius: 5000,
   *   skus: [
   *     { globalSkuId: 'sku001', price: 99.00, stock: 100, distMode: 'RATIO', distRate: 0.15 }
   *   ]
   * });
   */
  @Transactional()
  async importProduct(tenantId: string, dto: ImportProductDto) {
    const { productId, overrideRadius, skus, categoryId, templateVersionId } = dto;

    // 1. 检查全局商品是否存在
    const globalProduct = await this.prisma.pmsProduct.findUnique({
      where: { productId },
      include: { globalSkus: true },
    });
    BusinessException.throwIfNull(globalProduct, '商品不存在');
    BusinessException.throwIf(
      globalProduct.publishStatus !== PublishStatus.ON_SHELF,
      '导入失败：总部商品未上架',
      ResponseCode.BUSINESS_ERROR,
    );
    BusinessException.throwIf(
      categoryId !== undefined && categoryId !== globalProduct.categoryId,
      `导入失败：商品 ${productId} 不属于分类 ${categoryId}`,
      ResponseCode.BUSINESS_ERROR,
    );
    const resolvedTemplateVersion = await this.resolveTemplateVersionForCategory(
      globalProduct.categoryId,
      templateVersionId,
    );

    // 2. 校验 SKU 有效性
    if (skus && skus.length > 0) {
      const validSkuIds = new Set(globalProduct.globalSkus.map((s) => s.skuId));
      const invalidSkus = skus.filter((s) => !validSkuIds.has(s.globalSkuId));
      BusinessException.throwIf(
        invalidSkus.length > 0,
        `无效的SKU: ${invalidSkus.map((s) => s.globalSkuId).join(',')}`,
        ResponseCode.PARAM_INVALID,
      );

      // 3. 校验每个SKU的利润和分销费率范围
      for (const sku of skus) {
        const globalSku = globalProduct.globalSkus.find((g) => g.skuId === sku.globalSkuId);
        if (globalSku) {
          // 校验分销费率是否在允许范围内
          const storeDistRate = sku.distRate || 0;
          const minDistRate = Number(globalSku.guideRate) * 0.8; // 假设允许范围为指导费率的80%-120%
          const maxDistRate = Number(globalSku.guideRate) * 1.2;
          this.profitValidator.validateDistRateRange(storeDistRate, minDistRate, maxDistRate);

          // 校验利润
          this.profitValidator.validate(
            sku.price,
            globalSku.costPrice,
            storeDistRate,
            sku.distMode || DistributionMode.RATIO,
          );
        }
      }
    }

    // 4. 使用 upsert 创建或更新店铺商品(防止并发重复导入)
    const tenantProduct = await this.tenantProductRepo.upsert({
      where: { tenantId_productId: { tenantId, productId } },
      create: {
        tenantId,
        productId,
        status: PublishStatus.OFF_SHELF,
        overrideRadius: overrideRadius,
        templateVersionId: resolvedTemplateVersion?.versionId ?? null,
      },
      update: {
        // 如果已存在,更新服务半径
        overrideRadius: overrideRadius,
        templateVersionId: resolvedTemplateVersion?.versionId ?? null,
      },
    });

    // 5. 批量 upsert SKU（重新导入时更新已有 SKU 的价格/库存/分销配置）
    if (skus && skus.length > 0) {
      await Promise.all(
        skus.map((sku) =>
          this.tenantSkuRepo.upsert({
            where: {
              tenantProductId_globalSkuId: {
                tenantProductId: tenantProduct.id,
                globalSkuId: sku.globalSkuId,
              },
            },
            create: {
              tenantId,
              tenantProductId: tenantProduct.id,
              globalSkuId: sku.globalSkuId,
              price: new Decimal(sku.price),
              stock: sku.stock,
              distMode: sku.distMode || DistributionMode.RATIO,
              distRate: new Decimal(sku.distRate || 0),
              isActive: true,
            },
            update: {
              price: new Decimal(sku.price),
              stock: sku.stock,
              distMode: sku.distMode || DistributionMode.RATIO,
              distRate: new Decimal(sku.distRate || 0),
            },
          }),
        ),
      );
    }

    return Result.ok(tenantProduct);
  }

  async getTemplateVersions(categoryId: number) {
    const category = await this.prisma.pmsCategory.findUnique({
      where: { catId: categoryId },
      select: { catId: true, attrTemplateId: true },
    });
    BusinessException.throwIfNull(category, '分类不存在', ResponseCode.NOT_FOUND);

    if (!category.attrTemplateId) {
      return Result.ok([]);
    }

    let versions = await this.prisma.pmsAttrTemplateVersion.findMany({
      where: { templateId: category.attrTemplateId },
      orderBy: [{ version: 'desc' }, { createTime: 'desc' }],
      select: {
        versionId: true,
        version: true,
        templateCode: true,
        isLatest: true,
        createTime: true,
      },
    });

    if (versions.length === 0) {
      await this.bootstrapTemplateVersion(category.attrTemplateId);
      versions = await this.prisma.pmsAttrTemplateVersion.findMany({
        where: { templateId: category.attrTemplateId },
        orderBy: [{ version: 'desc' }, { createTime: 'desc' }],
        select: {
          versionId: true,
          version: true,
          templateCode: true,
          isLatest: true,
          createTime: true,
        },
      });
    }

    return Result.ok(versions);
  }

  async downloadImportTemplate(tenantId: string, query: ImportTemplateQueryDto, res: Response) {
    const category = await this.prisma.pmsCategory.findUnique({
      where: { catId: query.categoryId },
      select: { catId: true, name: true },
    });
    BusinessException.throwIfNull(category, '分类不存在', ResponseCode.NOT_FOUND);
    const resolvedTemplateVersion = await this.resolveTemplateVersionForCategory(query.categoryId, query.templateVersionId);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('商品导入模板');
    const baseColumns = [
      { header: 'rowNo', key: 'rowNo', width: 10 },
      { header: 'productId', key: 'productId', width: 40 },
      { header: 'globalSkuId', key: 'globalSkuId', width: 40 },
      { header: 'price', key: 'price', width: 12 },
      { header: 'stock', key: 'stock', width: 12 },
      { header: 'distRate', key: 'distRate', width: 12 },
      { header: 'distMode', key: 'distMode', width: 14 },
    ];
    const templateColumns = (resolvedTemplateVersion?.fields || []).map(field => ({
      header: field.columnHeader,
      key: field.columnHeader,
      width: 20,
    }));
    worksheet.columns = [...baseColumns, ...templateColumns];
    worksheet.addRow({
      rowNo: 1,
      productId: '请填写总部商品ID',
      globalSkuId: '请填写总部SKU ID',
      price: 99,
      stock: 100,
      distRate: 0.1,
      distMode: 'RATIO',
    });
    worksheet.getRow(1).font = { bold: true };

    const filename = resolvedTemplateVersion
      ? `store-product-import-template-cat-${category.catId}-v${resolvedTemplateVersion.version}.xlsx`
      : `store-product-import-template-cat-${category.catId}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    if (resolvedTemplateVersion) {
      res.setHeader('X-Template-Version-Id', resolvedTemplateVersion.versionId);
      res.setHeader('X-Template-Version', String(resolvedTemplateVersion.version));
    }
    res.end(buffer, 'binary');
  }

  async importExcel(tenantId: string, dto: ImportExcelDto) {
    const hasRows = Array.isArray(dto.rows) && dto.rows.length > 0;
    const hasFile = Boolean(dto.fileBase64 && dto.fileBase64.trim().length > 0);

    BusinessException.throwIf(!hasRows && !hasFile, '导入失败：请提供 rows 或 fileBase64', ResponseCode.PARAM_INVALID);
    if (hasRows) {
      BusinessException.throwIf(
        dto.rows!.length > STORE_PRODUCT_IMPORT_MAX_ROWS,
        `导入失败：单次最多支持 ${STORE_PRODUCT_IMPORT_MAX_ROWS} 行`,
        ResponseCode.PARAM_INVALID,
      );
    }
    if (hasFile) {
      BusinessException.throwIf(
        dto.fileBase64!.length > STORE_PRODUCT_IMPORT_MAX_FILE_BASE64_CHARS,
        '导入失败：文件体积过大，请拆分后重试',
        ResponseCode.PARAM_INVALID,
      );
    }

    const queueCounts = await this.storeProductImportQueue.getJobCounts();
    const backlog =
      Number(queueCounts?.waiting || 0) +
      Number(queueCounts?.active || 0) +
      Number(queueCounts?.delayed || 0);
    BusinessException.throwIf(
      backlog >= STORE_PRODUCT_IMPORT_QUEUE_BACKLOG_LIMIT,
      `导入任务拥堵（当前排队 ${backlog}），请稍后重试`,
      ResponseCode.TOO_MANY_REQUESTS,
    );

    const jobId = randomUUID();
    await this.storeProductImportQueue.add(
      STORE_PRODUCT_IMPORT_JOB,
      {
        tenantId,
        request: dto,
        queuedAt: new Date().toISOString(),
      },
      {
        jobId,
        attempts: 1,
        removeOnComplete: 10000,
        removeOnFail: 10000,
      },
    );

    return Result.ok(
      {
        jobId,
        status: 'PENDING',
        acceptedRows: hasRows ? dto.rows!.length : null,
      },
      '导入任务已受理，请稍后查询回执',
    );
  }

  async getImportJob(tenantId: string, jobId: string) {
    const job = await this.storeProductImportQueue.getJob(jobId);
    BusinessException.throwIfNull(job, '导入任务不存在', ResponseCode.NOT_FOUND);
    BusinessException.throwIf(job.data.tenantId !== tenantId, '无权查看该导入任务', ResponseCode.FORBIDDEN);

    const state = await job.getState();
    const createdAt = new Date(job.timestamp);
    const finishedAt = job.finishedOn ? new Date(job.finishedOn) : null;

    if (state === 'completed') {
      const result = (job.returnvalue || {
        successCount: 0,
        failCount: 0,
        details: [],
        finishedAt: finishedAt ? finishedAt.toISOString() : new Date().toISOString(),
      }) as StoreProductImportDoneResult;

      return Result.ok({
        jobId,
        status: 'DONE',
        successCount: result.successCount,
        failCount: result.failCount,
        details: result.details,
        createdAt,
        finishedAt: result.finishedAt,
      });
    }

    if (state === 'failed') {
      return Result.ok({
        jobId,
        status: 'FAILED',
        reason: job.failedReason || '导入任务执行失败',
        createdAt,
        finishedAt,
      });
    }

    return Result.ok({
      jobId,
      status: state === 'active' ? 'RUNNING' : 'PENDING',
      queueState: state,
      progress: this.normalizeProgress(job.progress()),
      createdAt,
    });
  }

  async processImportExcelJob(payload: StoreProductImportJobPayload): Promise<StoreProductImportDoneResult> {
    const { tenantId, request } = payload;
    const resolvedTemplateVersion = await this.resolveTemplateVersionForCategory(
      request.categoryId,
      request.templateVersionId,
    );
    const rows =
      request.rows && request.rows.length > 0
        ? request.rows
        : await this.parseRowsFromBase64(request.fileBase64, resolvedTemplateVersion?.fields || []);
    BusinessException.throwIf(rows.length === 0, '导入失败：未检测到有效行', ResponseCode.PARAM_INVALID);
    BusinessException.throwIf(
      rows.length > STORE_PRODUCT_IMPORT_MAX_ROWS,
      `导入失败：单次最多支持 ${STORE_PRODUCT_IMPORT_MAX_ROWS} 行`,
      ResponseCode.PARAM_INVALID,
    );

    const details: Array<{ rowNo: number; skuCode: string; success: boolean; reason?: string }> = [];
    let successCount = 0;
    let failCount = 0;

    for (const row of rows) {
      try {
        if (resolvedTemplateVersion) {
          for (const field of resolvedTemplateVersion.fields) {
            if (!field.required) continue;
            const value = row.templateAttrs?.[field.columnHeader];
            BusinessException.throwIf(
              !String(value ?? '').trim(),
              `模板字段 ${field.name} 不能为空`,
              ResponseCode.PARAM_INVALID,
            );
          }
        }

        await this.importProduct(tenantId, {
          productId: row.productId,
          categoryId: request.categoryId,
          templateVersionId: resolvedTemplateVersion?.versionId,
          skus: [
            {
              globalSkuId: row.globalSkuId,
              price: row.price,
              stock: row.stock,
              distRate: row.distRate,
              distMode: row.distMode,
            },
          ],
        });
        details.push({
          rowNo: row.rowNo || 0,
          skuCode: row.globalSkuId,
          success: true,
        });
        successCount++;
      } catch (error) {
        details.push({
          rowNo: row.rowNo || 0,
          skuCode: row.globalSkuId,
          success: false,
          reason: getErrorMessage(error),
        });
        failCount++;
      }
    }

    return {
      successCount,
      failCount,
      details,
      finishedAt: new Date().toISOString(),
    };
  }

  /**
   * 批量导入商品到店铺
   *
   * @description
   * 从选品中心多选商品后一次性导入。逐个调用 importProduct，支持部分成功。
   * 单次最多 50 个商品，超过需分批提交。
   *
   * @param tenantId - 当前租户ID
   * @param dto - 批量导入参数，items 为 ImportProductDto 数组
   * @returns 统一批量回执 successCount、failCount、details（id 为选品 productId）
   */
  async batchImportProducts(tenantId: string, dto: BatchImportProductDto) {
    let successCount = 0;
    let failCount = 0;
    const details: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const item of dto.items) {
      try {
        await this.importProduct(tenantId, item);
        details.push({ id: item.productId, success: true });
        successCount++;
      } catch (error) {
        const msg = getErrorMessage(error);
        details.push({ id: item.productId, success: false, error: msg });
        failCount++;
      }
    }

    return Result.ok(
      { successCount, failCount, details },
      `批量导入完成：成功 ${successCount} 个，失败 ${failCount} 个`,
    );
  }

  /**
   * 批量更新 SKU 价格/库存/分销配置
   *
   * @description
   * 选择多个 SKU 一次性调整价格、库存或分销配置。逐个调用 updateProductPrice，支持部分成功。
   * 单次最多 50 个 SKU，超过需分批提交。每个 SKU 需通过利润风控校验。
   *
   * @param tenantId - 当前租户ID
   * @param dto - 批量调价参数，items 为 UpdateProductPriceDto 数组
   * @returns 统一批量回执 successCount、failCount、details（id 为租户 SKU ID）
   */
  async batchUpdateProductPrice(tenantId: string, dto: BatchUpdateProductPriceDto) {
    let successCount = 0;
    let failCount = 0;
    const details: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const item of dto.items) {
      try {
        await this.updateProductPrice(tenantId, item);
        details.push({ id: item.tenantSkuId, success: true });
        successCount++;
      } catch (error) {
        const msg = getErrorMessage(error);
        details.push({ id: item.tenantSkuId, success: false, error: msg });
        failCount++;
      }
    }

    return Result.ok(
      { successCount, failCount, details },
      `批量调价完成：成功 ${successCount} 个，失败 ${failCount} 个`,
    );
  }

  /**
   * 批量预校验 SKU 改价/改分佣是否可执行（不落库）
   *
   * 规则：
   * 1. SKU 必须存在且归属当前租户
   * 2. 仅 DRAFT / REJECTED 状态商品允许批量维护
   * 3. 需通过利润风控校验
   */
  async batchValidateSkuPriceCommission(tenantId: string, dto: BatchUpdateProductPriceDto) {
    let successCount = 0;
    let failCount = 0;
    const details: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const item of dto.items) {
      try {
        await this.assertSkuBatchEditable(tenantId, item);
        details.push({ id: item.tenantSkuId, success: true });
        successCount++;
      } catch (error) {
        details.push({ id: item.tenantSkuId, success: false, error: getErrorMessage(error) });
        failCount++;
      }
    }

    return Result.ok(
      { successCount, failCount, details },
      `批量预校验完成：成功 ${successCount} 个，失败 ${failCount} 个`,
    );
  }

  /**
   * 批量改价/改分佣（先校验后执行）
   */
  async batchUpsertSkuPriceCommission(tenantId: string, dto: BatchUpdateProductPriceDto) {
    let successCount = 0;
    let failCount = 0;
    const details: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const item of dto.items) {
      try {
        await this.assertSkuBatchEditable(tenantId, item);
        await this.updateProductPrice(tenantId, item);
        details.push({ id: item.tenantSkuId, success: true });
        successCount++;
      } catch (error) {
        details.push({ id: item.tenantSkuId, success: false, error: getErrorMessage(error) });
        failCount++;
      }
    }

    return Result.ok(
      { successCount, failCount, details },
      `批量改价改分佣完成：成功 ${successCount} 个，失败 ${failCount} 个`,
    );
  }

  /**
   * 店铺商品列表
   * 查询当前店铺已引入的商品
   * HQ 跨店查询需要超管身份
   */
  async findAll(tenantId: string, query: ListStoreProductDto) {
    const { name, type, status, auditStatus, storeId } = query;

    // storeId 跨店查询仅允许超管
    if (storeId && storeId !== tenantId) {
      BusinessException.throwIf(!TenantContext.isSuperTenant(), '无权查看其他门店商品', ResponseCode.FORBIDDEN);
    }

    const where: Prisma.PmsTenantProductWhereInput = {
      tenantId: storeId || tenantId,
    };

    if (name) {
      where.OR = [{ customTitle: { contains: name } }, { product: { name: { contains: name } } }];
    }
    if (type) {
      where.product = { is: { type: type as ProductType } };
    }
    if (status) where.status = status as Prisma.PmsTenantProductWhereInput['status'];
    if (auditStatus) {
      where.auditStatus = auditStatus as StoreProductAuditStatus;
    }

    const [list, total] = await Promise.all([
      this.tenantProductRepo.findWithRelations(where, query.skip, query.take),
      this.tenantProductRepo.countWithConditions(where),
    ]);

    type ListItem = Prisma.PmsTenantProductGetPayload<{
      include: { product: true; skus: { include: { globalSku: true } } };
    }>;
    const formatted = list.map((item: ListItem) => {
      const firstSku = item.skus?.[0];
      return {
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        albumPics: item.product.mainImages ? item.product.mainImages.join(',') : '',
        type: item.product.type,
        status: item.status,
        auditStatus: item.auditStatus,
        auditReason: item.auditReason,
        submittedAt: item.submittedAt,
        templateVersionId: item.templateVersionId,
        isHot: item.isHot,
        price: Number(firstSku?.price || 0),
        customTitle: item.customTitle,
        overrideRadius: item.overrideRadius,
        pointsRatio: firstSku?.pointsRatio,
        isPromotionProduct: firstSku?.isPromotionProduct,
        skus: item.skus.map((sku: ListItem['skus'][number]) => ({
          id: sku.id,
          price: Number(sku.price),
          stock: sku.stock,
          distMode: sku.distMode,
          distRate: Number(sku.distRate),
          isActive: sku.isActive,
          specValues: sku.globalSku.specValues,
          costPrice: Number(sku.globalSku.costPrice),
          guidePrice: Number(sku.globalSku.guidePrice),
          pointsRatio: sku.pointsRatio,
          isPromotionProduct: sku.isPromotionProduct,
        })),
      };
    });

    return Result.page(formatted, total);
  }

  /**
   * 更新店铺商品价格/分销配置/库存
   *
   * @description
   * 需校验利润风控 (售价 - 成本 - 分销佣金 > 0)
   * 使用乐观锁防止并发更新冲突
   *
   * @param tenantId - 租户ID
   * @param dto - 更新参数
   * @returns 更新后的SKU信息
   *
   * @throws BusinessException
   * - SKU不存在
   * - 无权操作此商品
   * - 价格设置导致亏损
   * - 更新失败,数据已被修改,请重试 (乐观锁冲突)
   *
   * @concurrency 使用乐观锁(version字段)防止并发更新
   * @performance 冲突率低(<1%),适合商品价格更新场景
   *
   * @example
   * // 更新商品价格
   * await updateProductPrice('tenant1', {
   *   tenantSkuId: 'sku1',
   *   price: 99.00,
   *   stock: 100,
   *   distRate: 0.15,
   *   distMode: 'RATIO'
   * });
   */
  @Transactional()
  async updateProductPrice(tenantId: string, dto: UpdateProductPriceDto) {
    const { tenantSkuId, price, stock, distRate, distMode, pointsRatio, isPromotionProduct } = dto;

    // 1. 获取店铺 SKU (包含当前版本号、租户商品、全局SKU)
    const tenantSku = await this.prisma.pmsTenantSku.findFirst({
      where: this.tenantHelper.readWhereForDelegate('pmsTenantSku', {
        id: tenantSkuId,
      }) as Prisma.PmsTenantSkuWhereInput,
      include: {
        tenantProd: true,
        globalSku: true,
      },
    });
    BusinessException.throwIfNull(tenantSku, 'SKU不存在');
    BusinessException.throwIf(tenantSku.tenantProd.tenantId !== tenantId, '无权操作此商品', ResponseCode.FORBIDDEN);

    // 2. 利润风控校验(使用 ProfitValidator)
    const currentDistMode = (distMode || tenantSku.distMode) as DistributionMode;
    const currentDistRate = distRate !== undefined ? distRate : tenantSku.distRate;
    const cost = tenantSku.globalSku.costPrice;

    // 使用 ProfitValidator 进行完整的参数校验和利润校验
    this.profitValidator.validate(price, cost, Number(currentDistRate), currentDistMode);

    // 3. 使用乐观锁更新数据库
    // updateMany 返回 { count: number },如果 count=0 说明版本号不匹配(被其他请求修改了)
    const affected = await this.prisma.pmsTenantSku.updateMany({
      where: {
        id: tenantSkuId,
        version: tenantSku.version, // 乐观锁条件: 版本号必须匹配
        tenantProd: { tenantId }, // 额外安全检查
      },
      data: {
        price: new Decimal(price),
        stock: stock !== undefined ? stock : undefined,
        distRate: distRate !== undefined ? new Decimal(distRate) : undefined,
        distMode: distMode !== undefined ? (distMode as DistributionMode) : undefined,
        pointsRatio: pointsRatio !== undefined ? pointsRatio : undefined,
        isPromotionProduct: isPromotionProduct !== undefined ? isPromotionProduct : undefined,
        version: { increment: 1 }, // 版本号+1
      },
    });

    // 4. 检查更新结果
    if (affected.count === 0) {
      throw new BusinessException(ResponseCode.CONFLICT, '更新失败,数据已被修改,请重试');
    }

    // 5. 查询最新数据返回
    const updated = await this.prisma.pmsTenantSku.findFirst({
      where: this.tenantHelper.readWhereForDelegate('pmsTenantSku', {
        id: tenantSkuId,
      }) as Prisma.PmsTenantSkuWhereInput,
      include: { globalSku: true },
    });

    return Result.ok(updated);
  }

  /**
   * 更新店铺商品基础信息 (状态、自定义标题、半径)
   */
  async updateProductBase(tenantId: string, dto: UpdateProductBaseDto) {
    const { id, status, customTitle, overrideRadius } = dto;

    const tenantProduct = await this.tenantProductRepo.findById(id);
    BusinessException.throwIfNull(tenantProduct, '商品不存在');
    BusinessException.throwIf(tenantProduct.tenantId !== tenantId, '无权操作此商品', ResponseCode.FORBIDDEN);
    BusinessException.throwIf(
      status === PublishStatus.ON_SHELF && tenantProduct.auditStatus !== StoreProductAuditStatus.APPROVED,
      '商品未通过审核，禁止上架',
      ResponseCode.BUSINESS_ERROR,
    );
    BusinessException.throwIf(
      status === PublishStatus.ON_SHELF && Boolean(tenantProduct.syncBlockedReason),
      `商品暂不可上架：${tenantProduct.syncBlockedReason}`,
      ResponseCode.BUSINESS_ERROR,
    );

    // 仅传入 Prisma 接受的字段，避免 undefined 进入 update data（部分环境下会触发引擎/序列化问题）
    const data: Prisma.PmsTenantProductUpdateInput = {
      status: status as PublishStatus,
    };
    if (customTitle !== undefined) {
      data.customTitle = customTitle;
    }
    if (overrideRadius !== undefined) {
      data.overrideRadius = overrideRadius;
    }

    await this.tenantProductRepo.update(id, data);

    return Result.ok(true);
  }

  /**
   * 从店铺移除商品（硬删除 + 关联 SKU 清理）
   *
   * @description
   * 删除门店商品映射及其所有关联 SKU。
   * 仅允许下架状态的商品被移除，上架中的商品需先下架。
   *
   * @param tenantId - 租户ID
   * @param dto - 移除参数
   * @returns 删除结果
   *
   * @throws BusinessException
   * - 商品不存在
   * - 无权操作此商品
   * - 商品处于上架状态，请先下架
   *
   * @transaction 使用事务保证商品和 SKU 同时删除
   */
  @Transactional()
  async removeProduct(tenantId: string, dto: RemoveProductDto) {
    const { id } = dto;

    const tenantProduct = await this.tenantProductRepo.findById(id);
    BusinessException.throwIfNull(tenantProduct, '商品不存在');
    BusinessException.throwIf(tenantProduct.tenantId !== tenantId, '无权操作此商品', ResponseCode.FORBIDDEN);
    BusinessException.throwIf(tenantProduct.status === PublishStatus.ON_SHELF, '商品处于上架状态，请先下架');

    // 先删除关联 SKU，再删除商品
    await this.tenantSkuRepo.deleteMany({ tenantProductId: id });
    await this.tenantProductRepo.delete(id);

    return Result.ok(null, '商品已移除');
  }

  async batchRemoveProducts(tenantId: string, dto: BatchStoreProductDto) {
    return this.withOperationIdempotency(
      tenantId,
      dto.operationId,
      'STORE_PRODUCT_BATCH_REMOVE',
      { items: dto.items },
      async () => {
        const details: Array<{ id: string; success: boolean; error?: string }> = [];

        for (const id of dto.items) {
          try {
            await this.removeProduct(tenantId, { id });
            details.push({ id, success: true });
          } catch (error) {
            details.push({ id, success: false, error: getErrorMessage(error) });
          }
        }

        const successCount = details.filter(item => item.success).length;
        const failCount = details.length - successCount;

        return Result.ok(
          { successCount, failCount, details },
          `批量移除完成：成功 ${successCount} 条，失败 ${failCount} 条`,
        );
      },
    );
  }

  @Transactional()
  async submitAudit(tenantId: string, id: string, operationId?: string) {
    return this.withOperationIdempotency(tenantId, operationId, 'STORE_PRODUCT_SUBMIT_AUDIT', { id }, async () => {
      const tenantProduct = await this.tenantProductRepo.findOneWithDetails(id);
      BusinessException.throwIfNull(tenantProduct, '商品不存在');
      BusinessException.throwIf(tenantProduct.tenantId !== tenantId, '无权操作此商品', ResponseCode.FORBIDDEN);
      BusinessException.throwIf(
        ![StoreProductAuditStatus.DRAFT, StoreProductAuditStatus.REJECTED].includes(tenantProduct.auditStatus),
        '当前状态不可提交审核',
        ResponseCode.BUSINESS_ERROR,
      );
      BusinessException.throwIf(tenantProduct.product.publishStatus !== PublishStatus.ON_SHELF, '总部商品未上架，无法提审');

      this.validateSubmitAudit(tenantProduct.skus);

      const updated = await this.tenantProductRepo.update(id, {
        auditStatus: StoreProductAuditStatus.PENDING,
        submittedAt: new Date(),
        auditReason: null,
        status: PublishStatus.OFF_SHELF,
      });

      return Result.ok(updated, '已提交审核，请等待处理');
    });
  }

  async batchSubmitAudit(tenantId: string, dto: BatchStoreProductDto) {
    return this.withOperationIdempotency(
      tenantId,
      dto.operationId,
      'STORE_PRODUCT_BATCH_SUBMIT_AUDIT',
      { items: dto.items },
      async () => {
        const details: Array<{ id: string; success: boolean; error?: string }> = [];

        for (const id of dto.items) {
          try {
            await this.submitAudit(tenantId, id);
            details.push({ id, success: true });
          } catch (error) {
            details.push({ id, success: false, error: getErrorMessage(error) });
          }
        }

        const successCount = details.filter(item => item.success).length;
        const failCount = details.length - successCount;

        return Result.ok(
          { successCount, failCount, details },
          `批量提审完成：成功 ${successCount} 条，失败 ${failCount} 条`,
        );
      },
    );
  }

  @Transactional()
  async approveAudit(id: string, userId: string, operationId?: string) {
    return this.withOperationIdempotency(undefined, operationId, 'STORE_PRODUCT_APPROVE_AUDIT', { id, userId }, async () => {
      const tenantProduct = await this.tenantProductRepo.findById(id);
      BusinessException.throwIfNull(tenantProduct, '商品不存在');
      BusinessException.throwIf(
        tenantProduct.auditStatus !== StoreProductAuditStatus.PENDING,
        '仅待审核商品可执行通过',
        ResponseCode.BUSINESS_ERROR,
      );

      const updated = await this.tenantProductRepo.update(id, {
        auditStatus: StoreProductAuditStatus.APPROVED,
        auditBy: userId,
        auditTime: new Date(),
        auditReason: null,
      });

      return Result.ok(updated, '审核通过：商品已进入可上架状态');
    });
  }

  async batchApproveAudit(dto: BatchApproveAuditDto, userId: string) {
    return this.withOperationIdempotency(
      undefined,
      dto.operationId,
      'STORE_PRODUCT_BATCH_APPROVE_AUDIT',
      { items: dto.items, userId },
      async () => {
        const details: Array<{ id: string; success: boolean; error?: string }> = [];

        for (const id of dto.items) {
          try {
            await this.approveAudit(id, userId);
            details.push({ id, success: true });
          } catch (error) {
            details.push({ id, success: false, error: getErrorMessage(error) });
          }
        }

        const successCount = details.filter(item => item.success).length;
        const failCount = details.length - successCount;

        return Result.ok(
          {
            successCount,
            failCount,
            details
          },
          `批量审核完成：通过 ${successCount} 条，失败 ${failCount} 条`
        );
      }
    );
  }

  @Transactional()
  async rejectAudit(id: string, userId: string, reason: string, operationId?: string) {
    return this.withOperationIdempotency(
      undefined,
      operationId,
      'STORE_PRODUCT_REJECT_AUDIT',
      { id, userId, reason },
      async () => {
        const tenantProduct = await this.tenantProductRepo.findById(id);
        BusinessException.throwIfNull(tenantProduct, '商品不存在');
        BusinessException.throwIf(
          tenantProduct.auditStatus !== StoreProductAuditStatus.PENDING,
          '仅待审核商品可执行驳回',
          ResponseCode.BUSINESS_ERROR,
        );

        const updated = await this.tenantProductRepo.update(id, {
          auditStatus: StoreProductAuditStatus.REJECTED,
          auditBy: userId,
          auditTime: new Date(),
          auditReason: reason,
          status: PublishStatus.OFF_SHELF,
        });

        return Result.ok(updated, '审核驳回：请按意见修改后重新提交');
      }
    );
  }

  private validateSubmitAudit(skus: Array<{ price: Prisma.Decimal | number | string }>) {
    BusinessException.throwIf(skus.length === 0, '提交审核失败：至少需要一个 SKU', ResponseCode.BUSINESS_ERROR);
    BusinessException.throwIf(
      skus.some((sku) => Number(sku.price) <= 0),
      '提交审核失败：SKU 价格必须大于 0',
      ResponseCode.BUSINESS_ERROR,
    );
  }

  private async assertSkuBatchEditable(tenantId: string, item: UpdateProductPriceDto) {
    const sku = await this.prisma.pmsTenantSku.findFirst({
      where: this.tenantHelper.readWhereForDelegate('pmsTenantSku', {
        id: item.tenantSkuId,
      }) as Prisma.PmsTenantSkuWhereInput,
      include: {
        tenantProd: true,
        globalSku: true,
      },
    });

    BusinessException.throwIfNull(sku, 'SKU不存在');
    BusinessException.throwIf(sku.tenantProd.tenantId !== tenantId, '无权操作此商品', ResponseCode.FORBIDDEN);
    const editableAuditStatuses: StoreProductAuditStatus[] = [
      StoreProductAuditStatus.DRAFT,
      StoreProductAuditStatus.REJECTED,
    ];
    BusinessException.throwIf(
      !editableAuditStatuses.includes(sku.tenantProd.auditStatus),
      '仅草稿/驳回商品支持批量改价改分佣',
      ResponseCode.BUSINESS_ERROR,
    );

    const distMode = (item.distMode || sku.distMode) as DistributionMode;
    const distRate = item.distRate !== undefined ? item.distRate : Number(sku.distRate);
    this.profitValidator.validate(item.price, sku.globalSku.costPrice, distRate, distMode);
  }

  private async resolveTemplateVersionForCategory(
    categoryId: number,
    templateVersionId?: string,
  ): Promise<ResolvedTemplateVersion | null> {
    const category = await this.prisma.pmsCategory.findUnique({
      where: { catId: categoryId },
      select: { catId: true, attrTemplateId: true },
    });
    BusinessException.throwIfNull(category, '分类不存在', ResponseCode.NOT_FOUND);

    if (!category.attrTemplateId) {
      BusinessException.throwIf(Boolean(templateVersionId), '当前分类未绑定模板，不能指定模板版本', ResponseCode.PARAM_INVALID);
      return null;
    }

    let version = templateVersionId
      ? await this.prisma.pmsAttrTemplateVersion.findFirst({
          where: { versionId: templateVersionId, templateId: category.attrTemplateId },
        })
      : await this.prisma.pmsAttrTemplateVersion.findFirst({
          where: { templateId: category.attrTemplateId, isLatest: true },
          orderBy: [{ version: 'desc' }, { createTime: 'desc' }],
        });

    if (!version && templateVersionId) {
      BusinessException.throw(ResponseCode.PARAM_INVALID, '模板版本不存在或与当前分类不匹配');
    }

    if (!version) {
      version = await this.bootstrapTemplateVersion(category.attrTemplateId);
    }

    const fields = this.extractTemplateSchemaFields(version.schemaSnapshot, version.version);
    return {
      versionId: version.versionId,
      version: version.version,
      templateCode: version.templateCode,
      fields,
    };
  }

  private async bootstrapTemplateVersion(templateId: number) {
    const [template, attrs] = await Promise.all([
      this.prisma.pmsAttrTemplate.findUnique({
        where: { templateId },
        select: { templateId: true, name: true },
      }),
      this.prisma.pmsAttribute.findMany({
        where: { templateId },
        orderBy: [{ sort: 'asc' }, { attrId: 'asc' }],
        select: {
          attrId: true,
          name: true,
          usageType: true,
          inputType: true,
          inputList: true,
        },
      }),
    ]);
    BusinessException.throwIfNull(template, '模板不存在', ResponseCode.NOT_FOUND);

    const latest = await this.prisma.pmsAttrTemplateVersion.findFirst({
      where: { templateId },
      orderBy: [{ version: 'desc' }],
      select: { version: true },
    });
    const nextVersion = (latest?.version || 0) + 1;
    const schemaSnapshot = {
      fields: attrs.map(attr => ({
        key: attr.name,
        name: attr.name,
        required: false,
        attrId: attr.attrId,
        usageType: attr.usageType,
        inputType: attr.inputType,
        inputList: attr.inputList,
      })),
    };

    await this.prisma.pmsAttrTemplateVersion.updateMany({
      where: { templateId, isLatest: true },
      data: { isLatest: false },
    });

    return this.prisma.pmsAttrTemplateVersion.create({
      data: {
        templateId,
        templateCode: `TPL_${template.templateId}`,
        version: nextVersion,
        schemaSnapshot: schemaSnapshot as Prisma.InputJsonValue,
        isLatest: true,
      },
    });
  }

  private extractTemplateSchemaFields(schemaSnapshot: unknown, version: number): TemplateSchemaField[] {
    const snapshot =
      schemaSnapshot && typeof schemaSnapshot === 'object' ? (schemaSnapshot as Record<string, unknown>) : {};
    const rawFields = Array.isArray(snapshot.fields)
      ? snapshot.fields
      : Array.isArray(schemaSnapshot)
        ? schemaSnapshot
        : [];

    return rawFields
      .map((item, index) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const rawName = String(row.name ?? row.label ?? row.key ?? `field_${index + 1}`).trim();
        if (!rawName) return null;
        const key = String(row.key ?? rawName).trim();
        const normalizedKey = key.startsWith('attr.') ? key.slice(5) : key;
        const columnKey = this.sanitizeTemplateColumnKey(normalizedKey);
        const columnHeader = `attr.${columnKey}@v${version}`;
        return {
          key: columnKey,
          name: rawName,
          required: Boolean(row.required),
          columnHeader,
        } satisfies TemplateSchemaField;
      })
      .filter((item): item is TemplateSchemaField => Boolean(item));
  }

  private sanitizeTemplateColumnKey(input: string) {
    return input.replace(/\s+/g, '_').trim();
  }

  private buildDefaultSkuLabel(specValues: unknown): string | null {
    if (!specValues || typeof specValues !== 'object') {
      return null;
    }
    const entries = Object.entries(specValues as Record<string, unknown>).filter(
      ([, value]) => value !== undefined && value !== null && String(value).trim() !== '',
    );
    if (entries.length === 0) {
      return null;
    }
    return entries.map(([, value]) => String(value).trim()).join('*');
  }

  private async withOperationIdempotency<T>(
    tenantId: string | undefined,
    operationId: string | undefined,
    action: string,
    requestPayload: unknown,
    run: () => Promise<T>,
  ): Promise<T> {
    if (!operationId) {
      return run();
    }

    const resolvedTenantId = tenantId || TenantContext.getTenantId() || '000000';
    const existing = await this.prisma.bizIdempotencyRecord.findFirst({
      where: { tenantId: resolvedTenantId, operationId, action },
    });

    if (existing?.responseSnapshot) {
      return existing.responseSnapshot as T;
    }

    const requestHash = createHash('sha256').update(JSON.stringify(requestPayload || {})).digest('hex');
    const expireTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      await this.prisma.bizIdempotencyRecord.create({
        data: {
          tenantId: resolvedTenantId,
          operationId,
          action,
          requestHash,
          expireTime,
        },
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2002') {
        const locked = await this.prisma.bizIdempotencyRecord.findFirst({
          where: { tenantId: resolvedTenantId, operationId, action },
        });
        if (locked?.responseSnapshot) {
          return locked.responseSnapshot as T;
        }
        throw new BusinessException(ResponseCode.OPERATION_FAILED, '请求正在处理中，请勿重复提交');
      }
      throw error;
    }

    try {
      const result = await run();
      await this.prisma.bizIdempotencyRecord.updateMany({
        where: { tenantId: resolvedTenantId, operationId, action },
        data: { responseSnapshot: result as Prisma.InputJsonValue },
      });
      return result;
    } catch (error) {
      await this.prisma.bizIdempotencyRecord.deleteMany({
        where: { tenantId: resolvedTenantId, operationId, action },
      });
      throw error;
    }
  }

  private normalizeProgress(progress: unknown): number {
    if (typeof progress === 'number' && Number.isFinite(progress)) {
      return progress;
    }
    return 0;
  }

  private parseCellString(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      if ('text' in value && typeof value.text === 'string') {
        return value.text;
      }
      if ('result' in value && value.result !== undefined && value.result !== null) {
        return String(value.result);
      }
      return '';
    }
    return String(value);
  }

  private async parseRowsFromBase64(
    fileBase64?: string,
    templateFields: TemplateSchemaField[] = [],
  ): Promise<ImportExcelRowDto[]> {
    if (!fileBase64) {
      return [];
    }

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(fileBase64, 'base64'));
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        return [];
      }

      const headerRow = worksheet.getRow(1);
      const headerIndexMap = new Map<string, number>();
      headerRow.eachCell((cell, colNumber) => {
        const label = this.parseCellString(cell.value).trim();
        if (label) {
          headerIndexMap.set(label, colNumber);
        }
      });

      const requiredBaseHeaders = ['rowNo', 'productId', 'globalSkuId', 'price', 'stock', 'distRate', 'distMode'];
      const missingBaseHeaders = requiredBaseHeaders.filter(header => !headerIndexMap.has(header));
      BusinessException.throwIf(
        missingBaseHeaders.length > 0,
        `Excel 模板缺少基础列：${missingBaseHeaders.join('、')}`,
        ResponseCode.PARAM_INVALID,
      );

      const missingTemplateHeaders = templateFields
        .map(field => field.columnHeader)
        .filter(header => !headerIndexMap.has(header));
      BusinessException.throwIf(
        missingTemplateHeaders.length > 0,
        `Excel 模板缺少模板列：${missingTemplateHeaders.join('、')}`,
        ResponseCode.PARAM_INVALID,
      );

      const rows: ImportExcelRowDto[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }
        const productId = this.parseCellString(row.getCell(headerIndexMap.get('productId')!).value).trim();
        const globalSkuId = this.parseCellString(row.getCell(headerIndexMap.get('globalSkuId')!).value).trim();
        if (!productId || !globalSkuId) {
          return;
        }
        const templateAttrs: Record<string, string> = {};
        for (const field of templateFields) {
          const colIndex = headerIndexMap.get(field.columnHeader);
          if (!colIndex) continue;
          templateAttrs[field.columnHeader] = this.parseCellString(row.getCell(colIndex).value).trim();
        }
        rows.push({
          rowNo: Number(this.parseCellString(row.getCell(headerIndexMap.get('rowNo')!).value) || rowNumber),
          productId,
          globalSkuId,
          price: Number(this.parseCellString(row.getCell(headerIndexMap.get('price')!).value) || 0),
          stock: Number(this.parseCellString(row.getCell(headerIndexMap.get('stock')!).value) || 0),
          distRate: Number(this.parseCellString(row.getCell(headerIndexMap.get('distRate')!).value) || 0),
          distMode: (this.parseCellString(row.getCell(headerIndexMap.get('distMode')!).value).trim() ||
            'RATIO') as ImportExcelRowDto['distMode'],
          templateAttrs,
        });
      });
      return rows;
    } catch (error) {
      throw new BusinessException(ResponseCode.PARAM_INVALID, `Excel 解析失败：${getErrorMessage(error)}`);
    }
  }
}
