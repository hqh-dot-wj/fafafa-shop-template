import { Injectable } from '@nestjs/common';
import { Prisma, ProductType as PrismaProductType, ProductBuildStatus, PublishStatus } from '@prisma/client';
import { Result, ResponseCode } from 'src/common/response';
import { BusinessException } from 'src/common/exceptions';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { PaginationHelper } from 'src/common/utils/pagination.helper';
import {
  CreateProductDto,
  UpdateProductDto,
  UpdateProductStatusDto,
  ListProductDto,
  ProductType,
  CreateAttrValueDto,
  CreateSkuDto,
  TemplateSource,
  ProductDraftStep,
  SaveProductStepDto,
} from './dto';
import { ProductRepository } from './product/product.repository';
import { SkuRepository } from './product/sku.repository';
import { AttributeRepository } from './attribute/attribute.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductSyncProducer } from '../store/product/product-sync.queue';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { getErrorMessage } from 'src/common/utils/error';

/**
 * 商品管理服务层
 * 处理商品的创建、更新、查询等核心业务逻辑
 */
@Injectable()
export class PmsProductService {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly skuRepo: SkuRepository,
    private readonly attrRepo: AttributeRepository,
    private readonly prisma: PrismaService,
    private readonly productSyncProducer: ProductSyncProducer,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 创建商品
   * 包含商品基本信息、SKU、属性值的事务创建
   *
   * @param dto - 创建商品 DTO
   * @returns 创建成功的商品信息
   */
  @Transactional()
  async create(dto: CreateProductDto) {
    await this.validateCategoryBindType(dto.categoryId, dto.type as PrismaProductType);

    const templateContext = await this.resolveTemplateContext({
      categoryId: dto.categoryId,
      templateSource: dto.templateSource,
      templateId: dto.templateId,
    });

    // 1. 业务逻辑校验
    BusinessException.throwIf(
      dto.type === ProductType.SERVICE && !dto.serviceDuration,
      '服务类商品必须填写服务时长',
      ResponseCode.PARAM_INVALID,
    );

    // 2. 验证属性归属（必须属于当前生效模板，且适配商品类型）
    if (dto.attrs && dto.attrs.length > 0) {
      await this.validateAttributes(dto.attrs, templateContext.templateId, dto.type as PrismaProductType);
    }

    // 3. 创建商品主表信息
    const product = await this.productRepo.create({
      creatorTenantId: this.tenantHelper.getTenantId(),
      name: dto.name,
      subTitle: dto.subTitle,
      mainImages: dto.mainImages,
      detailHtml: dto.detailHtml,
      type: dto.type,
      weight: dto.weight,
      isFreeShip: dto.isFreeShip,
      serviceDuration: dto.serviceDuration,
      serviceRadius: dto.serviceRadius,
      needBooking: dto.type === ProductType.SERVICE,
      templateSource: templateContext.templateSource,
      templateId: templateContext.templateId,
      specDef: dto.specDef || [],
      publishStatus: dto.publishStatus,
      buildStatus: ProductBuildStatus.COMPLETED,
      lastEditStep: ProductDraftStep.ATTR,
      draftSavedAt: null,
      category: { connect: { catId: dto.categoryId } },
      ...(dto.brandId && { brand: { connect: { brandId: dto.brandId } } }),
    });

    // 4. 创建SKU
    if (dto.skus && dto.skus.length > 0) {
      await this.createSkus(product.productId, dto.skus);
    }

    // 5. 创建属性值
    if (dto.attrs && dto.attrs.length > 0) {
      await this.createAttrValues(product.productId, dto.attrs);
    }

    return Result.ok(product);
  }

  /**
   * 商品分步保存
   * - 未传 productId：创建草稿
   * - 传 productId：更新草稿/编辑中商品
   */
  @Transactional()
  async saveDraftStep(dto: SaveProductStepDto) {
    BusinessException.throwIf(
      !dto.productId && !dto.categoryId,
      '首次保存请先选择商品分类',
      ResponseCode.PARAM_INVALID,
    );

    if (!dto.productId) {
      return this.createDraftByStep(dto);
    }
    return this.updateDraftByStep(dto.productId, dto);
  }

