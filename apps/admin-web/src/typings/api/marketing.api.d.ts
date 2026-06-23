declare namespace Api {
  namespace Marketing {
    /**
     * marketing.api.d.ts 是 admin-web 仍在使用的营销兼容类型层。
     * 新接口优先使用 @libs/common-types 的 OpenAPI 生成类型；只有旧页面视图模型、
     * OpenAPI 暂未覆盖的壳数据或字段需要前端二次组合时，才继续放在这里。
     * 修改这些类型时必须回看 apps/backend/src/module/marketing/** 的 DTO/VO，避免前端契约漂移。
     */
    interface PlayTemplate {
      id: string;
      code: string;
      name: string;
      unitName: string;
      ruleSchema: { fields: SchemaField[] };
      uiComponentId?: string;
      createTime: string;
      updateTime?: string;
      // 关联商品/规格字段
    }

    interface SchemaField {
      key: string;
      label: string;
      type: 'number' | 'string' | 'boolean' | 'datetime' | 'date' | 'time' | 'address' | 'daterange' | 'datetimerange';
      required: boolean;
      defaultValue?: any;
    }

    type PlayTemplateSearchParams = CommonType.RecordNullable<
      {
        name?: string;
        code?: string;
      } & Common.CommonSearchParams
    >;

    type PlayTemplateCreate = Pick<PlayTemplate, 'name' | 'unitName' | 'ruleSchema' | 'uiComponentId'>;
    type PlayTemplateUpdate = Partial<PlayTemplateCreate>;

    type PlayTemplateList = Common.PaginatingQueryRecord<PlayTemplate>;

    // Store Config
    interface StoreConfig {
      id: string;
      serviceId: string;
      serviceType: 'REAL' | 'SERVICE';
      templateCode: string;
      rules: Record<string, unknown>;
      stockMode: 'STRONG_LOCK' | 'LAZY_CHECK';
      status: 'OFF_SHELF' | 'ON_SHELF';
      createTime: string;
      // 扩展字段 (由 Service 层聚合)
      productName?: string;
      productStatus?: string;
      ruleName?: string;
      productImage?: string;
      commissionMode?: string;
      commissionRate?: number | null;
      aggregateEnabled?: boolean;
      zoneEnabled?: boolean;
      displayPriority?: number | null;
    }

    type StoreConfigSearchParams = CommonType.RecordNullable<
      {
        templateCode?: string;
        status?: string;
      } & Common.CommonSearchParams
    >;

    interface StoreConfigCreate {
      serviceId: string;
      serviceType: string;
      templateCode: string;
      rules: Record<string, unknown>;
      stockMode: string;
      status?: string;
    }

    type StoreConfigUpdate = Partial<StoreConfigCreate>;

    type StoreConfigList = Common.PaginatingQueryRecord<StoreConfig>;

    // User Asset
    interface UserAsset {
      id: string;
      memberId: string;
      instanceId: string;
      assetName: string;
      assetType: 'VOUCHER' | 'TIMES_CARD';
      balance: number;
      status: 'UNUSED' | 'USED' | 'EXPIRED' | 'FROZEN';
      expireTime?: string;
      createTime: string;
    }

    type UserAssetSearchParams = CommonType.RecordNullable<
      {
        memberId?: string;
        status?: string;
      } & Common.CommonSearchParams
    >;

    type UserAssetList = Common.PaginatingQueryRecord<UserAsset>;

    // Settlement
    interface SettlementRequest {
      id: string;
      storeId: string;
      applyAmount: number;
      orderCount: number;
      status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FINISHED';
      auditBy?: string;
      auditTime?: string;
      auditRemark?: string;
      createTime: string;
    }

    type SettlementSearchParams = CommonType.RecordNullable<
      {
        storeId?: string;
        status?: string;
      } & Common.CommonSearchParams
    >;

    interface SettlementApply {
      storeId: string;
      applyAmount: number;
      orderCount: number;
      attachment?: string;
    }

    interface SettlementAudit {
      status: 'APPROVED' | 'REJECTED';
      remark?: string;
    }

    type SettlementList = Common.PaginatingQueryRecord<SettlementRequest>;

    // Coupon Template（与后端 GET 列表/详情 返回字段一致）
    interface CouponTemplate {
      id: string;
      /** 列表接口返回，跨租户场景用于区分数据归属 */
      tenantId?: string;
      name: string;
      description?: string;
      /** 优惠券类型: DISCOUNT-代金券, PERCENTAGE-折扣券, EXCHANGE-兑换券 */
      type: 'DISCOUNT' | 'PERCENTAGE' | 'EXCHANGE';
      discountAmount?: number;
      discountPercent?: number;
      minOrderAmount: number;
      validityType?: 'FIXED' | 'RELATIVE';
      validDays?: number;
      startTime?: string | Date;
      endTime?: string | Date;
      totalStock: number;
      remainingStock?: number;
      limitPerUser: number;
      distributedCount?: number;
      usedCount?: number;
      usageRate?: number;
      status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
      createTime?: string;
      updateTime?: string;
      // 兼容旧字段名
      code?: string;
      value?: number;
      minAmount?: number;
      totalCount?: number;
      limitPerPerson?: number;
      drawnCount?: number;
      validStartTime?: string;
      validEndTime?: string;
    }

    type CouponTemplateSearchParams = CommonType.RecordNullable<
      {
        name?: string;
        type?: string;
        status?: string;
      } & Common.CommonSearchParams
    >;

    /** 创建/更新时使用，与后端 DTO 一致 */
    type CouponTemplateCreate = {
      name: string;
      description?: string;
      type: 'DISCOUNT' | 'PERCENTAGE' | 'EXCHANGE';
      discountAmount?: number;
      discountPercent?: number;
      minOrderAmount?: number;
      validityType: 'FIXED' | 'RELATIVE';
      startTime?: string;
      endTime?: string;
      validDays?: number;
      totalStock: number;
      limitPerUser?: number;
      applicableProducts?: string[];
      applicableCategories?: number[];
      memberLevels?: number[];
      tenantId?: string;
      createBy?: string;
    };

    type CouponTemplateUpdate = Partial<CouponTemplateCreate>;

    type CouponTemplateList = Common.PaginatingQueryRecord<CouponTemplate>;

    /** User coupon (issued to member) */
    interface UserCoupon {
      id: string;
      templateId: string;
      memberId: string;
      couponName?: string;
      couponType?: string;
      discountAmount?: number;
      discountPercent?: number;
      status: 'UNUSED' | 'USED' | 'EXPIRED' | 'LOCKED';
      distributionType?: 'MANUAL' | 'ACTIVITY' | 'ORDER';
      receiveTime?: string;
      usedTime?: string;
      orderId?: string;
      createTime?: string;
      templateName?: string;
      value?: number;
      type?: string;
    }

    /** 管理端用户券列表查询 */
    type UserCouponListSearchParams = CommonType.RecordNullable<
      { memberId?: string; status?: string } & Common.CommonSearchParams
    >;

    /** 手动发放优惠券单条结果 */
    interface CouponManualDistributeResultItem {
      memberId: string;
      success: boolean;
      couponId?: string;
      error?: string;
    }

    /** Coupon usage record */
    interface CouponUsageRecord {
      id: string;
      userCouponId: string;
      templateId: string;
      memberId: string;
      orderId: string;
      usedTime: string;
      createTime: string;
      templateName?: string;
      nickname?: string;
      mobile?: string;
    }

    /** 管理端优惠券使用记录列表查询 */
    type CouponUsageRecordListSearchParams = CommonType.RecordNullable<
      {
        memberId?: string;
        templateId?: string;
        startTime?: string | null;
        endTime?: string | null;
      } & Common.CommonSearchParams
    >;

    // Points Rule Config (与后端 MktPointsRule / PointsRuleVo 一致)
    interface PointsRule {
      id?: string;
      tenantId?: string;
      /** 是否启用消费积分 */
      orderPointsEnabled: boolean;
      /** 消费积分比例: 每消费 N 元获得 M 积分 */
      orderPointsRatio: number;
      /** 消费积分基数: N 元 */
      orderPointsBase: number;
      /** 是否启用签到积分 */
      signinPointsEnabled: boolean;
      /** 签到积分数量 */
      signinPointsAmount: number;
      /** 是否启用积分有效期 */
      pointsValidityEnabled: boolean;
      /** 积分有效天数, null 表示永久有效 */
      pointsValidityDays: number | null;
      /** 是否启用积分抵扣 */
      pointsRedemptionEnabled: boolean;
      /** 积分抵扣比例: N 积分抵扣 M 元 */
      pointsRedemptionRatio: number;
      /** 积分抵扣基数: M 元 */
      pointsRedemptionBase: number;
      /** 单笔订单最多可使用积分数量 */
      maxPointsPerOrder: number | null;
      /** 单笔订单最多可抵扣百分比 (1-100) */
      maxDiscountPercentOrder: number | null;
      /** 系统开关 */
      systemEnabled: boolean;
      createBy?: string;
      createTime?: string;
      updateBy?: string | null;
      updateTime?: string;
    }

    type PointsRuleUpdate = Partial<
      Omit<PointsRule, 'id' | 'tenantId' | 'createBy' | 'createTime' | 'updateBy' | 'updateTime'>
    >;

    /** Points Task（与后端 mkt_points_task / PointsTaskVo 一致） */
    interface PointTask {
      id: string;
      tenantId?: string;
      /** 任务唯一标识 */
      taskKey: string;
      /** 任务名称 */
      taskName: string;
      /** 任务描述 */
      taskDescription: string | null;
      /** 积分奖励 */
      pointsReward: number;
      /** 完成条件（JSON） */
      completionCondition?: any;
      /** 是否可重复完成 */
      isRepeatable: boolean;
      /** 最多完成次数 */
      maxCompletions: number | null;
      /** 是否启用 */
      isEnabled: boolean;
      createBy?: string;
      createTime: string;
      updateBy?: string | null;
      updateTime?: string;
    }

    type PointTaskSearchParams = Common.PaginatingCommonParams & {
      isEnabled?: boolean;
    };

    type PointTaskList = Common.PaginatingQueryRecord<PointTask>;

    /** 创建任务（与 CreatePointsTaskDto 一致） */
    type PointTaskCreate = {
      taskKey: string;
      taskName: string;
      taskDescription?: string;
      pointsReward: number;
      completionCondition?: any;
      isRepeatable?: boolean;
      maxCompletions?: number;
      isEnabled?: boolean;
    };

    /** 更新任务（与 UpdatePointsTaskDto 一致） */
    type PointTaskUpdate = {
      taskName?: string;
      taskDescription?: string;
      pointsReward?: number;
      completionCondition?: any;
      isRepeatable?: boolean;
      maxCompletions?: number;
      isEnabled?: boolean;
    };

    /** Points account (admin list) */
    interface PointsAccount {
      id: string;
      memberId: string;
      totalPoints: number;
      availablePoints: number;
      frozenPoints: number;
      usedPoints: number;
      expiredPoints: number;
      createTime: string;
      member?: { memberId: string; nickname?: string; mobile?: string; avatar?: string };
    }

    /** Points transaction */
    interface PointsTransaction {
      id: string;
      memberId: string;
      type: string;
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
      remark?: string;
      createTime: string;
    }

    type PointsTransactionSearchParams = {
      memberId?: string;
      type?: string;
      startTime?: string;
      endTime?: string;
      pageNum?: number;
      pageSize?: number;
    };

    interface PointsStatisticsTotal {
      totalPoints?: number;
      totalCount?: number;
    }

    interface PointsEarnStatistics {
      byType?: { type: string; totalPoints: number; totalCount: number }[];
      total?: PointsStatisticsTotal;
    }

    interface PointsUseStatistics {
      byType?: { type: string; totalPoints: number; totalCount: number }[];
      total?: PointsStatisticsTotal;
    }

    interface PointsBalanceStatistics {
      totalAccounts?: number;
      totalPoints?: number;
      availablePoints?: number;
      frozenPoints?: number;
      usedPoints?: number;
      expiredPoints?: number;
    }

    interface PointsRankingItem {
      memberId: string;
      nickname?: string;
      availablePoints: number;
      rank?: number;
    }

    /** C 端营销运行时开关台账行 */
    interface RuntimeLedgerEntry {
      configKey: string;
      displayName: string;
      remark: string;
      platformValue: string | null;
      tenantValue: string | null;
      effectiveValue: string;
    }

    // Resolution: Incident
    type ResolutionIncidentType = 'METRIC_ALERT' | 'PROBE_STEP_MISSING';
    type ResolutionIncidentLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    type ResolutionIncidentStatus = 'OPEN' | 'ACK' | 'RESOLVED' | 'IGNORED';
    type ResolutionIncidentAction = 'ACK' | 'RESOLVE' | 'IGNORE';

    interface ResolutionIncidentHandleRecord {
      action: ResolutionIncidentAction;
      remark?: string;
      operator: string;
      handledAt: string;
    }

    interface ResolutionIncident {
      id: string;
      tenantId: string;
      type: ResolutionIncidentType;
      level: ResolutionIncidentLevel;
      status: ResolutionIncidentStatus;
      title: string;
      message: string;
      referenceId?: string;
      code?: string;
      traceId?: string | null;
      context?: Record<string, unknown>;
      occurredAt: string;
      latestHandle?: ResolutionIncidentHandleRecord;
    }

    type ResolutionIncidentSearchParams = CommonType.RecordNullable<
      {
        tenantId?: string;
        type?: ResolutionIncidentType;
        level?: ResolutionIncidentLevel;
        status?: ResolutionIncidentStatus;
        keyword?: string;
      } & Common.CommonSearchParams
    >;

    type ResolutionIncidentList = Common.PaginatingQueryRecord<ResolutionIncident>;

    type ResolutionIncidentHandlePayload = {
      action: ResolutionIncidentAction;
      remark?: string;
    };

    // Resolution: Priority Rule
    interface PriorityRule {
      id: string;
      tenantId: string;
      activityType: string;
      priority: number;
      aggregateEnabled: boolean;
      zoneEnabled: boolean;
      createTime?: string;
      updateTime?: string;
    }

    // Resolution: Metrics Dashboard
    interface ResolutionMetricThresholds {
      failureRateWarnPercent: number;
      p95LatencyWarnMs: number;
      cacheDeletedKeysWarn: number;
    }

    interface ResolutionMetricsAlert {
      code: 'SCENE_RESOLVE_FAILURE_RATE' | 'SCENE_RESOLVE_P95_LATENCY' | 'CACHE_INVALIDATION_DELETED_KEYS';
      level: 'WARN' | 'CRITICAL';
      message: string;
      threshold: number;
      actual: number;
    }

    interface ResolutionSceneResolveOverview {
      total: number;
      success: number;
      failed: number;
      successRate: number;
      p95LatencyMs: number | null;
      p99LatencyMs: number | null;
      avgLatencyMs: number | null;
      emptyModules: number;
    }

    interface ResolutionCacheInvalidationOverview {
      events: number;
      deletedKeys: number;
      totalDurationMs: number;
      avgDurationMs: number | null;
      p95DurationMs: number | null;
      p99DurationMs: number | null;
    }

    interface ResolutionMetricsOverview {
      date: string;
      thresholds: ResolutionMetricThresholds;
      sceneResolve: ResolutionSceneResolveOverview;
      cacheInvalidation: ResolutionCacheInvalidationOverview;
      alerts: ResolutionMetricsAlert[];
    }

    interface ResolutionSceneMetricsItem {
      sceneCode: string;
      success: number;
      failed: number;
      total: number;
      successRate: number;
    }

    interface ResolutionMetricsDashboard {
      overview: ResolutionMetricsOverview;
      topScenes: ResolutionSceneMetricsItem[];
    }

    // Marketing Business Dashboard
    type BusinessDashboardQuery = CommonType.RecordNullable<{
      tenantId?: string;
    }>;

    interface BusinessDashboardInstanceSection {
      total: number;
      success: number;
      failed: number;
      pendingPay: number;
      paid: number;
      active: number;
      timeout: number;
      refunded: number;
      successRate: number;
    }

    interface BusinessDashboardStatisticsSection {
      totalDistributed: number;
      totalUsed: number;
      useRate: number;
      totalExpired: number;
      totalDiscountAmount: number;
      pointsTotal: number;
      pointsAvailable: number;
    }

    interface BusinessDashboardIncidentSection {
      total: number;
      rows: ResolutionIncident[];
    }

    interface BusinessDashboardSections {
      resolution: ResolutionMetricsDashboard;
      runtimeLedger: RuntimeLedgerEntry[];
      instance: BusinessDashboardInstanceSection;
      statistics: BusinessDashboardStatisticsSection;
      incidents: BusinessDashboardIncidentSection;
    }

    interface BusinessDashboard {
      tenantId: string;
      generatedAt: string;
      sections: BusinessDashboardSections;
    }

    // Resolution: Simulation
    interface SimulateRequest {
      tenantId: string;
      productId: string;
      memberId?: string;
      simulateTime?: string;
      isNewcomer?: boolean;
      memberLevel?: string;
      executionMode?: 'PREVIEW' | 'REPLAY' | 'COMMIT';
      scenarioCode?: string;
      sampleEventIds?: string[];
      delayCompression?: {
        enabled?: boolean;
        ratio?: number;
        maxGapMs?: number;
      };
      probeEnabled?: boolean;
    }

    interface SimulateTimelineStep {
      eventId: string;
      eventType: string;
      code: string;
      name: string;
      offsetMs: number;
      payload: Record<string, unknown>;
    }

    interface SimulateCandidate {
      id: string;
      configId?: string;
      type: string;
      status: string;
      displayPriority: number;
    }

    interface SimulateFilteredItem {
      configId: string;
      type: string;
      reason: string;
    }

    interface SimulateSelectedActivity {
      activityType: string;
      configId: string;
      activityContextKey: string;
      commissionMode: string;
    }

    interface SimulateProbeStep {
      code: string;
      eventType: string;
      offsetMs: number;
    }

    interface SimulateSideEffects {
      executed: boolean;
      emittedCount: number;
    }

    interface SimulateResult {
      executionMode: 'PREVIEW' | 'REPLAY' | 'COMMIT';
      scenarioCode: string;
      timeline: SimulateTimelineStep[];
      candidateCount: number;
      candidates: SimulateCandidate[];
      eligibleCount: number;
      eligible: Array<Pick<SimulateCandidate, 'id' | 'type'>>;
      filteredCount: number;
      filtered: SimulateFilteredItem[];
      selectedActivity: SimulateSelectedActivity | null;
      selected?: SimulateSelectedActivity | null;
      sideEffects: SimulateSideEffects;
      probe?: {
        steps: SimulateProbeStep[];
      };
    }

    // Resolution: Order Activity Audit
    interface OrderActivityAuditItem {
      orderItemId: number;
      productId: string;
      productName: string;
      activityType?: string;
      activityConfigId?: string;
      activitySnapshot?: Record<string, unknown>;
      commissionMode?: string;
      commissionRate?: number;
    }

    interface OrderActivityAuditRecord {
      timestamp: string;
      action: string;
      detail: string;
    }

    interface OrderActivityAudit {
      orderId: string;
      /** 订单号（后端一并返回） */
      orderSn?: string;
      items: OrderActivityAuditItem[];
      auditRecords: OrderActivityAuditRecord[];
    }

    /** 后端 GET /store/order/:id/activity-audit 原始 data（含 resolutionAudits、行 id） */
    interface OrderActivityAuditPayload {
      orderId: string;
      orderSn?: string;
      items?: OrderActivityAuditItemPayload[];
      resolutionAudits?: OrderActivityAuditResolutionRow[];
      auditRecords?: OrderActivityAuditRecord[];
    }

    interface OrderActivityAuditItemPayload {
      id: number;
      productName: string;
      skuId?: string;
      activityContextKey?: string | null;
      activityType?: string | null;
      activityConfigId?: string | null;
      activityNameSnapshot?: string | null;
      activityPriceSnapshot?: unknown;
      activityCommissionModeSnapshot?: string | null;
      activityCommissionRateSnapshot?: number | null;
      orderItemOriginalAmount?: unknown;
      orderItemFinalPaid?: unknown;
      resolutionSnapshot?: unknown;
    }

    interface OrderActivityAuditResolutionRow {
      id: string;
      scene: string;
      createTime: string;
      selectedActivityType?: string | null;
      selectedConfigId?: string | null;
      candidateSnapshot?: unknown;
      filteredSnapshot?: unknown;
    }

    // Resolution: Commission Audit
    interface CommissionAuditRecord {
      id: string;
      orderId: string;
      orderItemId: number;
      level: number;
      beneficiaryId: string;
      amount: number;
      rateSnapshot: number;
      status: string;
      explanation: string;
      createTime: string;
    }

    /** Marketing Statistics */
    interface CouponStatistics {
      templateCount?: number;
      totalDistributed: number;
      totalUsed: number;
      totalExpired: number;
      useRate: number;
      totalDiscountAmount?: number;
      trend: {
        date: string;
        distributed: number;
        used: number;
      }[];
    }

    interface PointsStatistics {
      totalEarned: number;
      totalSpent: number;
      totalExpired: number;
      topEarners: {
        nickname: string;
        points: number;
      }[];
      trend: {
        date: string;
        earned: number;
        spent: number;
      }[];
    }

    // Marketing Scene
    interface MarketingScene {
      id: string;
      sceneCode: string;
      sceneName: string;
      sceneType: string;
      channelScope: string[];
      pageRoute?: string | null;
      status: string;
      /** 列表/编辑回填（与 SaveSceneParams 扩展字段对齐） */
      defaultCardTemplateCode?: string | null;
      defaultResolverPolicyCode?: string | null;
      placementConfig?: Record<string, unknown> | null;
      templateCode?: string | null;
      templateOverrides?: Record<string, unknown> | null;
      activityTypeFilter?: string;
      storeMatchMode?: string;
      sortMode?: string;
      modules?: MarketingSceneModule[];
    }

    interface MarketingSceneTemplateModule {
      id: string;
      templateCode: string;
      moduleSlot: string;
      moduleName: string;
      moduleType: string;
      title?: string | null;
      subTitle?: string | null;
      displayOrder: number;
      limitSize: number;
      sourcePolicyCode: string;
      resolverPolicyCode: string;
      sortPolicyCode?: string | null;
      audiencePolicyCode?: string | null;
      cardTemplateCode: string;
      attributionPolicyCode?: string | null;
      uiConfig?: Record<string, unknown> | null;
    }

    interface MarketingSceneTemplate {
      id: string;
      templateCode: string;
      templateName: string;
      sceneType: string;
      channelScope: string[];
      pageRoute?: string | null;
      defaultCardTemplateCode?: string | null;
      defaultResolverPolicyCode?: string | null;
      placementConfig?: Record<string, unknown> | null;
      description?: string | null;
      isActive: boolean;
      modules?: MarketingSceneTemplateModule[];
    }

    interface MarketingSceneModule {
      id: string;
      sceneCode: string;
      moduleCode: string;
      moduleName: string;
      moduleType: string;
      title?: string | null;
      subTitle?: string | null;
      displayOrder: number;
      limitSize: number;
      sourcePolicyCode: string;
      resolverPolicyCode: string;
      sortPolicyCode?: string | null;
      audiencePolicyCode?: string | null;
      cardTemplateCode: string;
      attributionPolicyCode?: string | null;
      uiConfig?: Record<string, unknown>;
      status: string;
    }

    type SceneSearchParams = CommonType.RecordNullable<
      { sceneCode?: string; sceneName?: string; sceneType?: string; status?: string } & Common.CommonSearchParams
    >;
    type SceneList = Common.PaginatingQueryRecord<MarketingScene>;

    type SceneTemplateSearchParams = CommonType.RecordNullable<
      { templateCode?: string; isActive?: string } & Common.CommonSearchParams
    >;
    type SceneTemplateList = Common.PaginatingQueryRecord<MarketingSceneTemplate>;

    type SaveSceneParams = Pick<MarketingScene, 'sceneCode' | 'sceneName' | 'sceneType' | 'channelScope'> & {
      pageRoute?: string | null;
      status?: string;
      defaultCardTemplateCode?: string | null;
      defaultResolverPolicyCode?: string | null;
      placementConfig?: Record<string, unknown> | null;
    };

    type CreateSceneFromTemplateParams = Pick<MarketingScene, 'sceneCode' | 'sceneName'> & {
      templateCode: string;
      status?: string;
      overrides?: Record<string, unknown>;
    };

    interface SyncSceneFromTemplateParams {
      fields: string[];
    }

    type SaveSceneModuleParams = Pick<
      MarketingSceneModule,
      'moduleCode' | 'moduleName' | 'moduleType' | 'sourcePolicyCode' | 'resolverPolicyCode' | 'cardTemplateCode'
    > & {
      id?: string;
      title?: string | null;
      subTitle?: string | null;
      displayOrder?: number;
      limitSize?: number;
      sortPolicyCode?: string | null;
      audiencePolicyCode?: string | null;
      attributionPolicyCode?: string | null;
      uiConfig?: Record<string, unknown>;
      status?: string;
    };

    interface ScenePublishPrecheckIssue {
      code:
        | 'SCENE_INACTIVE'
        | 'SCENE_NO_ACTIVE_MODULES'
        | 'MODULE_REQUIRED_POLICY_MISSING'
        | 'MODULE_LIMIT_INVALID'
        | 'POLICY_MISSING'
        | 'POLICY_TYPE_MISMATCH'
        | 'POLICY_INACTIVE';
      level: 'ERROR';
      target: string;
      message: string;
      relatedPolicyCode?: string;
    }

    interface ScenePublishPrecheckResult {
      pass: boolean;
      sceneCode: string;
      checkedAt: string;
      moduleCount: number;
      issues: string[];
      issueDetails: ScenePublishPrecheckIssue[];
    }

    // Marketing Policy
    interface MarketingPolicy {
      id: string;
      policyCode: string;
      policyName: string;
      policyType: string;
      status: string;
      /** 列表/详情返回的策略配置体 */
      config?: Record<string, unknown>;
      filterRules?: unknown[];
      resolveRules?: unknown[];
      createTime?: string;
    }

    type PolicySearchParams = CommonType.RecordNullable<
      { policyCode?: string; policyType?: string; status?: string } & Common.CommonSearchParams
    >;

    /** 场景模块列表查询 */
    type SceneModuleListSearchParams = CommonType.RecordNullable<
      { sceneCode?: string; moduleCode?: string; status?: string } & Common.CommonSearchParams
    >;

    /** 与 `useTable` / `NaiveUI.TableApiFn` 对齐：列表体须为 `PaginatingQueryRecord`（含 pageNum、pageSize） */
    type SceneModuleList = Common.PaginatingQueryRecord<MarketingSceneModule>;

    /** 营销玩法实例（活动实例） */
    interface PlayInstance {
      id: string;
      tenantId: string;
      memberId: string;
      configId: string;
      templateCode: string;
      instanceData: Record<string, unknown>;
      status: string;
      orderSn?: string | null;
      orderId?: string | null;
      createTime: string;
      updateTime?: string;
      payTime?: string | null;
      endTime?: string | null;
      /** 列表聚合：会员昵称或手机号 */
      memberDisplayName?: string;
      /** 列表聚合：配置可读摘要 */
      configDisplayName?: string;
      configRuleName?: string;
      configProductName?: string;
      /** 列表聚合：状态中文 */
      statusLabelZh?: string;
      /** 列表聚合：订单号/金额等 */
      instanceSummary?: string;
    }

    type PlayInstanceList = Common.PaginatingQueryRecord<PlayInstance>;

    /** 活动实例列表查询 */
    type PlayInstanceSearchParams = CommonType.RecordNullable<
      { memberId?: string; status?: string } & Common.CommonSearchParams
    >;

    interface InstanceProbeBase {
      id: string;
      tenantId: string;
      memberId: string;
      configId: string;
      templateCode: string;
      orderSn?: string | null;
      orderId?: string | null;
      status: string;
      createTime: string;
      payTime?: string | null;
      endTime?: string | null;
      updateTime: string;
      instanceData: Record<string, unknown>;
    }

    type InstanceProbeTimelineCode =
      | 'INSTANCE_CREATED'
      | 'INSTANCE_PAID'
      | 'INSTANCE_SUCCESS'
      | 'INSTANCE_FAILED'
      | 'INSTANCE_TIMEOUT'
      | 'INSTANCE_REFUNDED'
      | 'UNKNOWN';

    interface InstanceProbeTimelineItem {
      code: InstanceProbeTimelineCode;
      type: string;
      sourceStep?: string;
      traceId?: string | null;
      timestamp: string;
      payload: Record<string, unknown>;
    }

    interface InstanceProbeAbnormality {
      code: string;
      level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      message: string;
      occurredAt?: string;
      traceId?: string | null;
      context?: Record<string, unknown>;
    }

    interface InstanceProbe {
      base: InstanceProbeBase;
      timeline: InstanceProbeTimelineItem[];
      abnormalities: InstanceProbeAbnormality[];
      hasAbnormalities: boolean;
    }

    type InstanceProbeQuery = CommonType.RecordNullable<{
      tenantId?: string;
      instanceId?: string;
    }>;
    type PolicyList = Common.PaginatingQueryRecord<MarketingPolicy>;

    type SaveSourcePolicyParams = { policyCode: string; policyName: string; clauses: unknown[]; status?: string };
    type SaveResolverPolicyParams = {
      policyCode: string;
      policyName: string;
      primaryOfferTypes: string[];
      conflictMatrix: Record<string, unknown>;
      status?: string;
    };
    type SaveAudiencePolicyParams = {
      policyCode: string;
      policyName: string;
      rules: Record<string, unknown>;
      status?: string;
    };
    type SaveSortPolicyParams = { policyCode: string; policyName: string; sortRules: unknown[]; status?: string };
    type SaveCardTemplateParams = { policyCode: string; policyName: string; templateConfig: unknown; status?: string };

    /** 活动中心：跟随后端 OpenAPI 生成契约 */
    type ActivityBase = import('@libs/common-types').components['schemas']['ActivityVo'];
    type ActivityCreateBase = import('@libs/common-types').components['schemas']['CreateActivityDto'];
    type ActivityUpdateBase = import('@libs/common-types').components['schemas']['UpdateActivityDto'];

    /** OpenAPI 待补全：分销成长配置 */
    type DistributionGrowthShareChannel = 'MINIAPP' | 'H5' | 'APP';
    type DistributionGrowth = {
      activityVersionId: string;
      shareChannel: DistributionGrowthShareChannel;
      shareLandingPage: string;
      referralCodeEnabled: boolean;
      attributionWindowMinutes: number;
      commissionBudgetTotal: number;
      commissionBudgetAlertThreshold: number;
      commissionBudgetFuseThreshold: number;
      upgradeRule: Record<string, unknown>;
      teamThresholdRule: Record<string, unknown>;
    };

    type Activity = ActivityBase & {
      distributionGrowth?: DistributionGrowth | null;
    };
    type ActivityStatus = Activity['status'];
    type ActivityList = Common.PaginatingQueryRecord<Activity>;
    type ActivityListParams = CommonType.RecordNullable<
      import('@libs/common-types').operations['CampaignAdminController_list']['parameters']['query']
    >;
    type ActivityCalendarQuery = CommonType.RecordNullable<
      import('@libs/common-types').operations['CampaignAdminController_calendar']['parameters']['query']
    >;
    type ActivityDashboardQuery = CommonType.RecordNullable<
      import('@libs/common-types').operations['CampaignAdminController_dashboard']['parameters']['query']
    >;
    type ActivityCalendar = import('@libs/common-types').components['schemas']['ActivityCalendarVo'];
    type ActivityDashboard = import('@libs/common-types').components['schemas']['ActivityDashboardVo'];
    type ActivityItem = import('@libs/common-types').components['schemas']['ActivityItemDto'];
    type ActivityCreate = ActivityCreateBase & {
      distributionGrowth?: DistributionGrowth;
    };
    type ActivityUpdate = ActivityUpdateBase & {
      distributionGrowth?: DistributionGrowth;
    };
    type ActivityItemCreate = import('@libs/common-types').components['schemas']['CreateActivityItemDto'];
    type ActivityItemUpdate = import('@libs/common-types').components['schemas']['UpdateActivityItemDto'];

    /** 营销协议定义：跟随后端 OpenAPI 生成契约 */
    type MarketingProtocolCanonicalMapping =
      import('@libs/common-types').components['schemas']['MarketingProtocolCanonicalMappingVo'];
    type MarketingProtocolMutabilityRule =
      import('@libs/common-types').components['schemas']['MarketingProtocolMutabilityRuleVo'];
    type MarketingProtocolCutoverItem =
      import('@libs/common-types').components['schemas']['MarketingProtocolCutoverItemVo'];
    type JourneySettingsTemplate = import('@libs/common-types').components['schemas']['JourneySettingsDto'];
    type ProtocolDefinition = import('@libs/common-types').components['schemas']['MarketingProtocolDefinitionVo'];

    /** 营销活动向导 / 工作台壳子：跟随后端 OpenAPI 生成契约 */
    type CampaignWizardStep = import('@libs/common-types').components['schemas']['CampaignWizardStepVo'];
    type CampaignWizardShell = import('@libs/common-types').components['schemas']['CampaignWizardShellVo'];
    type CampaignWorkbenchTab = import('@libs/common-types').components['schemas']['CampaignWorkbenchTabVo'];
    type CampaignWorkbenchShell = import('@libs/common-types').components['schemas']['CampaignWorkbenchShellVo'];
    type CampaignApprovalLog = import('@libs/common-types').components['schemas']['CampaignApprovalLogVo'];
    type CampaignPrecheckShell = import('@libs/common-types').components['schemas']['CampaignPrecheckShellVo'];
    type CampaignShellPath =
      import('@libs/common-types').operations['CampaignShellController_getWorkbenchShell']['parameters']['path'];

    /** 营销权益池：当前前端工作台使用的稳定契约 */
    type EntitlementPoolType = 'PRODUCT' | 'COUPON' | 'POINTS';
    type EntitlementTouchpoint = 'audience' | 'product' | 'coupon' | 'points' | 'notification' | 'share';
    type EntitlementProductSourceType = 'SCENE' | 'CATEGORY' | 'RECOMMEND';

    interface EntitlementCompileTarget {
      owner: string;
      runtimeArtifacts: string[];
      forbiddenFacts?: string[];
    }

    interface EntitlementDefinition {
      version: string;
      poolTypes: EntitlementPoolType[];
      compileTargets: Record<string, EntitlementCompileTarget>;
      disallowedScopes: string[];
    }

    interface CompileEntitlementPoolInput {
      poolType: EntitlementPoolType;
      sourceType?: EntitlementProductSourceType;
      sourceKey?: string;
      memberId?: string;
      taskId?: string;
      templateId?: string;
      pageNum?: number;
      pageSize?: number;
    }

    interface CompileEntitlementPayload {
      touchpoints: EntitlementTouchpoint[];
      pools: CompileEntitlementPoolInput[];
    }

    interface EntitlementPoolCompileResult {
      poolType: EntitlementPoolType;
      poolId: string;
      compileTarget: EntitlementCompileTarget;
      preview?: Record<string, unknown>;
      riskSummary: string[];
    }

    interface EntitlementCompileData {
      pools: EntitlementPoolCompileResult[];
      owners: string[];
      riskSummary: string[];
    }
  }
}
