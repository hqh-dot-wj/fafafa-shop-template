import { NotificationChannel } from './notification.types';

export type NotificationBizType = 'MARKETING_ACTIVITY' | 'SYSTEM' | 'ORDER' | string;
export type NotificationTouchpointKind = 'MESSAGE' | 'SHARE';

export interface NotificationQuietHoursConfig {
  start: string;
  end: string;
  timezone: string;
}

export interface NotificationFrequencyConfig {
  key: string;
  limitPerDay: number;
  sentToday: number;
}

export interface NotificationSuppressionConfig {
  suppressed: boolean;
  reason?: string;
}

export interface NotificationDispatchContext {
  tenantId: string;
  bizType: NotificationBizType;
  bizRefId: string;
  activityId?: string;
  touchpointCode?: string;
  touchpointKind?: NotificationTouchpointKind;
  sceneCode?: string;
  channel: NotificationChannel;
  templateCode?: string;
  templateVersion?: string;
  consentGranted?: boolean;
  requestedAt: Date;
  quietHours?: NotificationQuietHoursConfig;
  frequency?: NotificationFrequencyConfig;
  suppression?: NotificationSuppressionConfig;
}