  /**
   * 校验属性ID归属与适配性
   * - attrId 必须存在
   * - 必须属于当前模板
   * - applyType 必须兼容商品类型（COMMON / REAL / SERVICE）
   */
  private async validateAttributes(
    attrs: CreateAttrValueDto[],
    templateId: number | null,
    productType: PrismaProductType,
  ) {
    BusinessException.throwIf(!templateId, '当前分类未绑定属性模板，请先为分类配置模板', ResponseCode.PARAM_INVALID);
    const attrIds = attrs.map((a) => a.attrId);
    const uniqueIds = new Set(attrIds);
    BusinessException.throwIf(uniqueIds.size !== attrIds.length, '属性ID重复，请检查后重试', ResponseCode.PARAM_INVALID);

    const defs = await this.attrRepo.findMany({
      where: { attrId: { in: attrIds } },
      select: { attrId: true, templateId: true, applyType: true },
    });

    const defMap = new Map(defs.map((item) => [item.attrId, item]));
    const missingIds = attrIds.filter((id) => !defMap.has(id));
    BusinessException.throwIf(missingIds.length > 0, `属性ID不存在: ${missingIds.join(', ')}`, ResponseCode.PARAM_INVALID);

    const outOfTemplateIds = attrIds.filter((id) => defMap.get(id)?.templateId !== templateId);
    BusinessException.throwIf(
      outOfTemplateIds.length > 0,
      `属性不属于当前模板: ${outOfTemplateIds.join(', ')}`,
      ResponseCode.PARAM_INVALID,
    );

    const invalidApplyIds = attrIds.filter((id) => {
      const applyType = defMap.get(id)?.applyType;
      if (applyType === undefined || applyType === null) return false;
      if (applyType === 0) return false;
      if (applyType === 1) return productType !== ProductType.REAL;
      if (applyType === 2) return productType !== ProductType.SERVICE;
      return false;
    });
    BusinessException.throwIf(
      invalidApplyIds.length > 0,
      `属性不适用于当前商品类型: ${invalidApplyIds.join(', ')}`,
      ResponseCode.PARAM_INVALID,
    );
  }

  /**
   * 创建SKU列表
   * @param productId - 商品ID
   * @param skus - SKU数据数组
   */
  private async createSkus(productId: string, skus: CreateSkuDto[]) {
    const skuData = skus.map((sku) => ({
      productId,
      specValues: sku.specValues || {},
      skuImage: sku.skuImage,
      guidePrice: sku.guidePrice,
      costPrice: sku.costPrice || 0,
      distMode: sku.distMode,
      guideRate: sku.guideRate,
      minDistRate: sku.minDistRate,
      maxDistRate: sku.maxDistRate,
    }));

    await this.skuRepo.createMany(skuData);
  }

  /**
   * 创建属性值列表
   * @param productId - 商品ID
   * @param attrs - 属性值数组
   */
  private async createAttrValues(productId: string, attrs: CreateAttrValueDto[]) {
    // 查询属性定义名称
    const attrIds = attrs.map((a) => a.attrId);
    const attrDefinitions = await this.attrRepo.findMany({
      where: { attrId: { in: attrIds } },
      select: { attrId: true, name: true },
    });

    const attrValueData = attrs.map((item) => {
      const def = attrDefinitions.find((d) => d.attrId === item.attrId);
      if (!def) {
        throw new BusinessException(ResponseCode.BUSINESS_ERROR, `属性 ${item.attrId} 不存在`);
      }
      return {
        productId,
        attrId: item.attrId,
        attrName: def.name,
        value: item.value,
      };
    });

    await this.prisma.pmsProductAttrValue.createMany({
      data: attrValueData,
    });
  }

