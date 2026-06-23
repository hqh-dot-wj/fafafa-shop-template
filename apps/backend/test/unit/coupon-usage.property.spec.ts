import { Test, TestingModule } from '@nestjs/testing';
import { CouponType, UserCouponStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as fc from 'fast-check';
import { ORDER_SERVICE } from '../../src/module/client/order/order-service.token';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MessageTouchpointDispatcher } from '../../src/module/marketing/events/message-touchpoint.dispatcher';
import { UserCouponRepository } from '../../src/module/marketing/coupon/distribution/user-coupon.repository';
import { CouponTemplateRepository } from '../../src/module/marketing/coupon/template/template.repository';
import { CouponUsageRepository } from '../../src/module/marketing/coupon/usage/usage.repository';
import { CouponUsageService } from '../../src/module/marketing/coupon/usage/usage.service';

describe('CouponUsageService - Property-Based Tests', () => {
  let service: CouponUsageService;

  const mockUserCouponRepo = {
    findById: jest.fn(),
    findAvailableCoupons: jest.fn(),
    lockCoupon: jest.fn(),
    useCoupon: jest.fn(),
    unlockCoupon: jest.fn(),
    refundCoupon: jest.fn(),
    refundCouponWithExtend: jest.fn(),
  };

  const mockUsageRepo = {
    create: jest.fn(),
  };

  const mockTemplateRepo = {
    findById: jest.fn(),
  };

  const mockPrisma = {
    mktCouponRefundCompensation: {
      upsert: jest.fn(),
    },
  };

  const mockOrderService = {
    findByIdForMarketing: jest.fn(),
    updateOrderPointsEarned: jest.fn(),
  };

  const mockMessageTouchpointDispatcher = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };

  const couponWithTemplate = (
    coupon: Record<string, unknown>,
    applicableProducts: string[] = [],
    applicableCategories: number[] = [],
  ) => ({
    ...coupon,
    template: {
      applicableProducts,
      applicableCategories,
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponUsageService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserCouponRepository, useValue: mockUserCouponRepo },
        { provide: CouponTemplateRepository, useValue: mockTemplateRepo },
        { provide: CouponUsageRepository, useValue: mockUsageRepo },
        { provide: ORDER_SERVICE, useValue: mockOrderService },
        { provide: MessageTouchpointDispatcher, useValue: mockMessageTouchpointDispatcher },
      ],
    }).compile();

    service = module.get<CouponUsageService>(CouponUsageService);
    mockUsageRepo.create.mockResolvedValue({});
    mockOrderService.findByIdForMarketing.mockResolvedValue({ totalAmount: new Decimal(0) });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Property 2: 优惠券不可重复使用', () => {
    it('should prevent reusing a coupon when repository compare-and-swap fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            couponId: fc.uuid(),
            orderId: fc.uuid(),
          }),
          async ({ couponId, orderId }) => {
            mockUserCouponRepo.lockCoupon.mockResolvedValue({ count: 0 });

            await expect(service.lockCoupon(couponId, orderId)).rejects.toThrow();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should lock an available coupon atomically', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            couponId: fc.uuid(),
            orderId: fc.uuid(),
          }),
          async ({ couponId, orderId }) => {
            mockUserCouponRepo.lockCoupon.mockResolvedValue({ count: 1 });

            await expect(service.lockCoupon(couponId, orderId)).resolves.toBeUndefined();
            expect(mockUserCouponRepo.lockCoupon).toHaveBeenCalledWith(couponId, orderId);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Property 3: 优惠券金额计算正确性', () => {
    it('should calculate discount amount correctly for discount coupons', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            couponId: fc.uuid(),
            discountAmount: fc.integer({ min: 1, max: 500 }),
            minOrderAmount: fc.integer({ min: 1, max: 1000 }),
            orderAmount: fc.integer({ min: 1, max: 2000 }),
          }),
          async ({ couponId, discountAmount, minOrderAmount, orderAmount }) => {
            mockUserCouponRepo.findById.mockResolvedValue({
              id: couponId,
              couponType: CouponType.DISCOUNT,
              discountAmount: new Decimal(discountAmount),
              minOrderAmount: new Decimal(minOrderAmount),
            });

            const result = await service.calculateDiscount(couponId, orderAmount);

            expect(result).toBe(Math.min(discountAmount, orderAmount));
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should respect max discount amount for percentage coupons', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            couponId: fc.uuid(),
            discountPercent: fc.integer({ min: 1, max: 99 }),
            maxDiscountAmount: fc.option(fc.integer({ min: 10, max: 500 }), { nil: null }),
            orderAmount: fc.integer({ min: 100, max: 2000 }),
          }),
          async ({ couponId, discountPercent, maxDiscountAmount, orderAmount }) => {
            mockUserCouponRepo.findById.mockResolvedValue({
              id: couponId,
              couponType: CouponType.PERCENTAGE,
              discountPercent,
              maxDiscountAmount: maxDiscountAmount ? new Decimal(maxDiscountAmount) : null,
              minOrderAmount: new Decimal(0),
            });

            const result = await service.calculateDiscount(couponId, orderAmount);
            const expected = Math.min(
              (orderAmount * discountPercent) / 100,
              maxDiscountAmount ?? Number.POSITIVE_INFINITY,
              orderAmount,
            );

            expect(Math.abs(result - expected)).toBeLessThan(0.01);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Property 5: 优惠券状态转换原子性', () => {
    it('should ensure atomic state transition when using coupon', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            couponId: fc.uuid(),
            orderId: fc.uuid(),
            memberId: fc.uuid(),
            tenantId: fc.string({ minLength: 6, maxLength: 20 }),
            discountAmount: fc.integer({ min: 1, max: 500 }),
            orderAmount: fc.integer({ min: 100, max: 2000 }),
          }),
          async ({ couponId, orderId, memberId, tenantId, discountAmount, orderAmount }) => {
            mockUserCouponRepo.findById.mockResolvedValue({
              id: couponId,
              memberId,
              tenantId,
              templateId: 'template-001',
              status: UserCouponStatus.LOCKED,
              couponType: CouponType.DISCOUNT,
              discountAmount: new Decimal(discountAmount),
            });
            mockUserCouponRepo.useCoupon.mockResolvedValue({ count: 1 });
            mockUsageRepo.create.mockResolvedValue({});
            mockOrderService.findByIdForMarketing.mockResolvedValue({
              totalAmount: new Decimal(orderAmount),
            });

            await expect(service.useCoupon(couponId, orderId, discountAmount)).resolves.toBeUndefined();

            expect(mockUserCouponRepo.useCoupon).toHaveBeenCalledWith(couponId, orderId);
            expect(mockUsageRepo.create).toHaveBeenCalledWith(
              expect.objectContaining({
                memberId,
                orderId,
                userCoupon: { connect: { id: couponId } },
              }),
            );
            expect(mockMessageTouchpointDispatcher.dispatch).toHaveBeenCalled();
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Property 7: 优惠券有效期验证', () => {
    it('should reject coupons outside valid time range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            couponId: fc.uuid(),
            memberId: fc.uuid(),
            orderAmount: fc.integer({ min: 100, max: 2000 }),
            timeOffset: fc.integer({ min: -365, max: 365 }).filter((offset) => offset < -1 || offset > 1),
          }),
          async ({ couponId, memberId, orderAmount, timeOffset }) => {
            const now = new Date();
            const startTime = new Date(now.getTime() + timeOffset * 86400000);
            const endTime = new Date(startTime.getTime() + 86400000);

            mockUserCouponRepo.findById.mockResolvedValue(
              couponWithTemplate({
                id: couponId,
                memberId,
                status: UserCouponStatus.UNUSED,
                couponType: CouponType.DISCOUNT,
                discountAmount: new Decimal(20),
                minOrderAmount: new Decimal(0),
                startTime,
                endTime,
              }),
            );

            await expect(
              service.validateCoupon(couponId, {
                memberId,
                orderAmount,
                productIds: [],
                categoryIds: [],
              }),
            ).rejects.toThrow();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should accept coupons within valid time range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            couponId: fc.uuid(),
            memberId: fc.uuid(),
            orderAmount: fc.integer({ min: 100, max: 2000 }),
          }),
          async ({ couponId, memberId, orderAmount }) => {
            const now = new Date();

            mockUserCouponRepo.findById.mockResolvedValue(
              couponWithTemplate({
                id: couponId,
                memberId,
                status: UserCouponStatus.UNUSED,
                couponType: CouponType.DISCOUNT,
                discountAmount: new Decimal(20),
                minOrderAmount: new Decimal(0),
                startTime: new Date(now.getTime() - 86400000),
                endTime: new Date(now.getTime() + 86400000),
              }),
            );

            const result = await service.validateCoupon(couponId, {
              memberId,
              orderAmount,
              productIds: [],
              categoryIds: [],
            });

            expect(result.data.valid).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Property 8: 优惠券适用范围验证', () => {
    it('should validate applicable products correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            couponId: fc.uuid(),
            memberId: fc.uuid(),
            orderAmount: fc.integer({ min: 100, max: 2000 }),
            applicableProducts: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
            orderProducts: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          }),
          async ({ couponId, memberId, orderAmount, applicableProducts, orderProducts }) => {
            const now = new Date();
            mockUserCouponRepo.findById.mockResolvedValue(
              couponWithTemplate(
                {
                  id: couponId,
                  memberId,
                  status: UserCouponStatus.UNUSED,
                  couponType: CouponType.DISCOUNT,
                  discountAmount: new Decimal(20),
                  minOrderAmount: new Decimal(0),
                  startTime: new Date(now.getTime() - 86400000),
                  endTime: new Date(now.getTime() + 86400000),
                },
                applicableProducts,
              ),
            );

            const assertion = service.validateCoupon(couponId, {
              memberId,
              orderAmount,
              productIds: orderProducts,
              categoryIds: [],
            });

            if (orderProducts.some((productId) => applicableProducts.includes(productId))) {
              await expect(assertion).resolves.toMatchObject({ data: { valid: true } });
            } else {
              await expect(assertion).rejects.toThrow();
            }
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should validate applicable categories correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            couponId: fc.uuid(),
            memberId: fc.uuid(),
            orderAmount: fc.integer({ min: 100, max: 2000 }),
            applicableCategories: fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }),
            orderCategories: fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }),
          }),
          async ({ couponId, memberId, orderAmount, applicableCategories, orderCategories }) => {
            const now = new Date();
            mockUserCouponRepo.findById.mockResolvedValue(
              couponWithTemplate(
                {
                  id: couponId,
                  memberId,
                  status: UserCouponStatus.UNUSED,
                  couponType: CouponType.DISCOUNT,
                  discountAmount: new Decimal(20),
                  minOrderAmount: new Decimal(0),
                  startTime: new Date(now.getTime() - 86400000),
                  endTime: new Date(now.getTime() + 86400000),
                },
                [],
                applicableCategories,
              ),
            );

            const assertion = service.validateCoupon(couponId, {
              memberId,
              orderAmount,
              productIds: [],
              categoryIds: orderCategories,
            });

            if (orderCategories.some((categoryId) => applicableCategories.includes(categoryId))) {
              await expect(assertion).resolves.toMatchObject({ data: { valid: true } });
            } else {
              await expect(assertion).rejects.toThrow();
            }
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should accept coupons with no restrictions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            couponId: fc.uuid(),
            memberId: fc.uuid(),
            orderAmount: fc.integer({ min: 100, max: 2000 }),
            orderProducts: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          }),
          async ({ couponId, memberId, orderAmount, orderProducts }) => {
            const now = new Date();
            mockUserCouponRepo.findById.mockResolvedValue(
              couponWithTemplate({
                id: couponId,
                memberId,
                status: UserCouponStatus.UNUSED,
                couponType: CouponType.DISCOUNT,
                discountAmount: new Decimal(20),
                minOrderAmount: new Decimal(0),
                startTime: new Date(now.getTime() - 86400000),
                endTime: new Date(now.getTime() + 86400000),
              }),
            );

            const result = await service.validateCoupon(couponId, {
              memberId,
              orderAmount,
              productIds: orderProducts,
              categoryIds: [],
            });

            expect(result.data.valid).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
