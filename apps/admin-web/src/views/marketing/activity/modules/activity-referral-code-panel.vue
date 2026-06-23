<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NTag } from 'naive-ui';

defineOptions({ name: 'ActivityReferralCodePanel' });

const props = defineProps<{
  activityVersionId?: string | null;
  shareChannel?: 'MINIAPP' | 'H5' | 'APP' | null;
  referralCodeEnabled?: boolean | null;
  shareLandingPage?: string | null;
  attributionWindowMinutes?: number | null;
  referralRule?: Record<string, unknown> | null;
}>();

const referralStatus = computed(() => {
  if (props.referralCodeEnabled === true) {
    return { label: '已开启', type: 'success' as const };
  }
  if (props.referralCodeEnabled === false) {
    return { label: '已关闭', type: 'default' as const };
  }
  return { label: '未配置', type: 'warning' as const };
});

// 推荐规则摘要只解释扫码、有效期和重复命中策略，不在前端执行归因判断。
const referralRuleSummary = computed(() => {
  if (!props.referralRule) return '-';
  const maxScanPerUser = readNumber(props.referralRule.maxScanPerUser);
  const codeExpireMinutes = readNumber(props.referralRule.codeExpireMinutes);
  const duplicatePolicy = readString(props.referralRule.duplicatePolicy);
  const chunks: string[] = [];

  if (maxScanPerUser !== null) {
    chunks.push(`单用户扫码上限 ${maxScanPerUser}`);
  }
  if (codeExpireMinutes !== null) {
    chunks.push(`有效期 ${codeExpireMinutes} 分钟`);
  }
  if (duplicatePolicy) {
    chunks.push(`重复命中策略 ${duplicatePolicy}`);
  }

  return chunks.length > 0 ? chunks.join('，') : '-';
});

const shareChannelText = computed(() => {
  const channel = props.shareChannel;
  if (!channel) return '-';
  const map: Record<'MINIAPP' | 'H5' | 'APP', string> = {
    MINIAPP: '小程序',
    H5: 'H5',
    APP: 'App',
  };
  return map[channel] ?? channel;
});

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
</script>

<template>
  <!-- 推荐码入口区：展示分享渠道、落地页、归因窗口和推荐规则摘要。 -->
  <NCard title="推荐码入口" :bordered="false" size="small">
    <NDescriptions label-placement="left" :column="1" size="small">
      <NDescriptionsItem label="推荐码开关">
        <NTag :type="referralStatus.type" size="small">{{ referralStatus.label }}</NTag>
      </NDescriptionsItem>
      <NDescriptionsItem label="活动版本">{{ activityVersionId || '-' }}</NDescriptionsItem>
      <NDescriptionsItem label="分享渠道">{{ shareChannelText }}</NDescriptionsItem>
      <NDescriptionsItem label="分享落地页">{{ shareLandingPage || '-' }}</NDescriptionsItem>
      <NDescriptionsItem label="归因窗口">{{
        attributionWindowMinutes ? `${attributionWindowMinutes} 分钟` : '-'
      }}</NDescriptionsItem>
      <NDescriptionsItem label="推荐规则摘要">{{ referralRuleSummary }}</NDescriptionsItem>
    </NDescriptions>
  </NCard>
</template>
