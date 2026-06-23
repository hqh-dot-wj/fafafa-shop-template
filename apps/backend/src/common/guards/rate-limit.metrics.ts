import { Counter, register } from 'prom-client';

type RateLimitSource = 'express' | 'throttler' | 'overload_guard';
type RateLimitOutcome = 'fallback' | 'reject';
type RateLimitEventLabel = 'source' | 'scope' | 'outcome';

const RATE_LIMIT_EVENTS_TOTAL = 'rate_limit_events_total';

function getOrCreateRateLimitCounter(): Counter<RateLimitEventLabel> {
  const existing = register.getSingleMetric(RATE_LIMIT_EVENTS_TOTAL);
  if (existing instanceof Counter) {
    return existing as Counter<RateLimitEventLabel>;
  }

  return new Counter<RateLimitEventLabel>({
    name: RATE_LIMIT_EVENTS_TOTAL,
    help: 'Total number of rate-limit events by source, scope and outcome',
    labelNames: ['source', 'scope', 'outcome'],
  });
}

const rateLimitCounter = getOrCreateRateLimitCounter();

export function recordRateLimitEvent(source: RateLimitSource, scope: string, outcome: RateLimitOutcome): void {
  rateLimitCounter.inc({
    source,
    scope: scope || 'unknown',
    outcome,
  });
}
