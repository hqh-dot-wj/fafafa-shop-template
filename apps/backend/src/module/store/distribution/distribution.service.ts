import { Injectable } from '@nestjs/common';
import { Prisma, CommissionBaseType, MktCampaignStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { Result } from 'src/common/response';
import { UpdateDistConfigDto } from './dto/update-dist-config.dto';
import { ListConfigLogsDto } from './dto/list-config-logs.dto';
import { CommissionPreviewDto, CommissionPreviewVo } from './dto/commission-preview.dto';
import { DistConfigVo, DistConfigLogVo } from './vo/dist-config.vo';
import { BusinessConstants } from 'src/common/constants/business.constants';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { PaginationHelper } from 'src/common/utils/pagination.helper';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import {
  buildCommissionBudgetSnapshot,
  CommissionBudgetConfigInput,
  CommissionBudgetContextInput,
  normalizeCommissionBudgetConfig,
  validateCommissionBudgetContext,
} from 'src/module/finance/commission/services/commission-validator.service';

@Injectable()
export class DistributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 获取分销规则配置
   * @param tenantId 租户ID
   * @returns 分销规则配置信息
   */
  async getConfig(tenantId: string): Promise<Result<DistConfigVo | null>> {
    const config = await this.prisma.sysDistConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysDistConfig', { tenantId }) as Prisma.SysDistConfigWhereInput,
    });

    if (!config) {
      // 返回默认配置（含跨店配置）
      return Result.ok({
        id: 0,
        level1Rate: BusinessConstants.DISTRIBUTION.DEFAULT_LEVEL1_RATE * 100,
        level2Rate: BusinessConstants.DISTRIBUTION.DEFAULT_LEVEL2_RATE * 100,
        enableLV0: true,
        enableCrossTenant: false,
        crossTenantRate: BusinessConstants.DISTRIBUTION.DEFAULT_CROSS_TENANT_RATE * 100, // 100% 无折扣
        crossMaxDaily: BusinessConstants.DISTRIBUTION.DEFAULT_CROSS_DAILY_LIMIT,
        commissionBaseType: 'ORIGINAL_PRICE',
        maxCommissionRate: 50,
        createTime: new Date().toISOString(),
      });
    }

    return Result.ok({
      id: config.id,
      level1Rate: Number(config.level1Rate) * 100,
      level2Rate: Number(config.level2Rate) * 100,
      enableLV0: config.enableLV0,
      enableCrossTenant: config.enableCrossTenant ?? false,
      crossTenantRate: Number(config.crossTenantRate ?? 1) * 100,
      crossMaxDaily: Number(config.crossMaxDaily ?? BusinessConstants.DISTRIBUTION.DEFAULT_CROSS_DAILY_LIMIT),
      commissionBaseType: config.commissionBaseType ?? 'ORIGINAL_PRICE',
      maxCommissionRate: Number(config.maxCommissionRate ?? 0.5) * 100,
      createTime: config.createTime.toISOString(),
    });
  }

  /**
   * 更新分销规则配置
   * @param tenantId 租户ID
   * @param dto 更新参数
   * @param operator 操作人
   * @returns 更新结果
   */
  @Transactional()
  async updateConfig(tenantId: string, dto: UpdateDistConfigDto, operator: string): Promise<Result<boolean>> {
    const existingConfig = await this.prisma.sysDistConfig.findUnique({
      where: { tenantId },
      select: { level1Rate: true, level2Rate: true },
    });
    const level1Rate = existingConfig
      ? Number(existingConfig.level1Rate)
      : BusinessConstants.DISTRIBUTION.DEFAULT_LEVEL1_RATE;
    const level2Rate = existingConfig
      ? Number(existingConfig.level2Rate)
      : BusinessConstants.DISTRIBUTION.DEFAULT_LEVEL2_RATE;
    const crossTenantRate = (dto.crossTenantRate ?? 100) / 100;
    const maxCommissionRate = dto.maxCommissionRate != null ? dto.maxCommissionRate / 100 : 0.5;

    const updatePayload = {
      enableLV0: dto.enableLV0,
      enableCrossTenant: dto.enableCrossTenant ?? false,
      crossTenantRate,
      crossMaxDaily: dto.crossMaxDaily ?? BusinessConstants.DISTRIBUTION.DEFAULT_CROSS_DAILY_LIMIT,
      ...(dto.commissionBaseType != null && { commissionBaseType: dto.commissionBaseType }),
      maxCommissionRate,
      updateBy: operator,
    };
    const createPayload = {
      tenantId,
      level1Rate,
      level2Rate,
      ...updatePayload,
      createBy: operator,
    };

    await this.prisma.sysDistConfig.upsert({
      where: { tenantId },
      update: updatePayload as Prisma.SysDistConfigUpdateInput,
      create: createPayload as Prisma.SysDistConfigCreateInput,
    });

    // 记录变更日志（审计）
    await this.prisma.sysDistConfigLog.create({
      data: {
        tenantId,
        level1Rate: new Prisma.Decimal(level1Rate),
        level2Rate: new Prisma.Decimal(level2Rate),
        enableLV0: dto.enableLV0,
        enableCrossTenant: dto.enableCrossTenant ?? false,
        crossTenantRate: new Prisma.Decimal(crossTenantRate),
        crossMaxDaily: new Prisma.Decimal(
          dto.crossMaxDaily ?? BusinessConstants.DISTRIBUTION.DEFAULT_CROSS_DAILY_LIMIT,
        ),
        commissionBaseType: (dto.commissionBaseType ?? null) as CommissionBaseType | null,
        maxCommissionRate: new Prisma.Decimal(maxCommissionRate),
        operator,
      },
    });

    return Result.ok(true, '更新成功');
  }

  /**
   * 获取分销规则变更历史
   * @param tenantId 租户ID
   * @param query 分页参数
   * @returns 变更历史列表
   */
  async getConfigLogs(
    tenantId: string,
    query: ListConfigLogsDto,
  ): Promise<Result<{ rows: DistConfigLogVo[]; total: number }>> {
    const { skip, take } = PaginationHelper.getPagination(query);

    const logWhere = this.tenantHelper.readWhereForDelegate('sysDistConfigLog', {
      tenantId,
    }) as Prisma.SysDistConfigLogWhereInput;
    const [logs, total] = await this.prisma.$transaction([
      this.prisma.sysDistConfigLog.findMany({
        where: logWhere,
        orderBy: { createTime: 'desc' },
        skip,
        take,
      }),
      this.prisma.sysDistConfigLog.count({
        where: logWhere,
      }),
    ]);

    const rows = logs.map((log) => ({
      id: Number(log.id),
      configId: Number(log.id),
      level1Rate: Number(log.level1Rate) * 100,
      level2Rate: Number(log.level2Rate) * 100,
      enableLV0: log.enableLV0,
      enableCrossTenant: log.enableCrossTenant ?? false,
      crossTenantRate: Number(log.crossTenantRate ?? 1) * 100,
      crossMaxDaily: Number(log.crossMaxDaily ?? BusinessConstants.DISTRIBUTION.DEFAULT_CROSS_DAILY_LIMIT),
      commissionBaseType: log.commissionBaseType ?? undefined,
      maxCommissionRate: log.maxCommissionRate ? Number(log.maxCommissionRate) * 100 : undefined,
      operator: log.operator,
      createTime: log.createTime.toISOString(),
    }));

    return Result.ok({ rows, total });
  }

  /**
   * 佣金预估 (前端提示用)
   * @param dto 预估参数（包含门店ID、SKU列表、分享人ID）
   * @returns 佣金预估信息
   */
  async getCommissionPreview(dto: CommissionPreviewDto): Promise<Result<CommissionPreviewVo>> {
    const { tenantId, items, shareUserId } = dto;

    // 获取门店信息
    const tenant = await this.prisma.sysTenant.findUnique({
      where: { tenantId },
      select: { companyName: true },
    });

    if (!tenant) {
      return Result.ok({
        tenantName: '未知门店',
        commissionRate: '0%',
        isLocalReferrer: true,
        isCrossEnabled: false,
        estimatedAmount: 0,
        notice: null,
        budgetTotal: 0,
        budgetFrozen: 0,
        budgetConsumed: 0,
        budgetReleased: 0,
        budgetByLevel: {},
        budgetByChannel: {},
        budgetByActivityVersion: {},
        budgetAlertThreshold: 70,
        budgetFuseThreshold: 90,
      });
    }

    // 获取门店分销配置
    const distConfig = await this.prisma.sysDistConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysDistConfig', { tenantId }) as Prisma.SysDistConfigWhereInput,
    });

    const tenantConfig = {
      enableCrossTenant: distConfig?.enableCrossTenant ?? false,
      crossTenantRate: distConfig?.crossTenantRate
        ? Number(distConfig.crossTenantRate)
        : BusinessConstants.DISTRIBUTION.DEFAULT_CROSS_TENANT_RATE,
      commissionBaseType: distConfig?.commissionBaseType ?? 'ORIGINAL_PRICE',
    };

    const activityBudgetConfig = await this.resolveActivityBudgetConfig(tenantId, dto.activityVersionId);
    const budgetConfig = normalizeCommissionBudgetConfig(activityBudgetConfig);
    const budgetContext: CommissionBudgetContextInput = {
      activityVersionId: dto.activityVersionId ?? activityBudgetConfig?.activityVersionId ?? null,
      shareChannel: dto.shareContext?.shareChannel ?? null,
      currentLevelId: dto.upgradeContext?.currentLevelId ?? null,
      targetLevelId: dto.upgradeContext?.targetLevelId ?? null,
    };

    // 判断是否跨店
    let isLocal = true;
    let notice: string | null = null;
    let crossTenantRate = 1;
    let beneficiaryLevel = dto.upgradeContext?.targetLevelId ?? dto.upgradeContext?.currentLevelId ?? 0;

    if (shareUserId) {
      // 分享人可能归属其他门店，禁止 readWhereForDelegate（避免合并当前请求租户）
      const [shareUser, profile] = await Promise.all([
        this.prisma.umsMember.findFirst({
          where: { memberId: shareUserId },
          select: { tenantId: true, levelId: true },
        }),
        this.prisma.sysDistDistributorProfile.findFirst({
          where: this.tenantHelper.readWhereForDelegate('sysDistDistributorProfile', {
            tenantId,
            memberId: shareUserId,
          }) as Prisma.SysDistDistributorProfileWhereInput,
          select: { status: true, levelId: true },
        }),
      ]);

      if (profile?.status === 'ACTIVE') {
        beneficiaryLevel = profile.levelId;
      } else if (shareUser?.levelId != null) {
        beneficiaryLevel = shareUser.levelId;
      }

      if (shareUser) {
        isLocal = shareUser.tenantId === tenantId;

        if (!isLocal) {
          if (tenantConfig.enableCrossTenant) {
            // 跨店且开启
            crossTenantRate = tenantConfig.crossTenantRate;
            notice = `当前下单门店为【${tenant.companyName}】，预计佣金按该店标准执行`;
          } else {
            // 跨店但未开启
            crossTenantRate = 0;
            notice = `【${tenant.companyName}】未开启跨店分销，本单不产生佣金`;
          }
        }
      }
    }

    const levelConfig =
      beneficiaryLevel > 0
        ? await this.prisma.sysDistLevel.findFirst({
            where: this.tenantHelper.readWhereForDelegate('sysDistLevel', {
              tenantId,
              levelId: beneficiaryLevel,
              isActive: true,
            }) as Prisma.SysDistLevelWhereInput,
            select: { level1Rate: true },
          })
        : null;
    const level1Rate = levelConfig ? Number(levelConfig.level1Rate) : 0;

    // 计算预估佣金金额：SKU 形成佣金池，分享人等级决定直推分配比例。
    let estimatedAmount = new Decimal(0);
    let comparableOrderAmount = new Decimal(0);

    if (items && items.length > 0 && crossTenantRate > 0 && level1Rate > 0) {
      // 批量查询SKU信息
      const skuIds = items.map((item) => item.skuId);
      const skus = await this.prisma.pmsTenantSku.findMany({
        where: this.tenantHelper.readWhereForDelegate('pmsTenantSku', {
          id: { in: skuIds },
          tenantId,
          isActive: true,
        }) as Prisma.PmsTenantSkuWhereInput,
        include: {
          globalSku: true,
        },
      });

      const skuMap = new Map(skus.map((s) => [s.id, s]));
      const effectiveShareRate = new Decimal(level1Rate).mul(crossTenantRate);

      for (const item of items) {
        const sku = skuMap.get(item.skuId);
        if (!sku || sku.distMode === 'NONE' || sku.isExchangeProduct) continue;

        const quantity = new Decimal(item.quantity ?? 1);
        const unitBasePrice =
          tenantConfig.commissionBaseType === 'ACTUAL_PAID'
            ? new Decimal(sku.price)
            : new Decimal(sku.globalSku.guidePrice);
        comparableOrderAmount = comparableOrderAmount.add(unitBasePrice.mul(quantity));

        if (tenantConfig.commissionBaseType === 'ZERO') continue;

        let skuPool = new Decimal(0);
        if (sku.distMode === 'RATIO') {
          skuPool = unitBasePrice.mul(quantity).mul(sku.distRate);
        } else if (sku.distMode === 'FIXED') {
          skuPool = new Decimal(sku.distRate).mul(quantity);
        }

        estimatedAmount = estimatedAmount.add(skuPool.mul(effectiveShareRate));
      }
    } else if (crossTenantRate === 0) {
      // 跨店但未开启，佣金率为0
      comparableOrderAmount = new Decimal(0);
    }

    const avgRate = comparableOrderAmount.gt(0) ? estimatedAmount.div(comparableOrderAmount) : new Decimal(0);

    const budgetSnapshot = buildCommissionBudgetSnapshot(budgetConfig, budgetContext, {
      frozenAmount: estimatedAmount.toNumber(),
    });
    const budgetValidation = validateCommissionBudgetContext(budgetConfig, budgetContext, {
      frozenAmount: estimatedAmount.toNumber(),
    });

    if (budgetValidation.budgetEnforced) {
      const budgetNotice = budgetValidation.insufficientBudget
        ? '当前活动预算不足'
        : budgetValidation.fuseTriggered
          ? '当前活动预算已触发熔断'
          : budgetValidation.alertTriggered
            ? '当前活动预算接近预警阈值'
            : null;

      if (budgetNotice) {
        notice = notice ? `${notice}；${budgetNotice}` : budgetNotice;
      }
    }

    return Result.ok({
      tenantName: tenant.companyName,
      commissionRate: `${avgRate.mul(100).toFixed(0)}%`,
      isLocalReferrer: isLocal,
      isCrossEnabled: tenantConfig.enableCrossTenant,
      estimatedAmount: Number(estimatedAmount.toFixed(2)),
      notice,
      ...budgetSnapshot,
    });
  }

  private async resolveActivityBudgetConfig(
    tenantId: string,
    activityVersionId?: string,
  ): Promise<(CommissionBudgetConfigInput & { activityVersionId?: string }) | null> {
    if (!activityVersionId) {
      return null;
    }

    const activity = await this.prisma.mktCampaign.findFirst({
      where: this.tenantHelper.readWhereForDelegate('mktCampaign', {
        tenantId,
        status: MktCampaignStatus.PUBLISHED,
        stagesJson: {
          path: ['distributionGrowth', 'activityVersionId'],
          equals: activityVersionId,
        },
      }) as Prisma.MktCampaignWhereInput,
      select: {
        stagesJson: true,
      },
    });

    if (!activity) {
      return null;
    }

    const distributionGrowth = this.readDistributionGrowthBudget(activity.stagesJson);
    if (!distributionGrowth) {
      return null;
    }

    return distributionGrowth;
  }

  private readDistributionGrowthBudget(
    rules: unknown,
  ): (CommissionBudgetConfigInput & { activityVersionId?: string }) | null {
    const root = this.asRecord(rules);
    const distributionGrowth = this.asRecord(root?.distributionGrowth);
    if (!distributionGrowth) {
      return null;
    }

    const activityVersionId = this.asString(distributionGrowth.activityVersionId);
    const commissionBudgetTotal = this.asNumber(distributionGrowth.commissionBudgetTotal);
    const commissionBudgetAlertThreshold = this.asNumber(distributionGrowth.commissionBudgetAlertThreshold);
    const commissionBudgetFuseThreshold = this.asNumber(distributionGrowth.commissionBudgetFuseThreshold);

    if (
      !activityVersionId ||
      commissionBudgetTotal === null ||
      commissionBudgetTotal <= 0 ||
      commissionBudgetAlertThreshold === null ||
      commissionBudgetFuseThreshold === null
    ) {
      return null;
    }

    return {
      activityVersionId,
      budgetTotal: commissionBudgetTotal,
      budgetAlertThreshold: commissionBudgetAlertThreshold,
      budgetFuseThreshold: commissionBudgetFuseThreshold,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private asString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private asNumber(value: unknown): number | null {
    if (typeof value !== 'number') return null;
    return Number.isFinite(value) ? value : null;
  }
}
