/**
 * Store 分销/商品 API 类型
 * 优先使用 OpenAPI components schemas；手写部分待后端补全 schema 后逐步替换为 generate-types 生成
 */
import type { components, operations } from './api';

// ─── 商品相关 (来自 schema) ───

export type StoreProductVo = components['schemas']['StoreProductVo'];
export type StoreSkuVo = components['schemas']['StoreSkuVo'];
export type TenantProduct = StoreProductVo;
export type TenantSku = StoreSkuVo;

export type ListStoreProductParams = components['schemas']['ListStoreProductDto'];

export type ImportSkuParams = components['schemas']['ImportSkuDto'];
export type ProductImportParams = components['schemas']['ImportProductDto'];
export type BatchImportProductDto = components['schemas']['BatchImportProductDto'];

export type ProductPriceUpdateParams = components['schemas']['UpdateProductPriceDto'];
export type ProductBaseUpdateParams = components['schemas']['UpdateProductBaseDto'];

// ─── 市场商品 ───

export type MarketProductVo = components['schemas']['MarketProductVo'];
export type MarketProductDetailVo = components['schemas']['MarketProductDetailVo'];
export type MarketProduct = MarketProductDetailVo;

export type MarketSearchParams = components['schemas']['ListMarketProductDto'];

// ─── 分销配置 ───

export type DistributionConfig = components['schemas']['DistConfigVo'];
export type DistributionConfigUpdateParams = components['schemas']['UpdateDistConfigDto'];
export type UpdateDistributionConfigDto = DistributionConfigUpdateParams;
export type DistributionConfigLog = components['schemas']['DistConfigLogVo'];

// ─── 等级体系 ───

export type Level = components['schemas']['LevelVo'];
export type CreateLevelDto = components['schemas']['CreateLevelDto'];
export type UpdateLevelDto = components['schemas']['UpdateLevelDto'];
export type UpdateMemberLevelDto = components['schemas']['UpdateMemberLevelDto'];
export type MemberLevelLog = components['schemas']['MemberLevelLogVo'];
export type LevelCheck = components['schemas']['LevelCheckVo'];

export interface LevelUpgradeCondition {
  minOrderCount?: number;
  minOrderAmount?: number;
  minSelfAmount?: number;
  minDirectSubCount?: number;
  minTeamCount?: number;
}

// ─── 分销员申请 ───

export type Application = components['schemas']['ApplicationVo'] & {
  member?: { nickname: string; avatar?: string; mobile?: string };
  reason?: string;
  auditTime?: string;
  auditor?: string;
};
export type ReviewApplicationDto = components['schemas']['ReviewApplicationDto'];
export type BatchReviewDto = components['schemas']['BatchReviewDto'];
export type ReviewConfig = components['schemas']['ReviewConfigVo'];
export type UpdateReviewConfigDto = components['schemas']['UpdateReviewConfigDto'];

// ─── 看板 ───

export type Dashboard = components['schemas']['DashboardVo'];
export type DistributorStats = components['schemas']['DistributorStatsVo'];
export type OrderStats = components['schemas']['OrderStatsVo'];

export type LevelSearchParams = NonNullable<operations['DistributionController_getLevelList']['parameters']['query']>;
export type ListApplicationDto = NonNullable<
  operations['DistributionController_listApplications']['parameters']['query']
>;
export type ListMemberLevelLogDto = NonNullable<
  operations['DistributionController_getMemberLevelLogs']['parameters']['query']
>;

export interface GetDashboardDto {
  startDate?: string;
  endDate?: string;
}

// ─── 佣金预估 (来自 OpenAPI，与后端 CommissionPreviewDto/Vo 对齐) ───

export type CommissionPreviewDto = components['schemas']['CommissionPreviewDto'];
export type CommissionPreviewVo = components['schemas']['CommissionPreviewVo'];

// ─── 分销资格治理 ───

export type DistributionCapability = components['schemas']['DistributionCapabilityVo'];
export type QualificationServicePolicy = components['schemas']['QualificationServicePolicyVo'];
export type UpsertServicePolicyDto = components['schemas']['UpsertServicePolicyDto'];
export type QualificationRule = components['schemas']['QualificationRuleVo'];
export type UpsertQualificationRuleDto = components['schemas']['UpsertQualificationRuleDto'];
export type QualificationEvidence = components['schemas']['QualificationEvidenceVo'];
export type QualificationApplication = components['schemas']['QualificationApplicationVo'];
export type ReviewQualificationApplicationDto = components['schemas']['ReviewQualificationApplicationDto'];
export type DistributorProfile = components['schemas']['DistributorProfileVo'];
export type DistributionRelation = components['schemas']['DistributionRelationVo'];
export type PendingReward = components['schemas']['PendingRewardVo'];
export type SubmitQualificationApplicationDto = components['schemas']['SubmitQualificationApplicationDto'];

export type ListServicePolicyDto = NonNullable<
  operations['DistributionQualificationController_listServicePolicies']['parameters']['query']
>;
export type ListQualificationRuleDto = NonNullable<
  operations['DistributionQualificationController_listRules']['parameters']['query']
>;
export type ListEvidenceDto = NonNullable<
  operations['DistributionQualificationController_listEvidence']['parameters']['query']
>;
export type ListQualificationApplicationDto = NonNullable<
  operations['DistributionQualificationController_listApplications']['parameters']['query']
>;
export type ListDistributorProfileDto = NonNullable<
  operations['DistributionQualificationController_listProfiles']['parameters']['query']
>;
export type ListDistributionRelationDto = NonNullable<
  operations['DistributionQualificationController_listRelations']['parameters']['query']
>;
export type ListPendingRewardDto = NonNullable<
  operations['DistributionQualificationController_listPendingRewards']['parameters']['query']
>;

// ─── 工作者资料/申请 ───

export type WorkerProfile = components['schemas']['WorkerProfileVo'];
export type WorkerApplication = components['schemas']['WorkerApplicationVo'];
export type CreateWorkerProfileDto = components['schemas']['CreateWorkerProfileDto'];
export type UpdateWorkerProfileDto = components['schemas']['UpdateWorkerProfileDto'];
export type UpdateWorkerStatusDto = components['schemas']['UpdateWorkerStatusDto'];
export type ApproveWorkerApplicationDto = components['schemas']['ApproveWorkerApplicationDto'];
export type RejectWorkerApplicationDto = components['schemas']['RejectWorkerApplicationDto'];
export type WorkerAddress = components['schemas']['WorkerAddressVo'];
export type WorkerCertificate = components['schemas']['WorkerCertificateVo'];

export type WorkerProfileSearchParams = NonNullable<operations['WorkerController_listProfiles']['parameters']['query']>;
export type WorkerApplicationSearchParams = NonNullable<
  operations['WorkerController_listApplications']['parameters']['query']
>;
