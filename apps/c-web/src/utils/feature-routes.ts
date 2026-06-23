import type { CWebFeatures } from '@/hooks/use-features';

export type FeatureKey = keyof CWebFeatures;

/** 路由前缀 → 所需 feature；未列出者为通用路由。 */
export const FEATURE_ROUTE_MAP: ReadonlyArray<{ prefix: string; feature: FeatureKey }> = [
  { prefix: '/service', feature: 'o2o' },
  { prefix: '/stores', feature: 'lbs' },
  { prefix: '/distribution', feature: 'distribution' },
  { prefix: '/wallet', feature: 'wallet' },
];

export function normalizeFeaturePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '/') return '/';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function resolveFeatureForPath(path: string): FeatureKey | null {
  const normalized = normalizeFeaturePath(path);
  for (const rule of FEATURE_ROUTE_MAP) {
    if (normalized === rule.prefix || normalized.startsWith(`${rule.prefix}/`)) {
      return rule.feature;
    }
  }
  return null;
}

export function isFeatureRouteEnabled(path: string, features: CWebFeatures): boolean {
  const key = resolveFeatureForPath(path);
  if (!key) return true;
  return features[key] === true;
}
