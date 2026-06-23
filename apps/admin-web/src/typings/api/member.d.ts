declare namespace Api {
  namespace Member {
    /** Member Object */
    interface Member {
      memberId: string;
      nickname: string;
      avatar: string;
      mobile: string;
      status: '1' | '2'; // 1: Normal, 2: Disabled
      createTime: string;
      tenantId: string;
      tenantName: string;
      referrerId?: string;
      referrerName?: string;
      referrerMobile?: string;
      indirectReferrerId?: string;
      indirectReferrerName?: string;
      indirectReferrerMobile?: string;
      balance: number;
      points: number;
      commission: number;
      totalConsumption: number;
      orderCount: number;
      levelId: number;
      levelName: string;
    }

    /** Member Point History */
    interface PointHistory {
      id: string;
      memberId: string;
      /** 变动积分 (正数为增加，负数为减少) */
      changePoints: number;
      /** 变动后积分 */
      afterPoints: number;
      /** 变动原因/场景: SIGN_IN, CONSUMPTION, MANUAL_ADJUST, etc. */
      type: string;
      /** 场景描述 */
      typeName?: string;
      /** 备注/人工调整原因 */
      remark?: string;
      createTime: string;
    }

    /** Point History Search Params */
    interface PointHistorySearchParams extends Common.PaginatingCommonParams {
      memberId?: string;
    }

    /** Point History List */
    type PointHistoryList = Common.PaginatingQueryRecord<PointHistory>;

    /** Manual Point Adjustment */
    interface PointAdjustment {
      memberId: string;
      /** 变动量 */
      amount: number;
      /** 原因 */
      remark: string;
    }

    /** Search Params */
    interface MemberSearchParams extends Common.CommonSearchParams {
      nickname?: string;
      mobile?: string;
      /** 会员等级（字典 member_level） */
      levelId?: number | null;
      [key: string]: unknown;
    }

    /** List Response */
    type MemberList = Common.PaginatingQueryRecord<Member>;

    /** Update Referrer Params */
    interface UpdateReferrerParams {
      memberId: string;
      referrerId: string;
    }

    /** Update Tenant Params */
    interface UpdateTenantParams {
      memberId: string;
      tenantId: string;
    }

    type UpgradeApplyType = 'PRODUCT_PURCHASE' | 'REFERRAL_CODE' | 'MANUAL_ADJUST';

    /** Upgrade Apply Record */
    interface UpgradeTriggerSnapshot {
      memberId: string;
      tenantId: string;
      applyType: UpgradeApplyType;
      referralCode?: string | null;
      orderId?: string | null;
      referrerId?: string | null;
      activityVersionId?: string | null;
      attributionWindowMinutes?: number | null;
      shareChannel?: string | null;
      sourceSceneCode?: string | null;
      sourceModuleCode?: string | null;
      sourcePagePath?: string | null;
      shareUserId?: string | null;
      activityContextKey?: string | null;
      currentLevel?: number | null;
      nextLevel?: number | null;
      teamSize?: number | null;
      estimatedCommission?: number | null;
      triggerTime: string;
    }

    /** OpenAPI 待补全：升级链路营销字段扩展 */
    type UpgradeApplyProtocolExt = {
      triggerSnapshot?: UpgradeTriggerSnapshot | null;
      matchedActivityVersion?: string | null;
    };

    type UpgradeApply = Common.CommonRecord<{
      id: string;
      tenantId: string;
      memberId: string;
      fromLevel: number;
      toLevel: number;
      applyType: UpgradeApplyType;
      referralCode: string | null;
      orderId: string | null;
      referrerId: string | null;
      status: 'PENDING' | 'APPROVED' | 'REJECTED';
      member?: {
        memberId: string;
        nickname: string;
        mobile: string;
        avatar: string;
      };
      fromLevelName: string;
      toLevelName: string;
    }> &
      UpgradeApplyProtocolExt;

    /** Upgrade Apply Search Params */
    type UpgradeApplySearchParams = Common.CommonSearchParams & {
      memberId?: string;
      status?: string;
      applyType?: string;
    };

    /** 会员业务操作日志查询 */
    interface MemberOperationLogParams extends Common.PaginatingCommonParams {
      memberId: string;
    }

    type MemberOperationLogList = Common.PaginatingQueryRecord<Api.Common.BizOperationLogItem>;
  }
}
