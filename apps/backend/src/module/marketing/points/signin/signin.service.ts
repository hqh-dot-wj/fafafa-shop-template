import { Injectable, Logger } from '@nestjs/common';
import { PointsTransactionType, Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { ClsService } from 'nestjs-cls';

// 显式 extend 一次（dayjs 内部对重复 extend 幂等），确保单测加载本 service 时
// dayjs.tz API 可用；运行时由 common/utils/index.ts 已经 extend 过，重复无副作用
dayjs.extend(utc);
dayjs.extend(timezone);
// 用标准 IANA 时区 `Asia/Shanghai`（与北京同时区）；Node 标准 ICU 不识别 'Asia/Beijing' 别名
const SIGNIN_TIME_ZONE = 'Asia/Shanghai';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Result } from 'src/common/response/result';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PointsAccountService } from '../account/account.service';
import { PointsRuleService } from '../rule/rule.service';
import { PointsErrorCode, PointsErrorMessages } from '../constants/error-codes';

/**
 * 积分签到服务
 *
 * @description 提供用户签到和签到状态查询功能
 */
@Injectable()
export class PointsSigninService {
  private readonly logger = new Logger(PointsSigninService.name);
  /** 签到分布式锁存活时间（毫秒）；锁内做"是否已签到 + 发放积分"两步，2 秒足够 */
  private readonly signinLockTtlMs = 2000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly accountService: PointsAccountService,
    private readonly ruleService: PointsRuleService,
    private readonly tenantHelper: TenantHelper,
    private readonly redis: RedisService,
  ) {}

  /**
   * 用户签到
   *
   * @param memberId 用户ID
   * @returns 签到结果
   */
  async signin(memberId: string) {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;

    // 获取积分规则
    const rulesResult = await this.ruleService.getRules();
    const rules = rulesResult.data;

    if (!rules.signinPointsEnabled || !rules.systemEnabled) {
      BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.SIGNIN_DISABLED]);
    }

    // 按全局默认时区（dayjs.tz.setDefault('Asia/Beijing')）划分"今天"，
    // 避免直接 new Date().setHours() 受服务器本地时区影响、多机部署跨零点行为不一致。
    const { todayStart, tomorrowStart, dateKey } = this.resolveSigninDateWindow();

    // Redis 分布式锁：同 memberId 同一天的签到串行化，配合后置幂等查询消除并发重复发放窗口。
    const lockKey = this.buildSigninLockKey(tenantId, memberId, dateKey);
    const lockToken = await this.redis.tryLock(lockKey, this.signinLockTtlMs);
    if (!lockToken) {
      // 同请求方多次并发：拒绝其余请求；同一窗口内最多一个签到流程进入，避免双发
      BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.ALREADY_SIGNED_TODAY]);
    }

    try {
      const existingSignin = await this.prisma.mktPointsTransaction.findFirst({
        where: this.tenantHelper.readWhereForDelegate('mktPointsTransaction', {
          tenantId,
          memberId,
          type: PointsTransactionType.EARN_SIGNIN,
          createTime: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        }) as Prisma.MktPointsTransactionWhereInput,
      });

      if (existingSignin) {
        BusinessException.throw(400, PointsErrorMessages[PointsErrorCode.ALREADY_SIGNED_TODAY]);
      }

      // 发放签到积分
      const result = await this.accountService.addPoints({
        memberId,
        amount: rules.signinPointsAmount,
        type: PointsTransactionType.EARN_SIGNIN,
        remark: '每日签到',
      });

      this.logger.log(`用户签到成功: memberId=${memberId}, points=${rules.signinPointsAmount}`);

      return Result.ok({
        points: rules.signinPointsAmount,
        transaction: result.data,
      });
    } finally {
      try {
        await this.redis.unlock(lockKey, lockToken);
      } catch (error) {
        this.logger.warn(`释放签到锁失败 memberId=${memberId} key=${lockKey}`, error);
      }
    }
  }

  /**
   * 按业务时区（dayjs 默认时区 Asia/Beijing）解析"今天"的时间窗口与日期 key。
   *
   * @description 单独抽出便于测试、便于未来按租户时区扩展；
   * dateKey 用 `YYYY-MM-DD` 形式，作为分布式锁与索引计算的稳定键。
   */
  private resolveSigninDateWindow(): { todayStart: Date; tomorrowStart: Date; dateKey: string } {
    const now = dayjs().tz(SIGNIN_TIME_ZONE);
    const start = now.startOf('day');
    return {
      todayStart: start.toDate(),
      tomorrowStart: start.add(1, 'day').toDate(),
      dateKey: start.format('YYYY-MM-DD'),
    };
  }

  private buildSigninLockKey(tenantId: string, memberId: string, dateKey: string): string {
    return `lock:points:signin:${tenantId}:${memberId}:${dateKey}`;
  }

  /**
   * 检查签到状态
   *
   * @param memberId 用户ID
   * @returns 签到状态
   */
  async checkSigninStatus(memberId: string) {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;

    // 与 signin 一致：用业务时区划分"今天"/"本月"，避免服务器本地时区漂移
    const now = dayjs().tz(SIGNIN_TIME_ZONE);
    const today = now.startOf('day').toDate();
    const tomorrow = now.startOf('day').add(1, 'day').toDate();

    const todaySignin = await this.prisma.mktPointsTransaction.findFirst({
      where: this.tenantHelper.readWhereForDelegate('mktPointsTransaction', {
        tenantId,
        memberId,
        type: PointsTransactionType.EARN_SIGNIN,
        createTime: {
          gte: today,
          lt: tomorrow,
        },
      }) as Prisma.MktPointsTransactionWhereInput,
    });

    // 统计连续签到天数
    const continuousDays = await this.calculateContinuousDays(memberId);

    // 统计本月签到天数（按业务时区的月起点）
    const monthStart = now.startOf('month').toDate();
    const monthSignins = await this.prisma.mktPointsTransaction.count({
      where: this.tenantHelper.readWhereForDelegate('mktPointsTransaction', {
        tenantId,
        memberId,
        type: PointsTransactionType.EARN_SIGNIN,
        createTime: {
          gte: monthStart,
        },
      }) as Prisma.MktPointsTransactionWhereInput,
    });

    return Result.ok({
      hasSignedToday: !!todaySignin,
      continuousDays,
      monthSignins,
      lastSigninTime: todaySignin?.createTime || null,
    });
  }

  /**
   * 计算连续签到天数
   *
   * @param memberId 用户ID
   * @returns 连续签到天数
   */
  private async calculateContinuousDays(memberId: string): Promise<number> {
    const tenantId = TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID;
    const maxDays = 100;
    const now = dayjs().tz(SIGNIN_TIME_ZONE);
    const todayStart = now.startOf('day');
    const tomorrow = todayStart.add(1, 'day').toDate();
    const windowStart = todayStart.subtract(maxDays - 1, 'day').toDate();

    const signins = await this.prisma.mktPointsTransaction.findMany({
      where: this.tenantHelper.readWhereForDelegate('mktPointsTransaction', {
        tenantId,
        memberId,
        type: PointsTransactionType.EARN_SIGNIN,
        createTime: {
          gte: windowStart,
          lt: tomorrow,
        },
      }) as Prisma.MktPointsTransactionWhereInput,
      select: {
        createTime: true,
      },
    });

    // signedDaySet 用业务时区的 YYYY-MM-DD 作为 key，避免 toDateKey 误用服务器本地时区
    const signedDaySet = new Set(
      signins.map((item) => dayjs(item.createTime).tz(SIGNIN_TIME_ZONE).format('YYYY-MM-DD')),
    );
    let continuousDays = 0;
    let cursor = todayStart;

    for (let i = 0; i < maxDays; i++) {
      if (!signedDaySet.has(cursor.format('YYYY-MM-DD'))) {
        break;
      }
      continuousDays++;
      cursor = cursor.subtract(1, 'day');
    }

    return continuousDays;
  }
}
