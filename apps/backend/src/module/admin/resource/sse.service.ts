import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SseMessage {
  userId?: number;
  message: string;
  type?: string;
}

interface ClientConnection {
  userId: number;
  /** 管理端当前租户，用于 tenant 级站内信（receiverId === tenantId）推送 */
  tenantId: string | null;
  subject: Subject<SseMessage>;
  connectedAt: number;
}

@Injectable()
export class SseService implements OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);
  private readonly clients: Map<string, ClientConnection> = new Map();
  private readonly MAX_CLIENTS = 500;
  private readonly STALE_TIMEOUT_MS = 30 * 60 * 1000;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanupStaleClients(), 5 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clients.forEach((client) => client.subject.complete());
    this.clients.clear();
  }

  /**
   * 添加客户端连接
   * @param clientId 客户端唯一标识
   * @param userId 用户ID
   * @param tenantId 当前租户 ID（与 admin 请求头一致，可为空）
   * @returns Observable 用于发送消息
   */
  addClient(clientId: string, userId: number, tenantId: string | null): Observable<MessageEvent> {
    if (this.clients.size >= this.MAX_CLIENTS) {
      this.cleanupStaleClients();
      if (this.clients.size >= this.MAX_CLIENTS) {
        this.logger.warn(`SSE 连接数已达上限 ${this.MAX_CLIENTS}，拒绝新连接`);
        return new Observable<MessageEvent>((subscriber) => {
          subscriber.next({ data: 'Too many connections' } as MessageEvent);
          subscriber.complete();
        });
      }
    }

    const subject = new Subject<SseMessage>();
    this.clients.set(clientId, { userId, tenantId: tenantId?.trim() ? tenantId.trim() : null, subject, connectedAt: Date.now() });

    return subject.asObservable().pipe(map((data) => ({ data: data.message }) as MessageEvent));
  }

  /**
   * 移除客户端连接
   * @param clientId 客户端唯一标识
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subject.complete();
      this.clients.delete(clientId);
    }
  }

  /**
   * 向指定用户发送消息
   * @param userId 用户ID
   * @param message 消息内容
   */
  sendToUser(userId: number, message: string): void {
    this.clients.forEach((client) => {
      if (client.userId === userId) {
        client.subject.next({ userId, message });
      }
    });
  }

  /**
   * 向所有用户广播消息
   * @param message 消息内容
   */
  broadcast(message: string): void {
    this.clients.forEach((client) => {
      client.subject.next({ message });
    });
  }

  /**
   * 站内信（IN_APP）发送成功后的实时推送
   *
   * @description
   * - target 为纯数字：推送给对应后台 userId 的所有连接
   * - target 与 tenantId 相同（租户级广播，如库存预警）：推送给该 tenantId 下所有已连接管理端
   */
  pushInAppNotification(args: { target: string; tenantId: string; payload: string }): void {
    const { target, tenantId, payload } = args;

    if (target === tenantId) {
      const tid = tenantId.trim();
      if (!tid) {
        return;
      }
      this.clients.forEach((client) => {
        if (client.tenantId === tid) {
          client.subject.next({ message: payload });
        }
      });
      return;
    }

    if (/^\d+$/.test(target)) {
      const userId = Number.parseInt(target, 10);
      if (!Number.isNaN(userId) && userId > 0) {
        this.sendToUser(userId, payload);
      }
    }
  }

  /**
   * 获取在线客户端数量
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * 获取指定用户的在线连接数
   * @param userId 用户ID
   */
  getUserConnectionCount(userId: number): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.userId === userId) {
        count++;
      }
    });
    return count;
  }

  private cleanupStaleClients(): void {
    const now = Date.now();
    const staleIds: string[] = [];

    this.clients.forEach((client, id) => {
      if (now - client.connectedAt > this.STALE_TIMEOUT_MS) {
        staleIds.push(id);
      }
    });

    for (const id of staleIds) {
      this.removeClient(id);
    }

    if (staleIds.length > 0) {
      this.logger.log(`清理 ${staleIds.length} 个过期 SSE 连接，剩余 ${this.clients.size} 个`);
    }
  }
}
