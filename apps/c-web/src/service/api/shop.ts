import type { AxiosInstance } from 'axios';
import { unwrapApiData } from '@/utils/api-envelope';

export interface ShopBranding {
  companyName: string;
  logoUrl?: string;
  themeColor?: string;
  contactUserName?: string;
  contactPhone?: string;
  userAgreement?: string;
  privacyAgreement?: string;
}

export async function fetchShopBranding(client: AxiosInstance): Promise<ShopBranding> {
  const res = await client.get('/client/shop/branding');
  return unwrapApiData<ShopBranding>(res.data);
}
