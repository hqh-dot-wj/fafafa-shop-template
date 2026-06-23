/**
 * 测试规格：finance 域三个金融调度器的分布式锁 token 化（Phase A2）
 *
 * ─ 复杂度：Complex
 *   金额相关 + Redis 外部依赖 + 有状态（lockToken）+ 并发风险（多实例 cron 抢锁）
 *
 * ─ Phase 1 不变量（对所有调度器都成立）
 *   I1 acquireLock 调用 redisService.tryLock(KEY, ttlMs)，ttl 单位为毫秒（>= 60_000）
 *   I2 acquireLock 成功后 lockToken === tryLock 返回的 token
 *   I3 acquireLock 失败后 lockToken === null
 *   I4 releaseLock 在持有 token 时调用 redisService.unlock(KEY, token)
 *   I5 releaseLock 完成后 lockToken === null
 *   I6 lockToken === null 时 releaseLock 不调用 unlock（防误删他人锁）
 *   I7 SettlementScheduler.renewLockOnce 调用 redisService.renewLock(KEY, token, ttlMs)
 *   I8 renewLockOnce 收到 0（token mismatch / 锁已丢） → lockToken 清空、timer 停
 *   I9 renewLockOnce 异常 → 按 Phase A2 决策 D2=a，视为锁丢失：lockToken 清空、timer 停
 *
 * ─ Phase 2 状态转移
 *   IDLE → HELD：tryLock 成功
 *   IDLE → IDLE：tryLock 返回 null
 *   HELD → HELD：renewLock 返回 1
 *   HELD → LOST：renewLock 返回 0 或抛错
 *   HELD → IDLE：releaseLock 正常释放
 *   LOST → IDLE：releaseLock 不调用 unlock（已无 token）
 *
 * ─ Phase 3 红队场景（仅保留 UNIT 可验证项；INTEG/SKIP 已列在 exec-plan §6）
 *   A1 [UNIT] 并发实例替换 token：renewLock 返回 0 → watchdog 退出，下次 cron 重新抢锁
 *   A2 [UNIT] release 时 token 已被替换：RedisService.unlock 内部 Lua 校验返回 0，
 *             调度器侧不抛、不重试
 *   A3 [UNIT] acquireLock 时 redis 不可用：返回 falsy，lockToken 保持 null
 *
 * ─ Phase 4 边界
 *   B1 tryLock → null      → acquireLock=false
 *   B2 tryLock → UUID 字符串 → acquireLock=true，lockToken 写入该值
 *   B3 renewLock → 1       → token 不变
 *   B4 renewLock → 0       → token=null
 *   B5 renewLock → Promise.reject  → token=null
 *
 * 关联：docs/exec-plans/active/SCHEDULER-AUDIT-2026-05.md Phase A2
 */

import { SettlementScheduler } from '../settlement/settlement.scheduler';
import { WithdrawalReconciliationScheduler } from '../withdrawal/withdrawal-reconciliation.scheduler';
import { SettlementReconciliationScheduler } from '../settlement-core/settlement-reconciliation.scheduler';
import { BusinessConstants } from 'src/common/constants/business.constants';

type RedisMock = {
  tryLock: jest.Mock;
  unlock: jest.Mock;
  renewLock: jest.Mock;
  getClient: jest.Mock;
};

function createRedisMock(overrides: Partial<RedisMock> = {}): RedisMock {
  return {
    tryLock: jest.fn().mockResolvedValue('mock-token-uuid'),
    unlock: jest.fn().mockResolvedValue(1),
    renewLock: jest.fn().mockResolvedValue(1),
    // 旧实现里 acquireLock/releaseLock 调用过 getClient().set/del/expire，
    // 即便新实现已不再走 raw client，依然给个空 stub 防止 mock 链路抛错。
    getClient: jest.fn().mockReturnValue({
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    }),
    ...overrides,
  };
}

function newSettlement(redis: RedisMock) {
  return new SettlementScheduler({} as never, redis as never, {} as never, {} as never, {} as never, {} as never);
}

