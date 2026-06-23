import { Test, TestingModule } from '@nestjs/testing';
import { InAppChannel } from './in-app.channel';
import { PrismaService } from 'src/prisma/prisma.service';

describe('InAppChannel', () => {
  let channel: InAppChannel;

  const mockPrisma = {
    sysMessage: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InAppChannel, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    channel = module.get<InAppChannel>(InAppChannel);
    jest.clearAllMocks();
    mockPrisma.sysMessage.create.mockResolvedValue({ id: 1 });
  });

  // R-FLOW-INAPP-01: 写入 sysMessage 表并返回 success=true
  it('Given 有效消息, When send, Then 写入 sysMessage 并返回 success=true', async () => {
    const result = await channel.send('member-1', {
      title: '订单通知',
      content: '您的订单已创建',
      template: 'ORDER_CREATED',
      tenantId: 'tenant-1',
    });

    expect(result).toEqual({ success: true, messageId: 1 });
    expect(mockPrisma.sysMessage.create).toHaveBeenCalledWith({
      data: {
        title: '订单通知',
        content: '您的订单已创建',
        type: 'ORDER_CREATED',
        receiverId: 'member-1',
        tenantId: 'tenant-1',
      },
    });
  });

  // R-BRANCH-INAPP-01: 无 title 时使用默认值"系统通知"
  it('Given 无 title, When send, Then title 使用默认值"系统通知"', async () => {
    await channel.send('member-1', {
      content: '系统消息',
      tenantId: 'tenant-1',
    });

    expect(mockPrisma.sysMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: '系统通知' }),
    });
  });

  // R-BRANCH-INAPP-02: 无 template 时 type 使用 'SYSTEM'
  it('Given 无 template, When send, Then type 使用 SYSTEM', async () => {
    await channel.send('member-1', {
      content: '系统消息',
      tenantId: 'tenant-1',
    });

    expect(mockPrisma.sysMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'SYSTEM' }),
    });
  });

  // R-BRANCH-INAPP-03: 数据库异常时向上抛出
  it('Given 数据库异常, When send, Then 抛出异常', async () => {
    mockPrisma.sysMessage.create.mockRejectedValue(new Error('DB error'));

    await expect(channel.send('member-1', { content: '消息', tenantId: 'tenant-1' })).rejects.toThrow('DB error');
  });
});
