import type { Router } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGetOrderList } from '@/service/api/store/order';
import { navigateByMessage, navigateToFirstAvailableRoute } from './message-navigation';

vi.mock('@/service/api/store/order', () => ({
  fetchGetOrderList: vi.fn(),
}));

type RouterMock = Router & {
  hasRoute: ReturnType<typeof vi.fn>;
  push: ReturnType<typeof vi.fn>;
};

function createRouter(routeNames: string[]): RouterMock {
  return {
    hasRoute: vi.fn((name: string | symbol) => routeNames.includes(String(name))),
    push: vi.fn().mockResolvedValue(undefined),
  } as unknown as RouterMock;
}

function createMessage(type: string, content = '') {
  return {
    content,
    createTime: '2026-05-20 00:00:00',
    id: 1,
    isRead: false,
    title: 'test message',
    type,
  } as unknown as Api.System.Message;
}

describe('message-navigation', () => {
  beforeEach(() => {
    vi.mocked(fetchGetOrderList).mockReset();
  });

  it('routes notice messages to notice page without relying on removed message route', async () => {
    const router = createRouter(['system_notice', 'home']);

    await navigateByMessage(router, createMessage('NOTICE'));

    expect(router.push).toHaveBeenCalledWith({ name: 'system_notice' });
    expect(router.hasRoute).not.toHaveBeenCalledWith('system_message');
  });

  it('falls back to home route when notice route is unavailable', async () => {
    const router = createRouter(['home']);

    await navigateByMessage(router, createMessage('SYSTEM'));

    expect(router.push).toHaveBeenCalledWith({ name: 'home' });
  });

  it('falls back by message type when payload route does not exist', async () => {
    const router = createRouter(['system_notice', 'home']);

    await navigateByMessage(router, createMessage('NOTICE', JSON.stringify({ routeName: 'missing_route' })));

    expect(router.hasRoute).toHaveBeenCalledWith('missing_route');
    expect(router.push).toHaveBeenCalledWith({ name: 'system_notice' });
  });

  it('falls back to order list when order detail route is unavailable', async () => {
    const router = createRouter(['store_order_list', 'system_notice', 'home']);

    await navigateByMessage(router, createMessage('ORDER', JSON.stringify({ orderId: '12' })));

    expect(router.push).toHaveBeenCalledWith({ name: 'store_order_list' });
  });

  it('uses explicit path fallback when no named route exists', async () => {
    const router = createRouter([]);

    await navigateToFirstAvailableRoute(router, ['system_notice', 'home'], { fallbackPath: '/' });

    expect(router.push).toHaveBeenCalledWith('/');
  });
});