function newWithdrawal(redis: RedisMock) {
  return new WithdrawalReconciliationScheduler(
    {} as never,
    redis as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

function newSettlementReconciliation(redis: RedisMock) {
  return new SettlementReconciliationScheduler({} as never, redis as never, {} as never, {} as never, {} as never);
}

const TTL_MS = BusinessConstants.REDIS_LOCK.SETTLEMENT_TTL_MS;

describe('Finance schedulers — distributed lock token (Phase A2)', () => {
  // 共享 invariants：三个调度器都必须满足 I1-I6
  describe.each([
    ['SettlementScheduler', newSettlement],
    ['WithdrawalReconciliationScheduler', newWithdrawal],
    ['SettlementReconciliationScheduler', newSettlementReconciliation],
  ] as const)('%s invariants', (_name, factory) => {
    it('I1: acquireLock 必须以毫秒为单位调用 redisService.tryLock', async () => {
      const redis = createRedisMock();
      const svc = factory(redis) as unknown as { acquireLock: () => Promise<boolean> };

      await svc.acquireLock();

      expect(redis.tryLock).toHaveBeenCalledTimes(1);
      const [, ttlArg] = redis.tryLock.mock.calls[0];
      expect(typeof ttlArg).toBe('number');
      // 反陷阱：若误传秒(300) 会立刻被这里捕获
      expect(ttlArg).toBeGreaterThanOrEqual(60_000);
      expect(ttlArg).toBe(TTL_MS);
    });

    it('I2/I3: acquireLock 成功写入 token；失败保持 lockToken=null', async () => {
      const redis = createRedisMock({ tryLock: jest.fn().mockResolvedValueOnce('uuid-a').mockResolvedValueOnce(null) });
      const svc = factory(redis) as unknown as { acquireLock: () => Promise<boolean>; lockToken: string | null };

      const ok = await svc.acquireLock();
      expect(ok).toBeTruthy();
      expect(svc.lockToken).toBe('uuid-a');

      // 第二次拿不到锁：lockToken 必须被清回 null，而非保留旧 token
      const ok2 = await svc.acquireLock();
      expect(ok2).toBeFalsy();
      expect(svc.lockToken).toBeNull();
    });

    it('I4/I5: 持有 token 时 releaseLock 调用 unlock(KEY, token) 并清空', async () => {
      const redis = createRedisMock();
      const svc = factory(redis) as unknown as {
        acquireLock: () => Promise<boolean>;
        releaseLock: () => Promise<void>;
        lockToken: string | null;
      };

      await svc.acquireLock();
      const tokenBefore = svc.lockToken;
      await svc.releaseLock();

      expect(redis.unlock).toHaveBeenCalledTimes(1);
      const [keyArg, tokenArg] = redis.unlock.mock.calls[0];
      expect(typeof keyArg).toBe('string');
      expect(keyArg.length).toBeGreaterThan(0);
      expect(tokenArg).toBe(tokenBefore);
      expect(svc.lockToken).toBeNull();
    });

    it('I6: lockToken=null 时 releaseLock 不调用 unlock（防误删）', async () => {
      const redis = createRedisMock();
      const svc = factory(redis) as unknown as { releaseLock: () => Promise<void>; lockToken: string | null };
      svc.lockToken = null;

      await svc.releaseLock();

      expect(redis.unlock).not.toHaveBeenCalled();
    });

    it('A2: unlock 返回 0（token 已被替换）时不抛、不重试', async () => {
      const redis = createRedisMock({ unlock: jest.fn().mockResolvedValue(0) });
      const svc = factory(redis) as unknown as {
        acquireLock: () => Promise<boolean>;
        releaseLock: () => Promise<void>;
        lockToken: string | null;
      };

      await svc.acquireLock();
      await expect(svc.releaseLock()).resolves.toBeUndefined();
      expect(svc.lockToken).toBeNull();
    });

    it('A3: tryLock 返回 null 视为未获锁，acquire=false', async () => {
      const redis = createRedisMock({ tryLock: jest.fn().mockResolvedValue(null) });
      const svc = factory(redis) as unknown as { acquireLock: () => Promise<boolean>; lockToken: string | null };

      const ok = await svc.acquireLock();
      expect(ok).toBeFalsy();
      expect(svc.lockToken).toBeNull();
      expect(redis.unlock).not.toHaveBeenCalled();
    });
  });

  // SettlementScheduler 独有：看门狗续期 + lock-lost 信号
  describe('SettlementScheduler renewal (watchdog)', () => {
    it('I7: renewLockOnce 调用 redisService.renewLock(KEY, token, TTL_MS)', async () => {
      const redis = createRedisMock();
      const svc = newSettlement(redis) as unknown as {
        acquireLock: () => Promise<boolean>;
        renewLockOnce: () => Promise<boolean>;
        lockToken: string | null;
      };

      await svc.acquireLock();
      await svc.renewLockOnce();

      expect(redis.renewLock).toHaveBeenCalledTimes(1);
      const [keyArg, tokenArg, ttlArg] = redis.renewLock.mock.calls[0];
      expect(typeof keyArg).toBe('string');
      expect(tokenArg).toBe(svc.lockToken);
      expect(ttlArg).toBe(TTL_MS);
    });

    it('I8 / B4: renewLock 返回 0 → lockToken 清空（锁丢失信号）', async () => {
      const redis = createRedisMock({ renewLock: jest.fn().mockResolvedValue(0) });
      const svc = newSettlement(redis) as unknown as {
        acquireLock: () => Promise<boolean>;
        renewLockOnce: () => Promise<boolean>;
        lockToken: string | null;
      };

      await svc.acquireLock();
      const stillHeld = await svc.renewLockOnce();

      expect(stillHeld).toBe(false);
      expect(svc.lockToken).toBeNull();
    });

    it('I9 / B5: renewLock 抛错 → 视为锁丢失（D2=a 安全优先）', async () => {
      const redis = createRedisMock({ renewLock: jest.fn().mockRejectedValue(new Error('redis down')) });
      const svc = newSettlement(redis) as unknown as {
        acquireLock: () => Promise<boolean>;
        renewLockOnce: () => Promise<boolean>;
        lockToken: string | null;
      };

      await svc.acquireLock();
      const stillHeld = await svc.renewLockOnce();

      expect(stillHeld).toBe(false);
      expect(svc.lockToken).toBeNull();
    });

    it('B3: renewLock 返回 1 → token 不变、仍 HELD', async () => {
      const redis = createRedisMock();
      const svc = newSettlement(redis) as unknown as {
        acquireLock: () => Promise<boolean>;
        renewLockOnce: () => Promise<boolean>;
        lockToken: string | null;
      };

      await svc.acquireLock();
      const tokenBefore = svc.lockToken;
      const stillHeld = await svc.renewLockOnce();

      expect(stillHeld).toBe(true);
      expect(svc.lockToken).toBe(tokenBefore);
    });

    it('I6 推广：lockToken=null 时 renewLockOnce 不调 renewLock', async () => {
      const redis = createRedisMock();
      const svc = newSettlement(redis) as unknown as {
        renewLockOnce: () => Promise<boolean>;
        lockToken: string | null;
      };
      svc.lockToken = null;

      const stillHeld = await svc.renewLockOnce();

      expect(stillHeld).toBe(false);
      expect(redis.renewLock).not.toHaveBeenCalled();
    });
  });
});
