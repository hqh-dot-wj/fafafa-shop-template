import { TeamCourseRuntimeService } from '../services/team-course-runtime.service';

describe('TeamCourseRuntimeService', () => {
  const tenantHelper = {
    readWhereForDelegate: jest.fn((_delegate: string, where: unknown) => where),
    setTenantId: jest.fn((data: Record<string, unknown>) => ({ ...data, tenantId: '000000' })),
  };

  const extensionRepo = {
    findByInstanceId: jest.fn(),
    findSchedulesByExtensionId: jest.fn(),
    findAttendancesByExtensionId: jest.fn(),
    findScheduleByDate: jest.fn(),
    markAttended: jest.fn(),
  };

  const service = new TeamCourseRuntimeService({} as any, tenantHelper as any, extensionRepo as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds team course summary from the leader extension', async () => {
    extensionRepo.findByInstanceId.mockResolvedValue({
      id: 'ext-team-1',
      instanceId: 'team-1',
      tenantId: '000000',
      totalLessons: 8,
      completedLessons: 2,
      classAddress: '长沙校区',
      classStartTime: new Date('2026-05-01T09:00:00.000Z'),
      classEndTime: new Date('2026-05-08T11:00:00.000Z'),
      status: 'ACTIVE',
      schedules: [
        { id: 'schedule-1', status: 'SCHEDULED', teacherId: 'teacher-1', classroomId: 'room-1', capacity: 8 },
        { id: 'schedule-2', status: 'COMPLETED', teacherName: '李老师', serviceCapacity: 8 },
        { id: 'schedule-3', status: 'CANCELLED' },
      ],
      attendances: [
        { id: 'attendance-1', memberId: 'member-1' },
        { id: 'attendance-2', memberId: 'member-1' },
        { id: 'attendance-3', memberId: 'member-2' },
      ],
    });

    const result = await service.getCourseSummary({
      tenantId: '000000',
      teamId: 'team-1',
      teamRuntimeStatus: 'IN_CLASS',
    });

    expect(result).toMatchObject({
      teamId: 'team-1',
      leaderInstanceId: 'team-1',
      extensionId: 'ext-team-1',
      extensionReady: true,
      extensionStatus: 'ACTIVE',
      totalLessons: 8,
      completedLessons: 2,
      pendingLessons: 6,
      scheduleCount: 3,
      completedScheduleCount: 1,
      cancelledScheduleCount: 1,
      teacherBoundScheduleCount: 2,
      classroomBoundScheduleCount: 1,
      capacityBoundScheduleCount: 2,
      attendanceRecordCount: 3,
      attendanceMarkedMemberCount: 2,
      teamRuntimeStatus: 'IN_CLASS',
    });
  });

  it('maps schedule rows with resource snapshots', async () => {
    extensionRepo.findByInstanceId.mockResolvedValue({
      id: 'ext-team-1',
      instanceId: 'team-1',
      tenantId: '000000',
      attendances: [],
      schedules: [],
    });
    extensionRepo.findSchedulesByExtensionId.mockResolvedValue([
      {
        id: 'schedule-1',
        date: new Date('2026-05-01T00:00:00.000Z'),
        startTime: '09:00',
        endTime: '11:00',
        lessons: 2,
        teacherId: 'teacher-1',
        teacherName: '李老师',
        classroomId: 'room-1',
        classroomName: '一号教室',
        location: '长沙校区',
        capacity: 8,
        serviceCapacity: 6,
        resourceSnapshot: { source: 'STORE_PLAY_RULES' },
        status: 'SCHEDULED',
        remark: '首课',
      },
    ]);

    const result = await service.listSchedules({ tenantId: '000000', teamId: 'team-1' });

    expect(result[0]).toMatchObject({
      scheduleId: 'schedule-1',
      teacherName: '李老师',
      classroomName: '一号教室',
      capacity: 8,
      serviceCapacity: 6,
      resourceSnapshot: { source: 'STORE_PLAY_RULES' },
    });
  });

  it('maps attendance rows only for real attendance members', async () => {
    extensionRepo.findByInstanceId.mockResolvedValue({
      id: 'ext-team-1',
      instanceId: 'team-1',
      tenantId: '000000',
      attendances: [],
      schedules: [],
    });
    extensionRepo.findAttendancesByExtensionId.mockResolvedValue([
      {
        id: 'attendance-1',
        memberId: 'member-1',
        date: new Date('2026-05-01T00:00:00.000Z'),
        attended: true,
        remark: '准时到课',
      },
      {
        id: 'attendance-virtual',
        memberId: 'vm-1',
        date: new Date('2026-05-01T00:00:00.000Z'),
        attended: true,
      },
    ]);

    const result = await service.listAttendances({
      tenantId: '000000',
      teamId: 'team-1',
      attendanceMembers: [
        { memberId: 'member-1', name: '学员A', mobile: '13800000001' },
        { memberId: 'member-2', name: '学员B' },
      ],
    });

    expect(result).toEqual([
      {
        attendanceId: 'attendance-1',
        memberId: 'member-1',
        memberName: '学员A',
        memberMobile: '13800000001',
        date: '2026-05-01T00:00:00.000Z',
        attended: true,
        remark: '准时到课',
      },
    ]);
  });

  it('rejects attendance marking for non-real attendance members', async () => {
    extensionRepo.findByInstanceId.mockResolvedValue({
      id: 'ext-team-1',
      instanceId: 'team-1',
      tenantId: '000000',
      attendances: [],
      schedules: [],
    });

    await expect(
      service.markAttendance({
        tenantId: '000000',
        teamId: 'team-1',
        memberId: 'vm-1',
        date: '2026-05-01',
        attendanceMembers: [{ memberId: 'member-1', name: '学员A' }],
      }),
    ).rejects.toMatchObject({
      response: {
        msg: '仅真实履约成员可标记到课',
      },
    });

    expect(extensionRepo.markAttended).not.toHaveBeenCalled();
  });

  it('returns a normalized attendance row after marking attendance', async () => {
    extensionRepo.findByInstanceId.mockResolvedValue({
      id: 'ext-team-1',
      instanceId: 'team-1',
      tenantId: '000000',
      attendances: [],
      schedules: [],
    });
    extensionRepo.findScheduleByDate.mockResolvedValue({
      id: 'schedule-1',
      date: new Date('2026-05-01T00:00:00.000Z'),
    });
    extensionRepo.markAttended.mockResolvedValue({
      id: 'attendance-1',
      memberId: 'member-1',
      date: new Date('2026-05-01T00:00:00.000Z'),
      attended: true,
      remark: '准时到课',
    });

    const result = await service.markAttendance({
      tenantId: '000000',
      teamId: 'team-1',
      memberId: 'member-1',
      date: '2026-05-01',
      remark: '准时到课',
      attendanceMembers: [{ memberId: 'member-1', name: '学员A', mobile: '13800000001' }],
    });

    expect(result).toEqual({
      attendanceId: 'attendance-1',
      memberId: 'member-1',
      memberName: '学员A',
      memberMobile: '13800000001',
      date: '2026-05-01T00:00:00.000Z',
      attended: true,
      remark: '准时到课',
    });
  });
});
