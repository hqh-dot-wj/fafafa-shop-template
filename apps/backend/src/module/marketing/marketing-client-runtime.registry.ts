import {
  MARKETING_CLIENT_AGGREGATE_ENABLED_KEY,
  MARKETING_CLIENT_SCENE_ENABLED_KEY,
  MARKETING_CLIENT_SCENE_ROLLOUT_PERCENT_KEY,
} from './marketing-client-runtime.constants';

export interface MarketingClientRuntimeRegistryEntry {
  configKey: string;
  displayName: string;
  /** 平台租户（000000）种子中的默认展示值，便于台账对照 */
  platformDefaultDisplay: string;
  remark: string;
}

/** 统一 C 端营销运行时相关的 sys_config 键清单（单一信息源，供台账接口与运维脚本共用） */
export const MARKETING_CLIENT_RUNTIME_REGISTRY: MarketingClientRuntimeRegistryEntry[] = [
  {
    configKey: MARKETING_CLIENT_SCENE_ENABLED_KEY,
    displayName: '场景接口总开关',
    platformDefaultDisplay: 'Y',
    remark: 'Y 开启；N 关闭。可按租户覆盖；ADMIN_PREVIEW 通道不受限。',
  },
  {
    configKey: MARKETING_CLIENT_SCENE_ROLLOUT_PERCENT_KEY,
    displayName: '场景接口放量百分比',
    platformDefaultDisplay: '100',
    remark: '0~100：按 memberId+tenantId 稳定哈希放量，100 全量。可按租户覆盖。',
  },
  {
    configKey: MARKETING_CLIENT_AGGREGATE_ENABLED_KEY,
    displayName: '聚合列表接口总开关',
    platformDefaultDisplay: 'Y',
    remark: 'Y 开启；N 关闭。可按租户覆盖；连续 14 个 UTC 日历日零调用后由定时任务自动置 N。',
  },
];
