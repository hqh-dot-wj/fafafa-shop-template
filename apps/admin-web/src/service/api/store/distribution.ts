import { request } from '@/service/request';

export type DistributionConfigResponse = Api.Store.DistributionConfig;
export type DistributionConfigUpdateRequest = Api.Store.DistributionConfigUpdateParams;
export type DistributionConfigUpdateResponse = null;
export type DistributionConfigLogParams = Api.Common.PaginatingCommonParams;
export type DistributionConfigLogResponse = Api.Common.PaginatingQueryRecord<Api.Store.DistributionConfigLog>;
export type CommissionPreviewRequest = Api.Store.CommissionPreviewDto;
export type CommissionPreviewResponse = Api.Store.CommissionPreview;
export type SharePolicyResponse = Api.Store.SharePolicy;
export type SharePolicyUpdateRequest = Api.Store.UpdateSharePolicyDto;
export type ShareTokenCreateRequest = Api.Store.CreateShareTokenDto;
export type ShareTokenCreateResponse = Api.Store.ShareToken;
export type ShareQrcodeCreateRequest = Api.Store.CreateShareQrcodeDto;
export type ShareQrcodeCreateResponse = Api.Store.ShareQrcode;
export type ShareTokenLogParams = Api.Store.ListShareTokenLogDto;
export type ShareTokenLogResponse = Api.Common.PaginatingQueryRecord<Api.Store.ShareTokenLog>;

/**
 * 获取分销规则配置
 */
export function fetchGetDistributionConfig() {
  return request<DistributionConfigResponse>({
    url: '/store/distribution/config',
    method: 'get',
  });
}

/**
 * 更新分销规则配置
 * @param data 配置数据
 */
export function fetchUpdateDistributionConfig(data: DistributionConfigUpdateRequest) {
  return request<DistributionConfigUpdateResponse>({
    url: '/store/distribution/config',
    method: 'post',
    data,
  });
}

/**
 * 获取分销规则变更历史
 * @param params 分页参数
 */
export function fetchGetDistributionConfigLogs(params?: DistributionConfigLogParams) {
  return request<DistributionConfigLogResponse>({
    url: '/store/distribution/config/logs',
    method: 'get',
    params,
  });
}

/**
 * 佣金预估 (前端提示用)
 * @param data 预估参数
 */
export function fetchGetCommissionPreview(data: CommissionPreviewRequest) {
  return request<CommissionPreviewResponse>({
    url: '/store/distribution/commission/preview',
    method: 'post',
    data,
  });
}

/**
 * 获取分销分享策略
 */
export function fetchGetSharePolicy() {
  return request<SharePolicyResponse>({
    url: '/store/distribution/share-policy',
    method: 'get',
  });
}

/**
 * 更新分销分享策略
 */
export function fetchUpdateSharePolicy(data: SharePolicyUpdateRequest) {
  return request<SharePolicyResponse>({
    url: '/store/distribution/share-policy',
    method: 'post',
    data,
  });
}

/**
 * 生成分销分享令牌
 */
export function fetchCreateShareToken(data: ShareTokenCreateRequest) {
  return request<ShareTokenCreateResponse>({
    url: '/store/distribution/share-token',
    method: 'post',
    data,
  });
}

/**
 * 生成分享小程序码
 */
export function fetchCreateShareQrcode(data: ShareQrcodeCreateRequest) {
  return request<ShareQrcodeCreateResponse>({
    url: '/store/distribution/share-token/qrcode',
    method: 'post',
    data,
  });
}

/**
 * 查询分享令牌日志
 */
export function fetchGetShareTokenLogs(params?: ShareTokenLogParams) {
  return request<ShareTokenLogResponse>({
    url: '/store/distribution/share-token/logs',
    method: 'get',
    params,
  });
}

// ==================== 分销数据看板 ====================

/**
 * 获取分销数据看板
 */
export function fetchGetDistributionDashboard(params: Api.Store.GetDashboardDto) {
  return request<Api.Store.Dashboard>({
    url: '/store/distribution/dashboard',
    method: 'get',
    params,
  });
}

// ==================== 分销员等级体系 ====================

/**
 * 创建等级配置
 */
export function fetchCreateLevel(data: Api.Store.CreateLevelDto) {
  return request<Api.Store.Level>({
    url: '/store/distribution/level',
    method: 'post',
    data,
  });
}

/**
 * 更新等级配置
 */
export function fetchUpdateLevel(id: number, data: Api.Store.UpdateLevelDto) {
  return request<Api.Store.Level>({
    url: `/store/distribution/level/${id}`,
    method: 'put',
    data,
  });
}

/**
 * 删除等级配置
 */
export function fetchDeleteLevel(id: number) {
  return request({
    url: `/store/distribution/level/${id}`,
    method: 'delete',
  });
}

/**
 * 查询等级列表（后端返回 { rows, total }）
 */
export function fetchGetLevelList(params?: Api.Store.LevelSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.Store.Level>>({
    url: '/store/distribution/level/list',
    method: 'get',
    params,
  });
}

/**
 * 查询等级详情
 */
export function fetchGetLevel(id: number) {
  return request<Api.Store.Level>({
    url: `/store/distribution/level/${id}`,
    method: 'get',
  });
}

/**
 * 手动调整会员等级
 */
export function fetchUpdateMemberLevel(data: Api.Store.UpdateMemberLevelDto) {
  return request({
    url: '/store/distribution/member-level',
    method: 'post',
    data,
  });
}

/**
 * 查询会员等级变更日志
 */
