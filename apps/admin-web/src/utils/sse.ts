import type { WatchStopHandle } from 'vue';
import { watch } from 'vue';
import { useEventSource } from '@vueuse/core';
import { IN_APP_SSE_KIND } from '@/constants/in-app-notification';
import { useAdminInboxStore } from '@/store/modules/admin-inbox';
import useNoticeStore from '@/store/modules/notice';
import { $t } from '@/locales';
import { localStg } from './storage';

interface InAppSsePayloadV1 {
  v: number;
  kind: string;
  title?: string;
  content: string;
}

const SSE_CONNECTED_MESSAGE = 'SSE连接成功';
const SSE_UNAUTHORIZED_MESSAGE = 'Unauthorized';
const SSE_TOO_MANY_CONNECTIONS_MESSAGE = 'Too many connections';
const STRUCTURED_NOTIFICATION_DURATION = 4500;
const LEGACY_NOTIFICATION_DURATION = 3000;
const NOTIFICATION_DEDUP_WINDOW = 2000;
const INBOX_REFRESH_DELAY = 500;

let activeSseUrl: string | null = null;
let closeActiveEventSource: (() => void) | null = null;
let stopDataWatch: WatchStopHandle | null = null;
let stopErrorWatch: WatchStopHandle | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const recentNotificationTimes = new Map<string, number>();

function isConnectionMessage(content: string): boolean {
  return content.trim() === SSE_CONNECTED_MESSAGE;
}

function isTerminalSystemMessage(content: string): boolean {
  const value = content.trim();
  return value === SSE_UNAUTHORIZED_MESSAGE || value === SSE_TOO_MANY_CONNECTIONS_MESSAGE;
}

function isIgnoredSystemMessage(content: string): boolean {
  return isConnectionMessage(content) || isTerminalSystemMessage(content);
}

function normalizeContent(raw: string): string {
  let content = raw;
  const noticeType = content.match(/\[dict\.(.*?)\]/)?.[1];
  if (noticeType) {
    content = content.replace(`dict.${noticeType}`, $t(`dict.${noticeType}` as App.I18n.I18nKey));
  }

  return content;
}

function scheduleInboxRefresh() {
  if (refreshTimer) {
    return;
  }

  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    useAdminInboxStore()
      .refresh()
      .catch(() => undefined);
  }, INBOX_REFRESH_DELAY);
}

function showSseNotification(args: { title: string; content: string; duration: number }) {
  const title = args.title.trim() || '消息';
  const content = args.content.trim();
  if (!content || isIgnoredSystemMessage(content)) {
    return;
  }

  const dedupKey = `${title}\n${content}`;
  const now = Date.now();
  const lastShownAt = recentNotificationTimes.get(dedupKey) ?? 0;
  if (now - lastShownAt < NOTIFICATION_DEDUP_WINDOW) {
    return;
  }

  recentNotificationTimes.set(dedupKey, now);
  for (const [key, shownAt] of recentNotificationTimes) {
    if (now - shownAt > NOTIFICATION_DEDUP_WINDOW) {
      recentNotificationTimes.delete(key);
    }
  }

  window.$notification?.create({
    title,
    content,
    type: 'success',
    duration: args.duration,
    keepAliveOnHover: false,
  });
}

function dispatchStructuredSse(raw: string): boolean {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed.startsWith('{')) {
    return false;
  }
  try {
    const parsed = JSON.parse(trimmed) as InAppSsePayloadV1;
    if (parsed.v === 1 && parsed.kind === IN_APP_SSE_KIND && typeof parsed.content === 'string') {
      scheduleInboxRefresh();
      showSseNotification({
        title: parsed.title?.trim() ? parsed.title : '消息',
        content: normalizeContent(parsed.content),
        duration: STRUCTURED_NOTIFICATION_DURATION,
      });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function closeSSE() {
  stopDataWatch?.();
  stopDataWatch = null;
  stopErrorWatch?.();
  stopErrorWatch = null;
  closeActiveEventSource?.();
  closeActiveEventSource = null;
  activeSseUrl = null;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

// 初始化
export const initSSE = (url: string) => {
  const token = localStg.get('token');
  if (import.meta.env.VITE_APP_SSE === 'N' || !token) {
    closeSSE();
    return null;
  }
  const tenantRaw = localStg.get('tenantId');
  const tenantQs =
    tenantRaw !== undefined && tenantRaw !== null && String(tenantRaw) !== ''
      ? `&tenantId=${encodeURIComponent(String(tenantRaw))}`
      : '';
  const sseUrl = `${url}?Authorization=Bearer ${token}&clientid=${import.meta.env.VITE_APP_CLIENT_ID}${tenantQs}`;

  if (activeSseUrl === sseUrl && closeActiveEventSource) {
    return closeSSE;
  }

  closeSSE();
  activeSseUrl = sseUrl;

  const { data, error, close } = useEventSource(sseUrl, [], {
    autoReconnect: {
      retries: 10,
      delay: 3000,
      onFailed() {
        console.error('Failed to connect after 10 retries');
      },
    },
  });
  closeActiveEventSource = close;

  stopErrorWatch = watch(error, () => {
    console.error('SSE connection error:', error.value);
    error.value = null;
  });

  stopDataWatch = watch(data, () => {
    if (!data.value) return;
    const raw = data.value;
    if (isConnectionMessage(raw)) {
      data.value = null;
      return;
    }
    if (isTerminalSystemMessage(raw)) {
      data.value = null;
      closeSSE();
      return;
    }
    if (dispatchStructuredSse(raw)) {
      data.value = null;
      return;
    }
    useNoticeStore().addNotice({
      message: raw,
      read: false,
      time: new Date().toLocaleString(),
    });
    showSseNotification({
      title: '消息',
      content: normalizeContent(raw),
      duration: LEGACY_NOTIFICATION_DURATION,
    });
    data.value = null;
  });

  return closeSSE;
};
