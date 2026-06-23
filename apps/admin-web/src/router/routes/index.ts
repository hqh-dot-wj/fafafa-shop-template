import type { ElegantConstRoute } from '@elegant-router/types';
import { generatedRoutes } from '../elegant/routes';
import { views as elegantViews, layouts } from '../elegant/imports';
import { transformElegantRoutesToVueRoutes } from '../elegant/transform';
import { normalizeStoreOperationsRoutes } from './store-ops';

export const MARKETING_ROUTE_NAME = 'marketing' as const;

/**
 * custom routes
 *
 * @link https://github.com/soybeanjs/elegant-router?tab=readme-ov-file#custom-route
 */
const customRoutes: ElegantConstRoute[] = [
  {
    name: MARKETING_ROUTE_NAME,
    path: '/marketing',
    component: 'layout.base',
    meta: {
      title: 'marketing',
      i18nKey: 'route.marketing',
    },
    children: [
      {
        name: 'marketing_operations-resource',
        path: '/marketing/operations-resource',
        meta: {
          title: 'marketing_operations-resource',
          i18nKey: 'route.marketing_operations-resource',
        },
        children: [
          {
            name: 'marketing_asset',
            path: '/marketing/asset',
            component: 'view.marketing_asset',
            meta: {
              title: 'marketing_asset',
              i18nKey: 'route.marketing_asset',
            },
          },
          {
            name: 'marketing_coupon',
            path: '/marketing/coupon',
            meta: {
              title: 'marketing_coupon',
              i18nKey: 'route.marketing_coupon',
            },
            children: [
              {
                name: 'marketing_coupon_template',
                path: '/marketing/coupon/template',
                component: 'view.marketing_coupon_template',
                meta: {
                  title: 'marketing_coupon_template',
                  i18nKey: 'route.marketing_coupon_template',
                },
              },
            ],
          },
          {
            name: 'marketing_points',
            path: '/marketing/points',
            meta: {
              title: 'marketing_points',
              i18nKey: 'route.marketing_points',
            },
            children: [
              {
                name: 'marketing_points_accounts',
                path: '/marketing/points/accounts',
                component: 'view.marketing_points_accounts',
                meta: {
                  title: 'marketing_points_accounts',
                  i18nKey: 'route.marketing_points_accounts',
                },
              },
              {
                name: 'marketing_points_rules',
                path: '/marketing/points/rules',
                component: 'view.marketing_points_rules',
                meta: {
                  title: 'marketing_points_rules',
                  i18nKey: 'route.marketing_points_rules',
                },
              },
              {
                name: 'marketing_points_tasks',
                path: '/marketing/points/tasks',
                component: 'view.marketing_points_tasks',
                meta: {
                  title: 'marketing_points_tasks',
                  i18nKey: 'route.marketing_points_tasks',
                },
              },
            ],
          },
          {
            name: 'marketing_template',
            path: '/marketing/template',
            component: 'view.marketing_template',
            meta: {
              title: 'marketing_template',
              i18nKey: 'route.marketing_template',
            },
          },
        ],
      },
      {
        name: 'marketing_activity-orchestration',
        path: '/marketing/activity-orchestration',
        meta: {
          title: 'marketing_activity-orchestration',
          i18nKey: 'route.marketing_activity-orchestration',
        },
        children: [
          {
            name: 'marketing_activity-center',
            path: '/marketing/campaigns',
            meta: {
              title: 'marketing_activity-center',
              i18nKey: 'route.marketing_activity-center',
            },
            children: [
              {
                name: 'marketing_activity_list',
                path: '/marketing/campaigns/list',
                component: 'view.marketing_activity_list',
                meta: {
                  title: 'marketing_activity_list',
                  i18nKey: 'route.marketing_activity_list',
                },
              },
              {
                name: 'marketing_activity_calendar',
                path: '/marketing/campaigns/calendar',
                component: 'view.marketing_activity_calendar',
                meta: {
                  title: 'marketing_activity_calendar',
                  i18nKey: 'route.marketing_activity_calendar',
                },
              },
              {
                name: 'marketing_activity_dashboard',
                path: '/marketing/campaigns/dashboard',
                component: 'view.marketing_activity_dashboard',
                meta: {
                  title: 'marketing_activity_dashboard',
                  i18nKey: 'route.marketing_activity_dashboard',
                },
              },
              {
                name: 'marketing_campaigns_wizard',
                path: '/marketing/campaigns/wizard',
                component: 'view.marketing_campaigns_wizard',
                meta: {
                  title: 'marketing_campaigns_wizard',
                  i18nKey: 'route.marketing_campaigns_wizard',
                },
              },
              {
                name: 'marketing_activity_detail',
                path: '/marketing/campaigns/detail',
                component: 'view.marketing_activity_detail',
                meta: {
                  title: 'marketing_activity_detail',
                  i18nKey: 'route.marketing_activity_detail',
                  hideInMenu: true,
                  activeMenu: 'marketing_activity_list',
                },
              },
              {
                name: 'marketing_campaigns_new',
                path: '/marketing/campaigns/new',
                component: 'view.marketing_campaigns_new',
                meta: {
                  title: 'marketing_campaigns_new',
                  i18nKey: 'route.marketing_campaigns_new',
                  hideInMenu: true,
                  activeMenu: 'marketing_campaigns_wizard',
                },
              },
              {
                name: 'marketing_campaigns_detail',
                path: '/marketing/campaigns/workbench',
                component: 'view.marketing_campaigns_detail',
                meta: {
                  title: 'marketing_campaigns_detail',
                  i18nKey: 'route.marketing_campaigns_detail',
                  hideInMenu: true,
                  activeMenu: 'marketing_activity_list',
                },
              },
            ],
          },
          {
            name: 'marketing_entitlement-pool',
            path: '/marketing/entitlement-pool',
            component: 'view.marketing_entitlement-pool',
            meta: {
              title: 'marketing_entitlement-pool',
              i18nKey: 'route.marketing_entitlement-pool',
            },
          },
          {
            name: 'marketing_scene-placement',
            path: '/marketing/scene-placement',
            meta: {
              title: 'marketing_scene-placement',
              i18nKey: 'route.marketing_scene-placement',
            },
            children: [
              {
                name: 'marketing_scene-placement_definition',
                path: '/marketing/scene-placement/definition',
                component: 'view.marketing_scene-placement_definition',
                meta: {
                  title: 'marketing_scene-placement_definition',
                  i18nKey: 'route.marketing_scene-placement_definition',
                },
              },
              {
                name: 'marketing_scene-placement_navigation',
                path: '/marketing/scene-placement/navigation',
                component: 'view.marketing_scene-placement_navigation',
                meta: {
                  title: 'marketing_scene-placement_navigation',
                  i18nKey: 'route.marketing_scene-placement_navigation',
                },
              },
              {
                name: 'marketing_scene-placement_preview',
                path: '/marketing/scene-placement/preview',
                component: 'view.marketing_scene-placement_preview',
                meta: {
                  title: 'marketing_scene-placement_preview',
                  i18nKey: 'route.marketing_scene-placement_preview',
                  hideInMenu: true,
                  activeMenu: 'marketing_scene-placement_definition',
                },
              },
            ],
          },
          {
            name: 'marketing_course-group',
            path: '/marketing/course-group',
            meta: {
              title: 'marketing_course-group',
              i18nKey: 'route.marketing_course-group',
            },
            children: [
              {
                name: 'marketing_course-group_team',
                path: '/marketing/course-group/team',
                component: 'view.marketing_course-group_team',
                meta: {
                  title: 'marketing_course-group_team',
                  i18nKey: 'route.marketing_course-group_team',
                },
              },
              {
                name: 'marketing_course-group_team-detail',
                path: '/marketing/course-group/team-detail',
                component: 'view.marketing_course-group_team-detail',
                meta: {
                  title: 'marketing_course-group_team-detail',
                  i18nKey: 'route.marketing_course-group_team-detail',
                  hideInMenu: true,
                  activeMenu: 'marketing_course-group_team',
                },
              },
              {
                name: 'marketing_course-group_failure',
                path: '/marketing/course-group/failure',
                component: 'view.marketing_course-group_failure',
                meta: {
                  title: 'marketing_course-group_failure',
                  i18nKey: 'route.marketing_course-group_failure',
                },
              },
              {
                name: 'marketing_course-group_commission',
                path: '/marketing/course-group/commission',
                component: 'view.marketing_course-group_commission',
                meta: {
                  title: 'marketing_course-group_commission',
                  i18nKey: 'route.marketing_course-group_commission',
                },
              },
            ],
          },
        ],
      },
      {
        name: 'marketing_runtime-control',
        path: '/marketing/runtime-control',
        meta: {
          title: 'marketing_runtime-control',
          i18nKey: 'route.marketing_runtime-control',
        },
        children: [
          {
            name: 'marketing_instance',
            path: '/marketing/instance',
            component: 'view.marketing_instance',
            meta: {
              title: 'marketing_instance',
              i18nKey: 'route.marketing_instance',
            },
          },
          {
            name: 'marketing_config',
            path: '/marketing/config',
            component: 'view.marketing_config',
            meta: {
              title: 'marketing_config',
              i18nKey: 'route.marketing_config',
              hideInMenu: true,
              activeMenu: 'marketing_campaigns_wizard',
            },
          },
          {
            name: 'marketing_policy',
            path: '/marketing/policy',
            component: 'view.marketing_policy',
            meta: {
              title: 'marketing_policy',
              i18nKey: 'route.marketing_policy',
              hideInMenu: true,
              activeMenu: 'marketing_campaigns_wizard',
            },
          },
          {
            name: 'marketing_scene',
            path: '/marketing/scene',
            component: 'view.marketing_scene',
            meta: {
              title: 'marketing_scene',
              i18nKey: 'route.marketing_scene',
              hideInMenu: true,
              activeMenu: 'marketing_campaigns_wizard',
            },
          },
          {
            name: 'marketing_scene-module',
            path: '/marketing/scene-module',
            component: 'view.marketing_scene-module',
            meta: {
              title: 'marketing_scene-module',
              i18nKey: 'route.marketing_scene-module',
              hideInMenu: true,
              activeMenu: 'marketing_campaigns_wizard',
            },
          },
          {
            name: 'marketing_resolution',
            path: '/marketing/resolution',
            meta: {
              title: 'marketing_resolution',
              i18nKey: 'route.marketing_resolution',
              hideInMenu: true,
              activeMenu: 'marketing_campaigns_wizard',
            },
            children: [
              {
                name: 'marketing_resolution_priority',
                path: '/marketing/resolution/priority',
                component: 'view.marketing_resolution_priority',
                meta: {
                  title: 'marketing_resolution_priority',
                  i18nKey: 'route.marketing_resolution_priority',
                  hideInMenu: true,
                  activeMenu: 'marketing_campaigns_wizard',
                },
              },
              {
                name: 'marketing_resolution_incident',
                path: '/marketing/resolution/incident',
                component: 'view.marketing_resolution_incident',
                meta: {
                  title: 'marketing_resolution_incident',
                  i18nKey: 'route.marketing_resolution_incident',
                  hideInMenu: true,
                  activeMenu: 'marketing_campaigns_wizard',
                },
              },
              {
                name: 'marketing_resolution_simulator',
                path: '/marketing/resolution/simulator',
                component: 'view.marketing_resolution_simulator',
                meta: {
                  title: 'marketing_resolution_simulator',
                  i18nKey: 'route.marketing_resolution_simulator',
                  hideInMenu: true,
                  activeMenu: 'marketing_campaigns_wizard',
                },
              },
            ],
          },
          {
            name: 'marketing_ai-platform-prompt',
            path: '/marketing/ai-platform-prompt',
            component: 'view.marketing_ai-platform-prompt',
            meta: {
              title: 'marketing_ai-platform-prompt',
              i18nKey: 'route.marketing_ai-platform-prompt',
            },
          },
        ],
      },
      {
        name: 'marketing_monitor-analysis',
        path: '/marketing/monitor-analysis',
        meta: {
          title: 'marketing_monitor-analysis',
          i18nKey: 'route.marketing_monitor-analysis',
        },
        children: [
          {
            name: 'marketing_points_statistics',
            path: '/marketing/points/statistics',
            component: 'view.marketing_points_statistics',
            meta: {
              title: 'marketing_points_statistics',
              i18nKey: 'route.marketing_points_statistics',
            },
          },
          {
            name: 'marketing_statistics',
            path: '/marketing/statistics',
            meta: {
              title: 'marketing_statistics',
              i18nKey: 'route.marketing_statistics',
            },
            children: [
              {
                name: 'marketing_statistics_coupon',
                path: '/marketing/statistics/coupon',
                component: 'view.marketing_statistics_coupon',
                meta: {
                  title: 'marketing_statistics_coupon',
                  i18nKey: 'route.marketing_statistics_coupon',
                },
              },
            ],
          },
          {
            name: 'marketing_client-runtime-ledger',
            path: '/marketing/client-runtime-ledger',
            component: 'view.marketing_client-runtime-ledger',
            meta: {
              title: 'marketing_client-runtime-ledger',
              i18nKey: 'route.marketing_client-runtime-ledger',
            },
          },
        ],
      },
    ],
  },
];

