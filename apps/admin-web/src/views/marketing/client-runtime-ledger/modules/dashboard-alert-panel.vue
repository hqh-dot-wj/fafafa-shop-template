<script setup lang="ts">
import { computed } from 'vue';
import { NAlert, NCard, NEmpty, NSpace, NSpin, NTag } from 'naive-ui';

defineOptions({ name: 'DashboardAlertPanel' });

const props = defineProps<{
  dashboard: Api.Marketing.BusinessDashboard | null;
  loading?: boolean;
}>();

const alerts = computed(() => props.dashboard?.sections.resolution.overview.alerts ?? []);
const incidents = computed(() => props.dashboard?.sections.incidents.rows ?? []);

function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}
</script>

<template>
  <!-- 告警面板区：展示经营指标告警和排障工单，只读解释运行风险。 -->
  <NCard title="告警面板" :bordered="false" size="small" class="card-wrapper">
    <NSpace vertical :size="16">
      <!-- 指标告警区：展示后端看板聚合出的阈值异常。 -->
      <div>
        <div class="mb-8px text-14px font-medium">指标告警</div>
        <NEmpty v-if="alerts.length === 0 && !loading" description="暂无指标告警" />
        <NSpin v-else-if="loading" :show="true">
          <div class="h-48px"></div>
        </NSpin>
        <div v-else class="space-y-10px">
          <NAlert
            v-for="alert in alerts"
            :key="alert.code"
            :type="alert.level === 'CRITICAL' ? 'error' : 'warning'"
            :bordered="false"
          >
            <div class="flex flex-wrap items-center justify-between gap-8px">
              <div class="font-medium">{{ alert.message }}</div>
              <NTag :type="alert.level === 'CRITICAL' ? 'error' : 'warning'" size="small">{{ alert.level }}</NTag>
            </div>
            <div class="mt-4px text-12px text-gray-500">
              <span class="mr-12px">码：{{ alert.code }}</span>
              <span class="mr-12px">阈值：{{ alert.threshold }}</span>
              <span>实际：{{ alert.actual }}</span>
            </div>
          </NAlert>
        </div>
      </div>

      <!-- 排障工单区：展示最近运行事件和 trace 信息，便于跳转排查。 -->
      <div>
        <div class="mb-8px text-14px font-medium">排障工单</div>
        <NEmpty v-if="incidents.length === 0 && !loading" description="暂无排障工单" />
        <NSpin v-else-if="loading" :show="true">
          <div class="h-48px"></div>
        </NSpin>
        <div v-else class="space-y-10px">
          <div v-for="incident in incidents" :key="incident.id" class="border border-gray-200 rounded-8px p-12px">
            <div class="mb-8px flex flex-wrap items-center gap-8px">
              <NTag
                :type="incident.level === 'CRITICAL' || incident.level === 'HIGH' ? 'error' : 'warning'"
                size="small"
              >
                {{ incident.level }}
              </NTag>
              <NTag :type="incident.status === 'RESOLVED' ? 'success' : 'default'" size="small">
                {{ incident.status }}
              </NTag>
              <span class="font-medium">{{ incident.title }}</span>
            </div>
            <div class="text-13px text-gray-700">{{ incident.message }}</div>
            <div class="mt-8px text-12px text-gray-500">
              <span class="mr-12px">类型：{{ incident.type }}</span>
              <span class="mr-12px">代码：{{ incident.code ?? '—' }}</span>
              <span class="mr-12px">时间：{{ formatTime(incident.occurredAt) }}</span>
              <span v-if="incident.traceId">Trace：{{ incident.traceId }}</span>
            </div>
          </div>
        </div>
      </div>
    </NSpace>
  </NCard>
</template>
