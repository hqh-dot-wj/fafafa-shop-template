// quality-gate allow-source-string-test
// 设计说明：本 spec 是「13 个 scheduler 跨租户上下文兜底契约」的明示治理网。
// 备选方案是为每个 scheduler 用 TestingModule 实例化 + spy TenantContext.run，
// 但 13 个 scheduler 的构造器各异（注入依赖不同）会带来高额 mock 维护成本，
// 且要让 spec 真正捕获「漏标 @IgnoreTenant」需要额外的反射工具，得不偿失。
// 静态扫描的语义清晰、维护成本最低，并能精确覆盖契约要求；如未来本契约升级为
// 真实行为测试，可以移除本注释。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 跨租户定时任务上下文契约（SCHEDULER-AUDIT Phase D2）
 *
 * 背景：
 *   @IgnoreTenant() 在 HTTP path 由 TenantGuard 触发，对 cron path 无效；
 *   `tenantExtension.updateMany/deleteMany` 在 `getTenantId() === undefined` 时
 *   不会追加 tenant 过滤条件，意味着 cron 路径没显式声明 super-tenant
 *   就有跨租户读写穿透风险（lifecycle.handleActivityStatus / resolution-audit-archive
 *   等已实证发生 updateMany / deleteMany）。
 *
 * 契约：
 *   13 个 self-managed scheduler 的每个 cron 入口方法必须同时满足：
 *   1. 标注 `@IgnoreTenant()`（HTTP path 标记 + 语义自描述，cron path 不依赖）
 *   2. 业务体被 `TenantContext.run({ tenantId: SUPER_TENANT_ID, ignoreTenant: true }, ...)`
 *      包裹（cron path 实际生效的兜底 context）
 *
 * 该 spec 用文本级静态扫描，确保「13 文件 17 任务」与契约逐一对齐；
 * 任意 scheduler 漏标或被回退都会立即变红，避免回归到 Phase D2 之前的隐式契约。
 */

interface SchedulerContract {
  /** 相对 apps/backend 根的文件路径 */
  file: string;
  /** 该文件内 cron 入口方法的数量（多任务文件如 lifecycle = 3） */
  cronMethodCount: number;
  /** 简短描述，便于失败时定位 */
  description: string;
}

const BACKEND_ROOT = resolve(__dirname, '..', '..', '..');

const SCHEDULER_CONTRACTS: SchedulerContract[] = [
  // marketing（8 个 cron 任务，6 个文件）
  {
    file: 'src/module/marketing/scheduler/resolution-audit-archive.scheduler.ts',
    cronMethodCount: 1,
    description: '营销裁决审计归档清理（deleteMany 跨租户写）',
  },
  {
    file: 'src/module/marketing/scheduler/aggregate-usage.scheduler.ts',
    cronMethodCount: 1,
    description: '营销聚合接口零流量自动关闭（sysConfig 跨租户写）',
  },
  {
    file: 'src/module/marketing/scheduler/resolution-alert.scheduler.ts',
    cronMethodCount: 1,
    description: '营销场景告警写入消息中心',
  },
  {
    file: 'src/module/marketing/scheduler/lifecycle.scheduler.ts',
    cronMethodCount: 3,
    description: '营销活动生命周期（超时实例 / 自动上下架 / 健康检查；含 storePlayConfig.updateMany 跨租户写）',
  },
  {
    file: 'src/module/marketing/course-group/scheduler/course-group-auto-fill.scheduler.ts',
    cronMethodCount: 1,
    description: '拼课自动补位',
  },
  {
    file: 'src/module/marketing/course-group/scheduler/course-group-reconcile.scheduler.ts',
    cronMethodCount: 1,
    description: '拼课团队重算补偿',
  },
  // client + finance（5 个 cron 任务，5 个文件）
  {
    file: 'src/module/client/payment/refund-reconciliation.scheduler.ts',
    cronMethodCount: 1,
    description: '退款查询补偿',
  },
  {
    file: 'src/module/finance/commission/commission-compensation.scheduler.ts',
    cronMethodCount: 1,
    description: '佣金漏算补偿扫描（跨租户读 paid orders）',
  },
  {
    file: 'src/module/finance/settlement/settlement.scheduler.ts',
    cronMethodCount: 1,
    description: '佣金结算到钱包（只包 cron 入口 settleJob，不包 triggerSettlement controller path）',
  },
  {
    file: 'src/module/finance/settlement-core/settlement-reconciliation.scheduler.ts',
    cronMethodCount: 1,
    description: '结算执行对账补偿',
  },
  {
    file: 'src/module/finance/withdrawal/withdrawal-reconciliation.scheduler.ts',
    cronMethodCount: 1,
    description: '提现对账补偿',
  },
  // store（4 个 cron 任务，2 个文件）
  {
    file: 'src/module/store/distribution/scheduler/level.scheduler.ts',
    cronMethodCount: 3,
    description: '分销员等级升级 / 降级 / 健康检查',
  },
  {
    file: 'src/module/store/product/stock-alert.scheduler.ts',
    cronMethodCount: 1,
    description: '库存预警扫描',
  },
];

