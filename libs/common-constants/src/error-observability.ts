export const ERROR_EVENT_APPS = ['backend', 'admin-web', 'miniapp-client'] as const;

export type ErrorEventApp = (typeof ERROR_EVENT_APPS)[number];

export const ERROR_EVENT_CLIENT_APPS = ['admin-web', 'miniapp-client'] as const;

export type ErrorEventClientApp = (typeof ERROR_EVENT_CLIENT_APPS)[number];

export const ERROR_EVENT_LEVELS = ['warn', 'error', 'fatal'] as const;

export type ErrorEventLevel = (typeof ERROR_EVENT_LEVELS)[number];

export const ERROR_EVENT_APP_SELECT_OPTIONS = ERROR_EVENT_APPS.map((value) => ({
  label: value,
  value,
}));

export const ERROR_EVENT_LEVEL_SELECT_OPTIONS = ERROR_EVENT_LEVELS.map((value) => ({
  label: value,
  value,
}));
