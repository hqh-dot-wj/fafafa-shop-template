import type { components, CreateOrderParams, OrderDetail, OrderListItem, OrderItemInput } from '@libs/common-types';
import type { ApiEnvelope } from '@/utils/api-envelope';
import { unwrapApiData } from '@/utils/api-envelope';

type ApiClient = import('axios').AxiosInstance;

export type CheckoutPreviewParams = components['schemas']['CheckoutPreviewDto'];
export type CheckoutPreviewVo = components['schemas']['CheckoutPreviewVo'];
export type CreateOrderResult = { orderId: string; orderSn: string; payAmount: number };

export type { OrderItemInput };

async function getData<T>(client: ApiClient, url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await client.get<ApiEnvelope<T>>(url, { params });
  return unwrapApiData(data);
}

async function postData<T>(client: ApiClient, url: string, body?: unknown): Promise<T> {
  const { data } = await client.post<ApiEnvelope<T>>(url, body);
  return unwrapApiData(data);
}

export function getCheckoutPreview(client: ApiClient, params: CheckoutPreviewParams) {
  return postData<CheckoutPreviewVo>(client, '/client/order/checkout/preview', params);
}

export function createOrder(client: ApiClient, dto: CreateOrderParams) {
  return postData<CreateOrderResult>(client, '/client/order/create', dto);
}

export function getOrderList(client: ApiClient, params: { status?: string; pageNum: number; pageSize: number }) {
  return getData<{ rows: OrderListItem[]; total: number }>(
    client,
    '/client/order/list',
    params as Record<string, unknown>,
  );
}

export function getOrderDetail(client: ApiClient, orderId: string) {
  return getData<OrderDetail>(client, `/client/order/${orderId}`);
}

export function cancelOrder(client: ApiClient, orderId: string, reason?: string) {
  return postData<null>(client, '/client/order/cancel', { orderId, reason });
}
