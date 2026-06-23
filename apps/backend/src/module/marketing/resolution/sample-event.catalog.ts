import { MarketingEventType } from '../events/marketing-event.types';

export interface SampleEventDefinition {
  id: string;
  code: string;
  name: string;
  eventType: MarketingEventType;
  delayMs: number;
  simulation?: boolean;
  dryRunOnly?: boolean;
  payload: Record<string, unknown>;
}

export interface SampleScenarioDefinition {
  code: string;
  name: string;
  defaultEventIds: string[];
  events: SampleEventDefinition[];
}

const RUN_CENTER_BASIC: SampleScenarioDefinition = {
  code: 'RUN_CENTER_BASIC',
  name: '跑团中心基础链路',
  defaultEventIds: ['entry_scan', 'share_click', 'pay_success'],
  events: [
    {
      id: 'entry_scan',
      code: 'ENTRY_SCAN',
      name: '入口扫码',
      eventType: MarketingEventType.INSTANCE_CREATED,
      delayMs: 0,
      simulation: true,
      dryRunOnly: true,
      payload: {
        channel: 'qr_scan',
        scene: 'RUN_CENTER_BASIC',
      },
    },
    {
      id: 'share_click',
      code: 'SHARE_CLICK',
      name: '分享点击',
      eventType: MarketingEventType.INTEGRATION_ORDER_CREATED,
      delayMs: 2000,
      simulation: true,
      dryRunOnly: true,
      payload: {
        channel: 'share_card',
        scene: 'RUN_CENTER_BASIC',
      },
    },
    {
      id: 'pay_success',
      code: 'PAY_SUCCESS',
      name: '支付成功',
      eventType: MarketingEventType.INSTANCE_PAID,
      delayMs: 2200,
      simulation: true,
      dryRunOnly: true,
      payload: {
        channel: 'pay',
        scene: 'RUN_CENTER_BASIC',
      },
    },
  ],
};

export const SAMPLE_EVENT_CATALOG: Record<string, SampleScenarioDefinition> = {
  [RUN_CENTER_BASIC.code]: RUN_CENTER_BASIC,
};

export function getSampleScenario(scenarioCode: string): SampleScenarioDefinition | null {
  return SAMPLE_EVENT_CATALOG[scenarioCode] ?? null;
}

export function resolveSampleEvents(scenarioCode: string, sampleEventIds?: string[]): SampleEventDefinition[] {
  const scenario = getSampleScenario(scenarioCode);
  if (!scenario) {
    return [];
  }

  const selectedIds = sampleEventIds?.length ? sampleEventIds : scenario.defaultEventIds;
  const eventMap = new Map(scenario.events.map((event) => [event.id, event] as const));
  return selectedIds.map((eventId) => eventMap.get(eventId)).filter((event): event is SampleEventDefinition => Boolean(event));
}
