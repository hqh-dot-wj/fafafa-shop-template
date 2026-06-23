export const LEGACY_MARKETING_ROUTE_REGISTRY = [
  {
    routeName: 'marketing_config',
    replacement: 'marketing_campaign_center',
    phase: 'legacy-readonly',
    dropAfter: '2026-06-30',
  },
  {
    routeName: 'marketing_policy',
    replacement: 'marketing_capability_hub',
    phase: 'legacy-readonly',
    dropAfter: '2026-06-30',
  },
  {
    routeName: 'marketing_scene',
    replacement: 'marketing_capability_hub',
    phase: 'compat-proxy',
    dropAfter: '2026-07-15',
  },
  {
    routeName: 'marketing_resolution',
    replacement: 'marketing_runtime_center',
    phase: 'compat-proxy',
    dropAfter: '2026-07-15',
  },
  {
    routeName: 'marketing_scene-module',
    replacement: 'marketing_capability_hub',
    phase: 'compat-proxy',
    dropAfter: '2026-07-15',
  },
] as const;
