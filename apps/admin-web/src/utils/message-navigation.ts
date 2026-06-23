import type { LocationQueryRaw, Router } from 'vue-router';
import { fetchGetOrderList } from '@/service/api/store/order';

type MessageTagType = 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error';

type MessagePayload = {
  orderId?: string | number;
  orderSn?: string;
  routeName?: string;
};

type MessageTypeMeta = {
  label: string;
  tagType: MessageTagType;
};

type RouteNavigationOptions = {
  fallbackPath?: string;
  query?: LocationQueryRaw;
};

const ORDER_MESSAGE_TYPES = ['ORDER', 'ORDER_CREATED', 'ORDER_PAID', 'ORDER_REFUNDED'];
const MESSAGE_FALLBACK_ROUTES = ['system_notice', 'home'];

const MESSAGE_TYPE_META: Record<string, MessageTypeMeta> = {
  ORDER: { label: '订单消息', tagType: 'primary' },
  ORDER_CREATED: { label: '订单消息', tagType: 'primary' },
  ORDER_PAID: { label: '支付消息', tagType: 'success' },
  ORDER_REFUNDED: { label: '退款消息', tagType: 'warning' },
  STOCK_ALERT: { label: '库存预警', tagType: 'warning' },
  SYSTEM: { label: '系统通知', tagType: 'info' },
  NOTICE: { label: '通知公告', tagType: 'default' },
};

export const MESSAGE_TYPE_OPTIONS = [
  { label: '订单消息', value: 'ORDER' },
  { label: '库存预警', value: 'STOCK_ALERT' },
  { label: '系统通知', value: 'SYSTEM' },
  { label: '通知公告', value: 'NOTICE' },
];

export function getMessageTypeMeta(type?: string | null): MessageTypeMeta {
  if (!type) return { label: '业务消息', tagType: 'default' };

  return MESSAGE_TYPE_META[type] ?? { label: '业务消息', tagType: 'default' };
}

export async function navigateToFirstAvailableRoute(
  router: Router,
  routeNames: readonly string[],
  options: RouteNavigationOptions = {},
) {
  const targetRoute = routeNames.find((name) => router.hasRoute(name));
  if (targetRoute) {
    await router.push(options.query ? { name: targetRoute, query: options.query } : { name: targetRoute });
    return true;
  }

  if (options.fallbackPath) {
    await router.push(options.fallbackPath);
  }

  return false;
}

export async function navigateByMessage(router: Router, message: Api.System.Message | Api.System.MessageVo) {
  const payload = parseMessagePayload(message.content);
  const messageType = String(message.type);

  if (payload?.routeName) {
    if (await navigateToFirstAvailableRoute(router, [payload.routeName])) {
      return;
    }
  }

  if (ORDER_MESSAGE_TYPES.includes(messageType)) {
    await navigateOrderMessage(router, message, payload);
    return;
  }

  if (messageType === 'STOCK_ALERT') {
    await navigateToFirstAvailableRoute(router, ['store_stock', ...MESSAGE_FALLBACK_ROUTES], { fallbackPath: '/' });
    return;
  }

  if (messageType === 'NOTICE') {
    await navigateToFirstAvailableRoute(router, MESSAGE_FALLBACK_ROUTES, { fallbackPath: '/' });
    return;
  }

  await navigateToFirstAvailableRoute(router, MESSAGE_FALLBACK_ROUTES, { fallbackPath: '/' });
}

async function navigateOrderMessage(
  router: Router,
  message: Api.System.Message | Api.System.MessageVo,
  payload: MessagePayload | null,
) {
  const payloadOrderId = payload?.orderId ? String(payload.orderId) : null;
  if (payloadOrderId) {
    if (await navigateToFirstAvailableRoute(router, ['store_order_detail'], { query: { id: payloadOrderId } })) {
      return;
    }

    await navigateToFirstAvailableRoute(router, ['store_order_list', ...MESSAGE_FALLBACK_ROUTES], {
      fallbackPath: '/',
    });
    return;
  }

  const orderSn = payload?.orderSn ?? extractOrderSn(message.content);
  if (!orderSn) {
    await navigateToFirstAvailableRoute(router, ['store_order_list', ...MESSAGE_FALLBACK_ROUTES], {
      fallbackPath: '/',
    });
    return;
  }

  const orderId = await findOrderIdBySn(orderSn);
  if (orderId) {
    if (await navigateToFirstAvailableRoute(router, ['store_order_detail'], { query: { id: orderId } })) {
      return;
    }

    await navigateToFirstAvailableRoute(router, ['store_order_list', ...MESSAGE_FALLBACK_ROUTES], {
      fallbackPath: '/',
      query: { orderSn },
    });
    return;
  }

  await navigateToFirstAvailableRoute(router, ['store_order_list', ...MESSAGE_FALLBACK_ROUTES], {
    fallbackPath: '/',
    query: { orderSn },
  });
}

function parseMessagePayload(content?: string): MessagePayload | null {
  if (!content?.trim().startsWith('{')) return null;

  try {
    const payload = JSON.parse(content) as MessagePayload;
    return typeof payload === 'object' && payload !== null ? payload : null;
  } catch {
    return null;
  }
}

function extractOrderSn(content?: string): string | null {
  const orderSn = content?.match(/订单号[:：]\s*([A-Za-z0-9_-]+)/)?.[1];
  return orderSn ?? null;
}

async function findOrderIdBySn(orderSn: string) {
  try {
    const { data } = await fetchGetOrderList({
      pageNum: 1,
      pageSize: 1,
      orderSn,
    });

    return data?.rows?.[0]?.id ?? null;
  } catch {
    return null;
  }
}
