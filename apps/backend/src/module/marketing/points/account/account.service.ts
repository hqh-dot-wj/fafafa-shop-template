import { Injectable, Logger } from '@nestjs/common';
import { MktPointsLot, PointsTransactionType, Prisma, PointsTransactionStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Result } from 'src/common/response/result';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { FormatDateFields } from 'src/common/utils';
import { MemberRepository } from 'src/module/admin/member/member.repository';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { PointsRuleService } from '../rule/rule.service';
import { PointsAccountRepository } from './account.repository';
import { PointsTransactionRepository } from './transaction.repository';
import { AddPointsDto } from './dto/add-points.dto';
import { DeductPointsDto } from './dto/deduct-points.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { PointsErrorCode, PointsErrorMessages } from '../constants/error-codes';
import { MessageTouchpointDispatcher } from '../../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../../events/marketing-event.types';
import { PointsLotLedgerService, RefundSpentPointsResult } from './points-lot-ledger.service';

export interface RefundSpentPointsInput {
  memberId: string;
  amount: number;
  relatedId: string;
  remark?: string;
}

export interface SettleFrozenPointsInput extends DeductPointsDto {
  relatedId: string;
}

/**
 * 积分账户服务
 *
 * @description 提供积分账户的管理、积分增减、查询等功能
 */
@Injectable()
export class PointsAccountService {
  private readonly logger = new Logger(PointsAccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly accountRepo: PointsAccountRepository,
    private readonly transactionRepo: PointsTransactionRepository,
    private readonly ruleService: PointsRuleService,
    private readonly memberRepo: MemberRepository,
    private readonly messageTouchpointDispatcher: MessageTouchpointDispatcher,
    private readonly lotLedgerService: PointsLotLedgerService,
  ) {
    void this.prisma;
    void this.cls;
  }

  /**
   * 获取或创建积分账户
   *
   * @param memberId 用户ID
   * @returns 积分账户
   */
  async getOrCreateAccount(memberId: string) {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    let account = await this.accountRepo.findByMemberId(memberId);

    if (!account) {
      account = await this.accountRepo.create({
        tenantId,
        memberId,
        totalPoints: 0,
        availablePoints: 0,
        frozenPoints: 0,
        usedPoints: 0,
        expiredPoints: 0,
        version: 0,
      } as Prisma.MktPointsAccountCreateInput);

      this.logger.log(`创建积分账户: memberId=${memberId}`);
    }

    return Result.ok(FormatDateFields(account));
  }

  /**
   * 查询积分余额
   *
   * @param memberId 用户ID
   * @returns 积分余额
   */
  async getBalance(memberId: string) {
    const account = await this.accountRepo.findByMemberId(memberId);

    if (!account) {
      return Result.ok({
        availablePoints: 0,
        frozenPoints: 0,
        expiringPoints: 0,
      });
    }

    // 即将过期积分以 lot 剩余额为准，避免已经消费/退款/冻结的历史发放流水被重复统计。
    const expiringPoints = await this.lotLedgerService.getExpiringPoints(memberId, 30);

    return Result.ok({
      availablePoints: account.availablePoints,
      frozenPoints: account.frozenPoints,
      expiringPoints,
    });
  }

