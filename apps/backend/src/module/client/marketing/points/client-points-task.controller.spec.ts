import { BusinessException } from 'src/common/exceptions';
import { PointsTaskService } from 'src/module/marketing/points/task/task.service';
import { ClientPointsTaskController } from './client-points-task.controller';

describe('ClientPointsTaskController', () => {
  const taskService = {
    findAll: jest.fn(),
    completeTask: jest.fn(),
    getUserCompletions: jest.fn(),
  };

  let controller: ClientPointsTaskController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ClientPointsTaskController(taskService as unknown as PointsTaskService);
  });

  it('Given available tasks request, When findAvailableTasks, Then only enabled tasks are queried', async () => {
    taskService.findAll.mockResolvedValue({ data: { rows: [] } });

    await controller.findAvailableTasks();

    expect(taskService.findAll).toHaveBeenCalledWith({ isEnabled: true });
  });

  it('Given current member, When completeTask, Then memberId comes from auth context', async () => {
    taskService.completeTask.mockResolvedValue({ data: { pointsAwarded: 5 } });

    await controller.completeTask('member-current', 'DAILY_SIGNIN');

    expect(taskService.completeTask).toHaveBeenCalledWith('member-current', 'DAILY_SIGNIN');
  });

  it('Given blank task key, When completeTask, Then reject before service access', async () => {
    await expect(controller.completeTask('member-current', ' ')).rejects.toThrow(BusinessException);

    expect(taskService.completeTask).not.toHaveBeenCalled();
  });

  it('Given completion list query, When page values are numeric strings, Then normalize pagination', async () => {
    taskService.getUserCompletions.mockResolvedValue({ data: { rows: [], total: 0 } });

    await controller.getMyCompletions('member-current', '2', '20');

    expect(taskService.getUserCompletions).toHaveBeenCalledWith('member-current', 2, 20);
  });

  it('Given invalid page query, When getMyCompletions, Then reject before service access', async () => {
    await expect(controller.getMyCompletions('member-current', '-1', '20')).rejects.toThrow(BusinessException);

    expect(taskService.getUserCompletions).not.toHaveBeenCalled();
  });
});
