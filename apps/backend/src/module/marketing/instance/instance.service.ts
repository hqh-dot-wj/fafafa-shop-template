import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { MarketingStockMode, PlayInstance, PlayInstanceStatus, Prisma, StorePlayConfig } from '@prisma/client';
import { PlayInstanceRepository } from './instance.repository';
import { CreatePlayInstanceDto, ListPlayInstanceDto } from './dto/instance.dto';
import { Result } from 'src/common/response/result';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { FinanceCommandPort } from 'src/module/finance/ports/finance-command.port';
import { PrismaService } from 'src/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { UserAssetService } from '../asset/asset.service';
import { PlayDispatcher } from '../play/play.dispatcher';
import { FormatDateFields } from 'src/common/utils';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { ConfigService } from 'src/module/admin/system/config/config.service';
import { IdempotencyService } from './idempotency.service';
import {
  isValidTransition,
  getStatusDescription,
  getAllowedNextStatuses,
  getStatusLabelZh,
} from './state-machine.config';
import { MessageTouchpointDispatcher } from '../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../events/marketing-event.types';
import { ResponseCode } from 'src/common/response/response.interface';
import { GrayReleaseService } from '../gray/gray-release.service';
import { MarketingStockService } from '../stock/stock.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { InstanceProbeService } from './instance-probe.service';

