import { Injectable } from '@nestjs/common';
import { NotificationDispatchContext, NotificationQuietHoursConfig } from '../interfaces/notification-dispatch-context.types';
import { NotificationPolicyDecision, NotificationPolicyRejectReason, NotificationPolicySnapshot } from '../interfaces/notification-policy.types';

@Injectable()
export class NotificationPolicyService {
  evaluate(context: NotificationDispatchContext): NotificationPolicyDecision {
    const quietHoursMatched = context.quietHours ? this.isInQuietHours(context.requestedAt, context.quietHours) : false;
    const consentGranted = context.consentGranted !== false;
    const frequencyExceeded = context.frequency
      ? context.frequency.limitPerDay > 0 && context.frequency.sentToday >= context.frequency.limitPerDay
      : false;
    const suppressionMatched = Boolean(context.suppression?.suppressed);

    if (suppressionMatched) {
      return this.reject('SUPPRESSED', 'Suppression rule matched, dispatch rejected', {
        quietHoursMatched,
        consentGranted,
        frequencyExceeded,
        suppressionMatched,
      });
    }

    if (!consentGranted) {
      return this.reject('CONSENT_REQUIRED', 'Consent is required before dispatch', {
        quietHoursMatched,
        consentGranted,
        frequencyExceeded,
        suppressionMatched,
      });
    }

    if (quietHoursMatched) {
      return this.reject('QUIET_HOURS', 'Current time falls into quiet hours', {
        quietHoursMatched,
        consentGranted,
        frequencyExceeded,
        suppressionMatched,
      });
    }

    if (frequencyExceeded) {
      return this.reject('FREQUENCY_LIMIT', 'Frequency limit exceeded', {
        quietHoursMatched,
        consentGranted,
        frequencyExceeded,
        suppressionMatched,
      });
    }

    return {
      allowed: true,
      snapshot: this.buildSnapshot(undefined, {
        quietHoursMatched,
        consentGranted,
        frequencyExceeded,
        suppressionMatched,
      }),
    };
  }

  private reject(
    reason: NotificationPolicyRejectReason,
    message: string,
    metrics: Pick<
      NotificationPolicySnapshot,
      'quietHoursMatched' | 'consentGranted' | 'frequencyExceeded' | 'suppressionMatched'
    >,
  ): NotificationPolicyDecision {
    return {
      allowed: false,
      reason,
      message,
      snapshot: this.buildSnapshot(reason, metrics),
    };
  }

  private buildSnapshot(
    reason: NotificationPolicyRejectReason | undefined,
    metrics: Pick<
      NotificationPolicySnapshot,
      'quietHoursMatched' | 'consentGranted' | 'frequencyExceeded' | 'suppressionMatched'
    >,
  ): NotificationPolicySnapshot {
    return {
      allowed: !reason,
      reason,
      quietHoursMatched: metrics.quietHoursMatched,
      consentGranted: metrics.consentGranted,
      frequencyExceeded: metrics.frequencyExceeded,
      suppressionMatched: metrics.suppressionMatched,
      evaluatedAt: new Date().toISOString(),
    };
  }

  private isInQuietHours(requestedAt: Date, quietHours: NotificationQuietHoursConfig): boolean {
    const startMinutes = this.parseHourMinute(quietHours.start);
    const endMinutes = this.parseHourMinute(quietHours.end);
    const currentMinutes = this.resolveMinutesInTimezone(requestedAt, quietHours.timezone);

    if (startMinutes === endMinutes) {
      return false;
    }

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  private parseHourMinute(value: string): number {
    const [hourRaw, minuteRaw] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return 0;
    }
    return hour * 60 + minute;
  }

  private resolveMinutesInTimezone(date: Date, timezone: string): number {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(date);
      const hour = Number(parts.find(item => item.type === 'hour')?.value ?? '0');
      const minute = Number(parts.find(item => item.type === 'minute')?.value ?? '0');
      return hour * 60 + minute;
    } catch {
      return date.getHours() * 60 + date.getMinutes();
    }
  }
}