const disabledGeneratedRouteNames = new Set(['marketing_activity', 'marketing_campaigns']);

const builtinConstantRoutes: ElegantConstRoute[] = [
  {
    name: '403',
    path: '/403',
    component: 'layout.blank$view.403',
    meta: {
      title: '403',
      i18nKey: 'route.403',
      constant: true,
      hideInMenu: true,
    },
  },
  {
    name: '404',
    path: '/404',
    component: 'layout.blank$view.404',
    meta: {
      title: '404',
      i18nKey: 'route.404',
      constant: true,
      hideInMenu: true,
    },
  },
  {
    name: '500',
    path: '/500',
    component: 'layout.blank$view.500',
    meta: {
      title: '500',
      i18nKey: 'route.500',
      constant: true,
      hideInMenu: true,
    },
  },
  {
    name: 'login',
    path: '/login/:module(pwd-login|code-login|register|reset-pwd|bind-wechat)?',
    component: 'layout.blank$view.login',
    props: true,
    meta: {
      title: 'login',
      i18nKey: 'route.login',
      constant: true,
      hideInMenu: true,
    },
  },
  {
    name: 'iframe-page',
    path: '/iframe-page/:url',
    component: 'layout.base$view.iframe-page',
    props: true,
    meta: {
      title: 'iframe-page',
      i18nKey: 'route.iframe-page',
      constant: true,
      hideInMenu: true,
      keepAlive: true,
      icon: 'material-symbols:iframe-outline',
    },
  },
  {
    name: 'social-callback',
    path: '/social-callback',
    component: 'layout.blank$view.social-callback',
    meta: {
      title: 'social-callback',
      i18nKey: 'route.social-callback',
      constant: true,
      hideInMenu: true,
      icon: 'simple-icons:authy',
    },
  },
];

