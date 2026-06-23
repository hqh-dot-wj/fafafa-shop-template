import type { ApiEnvelope } from '@/utils/api-envelope';
import { unwrapApiData } from '@/utils/api-envelope';

type ApiClient = import('axios').AxiosInstance;

export interface PrepayParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA' | 'MD5';
  paySign: string;
}

export interface MockSuccessResult {
  status: string;
}

async function postData<T>(client: ApiClient, url: string, body?: unknown): Promise<T> {
  const { data } = await client.post<ApiEnvelope<T>>(url, body);
  return unwrapApiData(data);
}

export function prepay(client: ApiClient, orderId: string, paymentMethod = 'WECHAT') {
  return postData<PrepayParams>(client, '/client/payment/prepay', { orderId, paymentMethod });
}

/** 测试环境模拟支付成功；生产须走真实支付回调（L3 人工验证）。 */
export function mockPaySuccess(client: ApiClient, orderId: string) {
  return postData<MockSuccessResult>(client, '/client/payment/mock-success', { orderId });
}
