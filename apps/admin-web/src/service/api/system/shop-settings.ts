import { request } from '@/service/request';

/** 店铺品牌字段（对应 backend ShopSettingsVo） */
export interface ShopSettings {
  id: number;
  tenantId: string;
  companyName: string;
  logoUrl?: string;
  themeColor?: string;
  contactUserName?: string;
  contactPhone?: string;
  userAgreement?: string;
  privacyAgreement?: string;
}

export type ShopSettingsPayload = Omit<ShopSettings, 'id' | 'tenantId'>;

/** 读取本店设置（单实例 000000） */
export function fetchGetShopSettings() {
  return request<ShopSettings>({
    url: '/system/tenant/shop-settings',
    method: 'get',
  });
}

/** 保存本店设置 */
export function fetchUpdateShopSettings(data: ShopSettingsPayload) {
  return request<boolean>({
    url: '/system/tenant/shop-settings',
    method: 'put',
    data,
  });
}
