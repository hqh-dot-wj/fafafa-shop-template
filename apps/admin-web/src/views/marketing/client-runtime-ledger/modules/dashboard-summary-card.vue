<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NGi, NGrid, NSpin, NStatistic } from 'naive-ui';

defineOptions({ name: 'DashboardSummaryCard' });

const props = defineProps<{
  dashboard: Api.Marketing.BusinessDashboard | null;
  loading?: boolean;
}>();

const sections = computed(() => props.dashboard?.sections ?? null);

function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}
</script>

<template>
  <!-- 经营摘要区：展示后端聚合的实例、券、积分和裁决指标。 -->
  <NCard title="经营摘要" :bordered="false" size="small" class="card-wrapper">
    <template #header-extra>
      <span class="text-xs text-gray-500">聚合时间：{{ formatTime(dashboard?.generatedAt) }}</span>
    </template>

    <NSpin :show="!!loading && !dashboard">
      <NEmpty v-if="!dashboard && !loading" description="暂无经营看板数据" />

      <div v-else-if="loading && !dashboard" class="py-32px text-center text-14px text-gray-500">
        正在加载经营看板...
      </div>

      <!-- 基础信息区：展示租户和看板生成时间。 -->
      <div v-else class="space-y-16px">
        <NDescriptions label-placement="left" bordered :column="2" size="small">
          <NDescriptionsItem label="租户ID">{{ dashboard?.tenantId ?? '—' }}</NDescriptionsItem>
          <NDescriptionsItem label="生成时间">{{ formatTime(dashboard?.generatedAt) }}</NDescriptionsItem>
        </NDescriptions>

        <!-- 实例指标区：展示营销实例状态分布和成功率。 -->
        <NGrid cols="2 s:3 m:4 l:6" :x-gap="12" :y-gap="12">
          <NGi>
            <NStatistic label="实例总数" :value="sections?.instance.total ?? 0" />
          </NGi>
          <NGi>
            <NStatistic label="成功数" :value="sections?.instance.success ?? 0" />
          </NGi>
          <NGi>
            <NStatistic label="待支付数" :value="sections?.instance.pendingPay ?? 0" />
          </NGi>
          <NGi>
            <NStatistic label="已支付数" :value="sections?.instance.paid ?? 0" />
          </NGi>
          <NGi>
            <NStatistic label="成功率" :value="formatPercent(sections?.instance.successRate ?? 0)" />
          </NGi>
          <NGi>
            <NStatistic label="进行中数" :value="sections?.instance.active ?? 0" />
          </NGi>
        </NGrid>

        <!-- 券和积分指标区：展示发放、核销和积分余额聚合。 -->
        <NGrid cols="2 s:3 m:4 l:6" :x-gap="12" :y-gap="12">
          <NGi>
            <NStatistic label="优惠券发放" :value="sections?.statistics.totalDistributed ?? 0" />
          </NGi>
          <NGi>
            <NStatistic label="优惠券核销" :value="sections?.statistics.totalUsed ?? 0" />
          </NGi>
          <NGi>
            <NStatistic label="核销率" :value="formatPercent(sections?.statistics.useRate ?? 0)" />
          </NGi>
          <NGi>
            <NStatistic label="过期数" :value="sections?.statistics.totalExpired ?? 0" />
          </NGi>
          <NGi>
            <NStatistic label="积分总量" :value="sections?.statistics.pointsTotal ?? 0" />
          </NGi>
          <NGi>
            <NStatistic label="可用积分" :value="sections?.statistics.pointsAvailable ?? 0" />
          </NGi>
        </NGrid>

        <!-- 裁决指标区：展示规则裁决成功率、延迟和缓存失效情况。 -->
        <NGrid cols="2 s:4" :x-gap="12" :y-gap="12">
          <NGi>
            <NStatistic label="裁决总量" :value="sections?.resolution.overview.sceneResolve.total ?? 0" />
          </NGi>
          <NGi>
            <NStatistic
              label="裁决成功率"
              :value="formatPercent(sections?.resolution.overview.sceneResolve.successRate ?? 0)"
            />
          </NGi>
          <NGi>
            <NStatistic label="P95 延迟" :value="sections?.resolution.overview.sceneResolve.p95LatencyMs ?? '—'" />
          </NGi>
          <NGi>
            <NStatistic
              label="缓存失效删除键"
              :value="sections?.resolution.overview.cacheInvalidation.deletedKeys ?? 0"
            />
          </NGi>
        </NGrid>
      </div>
    </NSpin>
  </NCard>
</template>