const builtinConstantRouteNames = new Set(builtinConstantRoutes.map((route) => route.name));

/** create routes when the auth route mode is static */
export function createStaticRoutes() {
  const constantRoutes: ElegantConstRoute[] = [];

  const authRoutes: ElegantConstRoute[] = [];

  const normalizedGeneratedRoutes: ElegantConstRoute[] = normalizeStoreOperationsRoutes(
    generatedRoutes.filter((item) => {
      const routeName = item.name as string;
      return (
        !customRoutes.some((route) => route.name === routeName) &&
        !disabledGeneratedRouteNames.has(routeName) &&
        !builtinConstantRouteNames.has(routeName)
      );
    }) as ElegantConstRoute[],
  );

  const allRoutes: ElegantConstRoute[] = [...customRoutes, ...normalizedGeneratedRoutes, ...builtinConstantRoutes];

  allRoutes.forEach((item) => {
    if (item.meta?.constant) {
      constantRoutes.push(item);
    } else {
      authRoutes.push(item);
    }
  });

  return {
    constantRoutes,
    authRoutes,
  };
}

const dynamicConstantRoutes: ElegantConstRoute[] = [
  {
    name: 'home',
    path: '/home',
    component: 'layout.base$view.home',
    meta: {
      title: 'home',
      i18nKey: 'route.home',
      icon: 'mdi:monitor-dashboard',
      order: -1,
    },
  },
  ...builtinConstantRoutes,
  {
    name: 'user-center',
    path: '/user-center',
    component: 'layout.base$view.user-center',
    meta: {
      title: 'user-center',
      i18nKey: 'route.user-center',
      icon: 'material-symbols:account-circle-full',
      hideInMenu: true,
    },
  },
];

/** create routes when the auth route mode is static */
export function createDynamicRoutes() {
  const constantRoutes: ElegantConstRoute[] = [];

  const authRoutes: ElegantConstRoute[] = [];

  [...customRoutes, ...dynamicConstantRoutes].forEach((item) => {
    if (item.meta?.constant) {
      constantRoutes.push(item);
    } else {
      authRoutes.push(item);
    }
  });

  return {
    constantRoutes,
    authRoutes,
  };
}

/**
 * Get auth vue routes
 *
 * @param routes Elegant routes
 */
export function getAuthVueRoutes(routes: ElegantConstRoute[]) {
  return transformElegantRoutesToVueRoutes(routes, layouts, elegantViews);
}
