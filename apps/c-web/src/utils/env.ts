import type { CWebFeatures } from '@/hooks/use-features';

export function getApiBase(): string {
  return import.meta.env.VITE_API_BASE || '/api';
}

export function getTenantId(): string {
  return import.meta.env.VITE_TENANT_ID || '000000';
}

/** 澶氭ā鏉?feature flag锛涗笌 Docker build-arg / .env 涓?VITE_FEATURE_* 瀵归綈銆?*/
export function getFeatures(): CWebFeatures {
  return {
    o2o: import.meta.env.VITE_FEATURE_O2O === 'true',
    distribution: import.meta.env.VITE_FEATURE_DISTRIBUTION === 'true',
    lbs: import.meta.env.VITE_FEATURE_LBS === 'true',
    wallet: import.meta.env.VITE_FEATURE_WALLET === 'true',
    financeSettlement: import.meta.env.VITE_FEATURE_FINANCE_SETTLEMENT === 'true',
  };
}
