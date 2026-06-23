import { OrderMarketingContractService } from './order-marketing-contract.service';

describe('OrderMarketingContractService', () => {
  const prisma = {
    omsOrder: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    omsOrderItem: {
      updateMany: jest.fn(),
    },
  };
  const tenantHelper = {
    readWhereForDelegate: jest.fn(),
  };
  let service: OrderMarketingContractService;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantHelper.readWhereForDelegate.mockImplementation((_delegate, where) => ({
      ...where,
      tenantId: 'tenant-1',
    }));
    service = new OrderMarketingContractService(prisma as never, tenantHelper as never);
  });

  describe('invariants', () => {
    it('queries orders through tenant-aware where clauses', async () => {
      prisma.omsOrder.findFirst.mockResolvedValue(null);

      await service.findByIdForMarketing('order-1');

      expect(tenantHelper.readWhereForDelegate).toHaveBeenCalledWith('omsOrder', { id: 'order-1' });
      expect(prisma.omsOrder.findFirst).toHaveBeenCalledWith({
        where: { id: 'order-1', tenantId: 'tenant-1' },
        include: undefined,
      });
    });

    it('includes order items only when requested', async () => {
      prisma.omsOrder.findFirst.mockResolvedValue(null);

      await service.findByIdForMarketing('order-1', true);

      expect(prisma.omsOrder.findFirst).toHaveBeenCalledWith({
        where: { id: 'order-1', tenantId: 'tenant-1' },
        include: { items: true },
      });
    });

    it('updates every item point row before writing the order total', async () => {
      prisma.omsOrderItem.updateMany.mockResolvedValue({ count: 1 });
      prisma.omsOrder.updateMany.mockResolvedValue({ count: 1 });

      await service.updateOrderPointsEarned(
        'order-1',
        [
          { skuId: 'sku-1', earnedPoints: 10 },
          { skuId: 'sku-2', earnedPoints: 20 },
        ],
        30,
      );

      expect(prisma.omsOrderItem.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.omsOrderItem.updateMany).toHaveBeenNthCalledWith(1, {
        where: { orderId: 'order-1', skuId: 'sku-1', tenantId: 'tenant-1' },
        data: { earnedPoints: 10 },
      });
      expect(prisma.omsOrderItem.updateMany).toHaveBeenNthCalledWith(2, {
        where: { orderId: 'order-1', skuId: 'sku-2', tenantId: 'tenant-1' },
        data: { earnedPoints: 20 },
      });
      expect(prisma.omsOrder.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', tenantId: 'tenant-1' },
        data: { pointsEarned: 30 },
      });
    });
  });

  describe('adversarial inputs', () => {
    it('still writes the order total when there are no item point rows', async () => {
      prisma.omsOrder.updateMany.mockResolvedValue({ count: 1 });

      await service.updateOrderPointsEarned('order-1', [], 0);

      expect(prisma.omsOrderItem.updateMany).not.toHaveBeenCalled();
      expect(prisma.omsOrder.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', tenantId: 'tenant-1' },
        data: { pointsEarned: 0 },
      });
    });

    it('propagates item update failures without writing the order total', async () => {
      prisma.omsOrderItem.updateMany.mockRejectedValue(new Error('db failed'));

      await expect(
        service.updateOrderPointsEarned('order-1', [{ skuId: 'sku-1', earnedPoints: 10 }], 10),
      ).rejects.toThrow('db failed');

      expect(prisma.omsOrder.updateMany).not.toHaveBeenCalled();
    });

    it('rejects stale or cross-tenant order updates when the scoped order is not found', async () => {
      prisma.omsOrder.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.updateOrderPointsEarned('order-1', [], 0)).rejects.toMatchObject({
        errorCode: 404,
      });
    });
  });

  describe('boundary conditions', () => {
    it('returns null when the order is not found by id', async () => {
      prisma.omsOrder.findFirst.mockResolvedValue(null);

      await expect(service.findByIdForMarketing('missing')).resolves.toBeNull();
    });

    it('returns null when the order is not found by orderSn', async () => {
      prisma.omsOrder.findFirst.mockResolvedValue(null);

      await expect(service.findBySnForMarketing('SN404')).resolves.toBeNull();
      expect(prisma.omsOrder.findFirst).toHaveBeenCalledWith({
        where: { orderSn: 'SN404', tenantId: 'tenant-1' },
        select: {
          id: true,
          tenantId: true,
          memberId: true,
          orderSn: true,
        },
      });
    });
  });
});
