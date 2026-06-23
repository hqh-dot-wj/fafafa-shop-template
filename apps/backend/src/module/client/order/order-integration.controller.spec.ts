import { Result } from 'src/common/response/result';
import type { OrderDiscountVo } from 'src/module/marketing/integration/vo/order-discount.vo';
import { OrderIntegrationController } from './order-integration.controller';
import { OrderMarketingPort } from './ports/order-marketing.port';

describe('OrderIntegrationController', () => {
  const marketingPort = {
    calculateDiscountPreview: jest.fn(),
  } as unknown as jest.Mocked<Pick<OrderMarketingPort, 'calculateDiscountPreview'>>;

  let controller: OrderIntegrationController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OrderIntegrationController(marketingPort as unknown as OrderMarketingPort);
  });

  it('Given discount request, When calculateDiscount, Then delegate to order marketing port', async () => {
    const response = Result.ok({
      originalAmount: 100,
      couponDiscount: 10,
      pointsDiscount: 5,
      totalDiscount: 15,
      finalAmount: 85,
      userCouponId: 'coupon-1',
      pointsUsed: 100,
      couponName: '新人券',
    } satisfies OrderDiscountVo);
    marketingPort.calculateDiscountPreview.mockResolvedValue(response);

    const result = await controller.calculateDiscount('member-1', {
      items: [
        {
          productId: 'product-1',
          productName: '课程',
          price: 100,
          quantity: 1,
        },
      ],
      userCouponId: 'coupon-1',
      pointsUsed: 100,
    });

    expect(result).toBe(response);
    expect(marketingPort.calculateDiscountPreview).toHaveBeenCalledWith('member-1', {
      items: [
        {
          productId: 'product-1',
          productName: '课程',
          price: 100,
          quantity: 1,
        },
      ],
      userCouponId: 'coupon-1',
      pointsUsed: 100,
    });
  });
});
