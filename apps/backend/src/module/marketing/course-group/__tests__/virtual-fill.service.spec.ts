import { VirtualFillService } from '../services/virtual-fill.service';

describe('VirtualFillService', () => {
  let service: VirtualFillService;

  beforeEach(() => {
    service = new VirtualFillService();
  });

  it('should append add fact and expose active virtual members', () => {
    const added = service.addVirtualFillFact({}, {
      virtualMemberId: 'vm-1',
      displayName: '虚拟成员1',
      sourceType: 'AUTO',
      createdByType: 'SYSTEM',
      createdById: 'system',
      createdAt: '2026-04-23T10:00:00.000Z',
    });

    expect(added.record).toMatchObject({
      opType: 'ADD',
      virtualMemberId: 'vm-1',
      displayName: '虚拟成员1',
    });
    expect(service.listActiveVirtualMembers(added.nextInstanceData)).toEqual([
      expect.objectContaining({
        virtualMemberId: 'vm-1',
        displayName: '虚拟成员1',
      }),
    ]);
  });

  it('should keep audit log append-only when removing a virtual member', () => {
    const added = service.addVirtualFillFact({}, {
      virtualMemberId: 'vm-1',
      displayName: '虚拟成员1',
      sourceType: 'LEADER_MANUAL',
      createdByType: 'LEADER',
      createdById: 'leader-1',
      createdAt: '2026-04-23T10:00:00.000Z',
    });

    const removed = service.removeVirtualFillFact(added.nextInstanceData, {
      virtualMemberId: 'vm-1',
      sourceType: 'LEADER_MANUAL',
      createdByType: 'LEADER',
      createdById: 'leader-1',
      createdAt: '2026-04-23T10:05:00.000Z',
      reason: '真实用户补位',
    });

    expect(service.listActiveVirtualMembers(removed.nextInstanceData)).toEqual([]);
    expect(removed.audits).toHaveLength(2);
    expect(removed.audits.map(item => item.opType)).toEqual(['ADD', 'REMOVE']);
  });

  it('should reject duplicate active virtual member ids', () => {
    const added = service.addVirtualFillFact({}, {
      virtualMemberId: 'vm-1',
      displayName: '虚拟成员1',
      sourceType: 'AUTO',
      createdByType: 'SYSTEM',
      createdById: 'system',
      createdAt: '2026-04-23T10:00:00.000Z',
    });

    expect(
      expectBusinessError(() =>
        service.addVirtualFillFact(added.nextInstanceData, {
          virtualMemberId: 'vm-1',
          displayName: '重复虚拟成员',
          sourceType: 'AUTO',
          createdByType: 'SYSTEM',
          createdById: 'system',
          createdAt: '2026-04-23T10:01:00.000Z',
        }),
      ),
    ).toBe('虚拟补位成员已存在');
  });

  it('should reject removing a virtual member that is not active', () => {
    expect(
      expectBusinessError(() =>
        service.removeVirtualFillFact({}, {
          virtualMemberId: 'vm-missing',
          sourceType: 'ADMIN_MANUAL',
          createdByType: 'ADMIN',
          createdById: 'admin-1',
          createdAt: '2026-04-23T10:05:00.000Z',
        }),
      ),
    ).toBe('虚拟补位成员不存在或已移除');
  });
});

function expectBusinessError(action: () => unknown) {
  try {
    action();
  } catch (error) {
    const businessError = error as { response?: { msg?: string } };
    return businessError.response?.msg;
  }

  throw new Error('Expected business exception to be thrown');
}