@Injectable()
export class PlayInstanceService {
  constructor(
    private readonly repo: PlayInstanceRepository,
    private readonly financeCommandPort: FinanceCommandPort,
    private readonly prisma: PrismaService,
    private readonly assetService: UserAssetService,
    private readonly configService: ConfigService,
    private readonly idempotencyService: IdempotencyService,
    private readonly messageTouchpointDispatcher: MessageTouchpointDispatcher,
    private readonly grayReleaseService: GrayReleaseService,
    private readonly quotaService: MarketingStockService,
    private readonly probeService: InstanceProbeService,
    @Inject(forwardRef(() => PlayDispatcher))
    private readonly playDispatcher: PlayDispatcher,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 分页查询实例
   * @param query 查询过滤参数
   */
  async findAll(query: ListPlayInstanceDto) {
    const { rows, total } = await this.repo.search(query);
    if (rows.length === 0) {
      return Result.page(FormatDateFields(rows), total);
    }

    const memberIds = [...new Set(rows.map((r) => r.memberId))];
    const configIds = [...new Set(rows.map((r) => r.configId))];

    const members =
      memberIds.length > 0
        ? await this.prisma.umsMember.findMany({
            where: { memberId: { in: memberIds } },
            select: { memberId: true, nickname: true, mobile: true },
          })
        : [];
    const configs =
      configIds.length > 0
        ? await this.prisma.storePlayConfig.findMany({
            where: { id: { in: configIds } },
            select: { id: true, serviceId: true, templateCode: true, rules: true },
          })
        : [];

    const memberMap = new Map(members.map((m) => [m.memberId, m]));
    const configMap = new Map(configs.map((c) => [c.id, c]));

    const serviceIds = [...new Set(configs.map((c) => c.serviceId))];
    const products =
      serviceIds.length > 0
        ? await this.prisma.pmsProduct.findMany({
            where: { productId: { in: serviceIds } },
            select: { productId: true, name: true },
          })
        : [];
    const productMap = new Map(products.map((p) => [p.productId, p]));

    const unresolvedServiceIds = serviceIds.filter((sid) => !productMap.has(sid));
    if (unresolvedServiceIds.length > 0) {
      const skus = await this.prisma.pmsGlobalSku.findMany({
        where: { skuId: { in: unresolvedServiceIds } },
        select: { skuId: true, product: { select: { productId: true, name: true } } },
      });
      for (const s of skus) {
        if (s.product?.name) {
          productMap.set(s.skuId, { productId: s.product.productId, name: s.product.name });
        }
      }
    }

    const list = rows.map((row) => {
      const member = memberMap.get(row.memberId);
      const memberDisplayName = member?.nickname?.trim() || member?.mobile?.trim() || '';

      const config = configMap.get(row.configId);
      const rules = config?.rules as Record<string, unknown> | null;
      const ruleTitle = typeof rules?.name === 'string' && rules.name.trim() ? rules.name.trim() : '';
      const productName = config ? (productMap.get(config.serviceId)?.name ?? '未知商品') : '—';
      const configDisplayName = config
        ? ruleTitle
          ? `${ruleTitle} · ${productName}`
          : `${productName} · ${config.templateCode}`
        : '配置不存在或已删除';

      const data = row.instanceData as Record<string, unknown> | null;
      const orderSnRaw = typeof data?.orderSn === 'string' ? data.orderSn : row.orderSn;
      const orderSn = typeof orderSnRaw === 'string' && orderSnRaw.trim() ? orderSnRaw.trim() : '';
      let pricePart = '';
      const rawPrice = data?.price;
      if (typeof rawPrice === 'number' && Number.isFinite(rawPrice)) {
        pricePart = `参考金额 ¥${rawPrice.toFixed(2)}`;
      } else if (rawPrice !== undefined && rawPrice !== null) {
        const n = Number(String(rawPrice));
        if (Number.isFinite(n)) {
          pricePart = `参考金额 ¥${n.toFixed(2)}`;
        }
      }
      const instanceSummary =
        [orderSn ? `关联订单 ${orderSn}` : '', pricePart].filter(Boolean).join(' · ') || undefined;

      return {
        ...row,
        memberDisplayName: memberDisplayName || undefined,
        configDisplayName,
        configRuleName: ruleTitle || undefined,
        configProductName: productName,
        statusLabelZh: getStatusLabelZh(row.status),
        instanceSummary,
      };
    });

    return Result.page(FormatDateFields(list), total);
  }

  /**
   * 查询实例详情 (包含策略增强数据)
   * @param id 实例ID
   */
  async findOne(id: string) {
    const instance = (await this.repo.findById(id, {
      include: { config: true },
    })) as (PlayInstance & { config: StorePlayConfig }) | null;
    BusinessException.throwIfNull(instance, '营销实例不存在');

    // ✅ 中文注释：策略模式应用 - 获取特定玩法需要的个性化展示数据（如拼团进度）
    const handler = this.playDispatcher.resolve(instance.config);
    let displayData = null;
    if (handler.getDisplayData && instance.config) {
      displayData = await handler.getDisplayData({
        campaign: instance.config,
        memberId: instance.memberId,
        instance,
      });
    }

    return Result.ok(
      FormatDateFields({
        ...instance,
        displayData,
      }),
    );
  }

  /**
   * C 端查询本人营销实例详情（与 {@link findOne} 展示结构一致，增加归属校验）
   *
   * @param id - 实例 ID
   * @param memberId - 当前登录会员 ID
   */
  async findOneForClient(id: string, memberId: string) {
    BusinessException.throwIf(!memberId, '请先登录');

    const instance = (await this.repo.findById(id, {
      include: { config: true },
    })) as (PlayInstance & { config: StorePlayConfig }) | null;
    BusinessException.throwIfNull(instance, '营销实例不存在');
    BusinessException.throwIf(instance.memberId !== memberId, '无权查看该活动实例');

    const handler = this.playDispatcher.resolve(instance.config);
    let displayData = null;
    if (handler.getDisplayData && instance.config) {
      displayData = await handler.getDisplayData({
        campaign: instance.config,
        memberId: instance.memberId,
        instance,
      });
    }

    return Result.ok(
      FormatDateFields({
        ...instance,
        displayData,
      }),
    );
  }

  /**
   * 查询实例探针信息
   */
  async getProbe(tenantId: string, instanceId: string) {
    return this.probeService.getProbe({ tenantId, instanceId });
  }

  /**
   * 参与活动 (创建实例)
   *
   * @description
   * 用户点击参与活动时调用，创建初始化状态为 PENDING_PAY 的记录
   *
   * ✅ 新增功能：
   * 1. 幂等性保障 - 防止用户重复点击导致创建多个实例
   * 2. 灰度发布检查 - 检查用户是否在灰度范围内
   * 3. 事件发送 - 发送 INSTANCE_CREATED 事件
   */
  @Transactional()
  async create(dto: CreatePlayInstanceDto) {
    // === 1. 幂等性检查 ===
    // 检查用户是否在短时间内重复参与同一活动
    const cachedResult = await this.idempotencyService.checkJoinIdempotency(
      dto.configId,
      dto.memberId,
      dto.instanceData,
    );

    if (cachedResult) {
      // 返回缓存的结果，避免重复创建
      return cachedResult;
    }

    // === 2. 获取活动配置 ===
    const config = await this.prisma.storePlayConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('storePlayConfig', {
        id: dto.configId,
      }) as Prisma.StorePlayConfigWhereInput,
    });
    BusinessException.throwIfNull(config, '活动配置不存在');

