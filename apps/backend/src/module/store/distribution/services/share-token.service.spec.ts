import { DistShareBizType, DistShareEventType, DistShareTokenStatus } from '@prisma/client';
import { ShareTokenService } from './share-token.service';

describe('ShareTokenService', () => {
  const mockPrisma = {
    umsMember: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    sysDistShareToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    sysDistShareEvent: {
      create: jest.fn(),
    },
  };
  const mockTenantHelper = {
    readWhereForDelegate: jest.fn((_model: string, where: unknown) => where),
  };
  const mockSharePolicyService = {
    getPolicy: jest.fn(),
  };
  const mockWechatService = {};
  const mockUploadService = {};
  const mockRedisService = {
    set: jest.fn(),
  };
  const mockAttributionConfigService = {
    getAttributionWindowMinutes: jest.fn(),
    getLinkExpireMinutes: jest.fn(),
  };
  const mockDistributorEligibilityService = {
    assertActive: jest.fn(),
    isActive: jest.fn(),
  };

  let service: ShareTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.umsMember.findFirst.mockImplementation(({ where }: { where: { memberId: string } }) => {
      if (where.memberId === 'member_001') {
        return Promise.resolve({ memberId: 'member_001', tenantId: 'tenant_001', parentId: null });
      }
      if (where.memberId === 'share_001') {
        return Promise.resolve({ memberId: 'share_001', tenantId: 'tenant_001', parentId: null });
      }
      return Promise.resolve(null);
    });
    mockPrisma.umsMember.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.sysDistShareToken.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'token_created',
        ...data,
        clickCount: 0,
        bindCount: 0,
        orderCount: 0,
        status: DistShareTokenStatus.ACTIVE,
      }),
    );
    mockPrisma.sysDistShareToken.findFirst.mockResolvedValue(null);
    mockPrisma.sysDistShareToken.findUnique.mockResolvedValue(null);
    mockPrisma.sysDistShareToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.sysDistShareEvent.create.mockResolvedValue({});
    mockSharePolicyService.getPolicy.mockResolvedValue({
      data: {
        enableCrossTenantBind: false,
        isActive: true,
        maxClickCount: 100,
        maxBindCount: 20,
        maxOrderCount: 20,
      },
    });
    mockAttributionConfigService.getAttributionWindowMinutes.mockResolvedValue(43200);
    mockAttributionConfigService.getLinkExpireMinutes.mockResolvedValue(1440);
    mockDistributorEligibilityService.assertActive.mockResolvedValue(undefined);
    mockDistributorEligibilityService.isActive.mockResolvedValue(true);

    service = new ShareTokenService(
      mockPrisma as never,
      mockTenantHelper as never,
      mockSharePolicyService as never,
      mockWechatService as never,
      mockUploadService as never,
      mockRedisService as never,
      mockAttributionConfigService as never,
      mockDistributorEligibilityService as never,
    );
  });

  it('createTokenForAdmin rejects inactive distributor before creating token', async () => {
    mockDistributorEligibilityService.assertActive.mockRejectedValue(new Error('inactive distributor'));

    await expect(
      service.createTokenForAdmin(
        'tenant_001',
        {
          shareUserId: 'share_001',
          bizType: DistShareBizType.PRODUCT,
          bizId: 'prod_001',
        },
        'admin',
      ),
    ).rejects.toThrow('inactive distributor');

    expect(mockPrisma.sysDistShareToken.create).not.toHaveBeenCalled();
  });

  it('createTokenForAdmin creates token only after distributor eligibility passes', async () => {
    const result = await service.createTokenForAdmin(
      'tenant_001',
      {
        shareUserId: 'share_001',
        bizType: DistShareBizType.PRODUCT,
        bizId: 'prod_001',
      },
      'admin',
    );

    expect(mockDistributorEligibilityService.assertActive).toHaveBeenCalledWith('tenant_001', 'share_001');
    expect(result.data?.shareUserId).toBe('share_001');
    expect(mockPrisma.sysDistShareToken.create).toHaveBeenCalled();
  });

  it('writes attribution cache with configured window converted to millisecond ttl', async () => {
    const token = {
      id: 'token_001',
      sid: 'DST_001',
      tenantId: 'tenant_001',
      shareUserId: 'share_001',
      bizType: DistShareBizType.ACTIVITY,
      bizId: 'activity-fallback',
      expireAt: new Date(Date.now() + 60_000),
      maxClickCount: 100,
      maxBindCount: 20,
      maxOrderCount: 20,
      clickCount: 1,
      bindCount: 0,
      orderCount: 0,
      status: DistShareTokenStatus.ACTIVE,
      metadata: {
        activityVersionId: 'activity-v1',
      },
      createBy: 'tester',
      createTime: new Date(),
      updateBy: 'tester',
      updateTime: new Date(),
    };

    const bound = await (
      service as unknown as {
        tryBindMember(token: typeof token, memberId: string): Promise<boolean>;
      }
    ).tryBindMember(token, 'member_001');

    expect(bound).toBe(true);
    expect(mockDistributorEligibilityService.isActive).toHaveBeenCalledWith('tenant_001', 'share_001');
    expect(mockAttributionConfigService.getAttributionWindowMinutes).toHaveBeenCalledWith({
      tenantId: 'tenant_001',
      activityVersionId: 'activity-v1',
    });
    expect(mockRedisService.set).toHaveBeenCalledWith(
      'attr:member:member_001',
      {
        shareUserId: 'share_001',
        activityVersionId: 'activity-v1',
        attributionWindowMinutes: 43200,
        sourceChannel: 'DIST_SHARE_TOKEN',
      },
      43200 * 60 * 1000,
    );
  });

  it('tryBindMember silently skips when share member is not active distributor', async () => {
    mockDistributorEligibilityService.isActive.mockResolvedValue(false);
    const token = {
      id: 'token_001',
      sid: 'DST_001',
      tenantId: 'tenant_001',
      shareUserId: 'share_001',
      bizType: DistShareBizType.PRODUCT,
      bizId: 'prod_001',
      expireAt: new Date(Date.now() + 60_000),
      maxClickCount: 100,
      maxBindCount: 20,
      maxOrderCount: 20,
      clickCount: 1,
      bindCount: 0,
      orderCount: 0,
      status: DistShareTokenStatus.ACTIVE,
      metadata: null,
      createBy: 'tester',
      createTime: new Date(),
      updateBy: 'tester',
      updateTime: new Date(),
    };

    const bound = await (
      service as unknown as {
        tryBindMember(token: typeof token, memberId: string): Promise<boolean>;
      }
    ).tryBindMember(token, 'member_001');

    expect(bound).toBe(false);
    expect(mockPrisma.umsMember.updateMany).not.toHaveBeenCalled();
    expect(mockRedisService.set).not.toHaveBeenCalled();
  });

  it('applySidOrderCountIncrement increments active token and writes server event', async () => {
    mockPrisma.sysDistShareToken.findFirst.mockResolvedValue({
      id: 'token_001',
      sid: 'DST_001',
      tenantId: 'tenant_001',
      shareUserId: 'share_001',
      bizType: DistShareBizType.PRODUCT,
      bizId: 'prod_001',
      maxOrderCount: 3,
      orderCount: 0,
      status: DistShareTokenStatus.ACTIVE,
    });
    mockPrisma.sysDistShareToken.updateMany.mockResolvedValueOnce({ count: 1 });

    const applied = await service.applySidOrderCountIncrement('DST_001', {
      tenantId: 'tenant_001',
      orderId: 'order_001',
      memberId: 'member_001',
    });

    expect(applied).toBe(true);
    expect(mockPrisma.sysDistShareToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orderCount: { lt: 3 },
          status: { not: DistShareTokenStatus.DISABLED },
        }),
        data: expect.objectContaining({
          orderCount: { increment: 1 },
          updateBy: 'order.paid.worker',
        }),
      }),
    );
    expect(mockPrisma.sysDistShareEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sid: 'DST_001',
          eventType: DistShareEventType.ORDER_ATTRIBUTED,
          orderId: 'order_001',
        }),
      }),
    );
  });

  it('applySidOrderCountDecrement decrements count and writes refund reversal event', async () => {
    mockPrisma.sysDistShareToken.findFirst.mockResolvedValue({
      id: 'token_001',
      sid: 'DST_001',
      tenantId: 'tenant_001',
      shareUserId: 'share_001',
      bizType: DistShareBizType.PRODUCT,
      bizId: 'prod_001',
      maxOrderCount: 3,
      orderCount: 1,
      status: DistShareTokenStatus.EXPIRED,
    });
    mockPrisma.sysDistShareToken.updateMany.mockResolvedValueOnce({ count: 1 });

    const applied = await service.applySidOrderCountDecrement('DST_001', {
      tenantId: 'tenant_001',
      orderId: 'order_001',
      memberId: 'member_001',
    });

    expect(applied).toBe(true);
    expect(mockPrisma.sysDistShareToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderCount: { decrement: 1 },
          updateBy: 'order.refund.worker',
        }),
      }),
    );
    expect(mockPrisma.sysDistShareEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: DistShareEventType.ORDER_REFUND_REVERSED,
          orderId: 'order_001',
        }),
      }),
    );
  });
});