  /**
   * 增加积分
   *
   * @param dto 增加积分数据
   * @returns 交易记录
   *
   * @description expireTime 解析顺序：
   * 1. 调用方未传该字段（undefined）→ 按 `MktPointsRule` 推导
   * 2. 调用方显式传 null → 永久（覆盖规则）
   * 3. 调用方显式传 Date → 直接采用
   */
  @Transactional()
  async addPoints(dto: AddPointsDto) {
    this.assertPositiveAmount(dto.amount);
    const tenantId = this.getActiveTenantId();

    // 获取或创建账户
    let account = await this.accountRepo.findByMemberId(dto.memberId);
    if (!account) {
      const result = await this.getOrCreateAccount(dto.memberId);
      BusinessException.throwIfNull(result.data, PointsErrorMessages[PointsErrorCode.ACCOUNT_NOT_FOUND]);
      account = result.data;
    }

    const resolvedExpireTime = await this.resolveAddPointsExpireTime(dto);

    const mutation = await this.accountRepo.atomicAdd(account.id, dto.amount, tenantId);
    if (!mutation) {
      BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.ACCOUNT_NOT_FOUND]);
    }

    // 创建交易记录
    const transaction = await this.transactionRepo.create({
      tenantId,
      accountId: mutation.id,
      memberId: dto.memberId,
      type: dto.type as PointsTransactionType,
      amount: dto.amount,
      balanceBefore: mutation.balanceBefore,
      balanceAfter: mutation.balanceAfter,
      status: PointsTransactionStatus.COMPLETED,
      relatedId: dto.relatedId,
      remark: dto.remark,
      expireTime: resolvedExpireTime,
    });

    await this.lotLedgerService.createLotForEarn({
      tenantId,
      accountId: mutation.id,
      memberId: dto.memberId,
      amount: dto.amount,
      sourceTransactionId: transaction.id,
      sourceType: dto.type as PointsTransactionType,
      expireTime: resolvedExpireTime,
    });

    await this.messageTouchpointDispatcher.dispatch({
      type: MarketingEventType.POINTS_EARNED,
      tenantId,
      instanceId: transaction.id,
      configId: mutation.id,
      memberId: dto.memberId,
      payload: {
        amount: dto.amount,
        transactionType: dto.type,
        relatedId: dto.relatedId,
      },
      timestamp: new Date(),
    });

    this.logger.log(`增加积分: memberId=${dto.memberId}, amount=${dto.amount}, type=${dto.type}`);

    return Result.ok(FormatDateFields(transaction));
  }

  /**
   * 扣减积分
   *
   * @param dto 扣减积分数据
   * @returns 交易记录
   */
  @Transactional()
  async deductPoints(dto: DeductPointsDto) {
    this.assertPositiveAmount(dto.amount);
    const tenantId = this.getActiveTenantId();
    const mutation = await this.accountRepo.atomicDeduct(dto.memberId, dto.amount, tenantId);
    if (!mutation) {
      await this.throwAtomicAccountFailure(dto.memberId, PointsErrorMessages[PointsErrorCode.INSUFFICIENT_BALANCE]);
    }

    const transaction = await this.transactionRepo.create({
      tenantId,
      accountId: mutation.id,
      memberId: dto.memberId,
      type: dto.type as PointsTransactionType,
      amount: -dto.amount,
      balanceBefore: mutation.balanceBefore,
      balanceAfter: mutation.balanceAfter,
      status: PointsTransactionStatus.COMPLETED,
      relatedId: dto.relatedId,
      remark: dto.remark,
      expireTime: null,
    });

    await this.lotLedgerService.consumeAvailableLots({
      tenantId,
      accountId: mutation.id,
      memberId: dto.memberId,
      amount: dto.amount,
      spendTransactionId: transaction.id,
      relatedId: dto.relatedId,
    });

    await this.messageTouchpointDispatcher.dispatch({
      type: MarketingEventType.POINTS_USED,
      tenantId,
      instanceId: transaction.id,
      configId: mutation.id,
      memberId: dto.memberId,
      payload: {
        amount: dto.amount,
        transactionType: dto.type,
        relatedId: dto.relatedId,
      },
      timestamp: new Date(),
    });

    this.logger.log(`扣减积分: memberId=${dto.memberId}, amount=${dto.amount}, type=${dto.type}`);

    return Result.ok(FormatDateFields(transaction));
  }

  /**
   * 冻结积分
   *
   * @param memberId 用户ID
   * @param amount 积分数量
   * @param relatedId 关联ID
   * @returns 交易记录
   */
  @Transactional()
  async freezePoints(memberId: string, amount: number, relatedId: string) {
    return this.freezePointsInTx(memberId, amount, relatedId);
  }

  async freezePointsInTx(memberId: string, amount: number, relatedId: string) {
    this.assertPositiveAmount(amount);
    const tenantId = this.getActiveTenantId();
    const mutation = await this.accountRepo.atomicFreeze(memberId, amount, tenantId);
    if (!mutation) {
      await this.throwAtomicAccountFailure(memberId, PointsErrorMessages[PointsErrorCode.INSUFFICIENT_BALANCE]);
    }

    const transaction = await this.transactionRepo.create({
      tenantId,
      accountId: mutation.id,
      memberId,
      type: PointsTransactionType.FREEZE,
      amount: -amount,
      balanceBefore: mutation.balanceBefore,
      balanceAfter: mutation.balanceAfter,
      status: PointsTransactionStatus.COMPLETED,
      relatedId,
      remark: '冻结积分',
      expireTime: null,
    });

    await this.lotLedgerService.freezeLots({
      tenantId,
      accountId: mutation.id,
      memberId,
      amount,
      freezeTransactionId: transaction.id,
      relatedId,
    });

    this.logger.log(`冻结积分: memberId=${memberId}, amount=${amount}`);

    return Result.ok(FormatDateFields(transaction));
  }

  /**
   * 解冻积分
   *
   * @param memberId 用户ID
   * @param amount 积分数量
   * @param relatedId 关联ID
   * @returns 交易记录
   */
  @Transactional()
  async unfreezePoints(memberId: string, amount: number, relatedId: string) {
    this.assertPositiveAmount(amount);
    const tenantId = this.getActiveTenantId();
    const mutation = await this.accountRepo.atomicUnfreeze(memberId, amount, tenantId);
    if (!mutation) {
      await this.throwAtomicAccountFailure(memberId, PointsErrorMessages[PointsErrorCode.INSUFFICIENT_FROZEN]);
    }

    const transaction = await this.transactionRepo.create({
      tenantId,
      accountId: mutation.id,
      memberId,
      type: PointsTransactionType.UNFREEZE,
      amount,
      balanceBefore: mutation.balanceBefore,
      balanceAfter: mutation.balanceAfter,
      status: PointsTransactionStatus.COMPLETED,
      relatedId,
      remark: '解冻积分',
      expireTime: null,
    });

    await this.lotLedgerService.releaseFrozenLots({
      tenantId,
      accountId: mutation.id,
      memberId,
      amount,
      relatedId,
      releaseTransactionId: transaction.id,
    });

    this.logger.log(`解冻积分: memberId=${memberId}, amount=${amount}`);

    return Result.ok(FormatDateFields(transaction));
  }

  /**
   * 结算已冻结积分
   *
   * @description 支付成功时直接把冻结分摊转成消费分摊，避免“先解冻再扣减”期间丢失原 lot 归属。
   */
  @Transactional()
  async settleFrozenPoints(dto: SettleFrozenPointsInput) {
    this.assertPositiveAmount(dto.amount);
    const tenantId = this.getActiveTenantId();
    const mutation = await this.accountRepo.atomicSettle(dto.memberId, dto.amount, tenantId);
    if (!mutation) {
      await this.throwAtomicAccountFailure(dto.memberId, PointsErrorMessages[PointsErrorCode.INSUFFICIENT_FROZEN]);
    }

    const transaction = await this.transactionRepo.create({
      tenantId,
      accountId: mutation.id,
      memberId: dto.memberId,
      type: dto.type as PointsTransactionType,
      amount: -dto.amount,
      balanceBefore: mutation.balanceBefore,
      balanceAfter: mutation.balanceAfter,
      status: PointsTransactionStatus.COMPLETED,
      relatedId: dto.relatedId,
      remark: dto.remark,
      expireTime: null,
    });

    await this.lotLedgerService.settleFrozenLots({
      tenantId,
      accountId: mutation.id,
      memberId: dto.memberId,
      amount: dto.amount,
      spendTransactionId: transaction.id,
      relatedId: dto.relatedId,
    });

    await this.messageTouchpointDispatcher.dispatch({
      type: MarketingEventType.POINTS_USED,
      tenantId,
      instanceId: transaction.id,
      configId: mutation.id,
      memberId: dto.memberId,
      payload: {
        amount: dto.amount,
        transactionType: dto.type,
        relatedId: dto.relatedId,
      },
      timestamp: new Date(),
    });

    this.logger.log(`结算冻结积分: memberId=${dto.memberId}, amount=${dto.amount}, type=${dto.type}`);

    return Result.ok(FormatDateFields(transaction));
  }

  /**
   * 订单退款返还已消费积分
   *
   * @description 优先按消费分摊原 lot 恢复；历史订单缺少分摊时创建补偿 lot，并在返回值中暴露策略。
   */
  @Transactional()
  async refundSpentPoints(dto: RefundSpentPointsInput) {
    this.assertPositiveAmount(dto.amount);
    const tenantId = this.getActiveTenantId();
    const mutation = await this.accountRepo.atomicRefundSpent(dto.memberId, dto.amount, tenantId);
    if (!mutation) {
      await this.throwAtomicAccountFailure(dto.memberId, PointsErrorMessages[PointsErrorCode.ACCOUNT_NOT_FOUND]);
    }

    const transaction = await this.transactionRepo.create({
      tenantId,
      accountId: mutation.id,
      memberId: dto.memberId,
      type: PointsTransactionType.REFUND,
      amount: dto.amount,
      balanceBefore: mutation.balanceBefore,
      balanceAfter: mutation.balanceAfter,
      status: PointsTransactionStatus.COMPLETED,
      relatedId: dto.relatedId,
      remark: dto.remark ?? '订单退款原路返还',
      expireTime: null,
    });

    const ledger: RefundSpentPointsResult = await this.lotLedgerService.refundSpentLots({
      tenantId,
      accountId: mutation.id,
      memberId: dto.memberId,
      amount: dto.amount,
      relatedId: dto.relatedId,
      refundTransactionId: transaction.id,
    });

    await this.messageTouchpointDispatcher.dispatch({
      type: MarketingEventType.POINTS_EARNED,
      tenantId,
      instanceId: transaction.id,
      configId: mutation.id,
      memberId: dto.memberId,
      payload: {
        amount: dto.amount,
        transactionType: PointsTransactionType.REFUND,
        relatedId: dto.relatedId,
        refundStrategy: ledger.strategy,
      },
      timestamp: new Date(),
    });

    this.logger.log(`退款返还积分: memberId=${dto.memberId}, amount=${dto.amount}, strategy=${ledger.strategy}`);

    return Result.ok({
      transaction: FormatDateFields(transaction),
      ledger,
    });
  }

  /**
   * 查询积分明细
   *
   * @param memberId 用户ID
   * @param query 查询参数
   * @returns 分页结果
   */
  async getTransactions(memberId: string, query: TransactionQueryDto) {
    const { rows, total } = await this.transactionRepo.findUserTransactions(memberId, {
      ...query,
      type: query.type as PointsTransactionType,
    });

    return Result.page(FormatDateFields(rows), total);
  }

  /**
   * 查询即将过期的积分
   *
   * @param memberId 用户ID
   * @param days 天数
   * @returns 即将过期的积分信息
   */
  async getExpiringPoints(memberId: string, days: number = 30) {
    const expiringPoints = await this.lotLedgerService.getExpiringPoints(memberId, days);

    return Result.ok({
      expiringPoints,
      days,
    });
  }

  /**
   * 管理端：分页查询积分账户列表
   */
  async getAccountsForAdmin(query: { pageNum?: number; pageSize?: number; memberId?: string }) {
    const where: Prisma.MktPointsAccountWhereInput = {};
    if (query.memberId) where.memberId = query.memberId;
    const { rows, total } = await this.accountRepo.findPage({
      where,
      pageNum: query.pageNum || 1,
      pageSize: query.pageSize || 10,
      orderBy: 'createTime',
      order: 'desc',
    });
    const memberIds = [...new Set(rows.map((r) => r.memberId))];
    const members =
      memberIds.length > 0
        ? await this.memberRepo.findMany({
            where: { memberId: { in: memberIds } },
            select: { memberId: true, nickname: true, mobile: true, avatar: true },
          })
        : [];
    const memberMap = new Map(members.map((m) => [m.memberId, m]));
    const rowsWithMember = rows.map((r) => ({
      ...FormatDateFields(r),
      member: memberMap.get(r.memberId) || null,
    }));
    return Result.page(rowsWithMember, total);
  }

  /**
   * 管理端：分页查询积分交易记录
   */
  async getTransactionsForAdmin(query: {
    memberId?: string;
    type?: PointsTransactionType;
    startTime?: Date;
    endTime?: Date;
    pageNum?: number;
    pageSize?: number;
  }) {
    const { rows, total } = await this.transactionRepo.findTransactionsAdmin({
      memberId: query.memberId,
      type: query.type,
      startTime: query.startTime,
      endTime: query.endTime,
      pageNum: query.pageNum || 1,
      pageSize: query.pageSize || 10,
    });
    return Result.page(FormatDateFields(rows), total);
  }

  private getActiveTenantId(): string {
    return TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
  }

  private assertPositiveAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      BusinessException.throw(400, '积分数量必须大于0');
    }
  }

  private async throwAtomicAccountFailure(memberId: string, fallbackMessage: string): Promise<never> {
    const account = await this.accountRepo.findByMemberId(memberId);
    if (!account) {
      BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.ACCOUNT_NOT_FOUND]);
    }
    BusinessException.throw(400, fallbackMessage);
  }

  /**
   * 解析 addPoints 调用的 expireTime 语义。
   *
   * @description undefined → 按 `MktPointsRule.pointsValidityDays` 推导；
   * null 或 Date → 调用方显式覆盖，直接采用。
   */
  private async resolveAddPointsExpireTime(dto: AddPointsDto): Promise<Date | null> {
    if (!('expireTime' in dto) || dto.expireTime === undefined) {
      return this.ruleService.resolveExpireTime();
    }
    return dto.expireTime ?? null;
  }

  /**
   * 将一个 lot 的剩余可用余额标记为过期，同事务完成"账户字段回写 + 写 EXPIRE 流水 + lot 状态更新"三件事。
   *
   * @description 模块职责分工：
   * - `PointsAccountService` 负责账户聚合字段（availablePoints / expiredPoints）与 transaction 流水
   * - `PointsLotLedgerService.expireLot` 负责 lot 表 + 关联 refund allocation 的状态
   *
   * 调用方（未来的 expire cron）应循环传入待过期 lot，逐个调用本方法；返回 null 表示 lot 已无可过期余额。
   */
  @Transactional()
  async expirePointsForLot(lot: MktPointsLot): Promise<{ transactionId: string; amount: number } | null> {
    const expiringAmount = lot.availableAmount;
    if (expiringAmount <= 0) {
      // lot 已被消耗完或被其它路径处置，幂等返回 null 让调用方继续处理下一条
      return null;
    }

    const mutation = await this.accountRepo.atomicExpireLotPoints(lot.accountId, expiringAmount, lot.tenantId);
    if (!mutation) {
      BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.ACCOUNT_NOT_FOUND]);
    }

    const transaction = await this.transactionRepo.create({
      tenantId: lot.tenantId,
      accountId: mutation.id,
      memberId: lot.memberId,
      type: PointsTransactionType.EXPIRE,
      amount: -expiringAmount,
      balanceBefore: mutation.balanceBefore,
      balanceAfter: mutation.balanceAfter,
      status: PointsTransactionStatus.COMPLETED,
      relatedId: lot.id,
      relatedType: 'POINTS_LOT',
      remark: '积分批次过期',
      expireTime: null,
    });

    await this.lotLedgerService.expireLot(lot, transaction.id);

    this.logger.log(`积分批次过期: lotId=${lot.id}, amount=${expiringAmount}, memberId=${lot.memberId}`);

    return { transactionId: transaction.id, amount: expiringAmount };
  }
}
