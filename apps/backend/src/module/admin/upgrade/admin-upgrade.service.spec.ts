jest.mock('nanoid', () => ({ nanoid: jest.fn(() => 'ABCD') }));

import { Test, TestingModule } from '@nestjs/testing';
import { AdminUpgradeService } from './admin-upgrade.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { UpgradeApplyRepository } from './upgrade-apply.repository';
import { UpgradeReferralService } from './services/upgrade-referral.service';
import { BizOperationLogService } from 'src/module/common/operation-log/biz-operation-log.service';
import { BizOperationActions, BizOperationTargetTypes } from 'src/module/common/operation-log/biz-operation-log.constants';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';

describe('AdminUpgradeService', () => {
  let service: AdminUpgradeService;
  const mockAppend = jest.fn().mockResolvedValue(undefined);
  const mockFindById = jest.fn();
  const mockFindMany = jest.fn().mockResolvedValue([]);
  const mockCount = jest.fn().mockResolvedValue(0);
  const mockMemberFindMany = jest.fn().mockResolvedValue([]);
  const mockMemberFindFirst = jest.fn();
  const mockUmsUpgradeApplyUpdate = jest.fn().mockResolvedValue({});
  const mockUmsMemberUpdate = jest.fn().mockResolvedValue({});
  const mockSysUserFindFirst = jest.fn().mockResolvedValue({ userName: 'opUser' });
  const mockGenerateAndBindCode = jest.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUpgradeService,
        getTenantHelperTestProvider(),
        {
          provide: PrismaService,
          useValue: {
            umsUpgradeApply: { update: mockUmsUpgradeApplyUpdate },
            umsMember: { update: mockUmsMemberUpdate, findMany: mockMemberFindMany, findFirst: mockMemberFindFirst },
            sysUser: { findFirst: mockSysUserFindFirst },
          },
        },
        {
          provide: UpgradeApplyRepository,
          useValue: { findById: mockFindById, findMany: mockFindMany, count: mockCount, countPending: jest.fn() },
        },
        {
          provide: UpgradeReferralService,
          useValue: { generateAndBindCode: mockGenerateAndBindCode },
        },
        {
          provide: BizOperationLogService,
          useValue: { append: mockAppend },
        },
      ],
    }).compile();

    service = module.get(AdminUpgradeService);
  });

  describe('approve', () => {
    const pendingApply = {
      id: 'apply-1',
      memberId: 'mem-1',
      fromLevel: 0,
      toLevel: 1,
      status: 'PENDING' as const,
      tenantId: '000000',
      orderId: null as string | null,
      applyType: 'PRODUCT_PURCHASE' as const,
      referralCode: null,
      referrerId: null,
      createTime: new Date(),
      updateTime: new Date(),
    };

    it('审批通过时应写入会员维度业务操作日志', async () => {
      mockFindById.mockResolvedValue(pendingApply);

      const result = await service.approve('apply-1', { action: 'approve' }, 99);

      expect(result.code).toBe(200);
      expect(mockAppend).toHaveBeenCalledTimes(1);
      expect(mockAppend).toHaveBeenCalledWith({
        operatorId: '99',
        operatorName: 'opUser',
        action: BizOperationActions.MEMBER_UPGRADE_APPROVE,
        targetType: BizOperationTargetTypes.MEMBER,
        targetId: 'mem-1',
        detail: {
          applyId: 'apply-1',
          decision: 'approve',
          fromLevel: 0,
          toLevel: 1,
        },
      });
      expect(mockGenerateAndBindCode).not.toHaveBeenCalled();
    });

    it('审批驳回时应写入会员维度业务操作日志', async () => {
      mockFindById.mockResolvedValue(pendingApply);

      const result = await service.approve('apply-1', { action: 'reject', reason: '材料不全' }, 99);

      expect(result.code).toBe(200);
      expect(mockAppend).toHaveBeenCalledTimes(1);
      expect(mockAppend).toHaveBeenCalledWith({
        operatorId: '99',
        operatorName: 'opUser',
        action: BizOperationActions.MEMBER_UPGRADE_REJECT,
        targetType: BizOperationTargetTypes.MEMBER,
        targetId: 'mem-1',
        detail: {
          applyId: 'apply-1',
          decision: 'reject',
          fromLevel: 0,
          toLevel: 1,
          reason: '材料不全',
        },
      });
    });

    it('Given 申请已处理, When approve, Then 抛出该申请已处理', async () => {
      mockFindById.mockResolvedValue({ ...pendingApply, status: 'APPROVED' });

      try {
        await service.approve('apply-1', { action: 'approve' }, 99);
        fail('应抛出 BusinessException');
      } catch (e) {
        expect(e.getResponse().msg).toBe('该申请已处理');
      }
    });
  });

  describe('findAll', () => {
    it('Given 申请记录包含触发快照, When findAll, Then 返回解析后的活动版本与触发快照', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 'apply-1',
          tenantId: '000000',
          memberId: 'mem-1',
          fromLevel: 0,
          toLevel: 1,
          applyType: 'REFERRAL_CODE',
          status: 'APPROVED',
          orderId: null,
          referralCode: 'T001-ABCD',
          referrerId: 'mem-2',
          reviewRemark: JSON.stringify({
            memberId: 'mem-1',
            tenantId: '000000',
            applyType: 'REFERRAL_CODE',
            referralCode: 'T001-ABCD',
            referrerId: 'mem-2',
            activityVersionId: 'MKT_V20260419',
            triggerTime: '2026-04-19T10:00:00.000Z',
          }),
          createTime: new Date('2026-04-19T10:00:00.000Z'),
          updateTime: new Date('2026-04-19T10:00:00.000Z'),
        },
      ]);
      mockCount.mockResolvedValue(1);
      mockMemberFindMany.mockResolvedValue([
        { memberId: 'mem-1', nickname: '会员A', mobile: '13900000000', avatar: 'avatar.png' },
      ]);

      const result = await service.findAll({
        getDateRange: jest.fn().mockReturnValue(null),
      } as any);

      expect(result.data?.rows?.[0]).toMatchObject({
        memberId: 'mem-1',
        matchedActivityVersion: 'MKT_V20260419',
      });
      expect(result.data?.rows?.[0]?.triggerSnapshot).toMatchObject({
        activityVersionId: 'MKT_V20260419',
        referralCode: 'T001-ABCD',
      });
    });
  });

  describe('manualLevel', () => {
    it('Given 会员已是目标等级, When manualLevel, Then 抛出会员已是该等级', async () => {
      mockMemberFindFirst.mockResolvedValue({
        memberId: 'mem-1',
        levelId: 1,
        referralCode: null,
      });

      try {
        await service.manualLevel('mem-1', { targetLevel: 1 }, 99);
        fail('应抛出 BusinessException');
      } catch (e) {
        expect(e.getResponse().msg).toBe('会员已是该等级');
      }
    });
  });
});
