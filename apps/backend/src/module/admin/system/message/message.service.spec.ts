import { MessageService } from './message.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { CreateMessageDto, ListMessageDto } from './dto/message.dto';
import { NotificationService } from 'src/module/notification/notification.service';

describe('MessageService — adminInbox', () => {
  let service: MessageService;

  const mockPrisma = {
    $transaction: jest.fn(),
    sysMessage: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockNotificationService = {
    send: jest.fn(),
  };

  const mockTenantHelper = {
    readWhereForDelegate: jest.fn((_delegate: string, where: object) => where),
  };

  beforeEach(() => {
    service = new MessageService(
      mockPrisma as unknown as PrismaService,
      mockTenantHelper as unknown as TenantHelper,
      mockNotificationService as unknown as NotificationService,
    );
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
  });

  it('Given adminInbox=true, When findAll, Then where 含 OR receiverId 为 userId 或 tenantId', async () => {
    mockPrisma.sysMessage.findMany.mockResolvedValue([]);
    mockPrisma.sysMessage.count.mockResolvedValue(0);

    const query = Object.assign(new ListMessageDto(), { pageNum: 1, pageSize: 10, adminInbox: true });
    await service.findAll(query, '000000', 7);

    expect(mockPrisma.sysMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: '000000',
          OR: [{ receiverId: '7' }, { receiverId: '000000' }],
        }),
      }),
    );
  });

  it('Given adminInbox 未开启, When findAll, Then where 不含 OR', async () => {
    mockPrisma.sysMessage.findMany.mockResolvedValue([]);
    mockPrisma.sysMessage.count.mockResolvedValue(0);

    const query = Object.assign(new ListMessageDto(), { pageNum: 1, pageSize: 10 });
    await service.findAll(query, '000000', 7);

    expect(mockPrisma.sysMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('Given receiverId 为租户 ID, When create, Then 通过 NotificationService 发送租户广播站内信', async () => {
    mockNotificationService.send.mockResolvedValue(undefined);

    const dto = Object.assign(new CreateMessageDto(), {
      title: '库存预警',
      content: '当前库存不足',
      type: 'STOCK_ALERT',
      receiverId: '000000',
      tenantId: '000000',
    });

    await service.create(dto);

    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        target: '000000',
        channel: 'IN_APP',
        title: '库存预警',
        content: '当前库存不足',
        tenantId: '000000',
        template: 'STOCK_ALERT',
      }),
    );
  });

  it('Given receiverId 为管理员 userId, When create, Then 通过 NotificationService 发送个人站内信', async () => {
    mockNotificationService.send.mockResolvedValue(undefined);

    const dto = Object.assign(new CreateMessageDto(), {
      title: '审批提醒',
      content: '有新的审批待处理',
      type: 'APPROVAL',
      receiverId: '7',
      tenantId: '000000',
    });

    await service.create(dto);

    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        target: '7',
        channel: 'IN_APP',
        title: '审批提醒',
        content: '有新的审批待处理',
        tenantId: '000000',
        template: 'APPROVAL',
      }),
    );
  });
});
