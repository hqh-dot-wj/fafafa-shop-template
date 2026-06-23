import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import { BusinessException } from 'src/common/exceptions';
import { SseController } from './sse.controller';
import { SseService } from './sse.service';

describe('SseController', () => {
  let sseService: jest.Mocked<
    Pick<SseService, 'addClient' | 'removeClient' | 'sendToUser' | 'broadcast' | 'getClientCount'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'verify'>>;
  let controller: SseController;

  beforeEach(() => {
    sseService = {
      addClient: jest.fn(),
      removeClient: jest.fn(),
      sendToUser: jest.fn(),
      broadcast: jest.fn(),
      getClientCount: jest.fn().mockReturnValue(2),
    };
    jwtService = {
      verify: jest.fn(),
    };
    controller = new SseController(sseService as unknown as SseService, jwtService as unknown as JwtService);
  });

  it('SSE 连接无 token 时返回 Unauthorized 且不注册连接', async () => {
    const event = await firstValueFrom(controller.sse('', 'client-1', undefined, { on: jest.fn() } as never));

    expect(event.data).toBe('Unauthorized');
    expect(sseService.addClient).not.toHaveBeenCalled();
  });

  it('SSE 连接拒绝非 access token', async () => {
    jwtService.verify.mockReturnValue({ userId: 1, type: 'refresh' } as never);

    const event = await firstValueFrom(controller.sse('Bearer token', 'client-1', 'T001', { on: jest.fn() } as never));

    expect(event.data).toBe('Unauthorized');
    expect(sseService.addClient).not.toHaveBeenCalled();
  });

  it('高风险 SSE 管理操作必须带权限元数据', () => {
    expect(Reflect.getMetadata('permission', SseController.prototype.sendMessage)).toBe('system:notice:add');
    expect(Reflect.getMetadata('permission', SseController.prototype.broadcast)).toBe('system:notice:add');
    expect(Reflect.getMetadata('permission', SseController.prototype.getCount)).toBe('system:notice:list');
  });

  it('sendMessage 应校验用户 ID 并裁剪消息内容', () => {
    controller.sendMessage('12' as unknown as number, '  hello  ');

    expect(sseService.sendToUser).toHaveBeenCalledWith(12, 'hello');
  });

  it.each([
    ['非法用户', 0, 'hello'],
    ['空消息', 12, '   '],
    ['超长消息', 12, 'a'.repeat(1001)],
  ])('sendMessage 拒绝 %s', (_label, userId, message) => {
    expect(() => controller.sendMessage(userId as number, message)).toThrow(BusinessException);
    expect(sseService.sendToUser).not.toHaveBeenCalled();
  });

  it('broadcast 应裁剪消息内容', () => {
    controller.broadcast('  hello  ');

    expect(sseService.broadcast).toHaveBeenCalledWith('hello');
  });
});
