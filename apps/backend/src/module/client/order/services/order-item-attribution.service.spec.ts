import { Test } from '@nestjs/testing';
import { OrderItemAttributionService } from './order-item-attribution.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('OrderItemAttributionService', () => {
  let service: OrderItemAttributionService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = {
      omsOrderItemAttribution: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      rptOrderItemMarketingFact: {
        upsert: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
    } as any;

    const module = await Test.createTestingModule({
      providers: [OrderItemAttributionService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(OrderItemAttributionService);
  });

  describe('createFromPreview', () => {
    it('should create attribution record with scene context', async () => {
      const previewItem = {
        tenantId: 'T001',
        entrySceneCode: 'HOME_FEATURED',
        entryModuleCode: 'FLASH_SALE',
        cardTemplateCode: 'CARD_A',
        resolverPolicyCode: 'POLICY_001',
        secondaryBenefits: [],
        activityContextKey: 'ACT_123',
        activityVersionId: 'MKT_V20260419',
        attributionWindowMinutes: 4320,
        channel: 'MINIAPP',
        shareChannel: 'SHARE_LINK',
        sid: 'DST_001',
      } as any;

      await service.createFromPreview(previewItem, 100, 'share1', 'ref1');

      expect(prisma.omsOrderItemAttribution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderItemId: 100,
            tenantId: 'T001',
            sourceSceneCodeSnapshot: 'HOME_FEATURED',
            sourceChannelSnapshot: 'SHARE_LINK',
            shareUserIdSnapshot: 'share1',
            referrerIdSnapshot: 'ref1',
            entryContextSnapshot: expect.objectContaining({
              activityVersionId: 'MKT_V20260419',
              attributionWindowMinutes: 4320,
              sid: 'DST_001',
              shareChannel: 'SHARE_LINK',
            }),
          }),
        }),
      );
    });
  });

  describe('writeOrderItemFact', () => {
    it('should upsert marketing fact with scene codes', async () => {
      const orderItem = {
        id: 100,
        tenantId: 'T001',
        activityType: 'DISCOUNT',
        orderItemFinalPaid: { toString: () => '99.00' } as any,
        totalAmount: { toString: () => '120.00' } as any,
      } as any;
      const attribution = {
        sourceSceneCodeSnapshot: 'HOME_FEATURED',
        sourceModuleCodeSnapshot: 'FLASH_SALE',
      } as any;

      await service.writeOrderItemFact(orderItem, attribution);

      expect(prisma.rptOrderItemMarketingFact.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderItemId: 100 },
        }),
      );
    });
  });
});
