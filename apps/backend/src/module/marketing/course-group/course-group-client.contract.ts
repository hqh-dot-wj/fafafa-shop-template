import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CourseGroupClientOpenTeamDto {
  @ApiPropertyOptional({ description: '租户 ID；未显式传入时按客户端租户上下文解析' })
  tenantId?: string;

  @ApiProperty({ description: '拼课商品 ID' })
  productId: string;

  @ApiPropertyOptional({ description: '商品规格 ID' })
  skuId?: string;

  @ApiPropertyOptional({ description: '活动上下文 key，用于区分同商品不同拼课活动' })
  activityContextKey?: string;

  @ApiPropertyOptional({ description: '上课地址；未传时回退到活动规则快照' })
  classAddress?: string;

  @ApiPropertyOptional({ description: '上课开始时间 ISO 字符串；未传时回退到活动规则快照' })
  classStartTime?: string;

  @ApiPropertyOptional({ description: '上课结束时间 ISO 字符串；未传时回退到活动规则快照' })
  classEndTime?: string;
}

export class CourseGroupClientJoinPreviewDto {
  @ApiPropertyOptional({ description: '租户 ID；用于重新校验门店上下文与活动归属' })
  tenantId?: string;
}

export class CourseGroupClientTeamLeaderVo {
  @ApiProperty({ description: '团长用户 ID' })
  userId: string;

  @ApiProperty({ description: '团长展示名' })
  name: string;

  @ApiPropertyOptional({ description: '团长头像 URL' })
  avatar?: string;

  @ApiPropertyOptional({ description: '团长手机号，按现有脱敏策略返回' })
  mobile?: string;
}

export class CourseGroupClientTeamMemberVo {
  @ApiProperty({ description: '成员记录 ID 或 memberId' })
  memberId: string;

  @ApiProperty({ description: '用户 ID' })
  userId: string;

  @ApiProperty({ description: '成员展示名' })
  name: string;

  @ApiPropertyOptional({ description: '成员头像 URL' })
  avatar?: string;

  @ApiProperty({ description: '成员角色，如 LEADER / MEMBER' })
  role: string;

  @ApiPropertyOptional({ description: '支付状态，如 PAID / WAIT_PAY / VIRTUAL' })
  payStatus?: string;

  @ApiProperty({ description: '加入时间 ISO 字符串' })
  joinedAt: string;

  @ApiPropertyOptional({ description: '支付完成时间 ISO 字符串' })
  paidAt?: string;

  @ApiPropertyOptional({ description: '成员备注' })
  remark?: string;

  @ApiPropertyOptional({ description: '成员类型，如 REAL / VIRTUAL' })
  memberType?: string;

  @ApiPropertyOptional({ description: '补位来源，如 AUTO / LEADER_MANUAL / ADMIN_MANUAL' })
  sourceType?: string;

  @ApiPropertyOptional({ description: '虚拟成员关联 ID' })
  virtualMemberId?: string;

  @ApiPropertyOptional({ description: '是否参与订单口径计算' })
  participatesInOrder?: boolean;

  @ApiPropertyOptional({ description: '是否参与考勤口径计算' })
  participatesInAttendance?: boolean;

  @ApiPropertyOptional({ description: '是否参与分佣口径计算' })
  participatesInCommission?: boolean;
}

export class CourseGroupClientTeamMemberInspectVo {
  @ApiProperty({ description: '成员 ID' })
  memberId: string;

  @ApiProperty({ description: '成员展示名' })
  name: string;

  @ApiProperty({ description: '成员角色，如 LEADER / MEMBER' })
  role: string;

  @ApiProperty({ description: '成员类型，如 REAL / VIRTUAL' })
  memberType: string;

  @ApiProperty({ description: '是否为虚拟补位成员' })
  isVirtual: boolean;

  @ApiPropertyOptional({ description: '补位来源，如 AUTO / LEADER_MANUAL / ADMIN_MANUAL' })
  sourceType?: string;

  @ApiProperty({ description: '是否参与订单口径' })
  participatesInOrder: boolean;

  @ApiProperty({ description: '是否参与考勤口径' })
  participatesInAttendance: boolean;

