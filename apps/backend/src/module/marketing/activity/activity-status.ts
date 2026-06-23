export const MARKETING_ACTIVITY_STATUS_VALUES = ['DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED'] as const;

export type MarketingActivityStatus = (typeof MARKETING_ACTIVITY_STATUS_VALUES)[number];

type ActivityStatusSource = {
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  isEnabled: boolean;
};

function toTimestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

export function resolveMarketingActivityStatus(
  activity: ActivityStatusSource,
  now: Date = new Date(),
): MarketingActivityStatus {
  const nowTime = now.getTime();
  const endTime = toTimestamp(activity.endTime);

  if (endTime != null && endTime <= nowTime) {
    return 'ARCHIVED';
  }

  if (activity.isEnabled) {
    return 'PUBLISHED';
  }

  const startTime = toTimestamp(activity.startTime);
  if (startTime != null && startTime <= nowTime) {
    return 'PAUSED';
  }

  return 'DRAFT';
}
