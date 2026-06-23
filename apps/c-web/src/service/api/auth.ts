import type { AuthLoginRes, DoubleTokenRes, PasswordLoginParams, SmsLoginParams, UserInfoRes } from '@/types/auth';
import type { ApiEnvelope } from '@/utils/api-envelope';
import { unwrapApiData } from '@/utils/api-envelope';

type ApiClient = import('axios').AxiosInstance;

async function postData<T>(
  client: ApiClient,
  url: string,
  body?: unknown,
  options?: { skipAuth?: boolean },
): Promise<T> {
  const { data } = await client.post<ApiEnvelope<T>>(url, body, { skipAuth: options?.skipAuth ?? true });
  return unwrapApiData(data);
}

async function getData<T>(client: ApiClient, url: string): Promise<T> {
  const { data } = await client.get<ApiEnvelope<T>>(url);
  return unwrapApiData(data);
}

export function sendLoginCode(client: ApiClient, payload: { mobile: string; tenantId?: string }) {
  return postData<null>(client, '/client/auth/send-login-code', payload);
}

export function loginOrRegisterBySms(client: ApiClient, payload: SmsLoginParams) {
  return postData<AuthLoginRes>(client, '/client/auth/login-or-register-by-sms', payload);
}

export function passwordLogin(client: ApiClient, payload: PasswordLoginParams) {
  return postData<AuthLoginRes>(client, '/client/auth/password-login', payload);
}

export function refreshToken(client: ApiClient, refreshTokenValue: string) {
  return postData<DoubleTokenRes>(client, '/client/auth/refresh', { refresh_token: refreshTokenValue });
}

export function logout(client: ApiClient) {
  return getData<null>(client, '/client/auth/logout');
}

export function getUserInfo(client: ApiClient) {
  return getData<UserInfoRes>(client, '/client/user/info');
}