  /**
   * 分页查询商品列表
   *
   * @param query - 查询参数 DTO
   * @returns 分页后的商品列表 VO
   */
  async findAll(query: ListProductDto) {
    const { skip, take } = PaginationHelper.getPagination(query);
    const { name, categoryId, type, publishStatus, buildStatus, creatorTenantId } = query;

    // 构建查询条件
    const where: Prisma.PmsProductWhereInput = {};
    if (name) {
      where.name = { contains: name };
    }
    if (categoryId) {
      where.categoryId = Number(categoryId);
    }
    if (type) {
      where.type = type;
    }
    if (publishStatus) {
      where.publishStatus = publishStatus as Prisma.PmsProductWhereInput['publishStatus'];
    }
    if (buildStatus) {
      where.buildStatus = buildStatus;
    }
    if (creatorTenantId) {
      where.creatorTenantId = creatorTenantId;
    }

    // 使用Repository查询
    const list = await this.productRepo.findWithRelations(where, skip, take);
    const total = await this.productRepo.countWithConditions(where);

    // 数据映射：转换为前端期望的 VO 格式
    type ProductWithRelations = Awaited<ReturnType<typeof this.productRepo.findWithRelations>>[number];
    const formattedList = list.map((item: ProductWithRelations) => {
      const orderedSkus = [...(item.globalSkus || [])].sort(
        (a, b) => Number(a.guidePrice || 0) - Number(b.guidePrice || 0),
      );
      const minPrice = orderedSkus.length > 0 ? Number(orderedSkus[0].guidePrice || 0) : 0;
      const defaultSkuLabel = this.buildDefaultSkuLabel(orderedSkus[0]?.specValues);

      return {
        ...item,
        albumPics: item.mainImages ? item.mainImages.join(',') : '',
        price: minPrice,
        defaultSkuLabel,
        displayName: defaultSkuLabel ? `${item.name} ${defaultSkuLabel}` : item.name,
      };
    });

    return Result.page(formattedList, total);
  }

  /**
   * 查询商品详情
   *
   * @param id - 商品ID
   * @returns 商品详情 VO
   */
  async findOne(id: string) {
    const product = await this.productRepo.findOneWithDetails(id);
    BusinessException.throwIf(!product, '商品不存在', ResponseCode.NOT_FOUND);
    const validProduct = product; // 类型收窄：throwIf 保证非空
    const categoryTemplateId = validProduct.category?.attrTemplateId ?? null;
    const attrTemplateIdSet = new Set(
      validProduct.attrValues
        .map((item: { attribute?: { templateId?: number } }) => item.attribute?.templateId)
        .filter((v: unknown): v is number => typeof v === 'number'),
    );
    const attrInferredTemplateId = attrTemplateIdSet.size === 1 ? Array.from(attrTemplateIdSet)[0] : null;
    const templateId = validProduct.templateId ?? attrInferredTemplateId ?? categoryTemplateId;
    const templateSource = (validProduct.templateSource as TemplateSource | undefined)
      ? (validProduct.templateSource as TemplateSource)
      : templateId && categoryTemplateId && templateId !== categoryTemplateId
        ? TemplateSource.CUSTOM
        : TemplateSource.CATEGORY;

    return Result.ok({
      ...validProduct,
      templateSource,
      templateId,
      attrs: validProduct.attrValues.map((av: { attrId: number; value: string }) => ({
        attrId: av.attrId,
        value: av.value,
      })),
    });
  }

