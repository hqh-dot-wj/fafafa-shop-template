import { mockPaySuccess, prepay } from '@/service/api/payment';
import { useApi } from '@/hooks/use-api';

/**
 * C 绔?Web 鏀粯闂幆锛氬厛 prepay锛屽啀鍦ㄩ潪鐢熶骇鐜 mock-success锛堝榻?backend PAYMENT_ENABLE_MOCK_SUCCESS锛夈€? * 鐢熶骇 H5 寰俊 JSAPI 灏氭湭鎺ュ叆锛岄』 L3 浜哄伐楠岃瘉鐪熷疄鏀粯鍥炶烦銆? */
export async function completeWebPayment(orderId: string): Promise<void> {
  const { apiClient } = useApi();
  const router = useRouter();

  await prepay(apiClient, orderId);
  await mockPaySuccess(apiClient, orderId);

  await router.push({
    path: '/pay/result',
    query: { orderId, status: 'success' },
  });
}