/** 统计字符串 needle 在 haystack 里出现的次数 */
function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) {
    return 0;
  }
  let count = 0;
  let from = 0;
  while (true) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

describe('SCHEDULER-AUDIT D2 跨租户上下文契约', () => {
  describe('contract list', () => {
    it('Given 契约清单, Then 至少覆盖 13 个 scheduler 与 17 个 cron 任务', () => {
      expect(SCHEDULER_CONTRACTS.length).toBe(13);
      const totalCronTasks = SCHEDULER_CONTRACTS.reduce((acc, c) => acc + c.cronMethodCount, 0);
      expect(totalCronTasks).toBe(17);
    });
  });

  describe('每个 scheduler 文件', () => {
    it.each(SCHEDULER_CONTRACTS)(
      'Given $file ($description), When 静态扫描, Then 含 $cronMethodCount 个 @IgnoreTenant + 同数量 TenantContext.run',
      ({ file, cronMethodCount }) => {
        const fullPath = resolve(BACKEND_ROOT, file);
        const src = readFileSync(fullPath, 'utf8');

        // 1. @IgnoreTenant() 出现次数必须等于 cron 方法数；
        //    多于 / 少于都说明发生了「漏改某个任务」或「错误地标到 non-cron 方法」。
        const ignoreTenantCount = countOccurrences(src, '@IgnoreTenant()');
        expect(ignoreTenantCount).toBe(cronMethodCount);

        // 2. TenantContext.run( 至少出现 cron 方法数次；
        //    实施模板要求每个 cron 入口在 try 内独立包裹一层 super-tenant context。
        const runCount = countOccurrences(src, 'TenantContext.run(');
        expect(runCount).toBeGreaterThanOrEqual(cronMethodCount);

        // 3. ignoreTenant: true 至少出现 cron 方法数次；
        //    防止只传 tenantId 而漏掉 ignoreTenant，导致 tenantExtension 仍尝试追加过滤。
        const ignoreTenantTrueCount = countOccurrences(src, 'ignoreTenant: true');
        expect(ignoreTenantTrueCount).toBeGreaterThanOrEqual(cronMethodCount);

        // 4. SUPER_TENANT_ID 至少出现 cron 方法数次；
        //    要求显式使用 TenantContext.SUPER_TENANT_ID 常量，禁止硬编码 '000000'。
        const superTenantCount = countOccurrences(src, 'SUPER_TENANT_ID');
        expect(superTenantCount).toBeGreaterThanOrEqual(cronMethodCount);

        // 5. 必须 import 两个 API，避免某些文件用错命名或忘记 import。
        expect(src).toContain("from 'src/common/tenant/tenant.decorator'");
        expect(src).toContain("from 'src/common/tenant/tenant.context'");
      },
    );
  });
});