  /**
   * 更新商品信息
   * 支持部分更新，仅更新传入的字段
   *
   * @param id - 商品ID
   * @param dto - 更新商品 DTO
   * @returns 更新后的商品信息
   */
  @Transactional()
  async update(id: string, dto: UpdateProductDto) {
    // 1. 检查商品是否存在
    const existing = await this.productRepo.findById(id);
    BusinessException.throwIfNull(existing, '商品不存在', ResponseCode.NOT_FOUND);

    // 2. 业务逻辑校验
    if (dto.type !== undefined || dto.serviceDuration !== undefined) {
      const productType = dto.type ?? existing.type;
      const serviceDuration = dto.serviceDuration ?? existing.serviceDuration;

      BusinessException.throwIf(
        productType === ProductType.SERVICE && !serviceDuration,
        '服务类商品必须填写服务时长',
        ResponseCode.PARAM_INVALID,
      );
    }

    if (dto.categoryId !== undefined || dto.type !== undefined) {
      const categoryId = dto.categoryId ?? existing.categoryId;
      const productType = (dto.type ?? existing.type) as PrismaProductType;
      await this.validateCategoryBindType(categoryId, productType);
    }

    const categoryId = dto.categoryId ?? existing.categoryId;
    const productType = (dto.type ?? existing.type) as PrismaProductType;
    const templateContext = await this.resolveTemplateContext({
      categoryId,
      templateSource: dto.templateSource,
      templateId: dto.templateId,
    });

    // 3. 验证属性归属
    if (dto.attrs && dto.attrs.length > 0) {
      await this.validateAttributes(dto.attrs, templateContext.templateId, productType);
    }

    // 4. 构建更新数据（仅包含传入的字段）
    const updateData = this.buildProductUpdateData(dto);
    updateData.templateSource = templateContext.templateSource;
    updateData.templateId = templateContext.templateId;
    updateData.buildStatus = ProductBuildStatus.COMPLETED;
    updateData.lastEditStep = ProductDraftStep.ATTR;
    updateData.draftSavedAt = null;

    const existingSkus = dto.skus !== undefined ? await this.skuRepo.findByProductId(id) : [];
    const existingSkuMap = new Map(existingSkus.map((sku) => [sku.skuId, sku]));

    // 5. 更新商品基础信息
    const product = await this.productRepo.update(id, updateData);

    // 6. 处理 SKU 变动（仅在传入时更新）
    if (dto.skus !== undefined) {
      await this.updateSkus(id, dto.skus);

      const incomingSkuIds = new Set(dto.skus.filter((item) => item.skuId).map((item) => item.skuId!));
      const hasNewSku = dto.skus.some((item) => !item.skuId);
      const hasRemovedSku = existingSkus.some((item) => !incomingSkuIds.has(item.skuId));
      const hasGuidePriceChanged = dto.skus.some((item) => {
        if (!item.skuId) return false;
        const previous = existingSkuMap.get(item.skuId);
        if (!previous) return false;
        return Number(previous.guidePrice) !== Number(item.guidePrice);
      });

      if (hasNewSku || hasRemovedSku) {
        await this.productSyncProducer.notifySkuChanged(id);
      }
      if (hasGuidePriceChanged) {
        await this.productSyncProducer.notifyGuidePriceChanged(id);
      }
    }

    // 7. 处理属性值（仅在传入时更新）
    if (dto.attrs !== undefined) {
      await this.updateAttrValues(id, dto.attrs);
    }

    return Result.ok(product);
  }

