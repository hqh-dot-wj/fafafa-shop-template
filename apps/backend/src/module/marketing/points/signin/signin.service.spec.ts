import { Test, TestingModule } from '@nestjs/testing';
import { PointsTransactionType } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PointsAccountService } from '../account/account.service';
import { PointsRuleService } from '../rule/rule.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { PointsSigninService } from './signin.service';

describe('PointsSigninService', () => {
  let service: PointsSigninService;

  const mockPrisma = {
    mktPointsTransaction: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockCls = {
    get: jest.fn(),
  };

  const mockAccountService = {
    addPoints: jest.fn(),
  };

  const mockRuleService = {
    getRules: jest.fn(),
  };

  const mockRedis = {
    tryLock: jest.fn().mockResolvedValue('lock-token-1'),
    unlock: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('00000');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsSigninService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClsService, useValue: mockCls },
        { provide: PointsAccountService, useValue: mockAccountService },
        { provide: PointsRuleService, useValue: mockRuleService },
        { provide: RedisService, useValue: mockRedis },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get<PointsSigninService>(PointsSigninService);
    jest.clearAllMocks();
    mockRedis.tryLock.mockResolvedValue('lock-token-1');
    mockRedis.unlock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // R-PRE-SIGNIN-01
  it('Given 签到功能未启用, When signin, Then 抛出业务异常', async () => {
    mockRuleService.getRules.mockResolvedValue({
      data: {
        signinPointsEnabled: false,
        systemEnabled: true,
      },
    });

    await expect(service.signin('m1')).rejects.toThrow(BusinessException);
  });

  // R-FLOW-SIGNIN-01
  it('Given 今日未签到且规则启用, When signin, Then 发放签到积分', async () => {
    mockRuleService.getRules.mockResolvedValue({
      data: {
        signinPointsEnabled: true,
        systemEnabled: true,
        signinPointsAmount: 10,
      },
    });
    mockPrisma.mktPointsTransaction.findFirst.mockResolvedValue(null);
    mockAccountService.addPoints.mockResolvedValue({
      data: { id: 'tx-1' },
    });

    const result = await service.signin('m1');

    expect(mockAccountService.addPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: 'm1',
        amount: 10,
        type: PointsTransactionType.EARN_SIGNIN,
      }),
    );
    expect(result.data.points).toBe(10);
  });

  // 问题 6-1：Redis 锁串行化签到，并发请求只允许第一个进入
  it('Given Redis 锁已被占用, When signin, Then 抛出"今日已签到"业务异常并跳过发放', async () => {
    mockRuleService.getRules.mockResolvedValue({
      data: { signinPointsEnabled: true, systemEnabled: true, signinPointsAmount: 10 },
    });
    mockRedis.tryLock.mockResolvedValueOnce(null);

    await expect(service.signin('m1')).rejects.toThrow(BusinessException);
    expect(mockPrisma.mktPointsTransaction.findFirst).not.toHaveBeenCalled();
    expect(mockAccountService.addPoints).not.toHaveBeenCalled();
  });

  // 问题 6-2：成功签到时锁必须被释放，避免后续日为下一天的签到被错误持锁阻塞
  it('Given 成功签到, When signin 返回, Then 锁被释放', async () => {
    mockRuleService.getRules.mockResolvedValue({
      data: { signinPointsEnabled: true, systemEnabled: true, signinPointsAmount: 10 },
    });
    mockPrisma.mktPointsTransaction.findFirst.mockResolvedValue(null);
    mockAccountService.addPoints.mockResolvedValue({ data: { id: 'tx-1' } });

    await service.signin('m1');

    expect(mockRedis.unlock).toHaveBeenCalledWith(expect.stringMatching(/^lock:points:signin:/), 'lock-token-1');
  });

  // 问题 6-3：锁获取成功但是查询发现已签到，必须释放锁并报错
  it('Given 锁内查询发现已签到, When signin, Then 抛异常并释放锁', async () => {
    mockRuleService.getRules.mockResolvedValue({
      data: { signinPointsEnabled: true, systemEnabled: true, signinPointsAmount: 10 },
    });
    mockPrisma.mktPointsTransaction.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(service.signin('m1')).rejects.toThrow(BusinessException);
    expect(mockAccountService.addPoints).not.toHaveBeenCalled();
    expect(mockRedis.unlock).toHaveBeenCalledWith(expect.stringMatching(/^lock:points:signin:/), 'lock-token-1');
  });

  // R-FLOW-SIGNIN-02
  it('Given 连续3天签到数据, When checkSigninStatus, Then 单次查询计算连续天数', async () => {
    const now = new Date();
    const day0 = new Date(now);
    const day1 = new Date(now);
    day1.setDate(day1.getDate() - 1);
    const day2 = new Date(now);
    day2.setDate(day2.getDate() - 2);

    mockPrisma.mktPointsTransaction.findFirst.mockResolvedValue({
      createTime: day0,
    });
    mockPrisma.mktPointsTransaction.findMany.mockResolvedValue([
      { createTime: day0 },
      { createTime: day1 },
      { createTime: day2 },
    ]);
    mockPrisma.mktPointsTransaction.count.mockResolvedValue(12);

    const result = await service.checkSigninStatus('m1');

    expect(mockPrisma.mktPointsTransaction.findMany).toHaveBeenCalledTimes(1);
    expect(result.data.continuousDays).toBe(3);
    expect(result.data.monthSignins).toBe(12);
    expect(result.data.hasSignedToday).toBe(true);
  });
});