export function fetchGetMemberLevelLogs(params: Api.Store.ListMemberLevelLogDto) {
  return request<Api.Common.PaginatingQueryRecord<Api.Store.MemberLevelLog>>({
    url: '/store/distribution/member-level/logs',
    method: 'get',
    params,
  });
}

/**
 * 检查会员升级条件
 */
export function fetchCheckLevelUpgrade(memberId: string) {
  return request<Api.Store.LevelCheck>({
    url: `/store/distribution/level/check/${memberId}`,
    method: 'get',
  });
}

// ==================== 分销员申请/审核 ====================

/**
 * 查询申请列表
 */
export function fetchGetApplicationList(params: Api.Store.ListApplicationDto) {
  return request<Api.Common.PaginatingQueryRecord<Api.Store.Application>>({
    url: '/store/distribution/application/list',
    method: 'get',
    params,
  });
}

/**
 * 审核申请
 */
export function reviewApplication(id: number, data: Api.Store.ReviewApplicationDto) {
  return request({
    url: `/store/distribution/application/${id}/review`,
    method: 'post',
    data,
  });
}

/**
 * 批量审核
 */
export function fetchBatchReview(data: Api.Store.BatchReviewDto) {
  return request({
    url: '/store/distribution/application/batch-review',
    method: 'post',
    data,
  });
}

/**
 * 获取审核配置
 */
export function fetchGetReviewConfig() {
  return request<Api.Store.ReviewConfig>({
    url: '/store/distribution/application/config',
    method: 'get',
  });
}

/**
 * 更新审核配置
 */
export function fetchUpdateReviewConfig(data: Api.Store.UpdateReviewConfigDto) {
  return request({
    url: '/store/distribution/application/config',
    method: 'put',
    data,
  });
}

// ==================== 分销资格治理 ====================

export function fetchGetQualificationCapability(memberId: string) {
  return request<Api.Store.DistributionCapability>({
    url: '/store/distribution/qualification/capability',
    method: 'get',
    params: { memberId },
  });
}

export function fetchGetServicePolicyList(params: Api.Store.ListServicePolicyDto) {
  return request<Api.Common.PaginatingQueryRecord<Api.Store.QualificationServicePolicy>>({
    url: '/store/distribution/qualification/service-policies',
    method: 'get',
    params,
  });
}

export function fetchCreateServicePolicy(data: Api.Store.UpsertServicePolicyDto) {
  return request<Api.Store.QualificationServicePolicy>({
    url: '/store/distribution/qualification/service-policies',
    method: 'post',
    data,
  });
}

export function fetchUpdateServicePolicy(id: number, data: Api.Store.UpsertServicePolicyDto) {
  return request<Api.Store.QualificationServicePolicy>({
    url: `/store/distribution/qualification/service-policies/${id}`,
    method: 'put',
    data,
  });
}

export function fetchGetQualificationRuleList(params: Api.Store.ListQualificationRuleDto) {
  return request<Api.Common.PaginatingQueryRecord<Api.Store.QualificationRule>>({
    url: '/store/distribution/qualification/rules',
    method: 'get',
    params,
  });
}

export function fetchCreateQualificationRule(data: Api.Store.UpsertQualificationRuleDto) {
  return request<Api.Store.QualificationRule>({
    url: '/store/distribution/qualification/rules',
    method: 'post',
    data,
  });
}

export function fetchUpdateQualificationRule(id: number, data: Api.Store.UpsertQualificationRuleDto) {
  return request<Api.Store.QualificationRule>({
    url: `/store/distribution/qualification/rules/${id}`,
    method: 'put',
    data,
  });
}

export function fetchGetQualificationEvidenceList(params: Api.Store.ListEvidenceDto) {
  return request<Api.Common.PaginatingQueryRecord<Api.Store.QualificationEvidence>>({
    url: '/store/distribution/qualification/evidence',
    method: 'get',
    params,
  });
}

export function fetchGetQualificationApplicationList(params: Api.Store.ListQualificationApplicationDto) {
  return request<Api.Common.PaginatingQueryRecord<Api.Store.QualificationApplication>>({
    url: '/store/distribution/qualification/applications',
    method: 'get',
    params,
  });
}

export function reviewQualificationApplication(id: string, data: Api.Store.ReviewQualificationApplicationDto) {
  return request<Api.Store.QualificationApplication>({
    url: `/store/distribution/qualification/applications/${id}/review`,
    method: 'post',
    data,
  });
}

export function fetchGetDistributorProfileList(params: Api.Store.ListDistributorProfileDto) {
  return request<Api.Common.PaginatingQueryRecord<Api.Store.DistributorProfile>>({
    url: '/store/distribution/qualification/profiles',
    method: 'get',
    params,
  });
}

export function freezeDistributorProfile(id: string, data?: { reason?: string }) {
  return request<Api.Store.DistributorProfile>({
    url: `/store/distribution/qualification/profiles/${id}/freeze`,
    method: 'post',
    data: data ?? {},
  });
}

export function revokeDistributorProfile(id: string, data?: { reason?: string }) {
  return request<Api.Store.DistributorProfile>({
    url: `/store/distribution/qualification/profiles/${id}/revoke`,
    method: 'post',
    data: data ?? {},
  });
}

export function fetchGetDistributionRelationList(params: Api.Store.ListDistributionRelationDto) {
  return request<Api.Common.PaginatingQueryRecord<Api.Store.DistributionRelation>>({
    url: '/store/distribution/qualification/relations',
    method: 'get',
    params,
  });
}

export function fetchGetPendingRewardList(params: Api.Store.ListPendingRewardDto) {
  return request<Api.Common.PaginatingQueryRecord<Api.Store.PendingReward>>({
    url: '/store/distribution/qualification/pending-rewards',
    method: 'get',
    params,
  });
}
