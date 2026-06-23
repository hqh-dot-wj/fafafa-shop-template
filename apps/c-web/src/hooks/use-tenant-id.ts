import { getTenantId } from '@/utils/env';

/** 褰撳墠绉熸埛 ID锛氶鐗堢敤 VITE_TENANT_ID 娉ㄥ叆锛屼笌 miniapp locationStore 鍏滃簳绉熸埛瀵归綈銆?*/
export function useTenantId(): string {
  return getTenantId();
}
