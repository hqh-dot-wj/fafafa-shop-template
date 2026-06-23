import { getFeatures } from '@/utils/env';

/** 澶氭ā鏉?feature flag 璇诲彇锛涗笌 VITE_FEATURE_* 鐜鍙橀噺瀵归綈銆?*/
export interface CWebFeatures {
  o2o: boolean;
  distribution: boolean;
  lbs: boolean;
  wallet: boolean;
  financeSettlement: boolean;
}

export function useFeatures(): CWebFeatures {
  return getFeatures();
}