  @ApiProperty({ description: '是否参与分佣口径' })
  participatesInCommission: boolean;
}

export class CourseGroupClientTeamSummaryVo {
  @ApiProperty({ description: '拼课团 ID' })
  teamId: string;

  @ApiProperty({ description: '商品 ID' })
  productId: string;

  @ApiProperty({ description: '商品名称' })
  productName: string;

  @ApiProperty({ description: '商品主图 URL' })
  productImg: string;

  @ApiPropertyOptional({ description: '商品规格 ID；用于直接跳转下单' })
  skuId?: string;

  @ApiProperty({ description: '租户 ID' })
  tenantId: string;

  @ApiProperty({ description: '租户名称' })
  tenantName: string;

  @ApiProperty({ description: '活动上下文 key' })
  activityContextKey: string;

  @ApiProperty({ description: '拼课活动配置 ID' })
  activityConfigId: string;

  @ApiProperty({ description: '拼课团状态，如 RECRUITING / FORMED / IN_CLASS / FINISHED / FAILED / CLOSED' })
  teamStatus: string;

  @ApiProperty({ type: CourseGroupClientTeamLeaderVo, description: '团长信息' })
  leader: CourseGroupClientTeamLeaderVo;

  @ApiPropertyOptional({ description: '上课地址' })
  classAddress?: string;

  @ApiPropertyOptional({ description: '上课开始时间 ISO 字符串' })
  classStartTime?: string;

  @ApiPropertyOptional({ description: '上课结束时间 ISO 字符串' })
  classEndTime?: string;

  @ApiProperty({ description: '成团最小人数' })
  minCount: number;

  @ApiProperty({ description: '成团最大人数' })
  maxCount: number;

  @ApiProperty({ description: '当前有效成员数' })
  currentMembers: number;

  @ApiProperty({ description: '当前已支付成员数' })
  paidMembers: number;

  @ApiProperty({ description: '真实成员数' })
  realMemberCount: number;

  @ApiProperty({ description: '虚拟补位成员数' })
  virtualMemberCount: number;

  @ApiProperty({ description: '有效成员数（含真实与补位）' })
  effectiveMemberCount: number;

  @ApiProperty({ description: '真实已支付成员数' })
  realPaidMemberCount: number;

  @ApiProperty({ description: '真实已支付金额' })
  realPaidAmount: number;

  @ApiProperty({ description: '分佣基数金额' })
  commissionBaseAmount: number;

  @ApiProperty({ description: '当前累计分佣金额' })
  commissionAmount: number;

  @ApiProperty({ description: '是否由虚拟补位促成成团' })
  formedByVirtual: boolean;

  @ApiProperty({ description: '分佣/财务证据是否齐备' })
  financeEvidenceReady: boolean;

  @ApiProperty({ description: '是否开启虚拟补位' })
  enableVirtualFill: boolean;

  @ApiProperty({ description: '团长是否允许手工补位' })
  allowLeaderManualFill: boolean;

  @ApiProperty({ description: '门店/后台是否允许手工补位' })
  allowAdminManualFill: boolean;

  @ApiProperty({ description: '剩余真实席位数' })
  remainingSlots: number;

  @ApiProperty({ description: '是否推荐展示' })
  recommended: boolean;

  @ApiProperty({ description: '当前访问者是否可参团；下单前仍需再次调用 join-preview 校验' })
  joinable: boolean;

  @ApiProperty({ description: '不可参团原因码；JOINABLE 表示可参团' })
  joinBlockReasonCode: string;

  @ApiProperty({ description: '不可参团原因文案' })
  joinBlockReasonText: string;

  @ApiProperty({ description: '门店规则是否完整可售' })
  storeReady: boolean;

  @ApiPropertyOptional({ description: '人数规则摘要' })
  ruleSummary?: string;

  @ApiPropertyOptional({ description: '分佣/收益提示文案' })
  revenueHint?: string;

  @ApiPropertyOptional({ description: '分享邀请标题' })
  shareTitle?: string;

  @ApiPropertyOptional({ description: '最近一次虚拟补位时间 ISO 字符串' })
  latestVirtualFillAt?: string;

