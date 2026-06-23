import { PlayInstanceStatus, Prisma, PrismaClient } from '@prisma/client';

import { assertHunanFullSeedScope, hunanFullAt, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

type NotificationSeedRow = {
  channel: 'IN_APP' | 'SMS' | 'WECHAT_TEMPLATE' | 'APP_PUSH';
  target: string;
  template: string;
  title: string;
  content: string;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';
  bizRefId: string;
  activityType: string;
  touchpointCode: string;
  touchpointKind: 'MESSAGE' | 'SHARE';
  sceneCode?: string;
  errorMsg?: string;
  providerMessageId?: string;
  policySnapshot: Record<string, unknown>;
  createOffsetDays: number;
  createHour?: number;
};

const PLAY_INSTANCE_DEMOS: Array<{
  id: string;
  memberId: string;
  configId: string;
  templateCode: string;
  status: PlayInstanceStatus;
  createOffsetDays: number;
  payOffsetDays?: number;
  endOffsetDays?: number;
  instanceData: Record<string, unknown>;
}> = [
  {
    id: 'hf-play-demo-pending-01',
    memberId: 'hf-member-regular-14',
    configId: 'hf-config-flash-cleaner',
    templateCode: 'FLASH_SALE',
    status: PlayInstanceStatus.PENDING_PAY,
    createOffsetDays: -1,
    instanceData: {
      scenario: 'PENDING_PAY',
      stockLocked: false,
      source: 'HF-SEED::OBS',
    },
  },
  {
    id: 'hf-play-demo-paid-01',
    memberId: 'hf-member-regular-11',
    configId: 'hf-config-flash-fruit',
    templateCode: 'FLASH_SALE',
    status: PlayInstanceStatus.PAID,
    createOffsetDays: -2,
    payOffsetDays: -2,
    instanceData: {
      scenario: 'PAID_WAIT_RESULT',
      stockLocked: true,
      source: 'HF-SEED::OBS',
    },
  },
  {
    id: 'hf-play-demo-active-01',
    memberId: 'hf-member-regular-16',
    configId: 'hf-config-course-art',
    templateCode: 'COURSE_GROUP_BUY',
    status: PlayInstanceStatus.ACTIVE,
    createOffsetDays: -3,
    payOffsetDays: -3,
    instanceData: {
      scenario: 'GROUP_ACTIVE',
      currentCount: 1,
      targetCount: 2,
      source: 'HF-SEED::OBS',
    },
  },
  {
    id: 'hf-play-demo-success-01',
    memberId: 'hf-member-regular-12',
    configId: 'hf-config-course-basketball',
    templateCode: 'COURSE_GROUP_BUY',
    status: PlayInstanceStatus.SUCCESS,
    createOffsetDays: -6,
    payOffsetDays: -6,
    endOffsetDays: -3,
    instanceData: {
      scenario: 'GROUP_SUCCESS',
      currentCount: 10,
      targetCount: 10,
      source: 'HF-SEED::OBS',
    },
  },
  {
    id: 'hf-play-demo-timeout-01',
    memberId: 'hf-member-regular-17',
    configId: 'hf-config-course-art',
    templateCode: 'COURSE_GROUP_BUY',
    status: PlayInstanceStatus.TIMEOUT,
    createOffsetDays: -8,
    payOffsetDays: -8,
    endOffsetDays: -5,
    instanceData: {
      scenario: 'GROUP_TIMEOUT',
      currentCount: 1,
      targetCount: 2,
      source: 'HF-SEED::OBS',
    },
  },
  {
    id: 'hf-play-demo-failed-01',
    memberId: 'hf-member-regular-18',
    configId: 'hf-config-course-spoken',
    templateCode: 'COURSE_GROUP_BUY',
    status: PlayInstanceStatus.FAILED,
    createOffsetDays: -7,
    payOffsetDays: -7,
    endOffsetDays: -6,
    instanceData: {
      scenario: 'GROUP_FAILED',
      failedReason: 'LEADER_CANCELLED',
      source: 'HF-SEED::OBS',
    },
  },
  {
    id: 'hf-play-demo-refunded-01',
    memberId: 'hf-member-regular-09',
    configId: 'hf-config-upgrade-scratch',
    templateCode: 'MEMBER_UPGRADE',
    status: PlayInstanceStatus.REFUNDED,
    createOffsetDays: -10,
    payOffsetDays: -10,
    endOffsetDays: -9,
    instanceData: {
      scenario: 'UPGRADE_REFUNDED',
      refundReason: 'MANUAL_REVIEW_REJECTED',
      source: 'HF-SEED::OBS',
    },
  },
];

const RESOLUTION_AUDIT_ROWS: Array<{
  id: string;
  productId: string;
  memberId: string;
  scene: string;
  selectedActivityType: string | null;
  selectedConfigId: string | null;
  candidateSnapshot: Prisma.InputJsonValue;
  filteredSnapshot: Prisma.InputJsonValue;
  createOffsetDays: number;
  createHour?: number;
}> = [
  {
    id: 'hf-resolution-audit-001',
    productId: 'hf-instant-coconut-water-001',
    memberId: 'hf-member-regular-02',
    scene: 'HF_SCENE_FLASH',
    selectedActivityType: 'FLASH_SALE',
    selectedConfigId: 'hf-config-flash-coconut',
    candidateSnapshot: [
      { configId: 'hf-config-flash-coconut', activityType: 'FLASH_SALE', priority: 100 },
      { configId: 'hf-config-flash-cleaner', activityType: 'FLASH_SALE', priority: 84 },
      { activityType: 'FULL_REDUCTION', priority: 70 },
    ] as Prisma.InputJsonValue,
    filteredSnapshot: [{ configId: 'hf-config-flash-cleaner', reason: 'PRODUCT_NOT_MATCH' }] as Prisma.InputJsonValue,
    createOffsetDays: -2,
    createHour: 11,
  },
  {
    id: 'hf-resolution-audit-002',
    productId: 'hf-service-art-001',
    memberId: 'hf-member-regular-08',
    scene: 'HF_SCENE_COURSE',
    selectedActivityType: 'COURSE_GROUP',
    selectedConfigId: 'hf-config-course-art',
    candidateSnapshot: [
      { configId: 'hf-config-course-art', activityType: 'COURSE_GROUP', priority: 96 },
      { configId: 'hf-config-upgrade-scratch', activityType: 'MEMBER_UPGRADE', priority: 70 },
    ] as Prisma.InputJsonValue,
    filteredSnapshot: [] as Prisma.InputJsonValue,
    createOffsetDays: -1,
    createHour: 15,
  },
  {
    id: 'hf-resolution-audit-003',
    productId: 'hf-retail-nuts-gift-001',
    memberId: 'hf-member-regular-03',
    scene: 'HF_SCENE_HOME',
    selectedActivityType: 'FULL_REDUCTION',
    selectedConfigId: null,
    candidateSnapshot: [
      { activityType: 'FULL_REDUCTION', priority: 80 },
      { activityType: 'NEWCOMER_EXCLUSIVE', priority: 100 },
    ] as Prisma.InputJsonValue,
    filteredSnapshot: [{ activityType: 'NEWCOMER_EXCLUSIVE', reason: 'MEMBER_NOT_NEWCOMER' }] as Prisma.InputJsonValue,
    createOffsetDays: -9,
    createHour: 19,
  },
  {
    id: 'hf-resolution-audit-004',
    productId: 'hf-service-math-001',
    memberId: 'hf-member-l1-07',
    scene: 'HF_SCENE_HOME',
    selectedActivityType: 'MEMBER_UPGRADE',
    selectedConfigId: 'hf-config-upgrade-math',
    candidateSnapshot: [
      { configId: 'hf-config-upgrade-math', activityType: 'MEMBER_UPGRADE', priority: 68 },
    ] as Prisma.InputJsonValue,
    filteredSnapshot: [] as Prisma.InputJsonValue,
    createOffsetDays: -11,
    createHour: 14,
  },
  {
    id: 'hf-resolution-audit-005',
    productId: 'hf-instant-granola-001',
    memberId: 'hf-member-regular-09',
    scene: 'HF_SCENE_FLASH',
    selectedActivityType: null,
    selectedConfigId: null,
    candidateSnapshot: [{ activityType: 'FLASH_SALE', priority: 95 }] as Prisma.InputJsonValue,
    filteredSnapshot: [{ activityType: 'FLASH_SALE', reason: 'ACTIVITY_WINDOW_EXPIRED' }] as Prisma.InputJsonValue,
    createOffsetDays: -7,
    createHour: 13,
  },
  {
    id: 'hf-resolution-audit-006',
    productId: 'hf-retail-cleaner-001',
    memberId: 'hf-member-regular-11',
    scene: 'HF_SCENE_NEWCOMER',
    selectedActivityType: 'NEWCOMER_EXCLUSIVE',
    selectedConfigId: null,
    candidateSnapshot: [
      { activityType: 'NEWCOMER_EXCLUSIVE', priority: 100 },
      { activityType: 'FLASH_SALE', priority: 95 },
    ] as Prisma.InputJsonValue,
    filteredSnapshot: [{ activityType: 'FLASH_SALE', reason: 'SCENE_NOT_MATCH' }] as Prisma.InputJsonValue,
    createOffsetDays: 0,
    createHour: 10,
  },
];

const NOTIFICATION_ROWS: NotificationSeedRow[] = [
  {
    channel: 'IN_APP',
    target: 'hf-member-regular-01',
    template: 'HF_MKT_NEWCOMER_SUCCESS_V1',
    title: '新人礼包到账',
    content: '你已获得新人券礼包，请在 7 天内使用。',
    status: 'SENT',
    bizRefId: 'HF-SEED::NTF:001',
    activityType: 'NEWCOMER_EXCLUSIVE',
    touchpointCode: 'NEWCOMER_WELCOME_V1',
    touchpointKind: 'MESSAGE',
    sceneCode: 'HF_SCENE_NEWCOMER',
    providerMessageId: 'hf-provider-001',
    policySnapshot: { allowed: true, quietHoursPassed: true, consentPassed: true, frequencyPassed: true },
    createOffsetDays: -7,
    createHour: 10,
  },
  {
    channel: 'APP_PUSH',
    target: 'hf-member-regular-02',
    template: 'HF_MKT_FLASH_STOCK_ALERT_V1',
    title: '秒杀库存告急',
    content: '你关注的商品库存不足，请尽快下单。',
    status: 'FAILED',
    bizRefId: 'HF-SEED::NTF:002',
    activityType: 'FLASH_SALE',
    touchpointCode: 'FLASH_SALE_STOCK_ALERT',
    touchpointKind: 'MESSAGE',
    sceneCode: 'HF_SCENE_FLASH',
    errorMsg: 'QUIET_HOURS_BLOCKED',
    policySnapshot: { allowed: false, reason: 'QUIET_HOURS', quietHours: { start: '23:00', end: '08:00' } },
    createOffsetDays: -2,
    createHour: 23,
  },
  {
    channel: 'SMS',
    target: '13900003333',
    template: 'HF_MKT_FULL_REDUCTION_REMINDER_V1',
    title: '周末满减提醒',
    content: '你的购物车已满足满减条件。',
    status: 'SENT',
    bizRefId: 'HF-SEED::NTF:003',
    activityType: 'FULL_REDUCTION',
    touchpointCode: 'FULL_REDUCTION_REMINDER',
    touchpointKind: 'MESSAGE',
    sceneCode: 'HF_SCENE_HOME',
    providerMessageId: 'hf-provider-003',
    policySnapshot: { allowed: true, frequencyCounter: 1, frequencyLimit: 2 },
    createOffsetDays: -9,
    createHour: 16,
  },
  {
    channel: 'WECHAT_TEMPLATE',
    target: 'openid_hf_member_l1_03',
    template: 'HF_MKT_COURSE_GROUP_RECRUIT_V1',
    title: '拼课报名提醒',
    content: '你发起的拼课活动仍差 1 人成团。',
    status: 'QUEUED',
    bizRefId: 'HF-SEED::NTF:004',
    activityType: 'COURSE_GROUP',
    touchpointCode: 'COURSE_GROUP_RECRUIT',
    touchpointKind: 'MESSAGE',
    sceneCode: 'HF_SCENE_COURSE',
    policySnapshot: { allowed: true, queueReason: 'WAIT_PROVIDER_WINDOW' },
    createOffsetDays: -1,
    createHour: 20,
  },
  {
    channel: 'IN_APP',
    target: 'hf-member-l1-07',
    template: 'HF_MKT_MEMBER_UPGRADE_APPROVED_V1',
    title: '升级审核通过',
    content: '恭喜你升级为合伙人等级。',
    status: 'SENT',
    bizRefId: 'HF-SEED::NTF:005',
    activityType: 'MEMBER_UPGRADE',
    touchpointCode: 'MEMBER_UPGRADE_APPROVED',
    touchpointKind: 'MESSAGE',
    providerMessageId: 'hf-provider-005',
    policySnapshot: { allowed: true, consentRequired: true, consentGranted: true },
    createOffsetDays: -11,
    createHour: 15,
  },
  {
    channel: 'APP_PUSH',
    target: 'hf-member-regular-14',
    template: 'HF_MKT_GROUP_BUY_PROGRESS_V1',
    title: '拼团进度更新',
    content: '你的拼团还差 1 人即可成功。',
    status: 'SENDING',
    bizRefId: 'HF-SEED::NTF:006',
    activityType: 'GROUP_BUY',
    touchpointCode: 'GROUP_BUY_PROGRESS',
    touchpointKind: 'MESSAGE',
    sceneCode: 'HF_SCENE_COURSE',
    policySnapshot: { allowed: true, channelFallback: ['IN_APP'] },
    createOffsetDays: -1,
    createHour: 18,
  },
  {
    channel: 'IN_APP',
    target: 'hf-member-regular-18',
    template: 'HF_MKT_COURSE_GROUP_SHARE_V1',
    title: '分享触点记录',
    content: '课程拼团分享已触发，等待关系绑定。',
    status: 'SENT',
    bizRefId: 'HF-SEED::NTF:007',
    activityType: 'COURSE_GROUP',
    touchpointCode: 'COURSE_GROUP_SHARE',
    touchpointKind: 'SHARE',
    sceneCode: 'HF_SCENE_COURSE',
    providerMessageId: 'hf-provider-007',
    policySnapshot: { allowed: true, bindingMode: 'BOTH', attributionWindowMinutes: 10080 },
    createOffsetDays: -6,
    createHour: 12,
  },
  {
    channel: 'SMS',
    target: '13900010000',
    template: 'HF_MKT_FIRST_ORDER_POINTS_V1',
    title: '首单积分到账',
    content: '首单奖励积分已到账，可用于抵扣。',
    status: 'FAILED',
    bizRefId: 'HF-SEED::NTF:008',
    activityType: 'FIRST_ORDER',
    touchpointCode: 'FIRST_ORDER_POINTS_V1',
    touchpointKind: 'MESSAGE',
    errorMsg: 'CONSENT_NOT_GRANTED',
    policySnapshot: { allowed: false, reason: 'CONSENT_REQUIRED', consentGranted: false },
    createOffsetDays: -5,
    createHour: 21,
  },
];

function resolvePlayEndTime(offsetDays?: number): Date | null {
  if (offsetDays == null) {
    return null;
  }
  return hunanFullAt(offsetDays, 18, 0);
}

function mapActivityIdByType(rows: Array<{ id: string; type: string }>): Map<string, string> {
  return new Map(rows.map((row) => [row.type, row.id]));
}

export async function seedHunanMarketingObservability(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanMarketingObservability');
  console.log('[07-Orders] 湖南完整演示营销可观测样本...');

  const activityRows = await prisma.mktCampaign.findMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      type: {
        in: [...new Set(NOTIFICATION_ROWS.map((item) => item.activityType))],
      },
    },
    select: {
      id: true,
      type: true,
    },
  });
  const activityIdByType = mapActivityIdByType(activityRows);

  await prisma.sysNotificationLog.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      bizType: 'MARKETING_ACTIVITY',
      bizRefId: { startsWith: 'HF-SEED::NTF:' },
    },
  });

  await prisma.mktResolutionAudit.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      scene: { in: ['HF_SCENE_FLASH', 'HF_SCENE_COURSE', 'HF_SCENE_HOME', 'HF_SCENE_NEWCOMER'] },
    },
  });

  await prisma.playInstance.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      id: { startsWith: 'hf-play-demo-' },
    },
  });

  await prisma.playInstance.createMany({
    data: PLAY_INSTANCE_DEMOS.map((item) => ({
      id: item.id,
      tenantId: HUNAN_FULL_TENANT_ID,
      memberId: item.memberId,
      configId: item.configId,
      templateCode: item.templateCode,
      instanceData: item.instanceData as Prisma.InputJsonValue,
      status: item.status,
      createTime: hunanFullAt(item.createOffsetDays, 10, 0),
      payTime: item.payOffsetDays == null ? null : hunanFullAt(item.payOffsetDays, 11, 20),
      endTime: resolvePlayEndTime(item.endOffsetDays),
    })),
  });

  await prisma.mktResolutionAudit.createMany({
    data: RESOLUTION_AUDIT_ROWS.map((item) => ({
      id: item.id,
      tenantId: HUNAN_FULL_TENANT_ID,
      productId: item.productId,
      memberId: item.memberId,
      scene: item.scene,
      candidateSnapshot: item.candidateSnapshot,
      filteredSnapshot: item.filteredSnapshot,
      selectedActivityType: item.selectedActivityType,
      selectedConfigId: item.selectedConfigId,
      createTime: hunanFullAt(item.createOffsetDays, item.createHour ?? 10, 0),
    })),
  });

  await prisma.sysNotificationLog.createMany({
    data: NOTIFICATION_ROWS.map((item) => ({
      tenantId: HUNAN_FULL_TENANT_ID,
      channel: item.channel,
      target: item.target,
      template: item.template,
      title: item.title,
      content: item.content,
      status: item.status,
      errorMsg: item.errorMsg ?? null,
      bizType: 'MARKETING_ACTIVITY',
      bizRefId: item.bizRefId,
      activityId: activityIdByType.get(item.activityType) ?? null,
      touchpointCode: item.touchpointCode,
      touchpointKind: item.touchpointKind,
      sceneCode: item.sceneCode ?? null,
      policySnapshot: item.policySnapshot as Prisma.InputJsonValue,
      providerMessageId: item.providerMessageId ?? null,
      createTime: hunanFullAt(item.createOffsetDays, item.createHour ?? 10, 0),
    })),
  });

  console.log(
    `  ✓ ${PLAY_INSTANCE_DEMOS.length} 条实例状态样本、${RESOLUTION_AUDIT_ROWS.length} 条裁决审计、${NOTIFICATION_ROWS.length} 条通知日志`,
  );
}
