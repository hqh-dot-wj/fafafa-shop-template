import { getStoredTenantId } from '@/service/request/tenant';
import { getToken } from '@/store/modules/auth/shared';
import { localStg } from '@/utils/storage';

/**
 * 与 `service/request` 拦截器对齐：NUpload 等原生 XHR 不走 axios，需手动带租户与语言头。
 */
export function getAdminUploadHeaders(): Record<string, string> {
  const tenantId = getStoredTenantId();
  const lang = (localStg.get('lang') || 'zh-CN').replace('-', '_');
  const clientId = import.meta.env.VITE_APP_CLIENT_ID ?? '';
  return {
    Authorization: `Bearer ${getToken()}`,
    clientid: clientId,
    Clientid: clientId,
    'Content-Language': lang,
    ...(tenantId ? { 'tenant-id': tenantId } : {}),
  };
}
