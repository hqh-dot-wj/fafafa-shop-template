export type NotificationPolicyRejectReason = 'QUIET_HOURS' | 'CONSENT_REQUIRED' | 'FREQUENCY_LIMIT' | 'SUPPRESSED';

export interface NotificationPolicySnapshot {
  allowed: boolean;
  reason?: NotificationPolicyRejectReason;
  quietHoursMatched: boolean;
  consentGranted: boolean;
  frequencyExceeded: boolean;
  suppressionMatched: boolean;
  evaluatedAt: string;
}

export interface NotificationPolicyDecision {
  allowed: boolean;
  reason?: NotificationPolicyRejectReason;
  message?: string;
  snapshot: NotificationPolicySnapshot;
}