  /**
   * 更新SKU列表（增删改）
   * @param productId - 商品ID
   * @param skus - SKU数据数组
   */
  private async updateSkus(productId: string, skus: CreateSkuDto[]) {
    // 获取现有 SKU ID 列表
    const existingSkus = await this.skuRepo.findByProductId(productId);
    const existingSkuIds = existingSkus.map((s) => s.skuId);

    // 识别需要保留/更新的 SKU ID
    const incomingSkuIds = skus.filter((s) => s.skuId).map((s) => s.skuId!);

    // 识别需要删除的 SKU ID
    const skusToDelete = existingSkuIds.filter((id) => !incomingSkuIds.includes(id));

    // 执行删除
    if (skusToDelete.length > 0) {
      await this.skuRepo.deleteMany({ skuId: { in: skusToDelete } });
    }

    // 执行更新或新增
    for (const sku of skus) {
      if (sku.skuId && existingSkuIds.includes(sku.skuId)) {
        // 更新现有 SKU
        await this.skuRepo.update(sku.skuId, {
          specValues: sku.specValues || {},
          skuImage: sku.skuImage,
          guidePrice: sku.guidePrice,
          costPrice: sku.costPrice || 0,
          distMode: sku.distMode,
          guideRate: sku.guideRate,
          minDistRate: sku.minDistRate,
          maxDistRate: sku.maxDistRate,
        });
      } else {
        // 创建新 SKU
        await this.skuRepo.create({
          specValues: sku.specValues || {},
          skuImage: sku.skuImage,
          guidePrice: sku.guidePrice,
          costPrice: sku.costPrice || 0,
          distMode: sku.distMode,
          guideRate: sku.guideRate,
          minDistRate: sku.minDistRate,
          maxDistRate: sku.maxDistRate,
          product: { connect: { productId } },
        });
      }
    }
  }

  /**
   * 更新属性值列表（全量覆盖）
   * @param productId - 商品ID
   * @param attrs - 属性值数组
   */
  private async updateAttrValues(productId: string, attrs: CreateAttrValueDto[]) {
    // 先删除现有属性值
    await this.prisma.pmsProductAttrValue.deleteMany({
      where: { productId },
    });

    // 重新创建属性值
    if (attrs && attrs.length > 0) {
      await this.createAttrValues(productId, attrs);
    }
  }

  private async createDraftByStep(dto: SaveProductStepDto) {
    const categoryId = dto.categoryId as number;
    const productType = (dto.type ?? ProductType.REAL) as PrismaProductType;
    await this.validateCategoryBindType(categoryId, productType);
    const templateContext = await this.resolveTemplateContext({
      categoryId,
      templateSource: dto.templateSource,
      templateId: dto.templateId,
    });

    if (dto.attrs && dto.attrs.length > 0) {
      await this.validateAttributes(dto.attrs, templateContext.templateId, productType);
    }

    const draft = await this.productRepo.create({
      creatorTenantId: this.tenantHelper.getTenantId(),
      name: dto.name?.trim() || '未命名草稿',
      subTitle: dto.subTitle,
      mainImages: dto.mainImages ?? [],
      detailHtml: dto.detailHtml ?? '',
      type: productType,
      weight: dto.weight,
      isFreeShip: dto.isFreeShip ?? false,
      serviceDuration: dto.serviceDuration,
      serviceRadius: dto.serviceRadius,
      needBooking: productType === ProductType.SERVICE,
      templateSource: templateContext.templateSource,
      templateId: templateContext.templateId,
      specDef: dto.specDef || [],
      publishStatus: (dto.publishStatus as PublishStatus) ?? PublishStatus.OFF_SHELF,
      buildStatus: ProductBuildStatus.DRAFT,
      lastEditStep: dto.step,
      draftSavedAt: new Date(),
      category: { connect: { catId: categoryId } },
      ...(dto.brandId ? { brand: { connect: { brandId: dto.brandId } } } : {}),
    });

    if (dto.skus && dto.skus.length > 0) {
      await this.createSkus(draft.productId, dto.skus);
    }
    if (dto.attrs && dto.attrs.length > 0) {
      await this.createAttrValues(draft.productId, dto.attrs);
    }

    return Result.ok(
      {
        productId: draft.productId,
        buildStatus: ProductBuildStatus.DRAFT,
        lastEditStep: dto.step,
        savedAt: draft.draftSavedAt,
      },
      '草稿已保存',
    );
  }

