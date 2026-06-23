import type { CWebFeatures } from '@/hooks/use-features';
import type { FeatureKey } from '@/utils/feature-routes';

export interface FeatureGatedNavItem {
  label: string;
  to: string;
  icon: string;
  feature?: FeatureKey;
}

export interface MeMenuItem {
  label: string;
  desc: string;
  to: string;
  feature?: FeatureKey;
  badgeKey?: 'coupon';
}

const TAB_ITEMS: FeatureGatedNavItem[] = [
  { label: '首页', to: '/', icon: '⌂' },
  { label: '分类', to: '/category', icon: '☰' },
  { label: '服务', to: '/service', icon: '🛎', feature: 'o2o' },
  { label: '购物车', to: '/cart', icon: '🛒' },
  { label: '我的', to: '/me', icon: '👤' },
];

const ME_MENU_CORE: MeMenuItem[] = [
  { label: '我的订单', desc: '查看全部订单', to: '/order' },
  { label: '收货地址', desc: '管理收货地址', to: '/address' },
  { label: '我的优惠券', desc: '未使用优惠券', to: '/coupon', badgeKey: 'coupon' },
];

const ME_MENU_FEATURE: MeMenuItem[] = [
  { label: '分销中心', desc: '推广赚佣金', to: '/distribution', feature: 'distribution' },
  { label: '我的钱包', desc: '余额与提现', to: '/wallet', feature: 'wallet' },
  { label: '附近门店', desc: 'LBS 门店列表', to: '/stores', feature: 'lbs' },
];

export function filterByFeature<T extends { feature?: FeatureKey }>(items: readonly T[], features: CWebFeatures): T[] {
  return items.filter((item) => !item.feature || features[item.feature]);
}

/** 底栏 Tab 与「我的」菜单：按 feature flag 过滤显隐。 */
export function useFeatureNav() {
  const features = useFeatures();

  const visibleTabs = computed(() => filterByFeature(TAB_ITEMS, features));
  const visibleMeMenu = computed(() => [
    ...filterByFeature(ME_MENU_CORE, features),
    ...filterByFeature(ME_MENU_FEATURE, features),
  ]);

  return { features, visibleTabs, visibleMeMenu };
}
