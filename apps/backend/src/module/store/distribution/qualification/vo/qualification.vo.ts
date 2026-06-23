import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DistributionCapabilityVo {
  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '租户ID' })
  tenantId: string;

  @ApiProperty({ description: '等级，0=普通，1=C1，2=C2' })
  levelId: number;

  @ApiProperty({ description: '档案状态' })
  profileStatus: string;

  @ApiProperty({ description: '是否可分享' })
  canShare: boolean;

  @ApiProperty({ description: '是否可获得正式佣金' })
  canEarnCommission: boolean;

  @ApiProperty({ description: '是否可提现' })
  canWithdraw: boolean;

  @ApiProperty({ description: '是否可建立团队关系' })
  canBindRelation: boolean;

  @ApiProperty({ description: '是否可获得二级佣金' })
  canEarnL2: boolean;

  @ApiProperty({ description: '待激活收益金额' })
  pendingRewardAmount: number;
}

export class QualificationServicePolicyVo {
  @ApiProperty({ description: 'ID' })
  id: number;

  @ApiProperty({ description: '目标类型' })
  targetType: string;

  @ApiProperty({ description: '目标ID' })
  targetId: string;

  @ApiProperty({ description: '是否可分佣' })
  commissionEligible: boolean;

  @ApiProperty({ description: '是否可作为资格材料' })
  qualificationEligible: boolean;

  @ApiProperty({ description: '普通用户是否允许分享' })
  allowLv0Share: boolean;

  @ApiProperty({ description: '普通用户待激活收益模式' })
  lv0RewardMode: string;

  @ApiProperty({ description: '是否需要风险确认' })
  requireRiskConfirm: boolean;

  @ApiPropertyOptional({ description: '风险确认时间' })
  riskConfirmedAt?: string;

  @ApiPropertyOptional({ description: '风险确认人' })
  riskConfirmedBy?: string;

  @ApiProperty({ description: '是否启用' })
  isActive: boolean;

  @ApiProperty({ description: '创建时间' })
  createTime: string;

  @ApiProperty({ description: '更新时间' })
  updateTime: string;
}

export class QualificationRuleVo {
  @ApiProperty({ description: 'ID' })
  id: number;

  @ApiProperty({ description: '目标等级' })
  targetLevelId: number;

  @ApiProperty({ description: '所需材料数量' })
  requiredEvidenceCount: number;

  @ApiPropertyOptional({ description: '限定服务策略ID', type: [Number] })
  requiredServicePolicyIds?: number[];

  @ApiProperty({ description: '是否需要人工审核' })
  requireManualReview: boolean;

  @ApiProperty({ description: '最低服务订单金额' })
  minOrderAmount: number;

  @ApiProperty({ description: '最小注册天数' })
  minRegisterDays: number;

  @ApiProperty({ description: '是否要求实名' })
  requireRealName: boolean;

  @ApiProperty({ description: '是否启用' })
  isActive: boolean;

  @ApiProperty({ description: '创建时间' })
  createTime: string;

  @ApiProperty({ description: '更新时间' })
  updateTime: string;
}

export class QualificationEvidenceVo {
  @ApiProperty({ description: 'ID' })
  id: string;

  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '订单ID' })
  orderId: string;

  @ApiPropertyOptional({ description: '订单项ID' })
  orderItemId?: number;

  @ApiPropertyOptional({ description: '商品ID' })
  productId?: string;

  @ApiPropertyOptional({ description: 'SKU ID' })
  skuId?: string;

  @ApiPropertyOptional({ description: '服务策略ID' })
  servicePolicyId?: number;

  @ApiPropertyOptional({ description: '来源分享人ID' })
  sourceShareUserId?: string;

  @ApiProperty({ description: '材料状态' })
  evidenceStatus: string;

  @ApiPropertyOptional({ description: '核销时间' })
  verifiedAt?: string;

  @ApiPropertyOptional({ description: '使用申请ID' })
  usedApplicationId?: string;

  @ApiPropertyOptional({ description: '失效原因' })
  invalidReason?: string;

  @ApiProperty({ description: '创建时间' })
  createTime: string;
}

export class QualificationApplicationVo {
  @ApiProperty({ description: 'ID' })
  id: string;

  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '目标等级' })
  targetLevelId: number;

  @ApiPropertyOptional({ description: '材料ID', type: [String] })
  evidenceIds?: string[];

  @ApiProperty({ description: '申请状态' })
  status: string;

  @ApiPropertyOptional({ description: '审核人ID' })
  reviewerId?: string;

  @ApiPropertyOptional({ description: '审核时间' })
  reviewTime?: string;

  @ApiPropertyOptional({ description: '审核备注' })
  reviewRemark?: string;

  @ApiPropertyOptional({ description: '通过后的档案ID' })
  approvedProfileId?: string;

  @ApiPropertyOptional({ description: '申请说明' })
  applyReason?: string;

  @ApiProperty({ description: '创建时间' })
  createTime: string;
}

export class DistributorProfileVo {
  @ApiProperty({ description: 'ID' })
  id: string;

  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '状态' })
  status: string;

  @ApiProperty({ description: '等级' })
  levelId: number;

  @ApiProperty({ description: '资格生效时间' })
  qualifiedAt: string;

  @ApiPropertyOptional({ description: '来源申请ID' })
  sourceApplicationId?: string;

  @ApiProperty({ description: '是否可提现' })
  canWithdraw: boolean;

  @ApiProperty({ description: '是否可绑定团队关系' })
  canBindRelation: boolean;

  @ApiProperty({ description: '是否可获得二级佣金' })
  canEarnL2: boolean;

  @ApiPropertyOptional({ description: '冻结原因' })
  frozenReason?: string;

  @ApiPropertyOptional({ description: '撤销原因' })
  revokedReason?: string;

  @ApiProperty({ description: '创建时间' })
  createTime: string;
}

export class DistributionRelationVo {
  @ApiProperty({ description: 'ID' })
  id: string;

  @ApiProperty({ description: '分销员会员ID' })
  distributorMemberId: string;

  @ApiPropertyOptional({ description: '团队归属C2会员ID' })
  teamOwnerMemberId?: string;

  @ApiPropertyOptional({ description: '邀请人会员ID' })
  inviterMemberId?: string;

  @ApiPropertyOptional({ description: '来源申请ID' })
  sourceApplicationId?: string;

  @ApiProperty({ description: '关系状态' })
  status: string;

  @ApiProperty({ description: '生效时间' })
  effectiveAt: string;
}

export class PendingRewardVo {
  @ApiProperty({ description: 'ID' })
  id: string;

  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '订单ID' })
  orderId: string;

  @ApiPropertyOptional({ description: '订单项ID' })
  orderItemId?: number;

  @ApiProperty({ description: '金额' })
  amount: number;

  @ApiProperty({ description: '状态' })
  status: string;

  @ApiPropertyOptional({ description: '释放档案ID' })
  releaseProfileId?: string;

  @ApiPropertyOptional({ description: '作废原因' })
  voidReason?: string;

  @ApiProperty({ description: '创建时间' })
  createTime: string;
}
