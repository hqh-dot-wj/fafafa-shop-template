import { Test } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { BatchLockService } from './batch-lock.service';
import { BatchValidationService } from './batch-validation.service';

describe('BatchValidationService', () => {
  let service: BatchValidationService;
  let batchLockService: { validateAndLock: jest.Mock };

  beforeEach(async () => {
    batchLockService = {
      validateAndLock: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [BatchValidationService, { provide: BatchLockService, useValue: batchLockService }],
    }).compile();

    service = module.get(BatchValidationService);
  });

  it('应跳过无 activityContextKey 的行并保留结果长度', async () => {
    batchLockService.validateAndLock.mockResolvedValue({
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

    const results = await service.validateAndLockLines([
      {
        tenantId: 't1',
        memberId: 'm1',
        productId: 'p-no-key',
        skuId: 's-no-key',
      },
      {
        tenantId: 't1',
        memberId: 'm1',
        productId: 'p1',
        skuId: 's1',
        activityContextKey: 'FLASH:c1',
        scene: 'CHECKOUT_PREVIEW',
      },
    ]);

    expect(batchLockService.validateAndLock).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
    expect(results[0]).toBeNull();
    expect(results[1]?.activityContextKey).toBe('FLASH:c1');
  });

  it('单条校验失败时应返回 null 并回调 onItemFailed', async () => {
    batchLockService.validateAndLock.mockRejectedValue(new Error('validate failed'));
    const onItemFailed = jest.fn();

    const results = await service.validateAndLockLines(
      [
        {
          tenantId: 't1',
          memberId: 'm1',
          productId: 'p1',
          skuId: 's1',
          activityContextKey: 'FLASH:c1',
          scene: 'CHECKOUT_PREVIEW',
        },
      ],
      { onItemFailed },
    );

    expect(results).toEqual([null]);
    expect(onItemFailed).toHaveBeenCalledTimes(1);
  });

  it('token 校验失败时应直接抛出，避免篡改 token 静默按原价下单', async () => {
    const error = new BusinessException(ResponseCode.TOKEN_INVALID, '活动上下文签名校验失败');
    batchLockService.validateAndLock.mockRejectedValue(error);

    await expect(
      service.validateAndLockLines([
        {
          tenantId: 't1',
          memberId: 'm1',
          productId: 'p1',
          skuId: 's1',
          activityContextKey: 'bad-token',
        },
      ]),
    ).rejects.toBe(error);
  });
});
