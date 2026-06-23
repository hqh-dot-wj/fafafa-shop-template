import { PointsRuleService } from '../../../marketing/points/rule/rule.service';
import { PointsTaskService } from '../../../marketing/points/task/task.service';
import { PointsPoolAdapter } from '../points-pool.adapter';

describe('PointsPoolAdapter', () => {
  let adapter: PointsPoolAdapter;
  const pointsRuleService = {
    getRules: jest.fn(),
  };
  const pointsTaskService = {
    findAll: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new PointsPoolAdapter(pointsRuleService as unknown as PointsRuleService, pointsTaskService as unknown as PointsTaskService);
  });

  it('should compile points pool with rules and task list', async () => {
    const rules = {
      data: {
        id: 'rule-001',
        systemEnabled: true,
        orderPointsEnabled: true,
      },
    };
    const tasks = {
      data: {
        rows: [
          { id: 'task-001', taskName: '领取', status: 'ENABLE' },
          { id: 'task-002', taskName: '邀请', status: 'ENABLE' },
        ],
      },
    };
    pointsRuleService.getRules.mockResolvedValue(rules);
    pointsTaskService.findAll.mockResolvedValue(tasks);

    const result = await adapter.compile({
      poolType: 'POINTS',
      taskId: 'task-001',
    });

    expect(pointsRuleService.getRules).toHaveBeenCalledTimes(1);
    expect(pointsTaskService.findAll).toHaveBeenCalledTimes(1);
    expect(pointsTaskService.findAll).toHaveBeenCalledWith({ pageNum: 1, pageSize: 10 });
    expect(result.poolType).toBe('POINTS');
    expect(result.poolId).toBe('task-001');
    expect(result.compileTarget.owner).toBe('marketing points');
    expect(result.preview.taskId).toBe('task-001');
    expect(result.preview.task).toMatchObject({ id: 'task-001', taskName: '领取' });
    expect(result.preview.rules).toEqual(rules.data);
    expect(result.preview.pointsTasks).toEqual(tasks.data.rows);
    expect(Array.isArray(result.riskSummary)).toBe(true);
    expect(result.riskSummary.length).toBeGreaterThan(0);
  });

  it('should mark missing task risk when task list does not include taskId', async () => {
    pointsRuleService.getRules.mockResolvedValue({
      data: {
        id: 'rule-001',
        systemEnabled: false,
      },
    });
    pointsTaskService.findAll.mockResolvedValue({
      data: {
        rows: [{ id: 'task-002' }],
        total: 1,
      },
    });

    const result = await adapter.compile({
      poolType: 'POINTS',
      taskId: 'task-missing',
    });

    expect(pointsTaskService.findAll).toHaveBeenCalledTimes(1);
    expect(result.poolId).toBe('task-missing');
    expect(Array.isArray(result.riskSummary)).toBe(true);
    expect(result.riskSummary.length).toBeGreaterThan(0);
    expect(result.riskSummary).toEqual(expect.arrayContaining([expect.stringContaining('taskId')]));
  });
});
