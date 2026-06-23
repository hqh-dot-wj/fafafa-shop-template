import { Test } from '@nestjs/testing';
import { ReportFactService } from './report-fact.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('ReportFactService', () => {
  let service: ReportFactService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = {
      rptOrderItemMarketingFact: {
        upsert: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        ReportFactService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ReportFactService);
  });

  it('should delegate to upsert for a completed order', async () => {
    await service.backfillFromOrder('order1', [
      {
        orderItemId: 1,
        tenantId: 'T001',
        sourceSceneCode: 'HOME_FEATURED',
        sourceModuleCode: 'FLASH_SALE',
        primaryOfferType: 'DISCOUNT',
        finalPaidAmount: 99,
      },
    ]);

    expect(prisma.rptOrderItemMarketingFact.upsert).toHaveBeenCalledTimes(1);
  });
});
