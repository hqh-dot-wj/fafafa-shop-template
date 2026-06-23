import type { AiPlatformPrompt } from '@prisma/client';
import { AiPlatformPromptService } from './ai-platform-prompt.service';
import { AiPlatformPromptRepository } from './ai-platform-prompt.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { DelFlagEnum } from 'src/common/enum/index';

describe('AiPlatformPromptService', () => {
  let service: AiPlatformPromptService;
  const mockSearch = jest.fn();
  const mockFindById = jest.fn();
  const mockSysTenantFindMany = jest.fn();

  const baseRow: AiPlatformPrompt = {
    id: 'p1',
    platformCode: 'WECHAT_MP',
    platformName: '微信',
    icon: null,
    systemPrompt: 'sys',
    outputSchema: {},
    maxLength: 100,
    sortOrder: 0,
    status: 1,
    delFlag: DelFlagEnum.NORMAL,
    tenantId: 'T001',
    createTime: new Date('2026-01-01'),
    updateTime: new Date('2026-01-02'),
  };

  beforeEach(() => {
    mockSearch.mockReset();
    mockFindById.mockReset();
    mockSysTenantFindMany.mockReset();

    const repo = {
      search: mockSearch,
      findById: mockFindById,
    } as unknown as AiPlatformPromptRepository;

    const prisma = {
      sysTenant: { findMany: mockSysTenantFindMany },
    } as unknown as PrismaService;

    service = new AiPlatformPromptService(repo, prisma);
  });

  it('findAll 列表行为 sys_tenant 补充 tenantName', async () => {
    mockSearch.mockResolvedValue({
      rows: [baseRow],
      total: 1,
      pageNum: 1,
      pageSize: 10,
      pages: 1,
    });
    mockSysTenantFindMany.mockResolvedValue([{ tenantId: 'T001', companyName: '测试租户' }]);

    const result = await service.findAll({ pageNum: 1, pageSize: 10 });

    expect(mockSysTenantFindMany).toHaveBeenCalledWith({
      where: { tenantId: { in: ['T001'] } },
      select: { tenantId: true, companyName: true },
    });
    expect(result.data?.rows?.[0]).toMatchObject({
      tenantId: 'T001',
      tenantName: '测试租户',
    });
  });

  it('findAll 无数据时不查询租户表', async () => {
    mockSearch.mockResolvedValue({
      rows: [],
      total: 0,
      pageNum: 1,
      pageSize: 10,
      pages: 0,
    });

    await service.findAll({ pageNum: 1, pageSize: 10 });

    expect(mockSysTenantFindMany).not.toHaveBeenCalled();
  });

  it('findAll 租户未命中时 tenantName 回退为 tenantId', async () => {
    mockSearch.mockResolvedValue({
      rows: [baseRow],
      total: 1,
      pageNum: 1,
      pageSize: 10,
      pages: 1,
    });
    mockSysTenantFindMany.mockResolvedValue([]);

    const result = await service.findAll({ pageNum: 1, pageSize: 10 });

    expect(result.data?.rows?.[0]).toMatchObject({
      tenantId: 'T001',
      tenantName: 'T001',
    });
  });
});
