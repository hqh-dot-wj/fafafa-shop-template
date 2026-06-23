<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NAlert, NButton, NCard, NEmpty, NGi, NGrid, NSpace, NSpin, NStatistic, NTag } from 'naive-ui';
import { fetchResolutionMetricsDashboard } from '@/service/api/marketing/resolution';

defineOptions({ name: 'SceneMetricsPanel' });

const metricsLoading = ref(false);
const metricsDashboard = ref<Api.Marketing.ResolutionMetricsDashboard | null>(null);

const resolutionOverview = computed(() => metricsDashboard.value?.overview ?? null);
const resolutionAlerts = computed(() => metricsDashboard.value?.overview.alerts ?? []);
const resolutionTopScenes = computed(() => metricsDashboard.value?.topScenes ?? []);

const thresholdSuggestionText = computed(() => {
  const thresholds = resolutionOverview.value?.thresholds;
  if (!thresholds) return '失败率 < 5%，P95 延迟 < 800ms，缓存失效键数 < 2000';
  return (
    `失败率 < ${thresholds.failureRateWarnPercent}%，` +
    `P95 延迟 < ${thresholds.p95LatencyWarnMs}ms，` +
    `缓存失效键数 < ${thresholds.cacheDeletedKeysWarn}`
  );
});

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${value.toFixed(2)}%`;
}

function formatLatency(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${value.toFixed(2)}ms`;
}

function alertTagType(level: Api.Marketing.ResolutionMetricsAlert['level']) {
  return level === 'CRITICAL' ? 'error' : 'warning';
}

async function loadResolutionMetrics() {
  metricsLoading.value = true;
  try {
    const { data: result } = await fetchResolutionMetricsDashboard();
    metricsDashboard.value = result ?? null;
  } catch {
    metricsDashboard.value = null;
  } finally {
    metricsLoading.value = false;
  }
}

onMounted(() => {
  loadResolutionMetrics();
});

defineExpose({
  refresh: loadResolutionMetrics,
});
</script>

<template>
  <!-- 场景运行监控区：展示裁决指标、告警和场景请求 Top。 -->
  <NCard title="场景运行监控" :bordered="false" size="small" class="card-wrapper">
    <template #header-extra>
      <NButton type="primary" ghost size="small" :loading="metricsLoading" @click="loadResolutionMetrics">
        刷新监控
      </NButton>
    </template>

    <NSpin :show="metricsLoading">
      <NSpace vertical :size="12">
        <!-- 阈值提示区：展示后端返回或默认的监控建议阈值。 -->
        <NAlert type="info" :bordered="false"> 建议阈值：{{ thresholdSuggestionText }} </NAlert>

        <!-- 告警区：展示当前裁决指标触发的风险提示。 -->
        <NAlert
          v-if="resolutionAlerts.length > 0"
          type="warning"
          :bordered="false"
          :title="`发现 ${resolutionAlerts.length} 条告警`"
        >
          <div
            v-for="(alert, index) in resolutionAlerts"
            :key="`${alert.code}-${index}`"
            class="mb-6px flex items-center gap-8px last:mb-0"
          >
            <NTag size="small" :type="alertTagType(alert.level)">{{ alert.level }}</NTag>
            <span class="text-13px">{{ alert.message }}</span>
          </div>
        </NAlert>

        <!-- 裁决指标区：展示请求量、成功率、延迟和缓存失效指标。 -->
        <NGrid v-if="resolutionOverview" :cols="6" :x-gap="12" :y-gap="12" responsive="screen">
          <NGi>
            <NStatistic label="裁决总请求" :value="resolutionOverview.sceneResolve.total" />
          </NGi>
          <NGi>
            <NStatistic label="裁决成功率" :value="formatPercent(resolutionOverview.sceneResolve.successRate)" />
          </NGi>
          <NGi>
            <NStatistic label="裁决 P95" :value="formatLatency(resolutionOverview.sceneResolve.p95LatencyMs)" />
          </NGi>
          <NGi>
            <NStatistic label="裁决 P99" :value="formatLatency(resolutionOverview.sceneResolve.p99LatencyMs)" />
          </NGi>
          <NGi>
            <NStatistic label="空模块累计" :value="resolutionOverview.sceneResolve.emptyModules" />
          </NGi>
          <NGi>
            <NStatistic label="当日缓存失效键" :value="resolutionOverview.cacheInvalidation.deletedKeys" />
          </NGi>
        </NGrid>

        <NEmpty v-if="!resolutionOverview" description="暂无监控数据，请稍后刷新" />

        <!-- 热门场景区：展示请求量靠前的场景及其成功率。 -->
        <NCard title="场景请求 Top" size="small" :bordered="false" class="bg-#fafafa">
          <NEmpty v-if="resolutionTopScenes.length === 0" description="暂无场景请求数据" />
          <div v-else class="flex-col gap-8px">
            <div
              v-for="scene in resolutionTopScenes"
              :key="scene.sceneCode"
              class="flex items-center justify-between rounded-6px bg-white px-10px py-8px"
            >
              <div class="flex items-center gap-8px">
                <NTag type="info" size="small" :bordered="false" class="font-mono">
                  {{ scene.sceneCode }}
                </NTag>
                <span class="text-13px text-gray-500"> 总请求 {{ scene.total }} / 失败 {{ scene.failed }} </span>
              </div>
              <span class="text-13px text-gray-700 font-600">{{ formatPercent(scene.successRate) }}</span>
            </div>
          </div>
        </NCard>
      </NSpace>
    </NSpin>
  </NCard>
</template>
