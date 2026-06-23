import { Test, TestingModule } from '@nestjs/testing';
import { Status, DelFlag } from '@prisma/client';
import { ClientService } from './client.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BusinessException } from 'src/common/exceptions';

describe('ClientService', () => {
  let service: ClientService;
  let prisma: {
    $transaction: jest.Mock;
    sysClient: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  const baseRow = {
    id: 2,
    clientId: 'cid-2',
    clientKey: 'app',
    clientSecret: 'sec',
    grantTypeList: 'password,social',
    deviceType: 'app',
    activeTimeout: 1800,
    timeout: 86400,
    status: Status.NORMAL,
    delFlag: DelFlag.NORMAL,
    createBy: 'admin',
    createTime: new Date(),
    updateBy: '',
    updateTime: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      sysClient: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation((input: unknown) => {
      if (typeof input === 'function') {
        return (input as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }
      return Promise.all(input as Promise<unknown>[]);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [ClientService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ClientService);
    jest.clearAllMocks();
  });

  it('findAll 将 grantTypeList 拆分为数组并返回分页结构', async () => {
    prisma.sysClient.findMany.mockResolvedValue([baseRow]);
    prisma.sysClient.count.mockResolvedValue(1);

    const res = await service.findAll({ pageNum: 1, pageSize: 10 } as never);

    expect(res.data?.total).toBe(1);
    expect(res.data?.rows?.[0]?.grantTypeList).toEqual(['password', 'social']);
    expect(res.data?.rows?.[0]?.status).toBe('0');
  });

  it('remove 拒绝删除内置客户端 id=1', async () => {
    await expect(service.remove([1])).rejects.toThrow(BusinessException);
    expect(prisma.sysClient.deleteMany).not.toHaveBeenCalled();
  });

  it('changeStatus 拒绝变更内置客户端', async () => {
    prisma.sysClient.findFirst.mockResolvedValue({
      ...baseRow,
      id: 1,
      clientId: 'builtin',
    });

    await expect(
      service.changeStatus({
        clientId: 'builtin',
        status: Status.STOP,
      }),
    ).rejects.toThrow(BusinessException);
    expect(prisma.sysClient.update).not.toHaveBeenCalled();
  });
});
