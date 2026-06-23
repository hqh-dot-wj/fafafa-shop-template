import { BadRequestException, Injectable } from '@nestjs/common';
import { CandidateLoaderService } from './services/candidate-loader.service';
import { EligibilityFilterService } from './services/eligibility-filter.service';
import { AggregateSelectorService } from './services/aggregate-selector.service';
import { ActivityContextTokenService } from './services/activity-context-token.service';
import { ResolutionRepository } from './resolution.repository';
import { SimulateDto, SimulationExecutionMode } from './dto/simulate.dto';
import { Result } from 'src/common/response/result';
import { DelayCompressionService } from './services/delay-compression.service';
import { getSampleScenario, resolveSampleEvents } from './sample-event.catalog';
import { MessageTouchpointDispatcher } from '../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../events/marketing-event.types';

@Injectable()
export class SimulatorService {
  constructor(
    private readonly candidateLoader: CandidateLoaderService,
    private readonly eligibilityFilter: EligibilityFilterService,
    private readonly aggregateSelector: AggregateSelectorService,
    private readonly tokenService: ActivityContextTokenService,
    private readonly repository: ResolutionRepository,
    private readonly delayCompressionService: DelayCompressionService,
    private readonly messageTouchpointDispatcher: MessageTouchpointDispatcher,
  ) {}

  /**
   * 模拟裁决过程：加载候选 → 过滤资格 → 选主活动 → 写审计记录
   *
   * @param dto - 模拟参数（租户、商品、会员、时间等）
   * @returns 裁决模拟结果（候选、有资格、被过滤、最终选中）
   */
  async simulate(dto: SimulateDto) {
    const executionMode = dto.executionMode ?? SimulationExecutionMode.PREVIEW;
    const scenarioCode = dto.scenarioCode ?? 'RUN_CENTER_BASIC';
    const scenario = getSampleScenario(scenarioCode);

    if (!scenario) {
      throw new BadRequestException(`未知的模拟场景：${scenarioCode}`);
    }

    const sampleEvents = resolveSampleEvents(scenarioCode, dto.sampleEventIds);
    if (dto.sampleEventIds?.length && sampleEvents.length !== dto.sampleEventIds.length) {
      throw new BadRequestException(`模拟场景 ${scenarioCode} 中存在未知的样例事件 ID`);
    }
    const timeline = this.delayCompressionService.buildTimeline(sampleEvents, dto.delayCompression);
    const candidates = await this.candidateLoader.loadCandidates(dto.tenantId, dto.productId);

    const { eligible, filtered } = this.eligibilityFilter.filterCandidates(candidates, {
      memberId: dto.memberId || '',
      now: dto.simulateTime ? new Date(dto.simulateTime) : new Date(),
      isNewcomer: dto.isNewcomer,
      memberLevel: dto.memberLevel,
    });

    const selected = await this.aggregateSelector.selectMainActivity(dto.tenantId, eligible);

    const sideEffectsExecuted = executionMode === SimulationExecutionMode.COMMIT;

    if (sideEffectsExecuted) {
      await this.emitSampleEvents({
        tenantId: dto.tenantId,
        productId: dto.productId,
        memberId: dto.memberId || 'SIMULATOR',
        scenarioCode,
        selectedConfigId: selected?.id || null,
        timeline,
      });

      await this.repository.createAudit({
        tenantId: dto.tenantId,
        productId: dto.productId,
        memberId: dto.memberId || 'SIMULATOR',
        scene: scenarioCode,
        candidateSnapshot: candidates.map((c) => ({ id: c.id, type: c.templateCode, status: c.status })),
        filteredSnapshot: filtered.map((f) => ({
          configId: f.config.id,
          type: f.config.templateCode,
          reason: f.reason,
        })),
        selectedActivityType: selected?.templateCode || null,
        selectedConfigId: selected?.id || null,
      });
    }

    return Result.ok({
      executionMode,
      scenarioCode,
      timeline,
      candidateCount: candidates.length,
      candidates: candidates.map((c) => ({
        id: c.id,
        type: c.templateCode,
        status: c.status,
        displayPriority: c.displayPriority,
      })),
      eligibleCount: eligible.length,
      eligible: eligible.map((c) => ({ id: c.id, type: c.templateCode })),
      filteredCount: filtered.length,
      filtered: filtered.map((f) => ({
        configId: f.config.id,
        type: f.config.templateCode,
        reason: f.reason,
      })),
      selectedActivity: selected
        ? {
            configId: selected.id,
            activityType: selected.templateCode,
            activityContextKey: this.tokenService.issue({
              tenantId: dto.tenantId,
              memberId: dto.memberId ?? null,
              activityType: selected.templateCode,
              activityConfigId: selected.id,
            }),
            commissionMode: selected.commissionMode,
          }
        : null,
      sideEffects: {
        executed: sideEffectsExecuted,
        emittedCount: sideEffectsExecuted ? timeline.length : 0,
      },
      ...(dto.probeEnabled
        ? {
            probe: {
              steps: timeline.map((step) => ({
                code: step.code,
                eventType: step.eventType,
                offsetMs: step.offsetMs,
              })),
            },
          }
        : {}),
    });
  }

  private async emitSampleEvents(input: {
    tenantId: string;
    productId: string;
    memberId: string;
    scenarioCode: string;
    selectedConfigId: string | null;
    timeline: Array<{
      eventId: string;
      eventType: string;
      code: string;
      name: string;
      offsetMs: number;
      payload: Record<string, unknown>;
    }>;
  }) {
    for (const step of input.timeline) {
      await this.messageTouchpointDispatcher.dispatch({
        tenantId: input.tenantId,
        type: step.eventType as MarketingEventType,
        instanceId: `${input.productId}:${input.scenarioCode}:${step.eventId}`,
        configId: input.selectedConfigId || input.productId,
        memberId: input.memberId,
        payload: {
          ...step.payload,
          simulation: true,
          dryRunOnly: true,
          scenarioCode: input.scenarioCode,
          sampleEventId: step.eventId,
          sampleEventCode: step.code,
          sampleEventName: step.name,
          timelineOffsetMs: step.offsetMs,
        },
        timestamp: new Date(Date.now() + step.offsetMs),
      });
    }
  }
}
