import type { components, CreateAddressParams, UpdateAddressParams } from '@libs/common-types';
import type { ApiEnvelope } from '@/utils/api-envelope';
import { unwrapApiData } from '@/utils/api-envelope';

type ApiClient = import('axios').AxiosInstance;

export type AddressVo = components['schemas']['AddressVo'];

async function getData<T>(client: ApiClient, url: string): Promise<T> {
  const { data } = await client.get<ApiEnvelope<T>>(url);
  return unwrapApiData(data);
}

async function postData<T>(client: ApiClient, url: string, body?: unknown): Promise<T> {
  const { data } = await client.post<ApiEnvelope<T>>(url, body);
  return unwrapApiData(data);
}

async function putData<T>(client: ApiClient, url: string, body?: unknown): Promise<T> {
  const { data } = await client.put<ApiEnvelope<T>>(url, body);
  return unwrapApiData(data);
}

async function deleteData<T>(client: ApiClient, url: string): Promise<T> {
  const { data } = await client.delete<ApiEnvelope<T>>(url);
  return unwrapApiData(data);
}

export function getDefaultAddress(client: ApiClient) {
  return getData<AddressVo | null>(client, '/client/address/default');
}

export function getAddressList(client: ApiClient) {
  return getData<{ list: AddressVo[] }>(client, '/client/address/list');
}

export function getAddressDetail(client: ApiClient, id: string) {
  return getData<AddressVo>(client, `/client/address/${id}`);
}

export function createAddress(client: ApiClient, dto: CreateAddressParams) {
  return postData<AddressVo>(client, '/client/address', dto);
}

export function updateAddress(client: ApiClient, dto: UpdateAddressParams) {
  return putData<AddressVo>(client, '/client/address', dto);
}

export function deleteAddress(client: ApiClient, id: string) {
  return deleteData<null>(client, `/client/address/${id}`);
}

export function setDefaultAddress(client: ApiClient, id: string) {
  return putData<null>(client, `/client/address/${id}/default`);
}
