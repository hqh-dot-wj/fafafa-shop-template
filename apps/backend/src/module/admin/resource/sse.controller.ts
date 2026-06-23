import { Controller, Sse, Query, Req, Get, Post, Body, MessageEvent, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { SseService } from './sse.service';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode, Result } from 'src/common/response';
import { v4 as uuidv4 } from 'uuid';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';

// 跳过认证的装饰器
const NotRequireAuth = () => SetMetadata('notRequireAuth', true);

@ApiTags('SSE消息推送')
@Controller('resource')
@ApiBearerAuth('Authorization')
export class SseController {
  constructor(
    private readonly sseService: SseService,
    private readonly jwtService: JwtService,
  ) {}

  @ApiOperation({ summary: 'SSE连接' })
  @NotRequireAuth()
  @Sse('sse')
  sse(
    @Query('Authorization') authorization: string,
    @Query('clientid') clientid: string,
    @Query('tenantId') tenantId: string | undefined,
    @Req() req: Request,
  ): Observable<MessageEvent> {
    // 从 Authorization 参数中提取 token
    const token = authorization?.replace(/^Bearer\s+/i, '')?.trim() ?? '';

    if (!token) {
      // 如果没有token，返回一个空的Observable
      return new Observable<MessageEvent>((subscriber) => {
        subscriber.next({ data: 'Unauthorized' } as MessageEvent);
        subscriber.complete();
      });
    }

    const userId = this.resolveAccessUserId(token);
    if (userId === null) {
      return new Observable<MessageEvent>((subscriber) => {
        subscriber.next({ data: 'Unauthorized' } as MessageEvent);
        subscriber.complete();
      });
    }

    // 生成唯一的客户端ID
    const uniqueClientId = `${clientid || 'unknown'}_${uuidv4()}`;

    const tenant = tenantId?.trim() ? tenantId.trim() : null;

    // 添加客户端连接
    const observable = this.sseService.addClient(uniqueClientId, userId, tenant);

    // 当连接关闭时，移除客户端
    req.on('close', () => {
      this.sseService.removeClient(uniqueClientId);
    });

    // 发送连接成功消息
    setTimeout(() => {
      this.sseService.sendToUser(userId, 'SSE连接成功');
    }, 100);

    return observable;
  }

  /**
   * 校验 access_token 并解析后台用户 ID
   */
  private resolveAccessUserId(token: string): number | null {
    try {
      const payload = this.jwtService.verify<{ userId?: number; type?: string }>(token);
      if (payload?.type !== 'access' || typeof payload.userId !== 'number') {
        return null;
      }
      return payload.userId;
    } catch {
      return null;
    }
  }

  @ApiOperation({ summary: '关闭SSE连接' })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('sse/close')
  closeSse(): Result {
    // 这个接口主要是前端调用,用于优雅地通知后端关闭连接
    // 实际的连接关闭是在客户端断开时自动处理的
    return Result.ok(null, 'SSE连接已关闭');
  }

  @ApiOperation({ summary: '发送消息给指定用户' })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('sse/send')
  @RequirePermission('system:notice:add')
  sendMessage(@Body('userId') userId: number, @Body('message') message: string): Result {
    const targetUserId = this.normalizeUserId(userId);
    const normalizedMessage = this.normalizeMessage(message);
    this.sseService.sendToUser(targetUserId, normalizedMessage);
    return Result.ok(null, '消息发送成功');
  }

  @ApiOperation({ summary: '广播消息给所有用户' })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('sse/broadcast')
  @RequirePermission('system:notice:add')
  broadcast(@Body('message') message: string): Result {
    this.sseService.broadcast(this.normalizeMessage(message));
    return Result.ok(null, '广播成功');
  }

  @ApiOperation({ summary: '获取在线连接数' })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('sse/count')
  @RequirePermission('system:notice:list')
  getCount(): Result {
    const count = this.sseService.getClientCount();
    return Result.ok({ count });
  }

  private normalizeUserId(userId: number): number {
    const value = Number(userId);
    BusinessException.throwIf(!Number.isInteger(value) || value <= 0, '用户ID无效', ResponseCode.PARAM_INVALID);
    return value;
  }

  private normalizeMessage(message: string): string {
    BusinessException.throwIf(typeof message !== 'string', '消息内容不能为空', ResponseCode.PARAM_INVALID);
    const value = message.trim();
    BusinessException.throwIf(!value, '消息内容不能为空', ResponseCode.PARAM_INVALID);
    BusinessException.throwIf(value.length > 1000, '消息内容超出长度限制', ResponseCode.PARAM_INVALID);
    return value;
  }
}
