import type { AxiosInstance } from 'axios';
import { getApiClient } from '@/plugins/api';

/** 鑾峰彇鍚屾簮 API 瀹㈡埛绔紙椤诲湪 setupApiClient 涔嬪悗浣跨敤锛夈€?*/
export function useApi(): { apiClient: AxiosInstance } {
  return { apiClient: getApiClient() };
}
