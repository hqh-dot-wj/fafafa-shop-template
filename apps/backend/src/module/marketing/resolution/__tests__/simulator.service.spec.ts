import { Test } from '@nestjs/testing';
import { SimulatorService } from '../simulator.service';
import { CandidateLoaderService } from '../services/candidate-loader.service';
import { EligibilityFilterService } from '../services/eligibility-filter.service';
import { AggregateSelectorService } from '../services/aggregate-selector.service';
import { ActivityContextTokenService } from '../services/activity-context-token.service';
import { ResolutionRepository } from '../resolution.repository';
import { DelayCompressionService } from '../services/delay-compression.service';
import { MessageTouchpointDispatcher } from '../../events/message-touchpoint.dispatcher';
import { SimulationExecutionMode } from '../dto/simulate.dto';

describe('SimulatorService', () => {
  let service: SimulatorService;
  let candidateLoader: { loadCandidates: jest.Mock };
  let eligibilityFilter: { filterCandidates: jest.Mock };
  let aggregateSelector: { selectMainActivity: jest.Mock };
  let repository: { createAudit: jest.Mock };
  let messageTouchpointDispatcher: { dispatch: jest.Mock };
  let tokenService: { issue: jest.Mock };

  beforeEach(async () => {
    candidateLoader = { loadCandidates: jest.fn() };
    eligibilityFilter = { filterCandidates: jest.fn() };
    aggregateSelector = { selectMainActivity: jest.fn() };
    repository = { createAudit: jest.fn().mockResolvedValue(undefined) };
    messageTouchpointDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    tokenService = { issue: jest.fn((input) => `token:${input.activityType}:${input.activityConfigId}`) };

    const module = await Test.createTestingModule({
      providers: [
        SimulatorService,
        { provide: CandidateLoaderService, useValue: candidateLoader },
        { provide: EligibilityFilterService, useValue: eligibilityFilter },
        { provide: AggregateSelectorService, useValue: aggregateSelector },
        { provide: ActivityContextTokenService, useValue: tokenService },
        { provide: ResolutionRepository, useValue: repository },
        DelayCompressionService,
        { provide: MessageTouchpointDispatcher, useValue: messageTouchpointDispatcher },
      ],
    }).compile();

    service = module.get(SimulatorService);
  });

  it('应该压缩时间线并返回 offsetMs', async () => {
    candidateLoader.loadCandidates.mockResolvedValue([]);
    eligibilityFilter.filterCandidates.mockReturnValue({ eligible: [], filtered: [] });
    aggregateSelector.selectMainActivity.mockResolvedValue(null);

    const result = await service.simulate({
      tenantId: 'tenant-1',
      productId: 'product-1',
      executionMode: SimulationExecutionMode.PREVIEW,
      scenarioCode: 'RUN_CENTER_BASIC',
      delayCompression: {
        enabled: true,
        ratio: 0.5,
        maxGapMs: 1000,
      },
    });

    expect(result.data?.timeline).toEqual([
      expect.objectContaining({ code: 'ENTRY_SCAN', offsetMs: 0, gapMs: 0 }),
      expect.objectContaining({ code: 'SHARE_CLICK', offsetMs: 1000, gapMs: 1000 }),
      expect.objectContaining({ code: 'PAY_SUCCESS', offsetMs: 2000, gapMs: 1000 }),
    ]);
  });

  it('应该在预览模式下不执行副作用', async () => {
    candidateLoader.loadCandidates.mockResolvedValue([]);
    eligibilityFilter.filterCandidates.mockReturnValue({ eligible: [], filtered: [] });
    aggregateSelector.selectMainActivity.mockResolvedValue(null);

    const result = await service.simulate({
      tenantId: 'tenant-1',
      productId: 'product-1',
      executionMode: SimulationExecutionMode.PREVIEW,
      scenarioCode: 'RUN_CENTER_BASIC',
    });

    expect(repository.createAudit).not.toHaveBeenCalled();
    expect(messageTouchpointDispatcher.dispatch).not.toHaveBeenCalled();
    expect(result.data?.sideEffects).toEqual({ executed: false, emittedCount: 0 });
  });

  it('应该在提交模拟事件时标记 dry-run 隔离上下文', async () => {
    candidateLoader.loadCandidates.mockResolvedValue([]);
    eligibilityFilter.filterCandidates.mockReturnValue({ eligible: [], filtered: [] });
    aggregateSelector.selectMainActivity.mockResolvedValue({ id: 'activity-1', templateCode: 'NEWCOMER_EXCLUSIVE' });

    const result = await service.simulate({
      tenantId: 'tenant-1',
      productId: 'product-1',
      memberId: 'member-1',
      executionMode: SimulationExecutionMode.COMMIT,
      scenarioCode: 'RUN_CENTER_BASIC',
      sampleEventIds: ['pay_success'],
    });

    expect(messageTouchpointDispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          simulation: true,
          dryRunOnly: true,
          scenarioCode: 'RUN_CENTER_BASIC',
          sampleEventId: 'pay_success',
        }),
      }),
    );
    expect(result.data?.sideEffects).toEqual({ executed: true, emittedCount: 1 });
  });

  it('应该返回 probe steps 的 code 序列', async () => {
    candidateLoader.loadCandidates.mockResolvedValue([]);
    eligibilityFilter.filterCandidates.mockReturnValue({ eligible: [], filtered: [] });
    aggregateSelector.selectMainActivity.mockResolvedValue(null);

    const result = await service.simulate({
      tenantId: 'tenant-1',
      productId: 'product-1',
      executionMode: SimulationExecutionMode.REPLAY,
      scenarioCode: 'RUN_CENTER_BASIC',
      probeEnabled: true,
    });

    expect(result.data?.probe?.steps.map((step) => step.code)).toEqual(['ENTRY_SCAN', 'SHARE_CLICK', 'PAY_SUCCESS']);
  });
});