    // === 3. 灰度发布检查 ===
    // 检查用户是否在灰度范围内（白名单、门店白名单、按比例灰度）
    const isInGrayRelease = await this.grayReleaseService.isInGrayRelease(config, dto.memberId, config.tenantId);

    if (!isInGrayRelease) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '该活动暂未对您开放，敬请期待');
    }

    // === 4. 策略校验 (Strategy Pattern) ===
    // 检查用户是否有资格参与（如：是否在活动时间内、是否满足参与条件等）
    const handler = this.playDispatcher.resolve(config);
    await handler.checkEligibility({ campaign: config, memberId: dto.memberId, params: dto.instanceData });

    const quantity = this.getJoinQuantity(dto.instanceData);
    let stockLocked = false;

    try {
      // === 5. STRONG_LOCK 模式预扣库存 ===
      if (config.stockMode === MarketingStockMode.STRONG_LOCK) {
        await this.quotaService.reserveQuota(config.id, quantity, config.stockMode);
        stockLocked = true;
      }

      // === 6. 执行创建，初始状态设为待支付 ===
      const instanceData = this.buildCreateInstanceData(dto.instanceData, stockLocked, quantity);
      const instance = await this.repo.create({
        ...dto,
        instanceData,
        status: PlayInstanceStatus.PENDING_PAY,
      });

      // === 7. 记录实例创建事件统计 ===
      await this.messageTouchpointDispatcher.dispatch({
        type: MarketingEventType.INSTANCE_CREATED,
        tenantId: instance.tenantId,
        instanceId: instance.id,
        configId: instance.configId,
        memberId: instance.memberId,
        sourceStep: 'instance.create',
        payload: {
          templateCode: config.templateCode,
          instanceData: instance.instanceData,
        },
        timestamp: new Date(),
      });

      // === 8. 缓存结果用于幂等性返回 ===
      const result = Result.ok(FormatDateFields(instance));
      await this.idempotencyService.cacheJoinResult(dto.configId, dto.memberId, dto.instanceData, result);

      return result;
    } catch (error) {
      // 创建流程失败时回补预扣库存，避免出现“锁库存成功但实例未落库”的脏数据。
      if (stockLocked) {
        await this.quotaService.releaseQuota(dto.configId, quantity);
      }
      throw error;
    }
  }

  /**
   * 状态流转机 (State Machine)
   *
   * @description
   * 营销实例的核心状态管理方法，确保状态跃迁的合法性和一致性
   *
   * ✅ 新增功能：
   * 1. 状态机约束 - 防止非法状态跃迁
   * 2. 分布式锁 - 防止并发状态变更
   * 3. 事件发送 - 发送状态变更事件
   * 4. 详细日志 - 记录状态变更历史
   *
   * @param id 实例ID
   * @param nextStatus 目标状态
   * @param extraData 附加数据
   */
  @Transactional()
  async transitStatus(id: string, nextStatus: PlayInstanceStatus, extraData?: Record<string, unknown>) {
    // === 1. 使用分布式锁防止并发状态变更 ===
    return await this.idempotencyService.withStateLock(id, async () => {
      // === 2. 查询当前实例 ===
      const instance = await this.repo.findById(id);
      BusinessException.throwIfNull(instance, '营销实例不存在');

      const currentStatus = instance.status;

      // === 3. 状态机约束：检查状态跃迁是否合法 ===
      if (!isValidTransition(currentStatus, nextStatus)) {
        const allowedStatuses = getAllowedNextStatuses(currentStatus);
        throw new BusinessException(
          ResponseCode.BUSINESS_ERROR,
          `非法的状态流转: ${currentStatus} -> ${nextStatus}。` +
            `当前状态 "${getStatusDescription(currentStatus)}" 只允许跃迁到: ${allowedStatuses.join(', ')}`,
        );
      }

      // === 4. 执行状态变更 ===
      const nextInstanceData = this.mergeInstanceData(instance.instanceData, extraData);
      if (this.shouldReleaseStock(nextStatus, nextInstanceData)) {
        const quantity = this.getJoinQuantity(nextInstanceData);
        await this.quotaService.releaseQuota(instance.configId, quantity);
        nextInstanceData.stockReleased = true;
      }
      const updated = await this.repo.updateStatus(id, nextStatus, nextInstanceData);

      // 支付完成时同步 orderId 到标量字段（兼容 instanceData 中携带 orderId 的旧路径）
      if (nextStatus === PlayInstanceStatus.PAID && typeof nextInstanceData.orderId === 'string') {
        await this.repo.updateOrderBinding(id, nextInstanceData.orderId as string);
      }

      // === 5. 通用业务逻辑：状态流转到 SUCCESS 时，自动执行分账和发券 ===
      if (nextStatus === PlayInstanceStatus.SUCCESS) {
        await this.creditToStore(updated);
      }

      // === 6. 策略生命周期勾子 (Strategy Hook) ===
      // 处理特定玩法的自定义副作用（如：拼团满员通知、秒杀库存释放等）
      const handler = this.playDispatcher.resolve({
        code: instance.templateCode,
        rules: {},
      });
      await handler.onStatusChange?.(updated, currentStatus, nextStatus);

      // === 7. 发送状态变更事件 ===
      // 根据不同的状态跃迁发送对应的事件
      await this.emitStatusChangeEvent(updated, currentStatus, nextStatus);

      return Result.ok(FormatDateFields(updated));
    });
  }

  /**
   * 发送状态变更事件
   *
   * @description
   * 根据状态跃迁类型发送对应的事件
   * 直接记录事件统计，并按目录触发消息触点。
   *
   * @param instance 实例数据
   * @param oldStatus 旧状态
   * @param newStatus 新状态
   */
  private async emitStatusChangeEvent(
    instance: PlayInstance,
    oldStatus: PlayInstanceStatus,
    newStatus: PlayInstanceStatus,
  ): Promise<void> {
    const data = instance.instanceData as Record<string, unknown> | null;
    const payload = {
      oldStatus,
      newStatus,
      instanceData: instance.instanceData,
      orderSn: data?.orderSn,
      amount: data?.price,
    };

    // 根据新状态发送对应的事件。
    let eventType: MarketingEventType | null = null;

    switch (newStatus) {
      case PlayInstanceStatus.PAID:
        eventType = MarketingEventType.INSTANCE_PAID;
        break;

      case PlayInstanceStatus.SUCCESS:
        eventType = MarketingEventType.INSTANCE_SUCCESS;
        break;

      case PlayInstanceStatus.FAILED:
        eventType = MarketingEventType.INSTANCE_FAILED;
        break;

      case PlayInstanceStatus.TIMEOUT:
        eventType = MarketingEventType.INSTANCE_TIMEOUT;
        break;

      case PlayInstanceStatus.REFUNDED:
        eventType = MarketingEventType.INSTANCE_REFUNDED;
        break;

      default:
        // 其他状态不发送事件
        return;
    }

    // 发送事件
    if (eventType) {
      await this.messageTouchpointDispatcher.dispatch({
        type: eventType,
        tenantId: instance.tenantId,
        instanceId: instance.id,
        configId: instance.configId,
        memberId: instance.memberId,
        sourceStep: `instance.status.${newStatus.toLowerCase()}`,
        payload,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 批量状态流转
   */
  @Transactional()
  async batchTransitStatus(ids: string[], nextStatus: PlayInstanceStatus, extraData?: Record<string, unknown>) {
    if (ids.length === 0) {
      return;
    }

    const instances = await this.repo.findMany({ where: { id: { in: ids } } });
    const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));

    BusinessException.throwIf(instances.length !== ids.length, '存在无效的营销实例ID，批量状态流转中止');

    for (const id of ids) {
      const instance = instanceMap.get(id);
      BusinessException.throwIfNull(instance, `营销实例不存在: ${id}`);
      BusinessException.throwIf(
        !isValidTransition(instance.status, nextStatus),
        `非法的状态流转: ${instance.status} -> ${nextStatus}`,
      );
    }

    for (const id of ids) {
      await this.transitStatus(id, nextStatus, extraData);
    }
  }

  /**
   * 自动分账入账 (Store Wallet) + 权益自动发放 (User Asset)
   */
  // private readonly PLATFORM_FEE_RATE = new Decimal(0.01); // Moved to system config

  /**
   * 自动分账入账 (Store Wallet) + 权益自动发放 (User Asset)
   */
  private async creditToStore(instance: PlayInstance) {
    // 1. 查询关联配置获取门店ID
    const config = await this.prisma.storePlayConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('storePlayConfig', {
        id: instance.configId,
        tenantId: instance.tenantId,
      }) as Prisma.StorePlayConfigWhereInput,
    });
    if (!config || !config.tenantId) return;

    // === A. 资金入账 (Wallet) ===
    const data = instance.instanceData as Record<string, unknown> | null;
    const amount = new Decimal(Number(data?.price ?? 0));
    if (amount.gt(0)) {
      // 获取平台费率配置
      const feeRateStr = await this.configService.getSystemConfigValue('marketing.fee_rate');
      BusinessException.throwIf(!feeRateStr, '系统配置缺失: marketing.fee_rate');
      const feeRate = new Decimal(feeRateStr);

      const platformFee = amount.mul(feeRate);
      const settleAmount = amount.minus(platformFee);

      // 4. 获取/创建门店钱包 (Store 视为一种特殊的 Member ID)
      // 约定：租户钱包的 memberId = `STORE_${tenantId}`，保留历史 memberId 形态兼容旧账本
      const storeMemberId = `STORE_${config.tenantId}`;
      await this.financeCommandPort.creditWalletIncome({
        memberId: storeMemberId,
        tenantId: instance.tenantId,
        amount: settleAmount,
        relatedId: instance.id,
        remark: `营销活动收入: ${instance.templateCode}`,
      });
    }

    // === B. 权益发放 (Asset) ===
    // 假设 rules: { giftAssetId: 'coupon_template_123', giftCount: 1 }
    const rules = config.rules as Record<string, unknown> | null;
    if (rules?.giftAssetId) {
      const giftAssetType =
        typeof rules.giftAssetType === 'string' && String(rules.giftAssetType).trim().length > 0
          ? String(rules.giftAssetType)
          : 'VOUCHER';
      await this.assetService.grantAsset({
        tenantId: instance.tenantId,
        memberId: instance.memberId,
        instanceId: instance.id,
        configId: instance.configId,
        assetName: String(rules.giftAssetName ?? '活动赠送权益'),
        assetType: giftAssetType,
        balance: new Decimal(Number(rules.giftCount ?? 1)),
        initialBalance: new Decimal(Number(rules.giftCount ?? 1)),
        status: 'UNUSED',
      });
    }
  }

  /**
   * 支付成功回调处理（通过 orderId 查询实例）
   *
   * @param orderId - OmsOrder.id
   */
  @Transactional()
  async handlePaymentSuccessById(orderId: string) {
    const processed = await this.idempotencyService.checkPaymentIdempotency(orderId);
    if (processed) return;

    const instance = await this.repo.findByOrderId(orderId);
    if (!instance) return;

    await this.processPaymentSuccess(instance);
    await this.idempotencyService.markPaymentProcessed(orderId);
  }

  /**
   * @deprecated since 2025-Q1. Use `handlePaymentSuccessById` instead.
   * Will be removed once all callers migrate from orderSn to orderId.
   */
  @Transactional()
  async handlePaymentSuccess(orderSn: string) {
    const processed = await this.idempotencyService.checkPaymentIdempotency(orderSn);
    if (processed) return;

    const instance = await this.repo.findByOrderSn(orderSn);
    if (!instance) return;

    await this.processPaymentSuccess(instance);
    await this.idempotencyService.markPaymentProcessed(orderSn);
  }

  /**
   * 支付成功后的核心处理逻辑
   *
   * @description 流转到 PAID 状态并触发策略回调
   */
  private async processPaymentSuccess(instance: PlayInstance) {
    let paidInstance = instance;

    if (instance.status === PlayInstanceStatus.PENDING_PAY) {
      await this.transitStatus(instance.id, PlayInstanceStatus.PAID);
      const paid = await this.repo.findById(instance.id);
      BusinessException.throwIfNull(paid, '营销实例不存在');
      paidInstance = paid;
    }

    const handler = this.playDispatcher.resolve({
      code: paidInstance.templateCode,
      rules: {},
    });
    await handler.applyRewards({
      campaign: { code: paidInstance.templateCode, rules: {} },
      memberId: paidInstance.memberId,
      instance: paidInstance,
    });
  }

  /** 从实例数据中读取参与数量；非正整数时降级为 1 */
  private getJoinQuantity(instanceData: Record<string, unknown>): number {
    const quantity = instanceData.quantity;
    if (typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0) {
      return Math.floor(quantity);
    }
    return 1;
  }

  /** 若活动需要锁定库存，则在 instanceData 中注入库存锁定标记和数量 */
  private buildCreateInstanceData(
    instanceData: Record<string, unknown>,
    stockLocked: boolean,
    quantity: number,
  ): Record<string, unknown> {
    if (!stockLocked) {
      return instanceData;
    }
    return {
      ...instanceData,
      stockLocked: true,
      stockReleased: false,
      stockLockQuantity: quantity,
    };
  }

  /** 将 extraData 浅合并到当前 instanceData；任一参数为非对象时安全降级 */
  private mergeInstanceData(currentData: unknown, extraData?: unknown): Record<string, unknown> {
    const baseData = currentData && typeof currentData === 'object' ? (currentData as Record<string, unknown>) : {};
    if (!extraData || typeof extraData !== 'object') {
      return { ...baseData };
    }
    return {
      ...baseData,
      ...(extraData as Record<string, unknown>),
    };
  }

  /** 判断流转到 nextStatus 时是否需要释放库存：终态（超时/失败/退款）且当前持有锁定库存时返回 true */
  private shouldReleaseStock(nextStatus: PlayInstanceStatus, instanceData: Record<string, unknown>): boolean {
    const shouldRelease =
      nextStatus === PlayInstanceStatus.TIMEOUT ||
      nextStatus === PlayInstanceStatus.FAILED ||
      nextStatus === PlayInstanceStatus.REFUNDED;
    return shouldRelease && instanceData.stockLocked === true && instanceData.stockReleased !== true;
  }
}
