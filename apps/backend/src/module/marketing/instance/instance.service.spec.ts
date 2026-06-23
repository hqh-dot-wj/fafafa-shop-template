import { Test, TestingModule } from '@nestjs/testing';
import { MarketingStockMode, PlayInstanceStatus } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { PlayInstanceService } from './instance.service';
import { PlayInstanceRepository } from './instance.repository';
import { FinanceCommandPort } from 'src/module/finance/ports/finance-command.port';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserAssetService } from '../asset/asset.service';
import { ConfigService } from 'src/module/admin/system/config/config.service';
import { IdempotencyService } from './idempotency.service';
import { MessageTouchpointDispatcher } from '../events/message-touchpoint.dispatcher';
import { GrayReleaseService } from '../gray/gray-release.service';
import { PlayDispatcher } from '../play/play.dispatcher';
import { MarketingStockService } from '../stock/stock.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { InstanceProbeService } from './instance-probe.service';

describe('PlayInstanceService', () => {
  let service: PlayInstanceService;

  const mockRepo = {
    search: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    findByOrderSn: jest.fn(),
    findByOrderId: jest.fn(),
    updateOrderBinding: jest.fn(),
  };

  const mockFinanceCommandPort = {
    creditWalletIncome: jest.fn(),
  };

  const mockPrisma = {
    storePlayConfig: {
      findFirst: jest.fn(),
    },
  };

  const mockAssetService = {
    grantAsset: jest.fn(),
  };

  const mockConfigService = {
    getSystemConfigValue: jest.fn(),
  };

  const mockIdempotencyService = {
    checkJoinIdempotency: jest.fn(),
    cacheJoinResult: jest.fn(),
    checkPaymentIdempotency: jest.fn(),
    markPaymentProcessed: jest.fn(),
    withStateLock: jest.fn(),
    withTeamLock: jest.fn(),
  };

  const mockEventEmitter = {
    dispatch: jest.fn(),
  };

  const mockGrayReleaseService = {
    isInGrayRelease: jest.fn(),
  };

  const mockPlayHandler = {
    checkEligibility: jest.fn(),
    onStatusChange: jest.fn(),
    applyRewards: jest.fn(),
    resolvePrice: jest.fn(),
    validateConfig: jest.fn(),
    getDisplayData: jest.fn(),
  };

  const mockPlayDispatcher = {
    resolve: jest.fn(),
  };

  const mockStockService = {
    reserveQuota: jest.fn(),
    releaseQuota: jest.fn(),
    decrement: jest.fn(),
    increment: jest.fn(),
  };

  const mockProbeService = {
    getProbe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayInstanceService,
        { provide: PlayInstanceRepository, useValue: mockRepo },
        { provide: FinanceCommandPort, useValue: mockFinanceCommandPort },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserAssetService, useValue: mockAssetService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: IdempotencyService, useValue: mockIdempotencyService },
        { provide: MessageTouchpointDispatcher, useValue: mockEventEmitter },
        { provide: GrayReleaseService, useValue: mockGrayReleaseService },
        { provide: PlayDispatcher, useValue: mockPlayDispatcher },
        { provide: MarketingStockService, useValue: mockStockService },
        { provide: InstanceProbeService, useValue: mockProbeService },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get<PlayInstanceService>(PlayInstanceService);
    jest.clearAllMocks();

    mockIdempotencyService.checkJoinIdempotency.mockResolvedValue(null);
    mockIdempotencyService.cacheJoinResult.mockResolvedValue(undefined);
    mockIdempotencyService.withStateLock.mockImplementation(
      async (_instanceId: string, callback: () => Promise<unknown>) => callback(),
    );
    mockGrayReleaseService.isInGrayRelease.mockResolvedValue(true);
    mockPlayDispatcher.resolve.mockReturnValue(mockPlayHandler);
    mockPlayHandler.checkEligibility.mockResolvedValue(undefined);
    mockPlayHandler.onStatusChange.mockResolvedValue(undefined);
    mockPlayHandler.applyRewards.mockResolvedValue(undefined);
    mockEventEmitter.dispatch.mockResolvedValue(undefined);
    mockRepo.create.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'ins-1',
      tenantId: data.tenantId,
      memberId: data.memberId,
      configId: data.configId,
      templateCode: data.templateCode,
      instanceData: data.instanceData,
      status: data.status,
    }));
    mockRepo.updateStatus.mockImplementation(
      async (id: string, status: PlayInstanceStatus, instanceData: Record<string, unknown>) => ({
        id,
        tenantId: 't-1',
        memberId: 'm-1',
        configId: 'cfg-1',
        templateCode: 'FLASH_SALE',
        instanceData,
        status,
      }),
    );
  });

  it('Given 探针服务返回结果, When getProbe, Then 透传实例探针结果', async () => {
    mockProbeService.getProbe.mockResolvedValue({ base: { id: 'ins-1' }, timeline: [], abnormalities: [] });

    const result = await service.getProbe('t-1', 'ins-1');

    expect(mockProbeService.getProbe).toHaveBeenCalledWith({ tenantId: 't-1', instanceId: 'ins-1' });
    expect(result.base.id).toBe('ins-1');
  });

  // R-FLOW-INSTANCE-02
  it('Given STRONG_LOCK 配置, When create, Then 先预扣库存并写入库存锁标记', async () => {
    mockPrisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      tenantId: 't-1',
      templateCode: 'FLASH_SALE',
      stockMode: MarketingStockMode.STRONG_LOCK,
      rules: {},
    });
    mockStockService.reserveQuota.mockResolvedValue(true);

    await service.create({
      tenantId: 't-1',
      memberId: 'm-1',
      configId: 'cfg-1',
      templateCode: 'FLASH_SALE',
      instanceData: { quantity: 2 },
    });

    expect(mockStockService.reserveQuota).toHaveBeenCalledWith('cfg-1', 2, MarketingStockMode.STRONG_LOCK);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceData: expect.objectContaining({
          quantity: 2,
          stockLocked: true,
          stockReleased: false,
          stockLockQuantity: 2,
        }),
      }),
    );
  });

  // R-BRANCH-INSTANCE-01
  it('Given 预扣库存成功, When create 落库失败, Then 自动回补库存', async () => {
    mockPrisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      tenantId: 't-1',
      templateCode: 'FLASH_SALE',
      stockMode: MarketingStockMode.STRONG_LOCK,
      rules: {},
    });
    mockStockService.reserveQuota.mockResolvedValue(true);
    mockRepo.create.mockRejectedValue(new Error('db failed'));

    await expect(
      service.create({
        tenantId: 't-1',
        memberId: 'm-1',
        configId: 'cfg-1',
        templateCode: 'FLASH_SALE',
        instanceData: { quantity: 2 },
      }),
    ).rejects.toThrow('db failed');

    expect(mockStockService.releaseQuota).toHaveBeenCalledWith('cfg-1', 2);
  });

  // R-BRANCH-INSTANCE-02
  it('Given 实例已锁库存且未释放, When 流转到 TIMEOUT, Then 回补库存并标记已释放', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'ins-1',
      configId: 'cfg-1',
      memberId: 'm-1',
      tenantId: 't-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.PENDING_PAY,
      instanceData: {
        quantity: 3,
        stockLocked: true,
        stockReleased: false,
      },
    });

    await service.transitStatus('ins-1', PlayInstanceStatus.TIMEOUT);

    expect(mockStockService.releaseQuota).toHaveBeenCalledWith('cfg-1', 3);
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      'ins-1',
      PlayInstanceStatus.TIMEOUT,
      expect.objectContaining({
        stockLocked: true,
        stockReleased: true,
      }),
    );
  });

  // R-PRE-INSTANCE-04
  it('Given 批量中存在非法状态流转, When batchTransitStatus, Then 直接拒绝并抛错', async () => {
    mockRepo.findMany.mockResolvedValue([
      {
        id: 'ins-1',
        status: PlayInstanceStatus.TIMEOUT,
      },
    ]);

    await expect(service.batchTransitStatus(['ins-1'], PlayInstanceStatus.SUCCESS)).rejects.toThrow(BusinessException);
  });

  // R-FLOW-INSTANCE-05
  it('Given 批量流转均合法, When batchTransitStatus, Then 逐条复用 transitStatus', async () => {
    mockRepo.findMany.mockResolvedValue([
      { id: 'ins-1', status: PlayInstanceStatus.PAID },
      { id: 'ins-2', status: PlayInstanceStatus.ACTIVE },
    ]);
    const transitSpy = jest.spyOn(service, 'transitStatus').mockResolvedValue({ data: null } as never);

    await service.batchTransitStatus(['ins-1', 'ins-2'], PlayInstanceStatus.SUCCESS, { source: 'batch' });

    expect(transitSpy).toHaveBeenCalledTimes(2);
    expect(transitSpy).toHaveBeenNthCalledWith(1, 'ins-1', PlayInstanceStatus.SUCCESS, { source: 'batch' });
    expect(transitSpy).toHaveBeenNthCalledWith(2, 'ins-2', PlayInstanceStatus.SUCCESS, { source: 'batch' });
  });

  // R-FLOW-MAAS-02
  it('Given SUCCESS 流转且规则含 giftAssetType, When transitStatus, Then 发放资产类型取 rules.giftAssetType', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'ins-1',
      configId: 'cfg-1',
      memberId: 'm-1',
      tenantId: 't-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.ACTIVE,
      instanceData: { price: 100 },
    });
    mockRepo.updateStatus.mockResolvedValue({
      id: 'ins-1',
      configId: 'cfg-1',
      memberId: 'm-1',
      tenantId: 't-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.SUCCESS,
      instanceData: { price: 100 },
    });
    mockPrisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      tenantId: 't-1',
      rules: {
        giftAssetId: 'asset-1',
        giftAssetName: '次卡权益',
        giftAssetType: 'TIMES_CARD',
        giftCount: 2,
      },
    });
    mockConfigService.getSystemConfigValue.mockResolvedValue('0.02');
    mockFinanceCommandPort.creditWalletIncome.mockResolvedValue(undefined);
    mockAssetService.grantAsset.mockResolvedValue(undefined);

    await service.transitStatus('ins-1', PlayInstanceStatus.SUCCESS);

    const settleAmount = mockFinanceCommandPort.creditWalletIncome.mock.calls[0][0].amount;
    expect(settleAmount.toString()).toBe('98');
    expect(mockFinanceCommandPort.creditWalletIncome).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: 'STORE_t-1',
        tenantId: 't-1',
        relatedId: 'ins-1',
      }),
    );
    expect(mockAssetService.grantAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        assetType: 'TIMES_CARD',
        balance: expect.anything(),
      }),
    );
  });

  // R-PRE-MAAS-01
  it('Given fee_rate 配置缺失, When SUCCESS 流转触发入账, Then 抛出业务异常', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'ins-1',
      configId: 'cfg-1',
      memberId: 'm-1',
      tenantId: 't-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.ACTIVE,
      instanceData: { price: 100 },
    });
    mockRepo.updateStatus.mockResolvedValue({
      id: 'ins-1',
      configId: 'cfg-1',
      memberId: 'm-1',
      tenantId: 't-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.SUCCESS,
      instanceData: { price: 100 },
    });
    mockPrisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      tenantId: 't-1',
      rules: {},
    });
    mockConfigService.getSystemConfigValue.mockResolvedValue(null);

    await expect(service.transitStatus('ins-1', PlayInstanceStatus.SUCCESS)).rejects.toThrow(BusinessException);
  });

  // --- Task 1/2: orderId 查询与绑定 ---

  it('Given 存在关联 orderId 的实例, When handlePaymentSuccessById, Then 通过 orderId 查到实例并流转到 PAID', async () => {
    mockIdempotencyService.checkPaymentIdempotency.mockResolvedValue(false);
    mockRepo.findByOrderId.mockResolvedValue({
      id: 'ins-1',
      tenantId: 't-1',
      memberId: 'm-1',
      configId: 'cfg-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.PENDING_PAY,
      instanceData: {},
    });
    // transitStatus 内部 findById → 返回 PENDING_PAY；processPaymentSuccess 的 findById → 返回 PAID
    mockRepo.findById
      .mockResolvedValueOnce({
        id: 'ins-1',
        tenantId: 't-1',
        memberId: 'm-1',
        configId: 'cfg-1',
        templateCode: 'FLASH_SALE',
        status: PlayInstanceStatus.PENDING_PAY,
        instanceData: {},
      })
      .mockResolvedValueOnce({
        id: 'ins-1',
        tenantId: 't-1',
        memberId: 'm-1',
        configId: 'cfg-1',
        templateCode: 'FLASH_SALE',
        status: PlayInstanceStatus.PAID,
        instanceData: {},
      });
    mockRepo.updateStatus.mockResolvedValue({
      id: 'ins-1',
      tenantId: 't-1',
      memberId: 'm-1',
      configId: 'cfg-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.PAID,
      instanceData: {},
    });

    await service.handlePaymentSuccessById('order-123');

    expect(mockRepo.findByOrderId).toHaveBeenCalledWith('order-123');
    expect(mockIdempotencyService.markPaymentProcessed).toHaveBeenCalledWith('order-123');
    expect(mockPlayHandler.applyRewards).toHaveBeenCalled();
  });

  it('Given handler applyRewards 失败, When handlePaymentSuccessById, Then 不提前标记支付已处理', async () => {
    mockIdempotencyService.checkPaymentIdempotency.mockResolvedValue(false);
    mockRepo.findByOrderId.mockResolvedValue({
      id: 'ins-cg-1',
      tenantId: 't-1',
      memberId: 'm-1',
      configId: 'cfg-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.PENDING_PAY,
      instanceData: {},
    });
    mockRepo.findById
      .mockResolvedValueOnce({
        id: 'ins-cg-1',
        tenantId: 't-1',
        memberId: 'm-1',
        configId: 'cfg-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.PENDING_PAY,
        instanceData: {},
      })
      .mockResolvedValueOnce({
        id: 'ins-cg-1',
        tenantId: 't-1',
        memberId: 'm-1',
        configId: 'cfg-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.PAID,
        instanceData: {},
      });
    mockRepo.updateStatus.mockResolvedValue({
      id: 'ins-cg-1',
      tenantId: 't-1',
      memberId: 'm-1',
      configId: 'cfg-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.PAID,
      instanceData: {},
    });
    mockPlayHandler.applyRewards.mockRejectedValueOnce(new Error('course-group reconcile failed'));

    await expect(service.handlePaymentSuccessById('order-failed')).rejects.toThrow('course-group reconcile failed');

    expect(mockIdempotencyService.markPaymentProcessed).not.toHaveBeenCalled();
  });

  it('Given 支付实例已是 PAID 且幂等标记缺失, When handlePaymentSuccessById 重试, Then 不重复流转 PAID 但继续执行策略并补标记', async () => {
    mockIdempotencyService.checkPaymentIdempotency.mockResolvedValue(false);
    mockRepo.findByOrderId.mockResolvedValue({
      id: 'ins-paid-1',
      tenantId: 't-1',
      memberId: 'm-1',
      configId: 'cfg-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.PAID,
      instanceData: {},
    });
    const transitSpy = jest.spyOn(service, 'transitStatus').mockResolvedValue({ data: null } as never);

    await service.handlePaymentSuccessById('order-paid-retry');

    expect(transitSpy).not.toHaveBeenCalled();
    expect(mockPlayHandler.applyRewards).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: 'm-1',
        instance: expect.objectContaining({
          id: 'ins-paid-1',
          status: PlayInstanceStatus.PAID,
        }),
      }),
    );
    expect(mockIdempotencyService.markPaymentProcessed).toHaveBeenCalledWith('order-paid-retry');
  });

  it('Given orderId 无匹配实例, When handlePaymentSuccessById, Then 静默返回', async () => {
    mockIdempotencyService.checkPaymentIdempotency.mockResolvedValue(false);
    mockRepo.findByOrderId.mockResolvedValue(null);

    await service.handlePaymentSuccessById('non-exist');

    expect(mockIdempotencyService.markPaymentProcessed).not.toHaveBeenCalled();
  });

  it('Given 已处理过的 orderId, When handlePaymentSuccessById, Then 幂等返回', async () => {
    mockIdempotencyService.checkPaymentIdempotency.mockResolvedValue(true);

    await service.handlePaymentSuccessById('order-dup');

    expect(mockRepo.findByOrderId).not.toHaveBeenCalled();
  });

  it('Given 已处理过的 orderSn, When handlePaymentSuccess, Then 幂等返回', async () => {
    mockIdempotencyService.checkPaymentIdempotency.mockResolvedValue(true);

    await service.handlePaymentSuccess('ext-sn-001');

    expect(mockIdempotencyService.checkPaymentIdempotency).toHaveBeenCalledWith('ext-sn-001');
    expect(mockRepo.findByOrderSn).not.toHaveBeenCalled();
  });

  it('Given orderSn 查到的实例无 orderId, When handlePaymentSuccess, Then 走旧逻辑', async () => {
    mockRepo.findByOrderSn.mockResolvedValue({
      id: 'ins-2',
      orderId: null,
      tenantId: 't-1',
      memberId: 'm-1',
      configId: 'cfg-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.PENDING_PAY,
      instanceData: {},
    });
    mockIdempotencyService.checkPaymentIdempotency.mockResolvedValue(false);
    mockRepo.findById
      .mockResolvedValueOnce({
        id: 'ins-2',
        tenantId: 't-1',
        memberId: 'm-1',
        configId: 'cfg-1',
        templateCode: 'FLASH_SALE',
        status: PlayInstanceStatus.PENDING_PAY,
        instanceData: {},
      })
      .mockResolvedValueOnce({
        id: 'ins-2',
        tenantId: 't-1',
        memberId: 'm-1',
        configId: 'cfg-1',
        templateCode: 'FLASH_SALE',
        status: PlayInstanceStatus.PAID,
        instanceData: {},
      });
    mockRepo.updateStatus.mockResolvedValue({
      id: 'ins-2',
      tenantId: 't-1',
      memberId: 'm-1',
      configId: 'cfg-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.PAID,
      instanceData: {},
    });

    await service.handlePaymentSuccess('ext-sn-002');

    expect(mockIdempotencyService.checkPaymentIdempotency).toHaveBeenCalledWith('ext-sn-002');
    expect(mockIdempotencyService.markPaymentProcessed).toHaveBeenCalledWith('ext-sn-002');
    expect(mockPlayHandler.applyRewards).toHaveBeenCalled();
  });

  it('Given instanceData 包含 orderId, When transitStatus 到 PAID, Then 同步 orderId 到标量字段', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'ins-1',
      configId: 'cfg-1',
      memberId: 'm-1',
      tenantId: 't-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.PENDING_PAY,
      instanceData: { orderId: 'order-456' },
    });
    mockRepo.updateStatus.mockResolvedValue({
      id: 'ins-1',
      configId: 'cfg-1',
      memberId: 'm-1',
      tenantId: 't-1',
      templateCode: 'FLASH_SALE',
      status: PlayInstanceStatus.PAID,
      instanceData: { orderId: 'order-456' },
    });

    await service.transitStatus('ins-1', PlayInstanceStatus.PAID);

    expect(mockRepo.updateOrderBinding).toHaveBeenCalledWith('ins-1', 'order-456');
  });

  describe('findOneForClient', () => {
    it('Given 未登录 memberId 为空, When findOneForClient, Then 拒绝', async () => {
      await expect(service.findOneForClient('ins-x', '')).rejects.toBeInstanceOf(BusinessException);
    });

    it('Given 非本人实例, When findOneForClient, Then 拒绝', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'ins-x',
        memberId: 'other',
        templateCode: 'FLASH_SALE',
        instanceData: {},
        config: { id: 'c1', rules: {} },
      } as never);

      await expect(service.findOneForClient('ins-x', 'm-self')).rejects.toBeInstanceOf(BusinessException);
    });

    it('Given 本人实例, When findOneForClient, Then 返回详情', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'ins-x',
        memberId: 'm-self',
        templateCode: 'FLASH_SALE',
        instanceData: {},
        config: { id: 'c1', rules: {} },
        tenantId: 't1',
        configId: 'c1',
        status: PlayInstanceStatus.ACTIVE,
      } as never);
      mockPlayHandler.getDisplayData.mockResolvedValue({ progress: 1 });

      const res = await service.findOneForClient('ins-x', 'm-self');

      expect(res.data.memberId).toBe('m-self');
      expect(res.data.displayData).toEqual({ progress: 1 });
    });
  });
});
