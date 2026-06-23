import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Status } from '@prisma/client';
import { LevelService } from '../services/level.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';

/**
 * 分销员等级定时任务
 */
@Injectable()
export class LevelScheduler {
  private readonly logger = new Logger(LevelScheduler.name);

  constructor(
    private readonly levelService: LevelService,
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 等级升级任务
   * 每天凌晨2点执行
   */
  @IgnoreTenant()
  @CodeManagedJob({
    key: 'distribution.processUpgrade',
    name: '分销员等级升级',
    group: 'STORE',
    cron: CronExpression.EVERY_DAY_AT_2AM,
    guardMode: 'platform-lock',
  })
  @Task({ name: 'distribution.processUpgrade', description: '分销员等级升级' })
  async processUpgrade() {
    const startTime = Date.now();
    this.logger.log('开始执行等级升级任务...');

    try {
      // Phase D2: sysTenant.findMany 与下游 batchProcessUpgrade 跨租户读写分销员等级，
      // cron path 无 Guard 触发，统一进入 super-tenant context 保持契约对齐。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        // 查询所有租户
        const tenants = await this.prisma.sysTenant.findMany({
          where: { status: Status.NORMAL },
          select: { tenantId: true, companyName: true },
        });

        let totalUpgraded = 0;
        let totalFailed = 0;

        // 遍历每个租户
        for (const tenant of tenants) {
          try {
            this.logger.log(`处理租户 ${tenant.companyName}(${tenant.tenantId}) 的等级升级...`);

            const result = await this.levelService.batchProcessUpgrade(tenant.tenantId);

            totalUpgraded += result.upgraded;
            totalFailed += result.failed;

            this.logger.log(
              `租户 ${tenant.companyName} 升级完成: 成功 ${result.upgraded} 人, 失败 ${result.failed} 人`,
            );
          } catch (error) {
            this.logger.error(`租户 ${tenant.companyName} 升级失败:`, error);
          }
        }

        const duration = Date.now() - startTime;
        this.logger.log(
          `等级升级任务完成: 处理 ${tenants.length} 个租户, 总计升级 ${totalUpgraded} 人, 失败 ${totalFailed} 人, 耗时 ${duration}ms`,
        );
      });
    } catch (error) {
      this.logger.error('等级升级任务执行失败:', error);
    }
  }

  /**
   * 等级降级任务
   * 每天凌晨3点执行
   */
  @IgnoreTenant()
  @CodeManagedJob({
    key: 'distribution.processDowngrade',
    name: '分销员等级降级',
    group: 'STORE',
    cron: '0 0 3 * * *',
    guardMode: 'platform-lock',
  })
  @Task({ name: 'distribution.processDowngrade', description: '分销员等级降级' })
  async processDowngrade() {
    const startTime = Date.now();
    this.logger.log('开始执行等级降级任务...');

    try {
      // Phase D2: 与 processUpgrade 同构，跨租户读写分销员等级；cron path 无 Guard 触发，
      // 进入 super-tenant context 兜底。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        // 查询所有租户
        const tenants = await this.prisma.sysTenant.findMany({
          where: { status: Status.NORMAL },
          select: { tenantId: true, companyName: true },
        });

        let totalDowngraded = 0;
        let totalFailed = 0;

        // 遍历每个租户
        for (const tenant of tenants) {
          try {
            this.logger.log(`处理租户 ${tenant.companyName}(${tenant.tenantId}) 的等级降级...`);

            const result = await this.levelService.batchProcessDowngrade(tenant.tenantId);

            totalDowngraded += result.downgraded;
            totalFailed += result.failed;

            this.logger.log(
              `租户 ${tenant.companyName} 降级完成: 成功 ${result.downgraded} 人, 失败 ${result.failed} 人`,
            );
          } catch (error) {
            this.logger.error(`租户 ${tenant.companyName} 降级失败:`, error);
          }
        }

        const duration = Date.now() - startTime;
        this.logger.log(
          `等级降级任务完成: 处理 ${tenants.length} 个租户, 总计降级 ${totalDowngraded} 人, 失败 ${totalFailed} 人, 耗时 ${duration}ms`,
        );
      });
    } catch (error) {
      this.logger.error('等级降级任务执行失败:', error);
    }
  }

  /**
   * 健康检查任务
   * 每小时执行一次，检查等级配置和会员数据的一致性
   */
  @IgnoreTenant()
  @CodeManagedJob({
    key: 'distribution.healthCheck',
    name: '分销等级健康检查',
    group: 'STORE',
    cron: CronExpression.EVERY_HOUR,
    guardMode: 'platform-lock',
  })
  @Task({ name: 'distribution.healthCheck', description: '分销等级健康检查' })
  async healthCheck() {
    try {
      // Phase D2: 跨租户读 sysTenant + umsMember + sysDistLevel；进入 super-tenant context
      // 让 readWhereForDelegate 与 tenantExtension 行为一致（已通过 tenantId 入参显式约束）。
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        // 查询所有租户
        const tenants = await this.prisma.sysTenant.findMany({
          where: { status: Status.NORMAL },
          select: { tenantId: true },
        });

        for (const tenant of tenants) {
          // 检查是否有会员的等级ID不存在于等级配置中
          const invalidMembers = await this.prisma.umsMember.findMany({
            where: this.tenantHelper.readWhereForDelegate('umsMember', {
              tenantId: tenant.tenantId,
              levelId: {
                gt: 0, // 只检查分销员
              },
            }) as Prisma.UmsMemberWhereInput,
            select: {
              memberId: true,
              levelId: true,
            },
          });

          if (invalidMembers.length > 0) {
            // 查询该租户的所有有效等级
            const validLevels = await this.prisma.sysDistLevel.findMany({
              where: this.tenantHelper.readWhereForDelegate('sysDistLevel', {
                tenantId: tenant.tenantId,
                isActive: true,
              }) as Prisma.SysDistLevelWhereInput,
              select: { levelId: true },
            });

            const validLevelIds = new Set(validLevels.map((l) => l.levelId));

            // 找出等级ID无效的会员
            const membersWithInvalidLevel = invalidMembers.filter((m) => !validLevelIds.has(m.levelId));

            if (membersWithInvalidLevel.length > 0) {
              this.logger.warn(
                `租户 ${tenant.tenantId} 发现 ${membersWithInvalidLevel.length} 个会员的等级ID无效: ${membersWithInvalidLevel.map((m) => `${m.memberId}(${m.levelId})`).join(', ')}`,
              );
            }
          }
        }
      });
    } catch (error) {
      this.logger.error('健康检查任务执行失败:', error);
    }
  }
}
