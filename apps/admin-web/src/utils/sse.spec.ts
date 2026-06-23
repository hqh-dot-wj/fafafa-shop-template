import { nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IN_APP_SSE_KIND } from '@/constants/in-app-notification';
import { closeSSE, initSSE } from './sse';

const state = vi.hoisted(() => ({
  eventSources: [] as Array<{
    close: ReturnType<typeof vi.fn>;
    data: ReturnType<typeof ref<string | null>>;
    error: ReturnType<typeof ref<Event | null>>;
    url: string;
  }>,
  getStorage: vi.fn(),
  notificationCreate: vi.fn(),
  refreshInbox: vi.fn().mockResolvedValue(undefined),
  addNotice: vi.fn(),
}));

vi.mock('@vueuse/core', () => ({
  useEventSource: vi.fn((url: string) => {
    const source = {
      close: vi.fn(),
      data: ref<string | null>(null),
      error: ref<Event | null>(null),
      url,
    };
    state.eventSources.push(source);
    return source;
  }),
}));

vi.mock('./storage', () => ({
  localStg: {
    get: state.getStorage,
  },
}));

vi.mock('@/store/modules/admin-inbox', () => ({
  useAdminInboxStore: () => ({
    refresh: state.refreshInbox,
  }),
}));

vi.mock('@/store/modules/notice', () => ({
  default: () => ({
    addNotice: state.addNotice,
  }),
}));

vi.mock('@/locales', () => ({
  $t: (key: string) => key,
}));

describe('sse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_APP_SSE', 'Y');
    vi.stubEnv('VITE_APP_CLIENT_ID', 'client-id');
    state.eventSources.length = 0;
    state.notificationCreate.mockReset();
    state.refreshInbox.mockClear();
    state.addNotice.mockReset();
    state.getStorage.mockImplementation((key: string) => {
      if (key === 'token') return 'token';
      if (key === 'tenantId') return 'tenant-1';
      return null;
    });
    window.$notification = {
      create: state.notificationCreate,
    } as unknown as typeof window.$notification;
    closeSSE();
  });

  afterEach(() => {
    closeSSE();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    delete window.$notification;
  });

  it('keeps one event source for the same url and token', () => {
    initSSE('/resource/sse');
    initSSE('/resource/sse');

    expect(state.eventSources).toHaveLength(1);
    expect(state.eventSources[0].url).toContain('tenantId=tenant-1');
  });

  it('does not show connection success as a business notification', async () => {
    initSSE('/resource/sse');

    state.eventSources[0].data.value = 'SSE连接成功';
    await nextTick();

    expect(state.notificationCreate).not.toHaveBeenCalled();
    expect(state.addNotice).not.toHaveBeenCalled();
  });

  it('closes SSE and suppresses notification when backend returns unauthorized', async () => {
    initSSE('/resource/sse');
    const source = state.eventSources[0];

    source.data.value = 'Unauthorized';
    await nextTick();

    expect(source.close).toHaveBeenCalledTimes(1);
    expect(state.notificationCreate).not.toHaveBeenCalled();
    expect(state.addNotice).not.toHaveBeenCalled();
  });

  it('deduplicates structured notifications and throttles inbox refresh', async () => {
    initSSE('/resource/sse');
    const payload = JSON.stringify({
      content: 'hello',
      kind: IN_APP_SSE_KIND,
      title: 'Notice',
      v: 1,
    });

    state.eventSources[0].data.value = payload;
    await nextTick();
    state.eventSources[0].data.value = payload;
    await nextTick();

    expect(state.notificationCreate).toHaveBeenCalledTimes(1);
    expect(state.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'hello',
        duration: 4500,
        keepAliveOnHover: false,
        title: 'Notice',
      }),
    );

    expect(state.refreshInbox).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(state.refreshInbox).toHaveBeenCalledTimes(1);
  });

  it('stops watchers and closes the event source', async () => {
    initSSE('/resource/sse');
    const source = state.eventSources[0];

    closeSSE();
    source.data.value = 'legacy message';
    await nextTick();

    expect(source.close).toHaveBeenCalledTimes(1);
    expect(state.notificationCreate).not.toHaveBeenCalled();
  });
});
