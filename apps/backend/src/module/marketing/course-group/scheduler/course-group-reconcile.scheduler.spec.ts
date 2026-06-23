import { IncidentType } from '../../resolution/vo/incident.vo';
import { CourseGroupReconcileScheduler } from './course-group-reconcile.scheduler';

describe('CourseGroupReconcileScheduler', () => {
  const courseGroupBuyService = {
    runReconcileSweep: jest.fn(),
  };

  const redisService = {
    tryLock: jest.fn(),
    unlock: jest.fn(),
  };

  const incidentService = {
    reportIncident: jest.fn(),
  };

  let scheduler: CourseGroupReconcileScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new CourseGroupReconcileScheduler(
      courseGroupBuyService as any,
      redisService as any,
      incidentService as any,
    );
  });

  it('should skip reconcile sweep when scheduler lock is unavailable', async () => {
    redisService.tryLock.mockResolvedValue(null);

    await scheduler.handleReconcileSweep();

    expect(courseGroupBuyService.runReconcileSweep).not.toHaveBeenCalled();
    expect(incidentService.reportIncident).not.toHaveBeenCalled();
  });

  it('should report returned incidents from reconcile sweep', async () => {
    redisService.tryLock.mockResolvedValue('token-2');
    redisService.unlock.mockResolvedValue(1);
    courseGroupBuyService.runReconcileSweep.mockResolvedValue([
      {
        id: 'course-group:team-1:TEAM_EFFECT_APPLY_FAILED',
        tenantId: '000000',
        type: IncidentType.TEAM_EFFECT_APPLY_FAILED,
        level: 'HIGH',
        status: 'OPEN',
        title: '拼课副作用补偿失败',
        message: '排课补偿失败',
        occurredAt: '2026-04-23T12:00:00.000Z',
      },
    ]);

    await scheduler.handleReconcileSweep();

    expect(courseGroupBuyService.runReconcileSweep).toHaveBeenCalledTimes(1);
    expect(incidentService.reportIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        type: IncidentType.TEAM_EFFECT_APPLY_FAILED,
        tenantId: '000000',
      }),
    );
    expect(redisService.unlock).toHaveBeenCalledWith('lock:marketing:course-group:reconcile-sweep', 'token-2');
  });
});
