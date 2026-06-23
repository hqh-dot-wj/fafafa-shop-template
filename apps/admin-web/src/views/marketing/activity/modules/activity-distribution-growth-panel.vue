<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NGi, NGrid, NTag } from 'naive-ui';
import type { DistributionGrowth } from '@/service/api/marketing';
import ActivityCommissionBudgetPanel from './activity-commission-budget-panel.vue';
import ActivityReferralCodePanel from './activity-referral-code-panel.vue';
import ActivityTeamThresholdPanel from './activity-team-threshold-panel.vue';
import ActivityUpgradeTriggerPanel from './activity-upgrade-trigger-panel.vue';

defineOptions({ name: 'ActivityDistributionGrowthPanel' });

const props = defineProps<{
  distributionGrowth?: DistributionGrowth | null;
  commissionBudgetSnapshot?: Api.Store.CommissionBudgetSnapshot | null;
  referralRule?: Record<string, unknown> | null;
}>();

const growth = computed(() => props.distributionGrowth ?? null);
const hasGrowthConfig = computed(() =>
  Boolean(growth.value?.activityVersionId && growth.value?.shareChannel && growth.value?.shareLandingPage),
);
const activeGrowth = computed(() => (hasGrowthConfig.value ? growth.value : null));

const shareChannelLabel = computed(() => {
  const shareChannel = growth.value?.shareChannel;
  if (!shareChannel) return '未配置';
  const labelMap: Record<Api.Marketing.DistributionGrowthShareChannel, string> = {
    MINIAPP: '小程序',
    H5: 'H5',
    APP: 'App',
  };
  return labelMap[shareChannel] ?? shareChannel;
});

// 预算快照优先使用后端预算服务数据；缺失时只用活动配置生成展示态，不代表真实可用预算。
const budgetSnapshot = computed<Api.Store.CommissionBudgetSnapshot>(() => {
  const snapshot = props.commissionBudgetSnapshot;
  if (snapshot) {
    return snapshot;
  }

  return {
    budgetTotal: growth.value?.commissionBudgetTotal ?? 0,
    budgetFrozen: 0,
    budgetConsumed: 0,
    budgetReleased: 0,
    budgetByLevel: {},
    budgetByChannel: {},
    budgetByActivityVersion: {},
    budgetAlertThreshold: growth.value?.commissionBudgetAlertThreshold ?? 0,
    budgetFuseThreshold: growth.value?.commissionBudgetFuseThreshold ?? 0,
  };
});
</script>

<template>
  <!-- 分销成长区：汇总推荐码、升级触发、团队阈值和佣金预算配置。 -->
  <NCard title="分销成长配置" :bordered="false" size="small">
    <NEmpty v-if="!activeGrowth" description="当前活动未配置分销成长参数" size="small" />

    <template v-else>
      <!-- 成长配置摘要区：展示活动版本、分享渠道和归因窗口。 -->
      <NDescriptions label-placement="left" :column="3" size="small">
        <NDescriptionsItem label="活动版本">{{ activeGrowth.activityVersionId }}</NDescriptionsItem>
        <NDescriptionsItem label="分享渠道">
          <NTag type="info" size="small">{{ shareChannelLabel }}</NTag>
        </NDescriptionsItem>
        <NDescriptionsItem label="归因有效期（分钟），覆盖租户默认">
          {{ activeGrowth.attributionWindowMinutes }} 分钟
        </NDescriptionsItem>
      </NDescriptions>

      <!-- 成长规则明细区：按业务职责拆分推荐、升级、团队和预算四类面板。 -->
      <NGrid class="mt-12px" cols="1 l:2" responsive="screen" :x-gap="12" :y-gap="12">
        <NGi>
          <ActivityReferralCodePanel
            :activity-version-id="activeGrowth.activityVersionId"
            :share-channel="activeGrowth.shareChannel"
            :referral-code-enabled="activeGrowth.referralCodeEnabled"
            :share-landing-page="activeGrowth.shareLandingPage"
            :attribution-window-minutes="activeGrowth.attributionWindowMinutes"
            :referral-rule="referralRule"
          />
        </NGi>
        <NGi>
          <ActivityUpgradeTriggerPanel
            :activity-version-id="activeGrowth.activityVersionId"
            :upgrade-rule="activeGrowth.upgradeRule"
          />
        </NGi>
        <NGi>
          <ActivityTeamThresholdPanel
            :activity-version-id="activeGrowth.activityVersionId"
            :team-threshold-rule="activeGrowth.teamThresholdRule"
          />
        </NGi>
        <NGi>
          <ActivityCommissionBudgetPanel
            :budget-total="budgetSnapshot.budgetTotal"
            :budget-frozen="budgetSnapshot.budgetFrozen"
            :budget-consumed="budgetSnapshot.budgetConsumed"
            :budget-released="budgetSnapshot.budgetReleased"
            :budget-by-level="budgetSnapshot.budgetByLevel"
            :budget-by-channel="budgetSnapshot.budgetByChannel"
            :budget-by-activity-version="budgetSnapshot.budgetByActivityVersion"
            :budget-alert-threshold="budgetSnapshot.budgetAlertThreshold"
            :budget-fuse-threshold="budgetSnapshot.budgetFuseThreshold"
          />
        </NGi>
      </NGrid>
    </template>
  </NCard>
</template>