  private async updateDraftByStep(productId: string, dto: SaveProductStepDto) {
    const existing = await this.productRepo.findById(productId);
    BusinessException.throwIfNull(existing, '商品不存在', ResponseCode.NOT_FOUND);

    const categoryId = dto.categoryId ?? existing.categoryId;
    const productType = (dto.type ?? existing.type) as PrismaProductType;

    if (dto.categoryId !== undefined || dto.type !== undefined) {
      await this.validateCategoryBindType(categoryId, productType);
    }

    const templateContext = await this.resolveTemplateContext({
      categoryId,
      templateSource: dto.templateSource,
      templateId: dto.templateId,
    });
    if (dto.attrs && dto.attrs.length > 0) {
      await this.validateAttributes(dto.attrs, templateContext.templateId, productType);
    }

    const updateData = this.buildProductUpdateData(dto);
    updateData.templateSource = templateContext.templateSource;
    updateData.templateId = templateContext.templateId;
    const isDraftFlow = existing.buildStatus === ProductBuildStatus.DRAFT;
    const lastEditStep = Math.max(existing.lastEditStep || ProductDraftStep.CATEGORY, dto.step);
    const savedAt = new Date();
    if (isDraftFlow) {
      updateData.buildStatus = ProductBuildStatus.DRAFT;
      updateData.lastEditStep = lastEditStep;
      updateData.draftSavedAt = savedAt;
    }

    const product = await this.productRepo.update(productId, updateData);

    if (dto.skus !== undefined) {
      await this.updateSkus(productId, dto.skus);
    }
    if (dto.attrs !== undefined) {
      await this.updateAttrValues(productId, dto.attrs);
    }

    return Result.ok(
      {
        productId: product.productId,
        buildStatus: isDraftFlow ? ProductBuildStatus.DRAFT : ProductBuildStatus.COMPLETED,
        lastEditStep: isDraftFlow ? lastEditStep : ProductDraftStep.ATTR,
        savedAt: isDraftFlow ? savedAt : undefined,
      },
      '草稿已保存',
    );
  }

  private buildProductUpdateData(dto: Partial<CreateProductDto>): Prisma.PmsProductUpdateInput {
    const updateData: Prisma.PmsProductUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.subTitle !== undefined) updateData.subTitle = dto.subTitle;
    if (dto.mainImages !== undefined) updateData.mainImages = dto.mainImages;
    if (dto.detailHtml !== undefined) updateData.detailHtml = dto.detailHtml;
    if (dto.type !== undefined) updateData.type = dto.type as ProductType;
    if (dto.weight !== undefined) updateData.weight = dto.weight;
    if (dto.isFreeShip !== undefined) updateData.isFreeShip = dto.isFreeShip;
    if (dto.serviceDuration !== undefined) updateData.serviceDuration = dto.serviceDuration;
    if (dto.serviceRadius !== undefined) updateData.serviceRadius = dto.serviceRadius;
    if (dto.publishStatus !== undefined) updateData.publishStatus = dto.publishStatus as PublishStatus;
    if (dto.categoryId !== undefined) updateData.category = { connect: { catId: dto.categoryId } };
    if (dto.brandId !== undefined) {
      updateData.brand = dto.brandId ? { connect: { brandId: dto.brandId } } : { disconnect: true };
    }

    if (dto.type !== undefined) {
      updateData.needBooking = dto.type === ProductType.SERVICE;
    }

    if (dto.specDef !== undefined) {
      updateData.specDef = dto.specDef as unknown as Prisma.InputJsonValue;
    }