  @ApiPropertyOptional({ description: '最近一次虚拟补位来源' })
  latestVirtualFillSource?: string;

  @ApiPropertyOptional({ description: '创建时间 ISO 字符串' })
  createTime?: string;
}

export class CourseGroupClientTeamListVo {
  @ApiProperty({ description: '商品 ID' })
  productId: string;

  @ApiProperty({ description: '商品名称' })
  productName: string;

  @ApiProperty({ description: '商品主图 URL' })
  productImg: string;

  @ApiProperty({ description: '租户 ID' })
  tenantId: string;

  @ApiProperty({ description: '租户名称' })
  tenantName: string;

  @ApiProperty({ description: '活动上下文 key' })
  activityContextKey: string;

  @ApiProperty({ description: '拼课活动配置 ID' })
  activityConfigId: string;

  @ApiProperty({ description: '当前门店/活动是否允许用户开团' })
  canOpen: boolean;

  @ApiProperty({ description: '当前门店/活动是否允许门店代开团' })
  allowProxyOpen: boolean;

  @ApiProperty({ type: [CourseGroupClientTeamSummaryVo], description: '可展示的拼课团列表' })
  teams: CourseGroupClientTeamSummaryVo[];

  @ApiProperty({ description: '拼课团总数' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  pageNum: number;

  @ApiProperty({ description: '当前分页大小' })
  pageSize: number;

  @ApiPropertyOptional({ description: '当列表为空时用于页面展示的提示文案' })
  emptyHint?: string;
}

export class CourseGroupClientTeamDetailVo extends CourseGroupClientTeamSummaryVo {
  @ApiProperty({ description: '详情主键，当前与 teamId 一致' })
  detailId: string;

  @ApiProperty({ description: '访问者角色，如 LEADER / MEMBER / VISITOR' })
  viewerRole: string;

  @ApiProperty({ description: '访问者是否已在团内' })
  viewerJoined: boolean;

  @ApiProperty({ description: '访问者是否已支付' })
  viewerPaid: boolean;

  @ApiProperty({ description: '访问者当前是否可分享' })
  canShare: boolean;

  @ApiProperty({ description: '访问者当前是否可发起参团流程；下单前仍需 join-preview 最终校验' })
  canJoin: boolean;

  @ApiProperty({ description: '状态文案' })
  teamStatusText: string;

  @ApiProperty({ type: [CourseGroupClientTeamMemberVo], description: '团内成员列表' })
  members: CourseGroupClientTeamMemberVo[];

  @ApiPropertyOptional({ description: '收益说明文案' })
  revenueDescription?: string;

  @ApiPropertyOptional({ description: '邀请说明文案' })
  inviteDescription?: string;
}

export class CourseGroupClientOpenResultVo {
  @ApiProperty({ description: '拼课团 ID' })
  teamId: string;

  @ApiProperty({ description: '玩法实例 ID；当前与 teamId 一致' })
  playInstanceId: string;

  @ApiProperty({ description: '是否需要额外支付；当前开团链路为 false' })
  payRequired: boolean;

  @ApiProperty({ description: '结果提示文案' })
  message: string;
}

export class CourseGroupClientJoinPreviewVo {
  @ApiProperty({ description: '拼课团 ID' })
  teamId: string;

  @ApiProperty({ description: '当前访问者是否可参团' })
  joinable: boolean;

  @ApiProperty({ description: '不可参团原因码；JOINABLE 表示可参团' })
  reasonCode: string;

  @ApiProperty({ description: '不可参团原因文案' })
  reasonText: string;

  @ApiProperty({ description: '兼容字段：不可参团原因码' })
  joinBlockReasonCode: string;

  @ApiProperty({ description: '兼容字段：不可参团原因文案' })
  joinBlockReasonText: string;

  @ApiProperty({ description: '参团应付金额' })
  payAmount: number;

  @ApiProperty({ description: '商品原价' })
  originalPrice: number;

  @ApiProperty({ description: '活动价' })
  activityPrice: number;

  @ApiProperty({ description: '剩余真实席位数' })
  remainingSlots: number;

  @ApiProperty({ description: '用于订单页展示的最终提示文案' })
  message: string;
}
