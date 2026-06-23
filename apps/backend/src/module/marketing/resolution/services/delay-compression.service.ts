import { Injectable } from '@nestjs/common';
import { SampleEventDefinition } from '../sample-event.catalog';

export interface DelayCompressionConfig {
  enabled?: boolean;
  ratio?: number;
  maxGapMs?: number;
}

export interface TimelineStep {
  eventId: string;
  code: string;
  name: string;
  eventType: string;
  payload: Record<string, unknown>;
  offsetMs: number;
  gapMs: number;
}

@Injectable()
export class DelayCompressionService {
  buildTimeline(events: SampleEventDefinition[], config?: DelayCompressionConfig): TimelineStep[] {
    const enabled = config?.enabled ?? false;
    const ratio = config?.ratio ?? 1;
    const maxGapMs = config?.maxGapMs ?? Number.MAX_SAFE_INTEGER;

    const timeline: TimelineStep[] = [];
    let offsetMs = 0;

    events.forEach((event, index) => {
      const originalGapMs = index === 0 ? 0 : event.delayMs;
      const gapMs = enabled ? this.compressGap(originalGapMs, ratio, maxGapMs) : originalGapMs;

      if (index > 0) {
        offsetMs += gapMs;
      }

      timeline.push({
        eventId: event.id,
        code: event.code,
        name: event.name,
        eventType: event.eventType,
        payload: event.payload,
        offsetMs,
        gapMs,
      });
    });

    return timeline;
  }

  private compressGap(originalGapMs: number, ratio: number, maxGapMs: number): number {
    const normalizedRatio = Number.isFinite(ratio) ? Math.max(0, ratio) : 1;
    const normalizedMaxGapMs = Number.isFinite(maxGapMs) ? Math.max(0, maxGapMs) : Number.MAX_SAFE_INTEGER;
    const compressedGapMs = Math.round(originalGapMs * normalizedRatio);

    return Math.min(normalizedMaxGapMs, compressedGapMs);
  }
}
