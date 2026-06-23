import type { AddCartParams, CartList } from '@libs/common-types';
import type { ApiEnvelope } from '@/utils/api-envelope';
import { unwrapApiData } from '@/utils/api-envelope';

type ApiClient = import('axios').AxiosInstance;

async function getData<T>(client: ApiClient, url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await client.get<ApiEnvelope<T>>(url, { params });
  return unwrapApiData(data);
}

async function postData<T>(client: ApiClient, url: string, body?: unknown): Promise<T> {
  const { data } = await client.post<ApiEnvelope<T>>(url, body);
  return unwrapApiData(data);
}

async function putData<T>(
  client: ApiClient,
  url: string,
  body?: unknown,
  params?: Record<string, unknown>,
): Promise<T> {
  const { data } = await client.put<ApiEnvelope<T>>(url, body, { params });
  return unwrapApiData(data);
}

async function deleteData<T>(client: ApiClient, url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await client.delete<ApiEnvelope<T>>(url, { params });
  return unwrapApiData(data);
}

export function getCartList(client: ApiClient, tenantId: string) {
  return getData<CartList>(client, '/client/cart/list', { tenantId });
}

export function addToCart(client: ApiClient, payload: AddCartParams) {
  return postData<null>(client, '/client/cart/add', payload);
}

export function updateCartQuantity(
  client: ApiClient,
  tenantId: string,
  payload: { skuId: string; quantity: number; activityContextKey?: string },
) {
  return putData<null>(client, '/client/cart/quantity', payload, { tenantId });
}

export function removeCartItem(client: ApiClient, tenantId: string, cartItemId: string) {
  return deleteData<null>(client, `/client/cart/item/${cartItemId}`, { tenantId });
}

export function clearCart(client: ApiClient, tenantId: string) {
  return deleteData<null>(client, '/client/cart/clear', { tenantId });
}
