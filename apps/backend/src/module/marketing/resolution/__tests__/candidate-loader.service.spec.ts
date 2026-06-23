import { Test } from '@nestjs/testing';
import { CandidateLoaderService } from '../services/candidate-loader.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('CandidateLoaderService', () => {
  let service: CandidateLoaderService;
  let prisma: { storePlayConfig: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { storePlayConfig: { findMany: jest.fn() } };
    const module = await Test.createTestingModule({
      providers: [CandidateLoaderService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(CandidateLoaderService);
  });

  it('should return empty array when no configs exist', async () => {
    prisma.storePlayConfig.findMany.mockResolvedValue([]);
    const result = await service.loadCandidates('tenant1', 'product1');
    expect(result).toEqual([]);
  });

  it('should return configs from prisma', async () => {
    prisma.storePlayConfig.findMany.mockResolvedValue([
      { id: 'c1', status: 'ON_SHELF', templateCode: 'GROUP_BUY', delFlag: 'NORMAL' },
    ]);
    const result = await service.loadCandidates('tenant1', 'product1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });
});
