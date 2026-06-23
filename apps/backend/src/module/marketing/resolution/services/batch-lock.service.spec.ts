import { Test } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { ResolutionService } from '../resolution.service';
import { BatchLockService } from './batch-lock.service';

describe('BatchLockService', () => {
  let service: BatchLockService;
  let resolutionService: { validateAndLock: jest.Mock };

  beforeEach(async () => {
    resolutionService = {
      validateAndLock: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [BatchLockService, { provide: ResolutionService, useValue: resolutionService }],
    }).compile();

    service = module.get(BatchLockService);
  });

  it('应透传单条 validateAndLock 请求', async () => {
    resolutionService.validateAndLock.mockResolvedValue({
      activityContextKey: 'FLASH:c1',
      activityType: 'FLASH',
      configId: 'c1',
      activityName: '闪购',
      activityPrice: new Decimal(9.9),
      originalPrice: new Decimal(19.9),
      commissionMode: 'NONE',
      commissionRate: null,
      status: 'ON_SHELF',
    });

    const result = await service.validateAndLock({
      tenantId: 't1',
      memberId: 'm1',
      productId: 'p1',
      skuId: 's1',
      activityContextKey: 'FLASH:c1',
      scene: 'CHECKOUT_PREVIEW',
    });

    expect(resolutionService.validateAndLock).toHaveBeenCalledTimes(1);
    expect(result.activityContextKey).toBe('FLASH:c1');
  });
});
