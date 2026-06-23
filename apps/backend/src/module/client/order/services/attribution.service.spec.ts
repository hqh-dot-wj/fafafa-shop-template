import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { AttributionService } from './attribution.service';

describe('AttributionService', () => {
  let service: AttributionService;

  const mockPrisma = {
    umsMember: {
      findFirst: jest.fn(),
    },
    omsCartItem: {
      findFirst: jest.fn(),
    },
  };

  const mockRedis = {
    get: jest.fn(),
  };

  const mockTenantHelper = {
    readWhereForDelegate: jest.fn().mockImplementation((_model: string, where: unknown) => where),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: TenantHelper, useValue: mockTenantHelper },
      ],
    }).compile();

    service = module.get<AttributionService>(AttributionService);
    jest.clearAllMocks();
  });

  it('returns input share user first when present', async () => {
    const result = await service.getFinalAttribution('member_001', 'share_001');

    expect(result).toEqual({
      shareUserId: 'share_001',
    });
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('reads cart last-touch shareUserId when tenantId provided (legacy: no cartSkuIds)', async () => {
    mockPrisma.omsCartItem.findFirst.mockResolvedValue({ shareUserId: 'share_cart' });
    mockRedis.get.mockResolvedValue(null);

    const result = await service.getFinalAttribution('member_001', undefined, { tenantId: 'tenant_001' });

    expect(result).toEqual({ shareUserId: 'share_cart', sourceChannel: 'CART_SID' });
    expect(mockPrisma.omsCartItem.findFirst).toHaveBeenCalledWith({
      where: { memberId: 'member_001', tenantId: 'tenant_001', shareUserId: { not: null } },
      orderBy: { updateTime: 'desc' },
      select: { shareUserId: true },
    });
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('limits cart last-touch query to the submitted skuIds', async () => {
    mockPrisma.omsCartItem.findFirst.mockResolvedValue({ shareUserId: 'share_cart' });
    mockRedis.get.mockResolvedValue(null);

    const result = await service.getFinalAttribution('member_001', undefined, {
      tenantId: 'tenant_001',
      cartSkuIds: ['sku-a', 'sku-b'],
    });

    expect(result).toEqual({ shareUserId: 'share_cart', sourceChannel: 'CART_SID' });
    expect(mockPrisma.omsCartItem.findFirst).toHaveBeenCalledWith({
      where: {
        memberId: 'member_001',
        tenantId: 'tenant_001',
        shareUserId: { not: null },
        skuId: { in: ['sku-a', 'sku-b'] },
      },
      orderBy: { updateTime: 'desc' },
      select: { shareUserId: true },
    });
  });

  it('skips cart fallback entirely when cartSkuIds is empty (direct-buy)', async () => {
    mockRedis.get.mockResolvedValue('share_redis');

    const result = await service.getFinalShareUserId('member_001', undefined, {
      tenantId: 'tenant_001',
      cartSkuIds: [],
    });

    expect(result).toBe('share_redis');
    expect(mockPrisma.omsCartItem.findFirst).not.toHaveBeenCalled();
  });

  it('ignores cart shareUserId when it equals self memberId', async () => {
    mockPrisma.omsCartItem.findFirst.mockResolvedValue({ shareUserId: 'member_001' });
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.umsMember.findFirst.mockResolvedValue({ parentId: null });

    const result = await service.getFinalShareUserId('member_001', undefined, { tenantId: 'tenant_001' });

    expect(result).toBeNull();
    expect(mockRedis.get).toHaveBeenCalled();
  });

  it('falls back to redis when cart row has no shareUserId', async () => {
    mockPrisma.omsCartItem.findFirst.mockResolvedValue(null);
    mockRedis.get.mockResolvedValue('share_redis');

    const result = await service.getFinalShareUserId('member_001', undefined, { tenantId: 'tenant_001' });

    expect(result).toBe('share_redis');
  });

  it('reads redis attribution metadata when cache is json', async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify({
        shareUserId: 'share_redis',
        activityVersionId: 'MKT_V20260419',
        attributionWindowMinutes: 2880,
        sourceChannel: 'SHARE_LINK',
      }),
    );

    const result = await service.getFinalAttribution('member_001');

    expect(result).toEqual({
      shareUserId: 'share_redis',
      activityVersionId: 'MKT_V20260419',
      attributionWindowMinutes: 2880,
      sourceChannel: 'SHARE_LINK',
    });
  });

  it('supports legacy redis string payload', async () => {
    mockRedis.get.mockResolvedValue('share_legacy');

    const result = await service.getFinalShareUserId('member_001');

    expect(result).toBe('share_legacy');
  });

  it('falls back to parent relation when cache is missing', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.umsMember.findFirst.mockResolvedValue({ parentId: 'share_parent' });

    const result = await service.getFinalShareUserId('member_001');

    expect(result).toBe('share_parent');
    expect(mockPrisma.umsMember.findFirst).toHaveBeenCalledWith({
      where: { memberId: 'member_001' },
      select: { parentId: true },
    });
  });
});