    return updateData;
  }

  /**
   * 删除商品
   * 包含级联校验：检查是否有门店已导入该商品
   *
   * @param id - 商品ID
   * @returns 删除结果
   */
  @Transactional()
  async remove(id: string) {
    // 1. 检查商品是否存在
    const product = await this.productRepo.findOneWithDetails(id);
    BusinessException.throwIfNull(product, '商品不存在', ResponseCode.NOT_FOUND);

    // 2. 级联校验：全平台统计是否仍有门店导入（不能用 readWhereForDelegate，否则非平台租户会漏数，删除总部商品时触发外键错误 500）
    const tenantCount = await this.prisma.pmsTenantProduct.count({
      where: { productId: id },
    });

    BusinessException.throwIf(
      tenantCount > 0,
      `该商品已被 ${tenantCount} 家门店导入，请先通知门店移除后再删除`,
      ResponseCode.BUSINESS_ERROR,
    );

    // 3. 删除关联数据（事务内）
    // 删除属性值
    await this.prisma.pmsProductAttrValue.deleteMany({ where: { productId: id } });

    // 先清理引用总部 SKU 的门店 SKU（跨租户；Prisma 扩展会对 deleteMany 加租户条件，需 ignoreTenant）
    const globalSkuRows = await this.prisma.pmsGlobalSku.findMany({
      where: { productId: id },
      select: { skuId: true },
    });
    const globalSkuIds = globalSkuRows.map((r) => r.skuId);
    if (globalSkuIds.length > 0) {
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        await this.prisma.pmsTenantSku.deleteMany({
          where: { globalSkuId: { in: globalSkuIds } },
        });
      });
    }

    // 删除总部 SKU
    await this.skuRepo.deleteMany({ productId: id });

    // 删除商品主表
    await this.productRepo.delete(id);

    return Result.ok(null, '商品已删除');
  }

  async batchRemove(ids: string[]) {
    const details: Array<{ id: string; success: boolean; error?: string }> = [];
    for (const id of ids) {
      try {
        await this.remove(id);
        details.push({ id, success: true });
      } catch (error) {
        details.push({ id, success: false, error: getErrorMessage(error) });
      }
    }

    const successCount = details.filter(item => item.success).length;
    const failCount = details.length - successCount;

    return Result.ok(
      { successCount, failCount, details },
      `批量删除完成：成功 ${successCount} 条，失败 ${failCount} 条`,
    );
  }

  /**
   * 更新商品发布状态
   * 独立的发布/下架端点，当下架时通知门店同步
   *
   * @param id - 商品ID
   * @param dto - 更新状态 DTO
   * @returns 更新后的商品信息
   */
  async updateStatus(id: string, dto: UpdateProductStatusDto) {
    // 1. 检查商品是否存在
    const existing = await this.productRepo.findById(id);
    BusinessException.throwIfNull(existing, '商品不存在', ResponseCode.NOT_FOUND);

    // 2. 如果状态未变化，直接返回
    if (existing.publishStatus === dto.publishStatus) {
      return Result.ok(existing, '商品状态未变化');
    }

    // 3. 上架前置校验
    if (dto.publishStatus === PublishStatus.ON_SHELF) {
      const precheck = await this.precheck(id);
      const passed = Boolean(precheck.data?.passed);
      if (!passed) {
        const reasons = precheck.data?.reasons || [];
        throw new BusinessException(
          ResponseCode.BUSINESS_ERROR,
          `上架失败：请先补齐上架准入项（${reasons.join('、')}）`,
        );
      }
    }

    // 4. 更新发布状态
    const product = await this.productRepo.update(id, {
      publishStatus: dto.publishStatus,
    });

    // 5. 如果是下架操作，通知门店同步
    if (dto.publishStatus === PublishStatus.OFF_SHELF) {
      await this.productSyncProducer.notifyOffShelf(id);
    } else {
      await this.productSyncProducer.notifyOnShelf(id);
    }

    return Result.ok(product, '商品状态已更新');
  }

  async precheck(id: string) {
    const product = await this.productRepo.findOneWithDetails(id);
    BusinessException.throwIfNull(product, '商品不存在', ResponseCode.NOT_FOUND);

    const reasons: string[] = [];
    if (product.buildStatus === ProductBuildStatus.DRAFT) {
      reasons.push('建品流程未完成');
    }
    if (product.globalSkus.length === 0) {
      reasons.push('缺少 SKU');
    }

    if (
      product.globalSkus.some(
        (sku: { guidePrice: Prisma.Decimal | number | string; distMode: string; guideRate: Prisma.Decimal | number | string }) =>
          Number(sku.guidePrice) <= 0 || (sku.distMode !== 'NONE' && Number(sku.guideRate) <= 0),
      )
    ) {
      reasons.push('价格分佣');
    }

    if (product.category.bindType && product.category.bindType !== product.type) {
      reasons.push('分类绑定');
    }

    return Result.ok({
      passed: reasons.length === 0,
      reasons,
    });
  }

  private async validateCategoryBindType(categoryId: number, productType: PrismaProductType) {
    const category = await this.prisma.pmsCategory.findUnique({
      where: { catId: categoryId },
      select: { bindType: true },
    });

    BusinessException.throwIfNull(category, '商品分类不存在', ResponseCode.NOT_FOUND);

    if (category.bindType && category.bindType !== productType) {
      throw new BusinessException(
        ResponseCode.PARAM_INVALID,
        `分类绑定类型不匹配：分类要求 ${category.bindType}，当前商品类型 ${productType}`,
      );
    }
  }

  private async resolveTemplateContext(input: {
    categoryId: number;
    templateSource?: TemplateSource;
    templateId?: number;
  }): Promise<{ templateSource: TemplateSource; templateId: number | null; templateVersionId: string | null }> {
    const source = input.templateSource ?? TemplateSource.CATEGORY;
    let resolvedTemplateId: number | null = null;

    if (source === TemplateSource.CUSTOM) {
      BusinessException.throwIf(!input.templateId, '选择自定义模板时，templateId 为必填', ResponseCode.PARAM_INVALID);
      const template = await this.prisma.pmsAttrTemplate.findUnique({
        where: { templateId: input.templateId! },
        select: { templateId: true },
      });
      BusinessException.throwIfNull(template, '自定义模板不存在', ResponseCode.NOT_FOUND);
      resolvedTemplateId = template.templateId;
    } else {
      const category = await this.prisma.pmsCategory.findUnique({
        where: { catId: input.categoryId },
        select: { attrTemplateId: true },
      });
      BusinessException.throwIfNull(category, '商品分类不存在', ResponseCode.NOT_FOUND);
      resolvedTemplateId = category.attrTemplateId ?? null;
    }

    const templateVersionId = resolvedTemplateId ? await this.ensureLatestTemplateVersion(resolvedTemplateId) : null;
    return {
      templateSource: source,
      templateId: resolvedTemplateId,
      templateVersionId,
    };
  }

  private async ensureLatestTemplateVersion(templateId: number): Promise<string> {
    const latest = await this.prisma.pmsAttrTemplateVersion.findFirst({
      where: { templateId, isLatest: true },
      orderBy: [{ version: 'desc' }, { createTime: 'desc' }],
      select: { versionId: true },
    });
    if (latest) {
      return latest.versionId;
    }

    const attrs = await this.prisma.pmsAttribute.findMany({
      where: { templateId },
      orderBy: [{ sort: 'asc' }, { attrId: 'asc' }],
      select: {
        attrId: true,
        name: true,
        usageType: true,
        inputType: true,
        inputList: true,
      },
    });
    const lastVersion = await this.prisma.pmsAttrTemplateVersion.findFirst({
      where: { templateId },
      orderBy: [{ version: 'desc' }],
      select: { version: true },
    });
    const nextVersion = (lastVersion?.version || 0) + 1;
    await this.prisma.pmsAttrTemplateVersion.updateMany({
      where: { templateId, isLatest: true },
      data: { isLatest: false },
    });
    const created = await this.prisma.pmsAttrTemplateVersion.create({
      data: {
        templateId,
        templateCode: `TPL_${templateId}`,
        version: nextVersion,
        schemaSnapshot: {
          fields: attrs.map((item) => ({
            key: item.name,
            name: item.name,
            required: false,
            attrId: item.attrId,
            usageType: item.usageType,
            inputType: item.inputType,
            inputList: item.inputList,
          })),
        } as Prisma.InputJsonValue,
        isLatest: true,
      },
      select: { versionId: true },
    });
    return created.versionId;
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

}
