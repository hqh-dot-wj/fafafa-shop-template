import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { PointsLotStatus, PointsTransactionStatus, PointsTransactionType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { RedisService } from 'src/module/common/redis/redis.service';
import { MessageTouchpointDispatcher } from '../../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../../events/marketing-event.types';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';

/**
 * 积分定时任务服务
 *
 * @description 提供积分过期处理等定时任务
 */
@Injectable()
export class PointsSchedulerService {
  private readonly logger = new Logger(PointsSchedulerService.name);
  private readonly lockKey = 'lock:marketing:points:scheduler:process-expired-points';
  private readonly lockTtlMs = 5 * 60 * 1000;
  private readonly batchSize = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly messageTouchpointDispatcher: MessageTouchpointDispatcher,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 处理过期积分
   *
   * @description 每天凌晨2点执行，处理已过期的积分
   */
  @CodeManagedJob({
    key: 'points.processExpiredPoints',
    name: '处理过期积分',
    group: 'MARKETING',
    cron: CronExpression.EVERY_DAY_AT_2AM,
    guardMode: 'self-managed',
  })
  @Task({ name: 'points.processExpiredPoints', description: '处理过期积分' })
  async processExpiredPoints() {
    const lockToken = await this.redisService.tryLock(this.lockKey, this.lockTtlMs);
    if (!lockToken) {
      this.logger.log('跳过处理过期积分：已有实例正在执行');
      return;
    }

    this.logger.log('开始处理过期积分...');

    try {
      const now = new Date();
      let processedCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      let batchCursorId: string | undefined;

      while (true) {
        const expiredLots = await this.prisma.mktPointsLot.findMany({
          where: this.tenantHelper.readWhereForDelegate('mktPointsLot', {
            expireTime: {
              lte: now,
            },
            availableAmount: {
              gt: 0,
            },
            status: PointsLotStatus.ACTIVE,
          }) as Prisma.MktPointsLotWhereInput,
          include: {
            account: true,
          },
          orderBy: {
            id: 'asc',
          },
          ...(batchCursorId
            ? {
                cursor: { id: batchCursorId },
                skip: 1,
              }
            : {}),
          take: this.batchSize,
        });

        if (expiredLots.length === 0) {
          break;
        }

        this.logger.log(`找到 ${expiredLots.length} 个待处理过期积分批次（分批）`);

        for (const lot of expiredLots) {
          try {
            // 检查账户可用积分是否足够扣减
            if (lot.account.availablePoints < lot.availableAmount) {
              skippedCount++;
              this.logger.warn(
                `账户可用积分不足，跳过过期处理: accountId=${lot.accountId}, available=${lot.account.availablePoints}, expire=${lot.availableAmount}`,
              );
              continue;
            }

            const expiredTx = await this.prisma.$transaction(async (tx) => {
              const expireAmount = lot.availableAmount;
              // 更新账户余额
              await tx.mktPointsAccount.update({
                where: {
                  id: lot.accountId,
                },
                data: {
                  availablePoints: {
                    decrement: expireAmount,
                  },
                  expiredPoints: {
                    increment: expireAmount,
                  },
                },
              });

              // 创建过期扣减记录
              const createdExpiredTx = await tx.mktPointsTransaction.create({
                data: {
                  tenantId: lot.tenantId,
                  accountId: lot.accountId,
                  memberId: lot.memberId,
                  type: PointsTransactionType.EXPIRE,
                  amount: -expireAmount,
                  balanceBefore: lot.account.availablePoints,
                  balanceAfter: lot.account.availablePoints - expireAmount,
                  status: PointsTransactionStatus.COMPLETED,
                  relatedId: lot.id,
                  remark: `积分批次过期扣减（lot: ${lot.id}）`,
                  expireTime: null,
                },
              });

              // lot 是可消费资产单元，过期只关闭 lot，不回写历史发放流水，避免破坏审计原始事实。
              await tx.mktPointsLot.update({
                where: {
                  id: lot.id,
                },
                data: {
                  availableAmount: 0,
                  expiredAmount: {
                    increment: expireAmount,
                  },
                  status: PointsLotStatus.EXPIRED,
                },
              });

              return createdExpiredTx;
            });

            await this.messageTouchpointDispatcher.dispatch({
              type: MarketingEventType.POINTS_EXPIRED,
              tenantId: lot.tenantId,
              instanceId: expiredTx.id,
              configId: lot.accountId,
              memberId: lot.memberId,
              payload: {
                amount: lot.availableAmount,
                originalLotId: lot.id,
                sourceTransactionId: lot.sourceTransactionId,
                accountId: lot.accountId,
              },
              timestamp: new Date(),
            });

            processedCount++;
            this.logger.log(
              `处理过期积分成功: lotId=${lot.id}, memberId=${lot.memberId}, amount=${lot.availableAmount}`,
            );
          } catch (error) {
            errorCount++;
            this.logger.error(
              `处理过期积分失败: lotId=${lot.id}, memberId=${lot.memberId}, error=${getErrorMessage(error)}`,
              getErrorStack(error),
            );
          }
        }

        batchCursorId = expiredLots[expiredLots.length - 1]?.id;
        if (expiredLots.length < this.batchSize) {
          break;
        }
      }

      this.logger.log(`过期积分处理完成: 成功=${processedCount}, 失败=${errorCount}, 跳过=${skippedCount}`);
    } catch (error) {
      this.logger.error(`处理过期积分异常: ${getErrorMessage(error)}`, getErrorStack(error));
    } finally {
      try {
        await this.redisService.unlock(this.lockKey, lockToken);
      } catch (error) {
        this.logger.warn(`释放过期积分任务锁失败: ${getErrorMessage(error)}`);
      }
    }
  }
}
