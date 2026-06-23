import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'src/prisma/prisma.service';
import { DelFlagEnum } from 'src/common/enum/index';
import { AiPlatformPromptRepository } from './ai-platform-prompt.repository';

describe('AiPlatformPromptRepository', () => {
  let repository: AiPlatformPromptRepository;

  const mockFindFirst = jest.fn().mockResolvedValue(null);

  const mockPrismaService = {
    aiPlatformPrompt: {
      findFirst: mockFindFirst,
    },
  };

  const mockClsService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    mockFindFirst.mockResolvedValue(null);
    mockClsService.get.mockImplementation((key: string) => {
      if (key === 'tenantId') {
        return 'tenant-child';
      }
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiPlatformPromptRepository,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ClsService, useValue: mockClsService },
      ],
    }).compile();

    repository = module.get(AiPlatformPromptRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByPlatformCode', () => {
    it('显式 tenantId 时 where 保留该租户，不被 Cls 当前租户覆盖', async () => {
      await repository.findByPlatformCode('WECHAT_MP', '000000');

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          delFlag: DelFlagEnum.NORMAL,
          platformCode: 'WECHAT_MP',
          status: 1,
          tenantId: '000000',
        },
      });
    });

    it('未传 tenantId 时使用 Cls 租户 scope', async () => {
      await repository.findByPlatformCode('WECHAT_MP');

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          delFlag: DelFlagEnum.NORMAL,
          platformCode: 'WECHAT_MP',
          status: 1,
          tenantId: 'tenant-child',
        },
      });
    });
  });
});
