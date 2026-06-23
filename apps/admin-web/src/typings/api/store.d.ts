/**
 * Api.Store - 来自 @libs/common-types
 */
import type {
  Application as ApplicationT,
  ApproveWorkerApplicationDto as ApproveWorkerApplicationDtoT,
  BatchOperationResult as BatchOperationResultT,
  BatchReviewDto as BatchReviewDtoT,
  CommissionPreviewDto as CommissionPreviewDtoT,
  CommissionPreviewVo as CommissionPreviewVoT,
  CreateLevelDto as CreateLevelDtoT,
  CreateWorkerProfileDto as CreateWorkerProfileDtoT,
  Dashboard as DashboardT,
  DistributionCapability as DistributionCapabilityT,
  DistributionConfigLog as DistributionConfigLogT,
  DistributionConfig as DistributionConfigT,
  DistributionConfigUpdateParams as DistributionConfigUpdateParamsT,
  DistributionRelation as DistributionRelationT,
  DistributorProfile as DistributorProfileT,
  DistributorStats as DistributorStatsT,
  GetDashboardDto as GetDashboardDtoT,
  ImportSkuParams as ImportSkuParamsT,
  LevelCheck as LevelCheckT,
  LevelSearchParams as LevelSearchParamsT,
  Level as LevelT,
  LevelUpgradeCondition as LevelUpgradeConditionT,
  ListApplicationDto as ListApplicationDtoT,
  ListDistributionRelationDto as ListDistributionRelationDtoT,
  ListDistributorProfileDto as ListDistributorProfileDtoT,
  ListEvidenceDto as ListEvidenceDtoT,
  ListMemberLevelLogDto as ListMemberLevelLogDtoT,
  ListPendingRewardDto as ListPendingRewardDtoT,
  ListQualificationApplicationDto as ListQualificationApplicationDtoT,
  ListQualificationRuleDto as ListQualificationRuleDtoT,
  ListServicePolicyDto as ListServicePolicyDtoT,
  ListStoreProductParams as ListStoreProductParamsT,
  MarketProduct as MarketProductT,
  MarketSearchParams as MarketSearchParamsT,
  MemberLevelLog as MemberLevelLogT,
  OrderStats as OrderStatsT,
  PendingReward as PendingRewardT,
  ProductBaseUpdateParams as ProductBaseUpdateParamsT,
  ProductImportParams as ProductImportParamsT,
  ProductPriceUpdateParams as ProductPriceUpdateParamsT,
  QualificationApplication as QualificationApplicationT,
  QualificationEvidence as QualificationEvidenceT,
  QualificationRule as QualificationRuleT,
  QualificationServicePolicy as QualificationServicePolicyT,
  RejectWorkerApplicationDto as RejectWorkerApplicationDtoT,
  ReviewApplicationDto as ReviewApplicationDtoT,
  ReviewConfig as ReviewConfigT,
  ReviewQualificationApplicationDto as ReviewQualificationApplicationDtoT,
  SubmitQualificationApplicationDto as SubmitQualificationApplicationDtoT,
  TenantProduct as TenantProductT,
  TenantSku as TenantSkuT,
  UpdateDistributionConfigDto as UpdateDistributionConfigDtoT,
  UpdateLevelDto as UpdateLevelDtoT,
  UpdateMemberLevelDto as UpdateMemberLevelDtoT,
  UpdateReviewConfigDto as UpdateReviewConfigDtoT,
  UpdateWorkerProfileDto as UpdateWorkerProfileDtoT,
  UpdateWorkerStatusDto as UpdateWorkerStatusDtoT,
  UpsertQualificationRuleDto as UpsertQualificationRuleDtoT,
  UpsertServicePolicyDto as UpsertServicePolicyDtoT,
  WorkerAddress as WorkerAddressT,
  WorkerApplicationSearchParams as WorkerApplicationSearchParamsT,
  WorkerApplication as WorkerApplicationT,
  WorkerCertificate as WorkerCertificateT,
  WorkerProfileSearchParams as WorkerProfileSearchParamsT,
  WorkerProfile as WorkerProfileT,
} from '@libs/common-types';

declare global {
  namespace Api {
    namespace Store {
      type TenantProduct = TenantProductT & {
        templateVersionId?: string;
      };
      type TenantSku = TenantSkuT;
      type TenantProductList = Api.Common.PaginatingQueryRecord<TenantProductT>;
      type ListStoreProductParams = ListStoreProductParamsT;
      type ImportSkuParams = ImportSkuParamsT;
      type ProductImportParams = ProductImportParamsT & {
        categoryId?: number;
        templateVersionId?: string;
      };
      /** 店铺域批量操作统一回执（导入、调价、库存等） */
      type BatchOperationResult = BatchOperationResultT;
      type ProductPriceUpdateParams = ProductPriceUpdateParamsT;
      type ProductBaseUpdateParams = ProductBaseUpdateParamsT;
      type ImportExcelRow = {
        rowNo?: number;
        productId: string;
        globalSkuId: string;
        price: number;
        stock: number;
        distRate?: number;
        distMode?: Api.Pms.DistributionMode;
      };
      type ImportExcelParams = {
        categoryId: number;
        templateVersionId?: string;
        fileBase64?: string;
        rows?: ImportExcelRow[];
      };
      type TemplateVersionOption = {
        versionId: string;
        version: number;
        templateCode: string;
        isLatest: boolean;
        createTime: string;
      };
      type ImportExcelResult = {
        jobId: string;
        successCount: number;
        failCount: number;
      };
      type ImportExcelJobDetail = {
        rowNo: number;
        skuCode: string;
        success: boolean;
        reason?: string;
      };
      type ImportExcelJobResult = {
        jobId: string;
        status: 'DONE';
        successCount: number;
        failCount: number;
        details: ImportExcelJobDetail[];
        createdAt: string;
      };

      type MarketProduct = MarketProductT & {
        defaultSkuLabel?: string;
        displayName?: string;
      };
      type MarketProductList = Api.Common.PaginatingQueryRecord<MarketProductT>;
      type MarketSearchParams = MarketSearchParamsT;

      type DistributionConfig = DistributionConfigT;
      type DistributionConfigUpdateParams = DistributionConfigUpdateParamsT;
      type UpdateDistributionConfigDto = UpdateDistributionConfigDtoT;
      type DistributionConfigLog = DistributionConfigLogT;
      type ShareTokenBizType = 'PRODUCT' | 'ACTIVITY' | 'PAGE';
      type ShareBindingMode = 'RECOMMEND_CODE' | 'RELATION' | 'BOTH';
      type ShareAttributionMode = 'FIRST_TOUCH' | 'LAST_TOUCH' | 'FIRST_BIND_LOCK';
      type ShareTokenStatus = 'ACTIVE' | 'DISABLED' | 'EXPIRED';
      type ShareEventType =
        | 'CLICK'
        | 'BIND'
        | 'ORDER_ATTRIBUTED'
        | 'EXPIRED_HIT'
        | 'LIMIT_HIT'
        | 'INVALID_HIT'
        | 'MANUAL_DISABLE';

      /**
       * OpenAPI 待补全：分销分享策略
       */
      type SharePolicy = {
        id: number;
        tenantId: string;
        linkExpireMinutes: number;
        maxClickCount: number;
        maxBindCount: number;
        maxOrderCount: number;
        bindingMode: ShareBindingMode;
        attributionMode: ShareAttributionMode;
        attributionWindowMinutes: number;
        enableCrossTenantBind: boolean;
        isActive: boolean;
        createTime: string;
        updateTime?: string;
      };

      /**
       * OpenAPI 待补全：更新分销分享策略
       */
      type UpdateSharePolicyDto = Pick<
        SharePolicy,
        | 'linkExpireMinutes'
        | 'maxClickCount'
        | 'maxBindCount'
        | 'maxOrderCount'
        | 'bindingMode'
        | 'attributionMode'
        | 'attributionWindowMinutes'
        | 'enableCrossTenantBind'
        | 'isActive'
      >;

      /**
       * OpenAPI 待补全：创建分享令牌
       */
      type CreateShareTokenDto = {
        shareUserId: string;
        bizType: ShareTokenBizType;
        bizId: string;
        linkExpireMinutes?: number;
        maxClickCount?: number;
        maxBindCount?: number;
        maxOrderCount?: number;
        metadata?: Record<string, unknown>;
      };

      /**
       * OpenAPI 待补全：分享令牌返回
       */
      type ShareToken = {
        sid: string;
        tenantId: string;
        shareUserId: string;
        bizType: ShareTokenBizType;
        bizId: string;
        shareUrl: string;
        maxClickCount: number;
        maxBindCount: number;
        maxOrderCount: number;
        clickCount: number;
        bindCount: number;
        orderCount: number;
        status: ShareTokenStatus;
        expireAt: string;
        metadata?: Record<string, unknown> | null;
      };

      /**
       * OpenAPI 待补全：生成小程序码
       */
      type CreateShareQrcodeDto = {
        sid: string;
        page?: string;
        width?: number;
        envVersion?: 'develop' | 'trial' | 'release';
      };

      /**
       * OpenAPI 待补全：小程序码返回
       */
      type ShareQrcode = {
        sid: string;
        qrcodeUrl: string;
        scene: string;
      };

      /**
       * OpenAPI 待补全：分享事件日志查询
       */
      type ListShareTokenLogDto = Api.Common.PaginatingCommonParams & {
        sid?: string;
        eventType?: ShareEventType;
        memberId?: string;
      };

      /**
       * OpenAPI 待补全：分享事件日志
       */
      type ShareTokenLog = {
        id: string;
        sid: string;
        eventType: ShareEventType;
        bizType?: ShareTokenBizType;
        bizId?: string;
        shareUserId?: string;
        memberId?: string;
        tenantId?: string;
        orderId?: string;
        eventCode?: string;
        eventMessage?: string;
        metadata?: Record<string, unknown> | null;
        createTime: string;
      };

      type Level = LevelT;
      type CreateLevelDto = CreateLevelDtoT;
      type UpdateLevelDto = UpdateLevelDtoT;
      type LevelUpgradeCondition = LevelUpgradeConditionT;
      type LevelSearchParams = LevelSearchParamsT;
      type ListLevelDto = LevelSearchParamsT;
      type UpdateMemberLevelDto = UpdateMemberLevelDtoT;
      type MemberLevelLog = MemberLevelLogT;
      type ListMemberLevelLogDto = ListMemberLevelLogDtoT;
      type LevelCheck = LevelCheckT;

      type Application = ApplicationT;
      type ListApplicationDto = ListApplicationDtoT;
      type ReviewApplicationDto = ReviewApplicationDtoT;
      type BatchReviewDto = BatchReviewDtoT;
      type ReviewConfig = ReviewConfigT;
      type UpdateReviewConfigDto = UpdateReviewConfigDtoT;
      type DistributionCapability = DistributionCapabilityT;
      type QualificationServicePolicy = QualificationServicePolicyT;
      type UpsertServicePolicyDto = UpsertServicePolicyDtoT;
      type ListServicePolicyDto = ListServicePolicyDtoT;
      type QualificationRule = QualificationRuleT;
      type UpsertQualificationRuleDto = UpsertQualificationRuleDtoT;
      type ListQualificationRuleDto = ListQualificationRuleDtoT;
      type QualificationEvidence = QualificationEvidenceT;
      type ListEvidenceDto = ListEvidenceDtoT;
      type QualificationApplication = QualificationApplicationT;
      type SubmitQualificationApplicationDto = SubmitQualificationApplicationDtoT;
      type ReviewQualificationApplicationDto = ReviewQualificationApplicationDtoT;
      type ListQualificationApplicationDto = ListQualificationApplicationDtoT;
      type DistributorProfile = DistributorProfileT;
      type ListDistributorProfileDto = ListDistributorProfileDtoT;
      type DistributionRelation = DistributionRelationT;
      type ListDistributionRelationDto = ListDistributionRelationDtoT;
      type PendingReward = PendingRewardT;
      type ListPendingRewardDto = ListPendingRewardDtoT;

      type GetDashboardDto = GetDashboardDtoT;
      type Dashboard = DashboardT;
      type DistributorStats = DistributorStatsT;
      type OrderStats = OrderStatsT;

      type DistributionGrowthShareChannel = 'MINIAPP' | 'H5' | 'APP';

      /** OpenAPI 待补全：分销佣金预估分享上下文 */
      type CommissionPreviewShareContext = {
        shareChannel?: DistributionGrowthShareChannel;
        shareLandingPage?: string;
        referralCodeEnabled?: boolean;
        attributionWindowMinutes?: number;
      };

      /** OpenAPI 待补全：分销佣金预估升级上下文 */
      type CommissionPreviewUpgradeContext = {
        currentLevelId?: number;
        targetLevelId?: number;
        canUpgrade?: boolean;
      };

      /** OpenAPI 待补全：分销佣金预估请求扩展字段 */
      type CommissionPreviewDto = CommissionPreviewDtoT & {
        activityVersionId?: string;
        shareContext?: CommissionPreviewShareContext;
        upgradeContext?: CommissionPreviewUpgradeContext;
      };

      /** OpenAPI 待补全：预算快照扩展字段 */
      type CommissionBudgetSnapshot = {
        budgetTotal?: number;
        budgetFrozen?: number;
        budgetConsumed?: number;
        budgetReleased?: number;
        budgetByLevel?: Record<string, number>;
        budgetByChannel?: Record<string, number>;
        budgetByActivityVersion?: Record<string, number>;
        budgetAlertThreshold?: number;
        budgetFuseThreshold?: number;
      };

      type CommissionPreview = CommissionPreviewVoT & CommissionBudgetSnapshot;

      type WorkerAddress = WorkerAddressT;
      type WorkerCertificate = WorkerCertificateT;
      type WorkerProfile = WorkerProfileT;
      type WorkerApplication = WorkerApplicationT;
      type WorkerProfileSearchParams = WorkerProfileSearchParamsT;
      type WorkerApplicationSearchParams = WorkerApplicationSearchParamsT;
      type CreateWorkerProfileDto = CreateWorkerProfileDtoT;
      type UpdateWorkerProfileDto = UpdateWorkerProfileDtoT;
      type UpdateWorkerStatusDto = UpdateWorkerStatusDtoT;
      type ApproveWorkerApplicationDto = ApproveWorkerApplicationDtoT;
      type RejectWorkerApplicationDto = RejectWorkerApplicationDtoT;
    }
  }
}

export {};
