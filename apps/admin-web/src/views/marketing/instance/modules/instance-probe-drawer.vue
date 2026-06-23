<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  NAlert,
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NSpin,
  NTag,
} from 'naive-ui';
import { fetchInstanceProbe } from '@/service/api/marketing/instance';
import { formatObjectSummaryText } from '../../shared/object-summary';

defineOptions({ name: 'InstanceProbeDrawer' });

const props = defineProps<{
  show: boolean;
  instanceId: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

const loading = ref(false);
const errorMessage = ref('');
const probe = ref<Api.Marketing.InstanceProbe | null>(null);

const base = computed(() => probe.value?.base ?? null);
const timeline = computed(() => probe.value?.timeline ?? []);
const abnormalities = computed(() => probe.value?.abnormalities ?? []);

const timelineLabelMap: Record<Api.Marketing.InstanceProbeTimelineCode, string> = {
  INSTANCE_CREATED: '实例创建',
  INSTANCE_PAID: '实例支付',
  INSTANCE_SUCCESS: '实例成功',
  INSTANCE_FAILED: '实例失败',
  INSTANCE_TIMEOUT: '实例超时',
  INSTANCE_REFUNDED: '实例退款',
  UNKNOWN: '未知事件',
};

function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

async function loadProbe(instanceId: string) {
  loading.value = true;
  errorMessage.value = '';
  try {
    const { data } = await fetchInstanceProbe(instanceId);
    probe.value = data ?? null;
  } catch (error) {
    probe.value = null;
    errorMessage.value = error instanceof Error ? error.message : '加载实例探针失败';
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.show, props.instanceId] as const,
  ([show, instanceId]) => {
    if (show && instanceId) {
      loadProbe(instanceId);
      return;
    }
    if (!show) {
      errorMessage.value = '';
    }
  },
  { immediate: true },
);
</script>

<template>
  <!-- 实例探针抽屉：读取单个实例的链路、时间线和异常上下文。 -->
  <NDrawer :show="show" width="920" placement="right" @update:show="(value) => emit('update:show', value)">
    <NDrawerContent title="实例探针" closable>
      <NSpin :show="loading">
        <!-- 加载失败区：保留重试入口，不吞掉后端诊断错误。 -->
        <NAlert v-if="errorMessage" type="error" :bordered="false" title="探针加载失败" class="mb-16px">
          <div class="mb-8px">{{ errorMessage }}</div>
          <NButton size="small" type="primary" @click="instanceId && loadProbe(instanceId)">重新加载</NButton>
        </NAlert>

        <NEmpty v-else-if="loading && !probe" description="正在加载实例探针..." />

        <template v-else-if="!probe">
          <NEmpty description="暂无探针数据" />
        </template>

        <template v-else>
          <!-- 链路状态区：汇总当前实例是否存在异常。 -->
          <NAlert :type="probe.hasAbnormalities ? 'warning' : 'success'" :bordered="false" class="mb-16px">
            <div class="flex items-center justify-between gap-12px">
              <div>
                <div class="font-medium">
                  {{ probe.hasAbnormalities ? '检测到异常' : '当前链路正常' }}
                </div>
                <div class="mt-4px text-12px">
                  {{ probe.hasAbnormalities ? '请结合时间线和异常列表进一步排查。' : '当前实例探针未发现异常。' }}
                </div>
              </div>
              <NTag :type="probe.hasAbnormalities ? 'warning' : 'success'" size="small">
                {{ probe.hasAbnormalities ? '有异常' : '无异常' }}
              </NTag>
            </div>
          </NAlert>

          <!-- 基础信息区：展示实例、租户、会员、订单和时间字段。 -->
          <NDescriptions label-placement="left" bordered :column="2" size="small" class="mb-16px">
            <NDescriptionsItem label="实例ID">{{ base?.id ?? '—' }}</NDescriptionsItem>
            <NDescriptionsItem label="租户ID">{{ base?.tenantId ?? '—' }}</NDescriptionsItem>
            <NDescriptionsItem label="会员ID">{{ base?.memberId ?? '—' }}</NDescriptionsItem>
            <NDescriptionsItem label="配置ID">{{ base?.configId ?? '—' }}</NDescriptionsItem>
            <NDescriptionsItem label="模板编码">{{ base?.templateCode ?? '—' }}</NDescriptionsItem>
            <NDescriptionsItem label="状态">{{ base?.status ?? '—' }}</NDescriptionsItem>
            <NDescriptionsItem label="创建时间">{{ formatTime(base?.createTime) }}</NDescriptionsItem>
            <NDescriptionsItem label="支付时间">{{ formatTime(base?.payTime) }}</NDescriptionsItem>
            <NDescriptionsItem label="结束时间">{{ formatTime(base?.endTime) }}</NDescriptionsItem>
            <NDescriptionsItem label="更新时间">{{ formatTime(base?.updateTime) }}</NDescriptionsItem>
            <NDescriptionsItem label="订单号">{{ base?.orderSn ?? '—' }}</NDescriptionsItem>
            <NDescriptionsItem label="系统订单ID">{{ base?.orderId ?? '—' }}</NDescriptionsItem>
          </NDescriptions>

          <!-- 业务数据区：展示实例附加数据摘要，不解析为前端规则。 -->
          <NCard title="实例业务数据" :bordered="false" size="small" class="mb-16px">
            <pre class="m-0 overflow-auto rounded-6px bg-gray-50 p-12px text-12px text-gray-700 leading-18px">{{
              formatObjectSummaryText(base?.instanceData)
            }}</pre>
          </NCard>

          <!-- 事件时间线区：按后端事件顺序展示 trace 和 payload。 -->
          <NCard title="最近事件时间线" :bordered="false" size="small" class="mb-16px">
            <NEmpty v-if="timeline.length === 0" description="暂无最近事件" />
            <div v-else class="space-y-12px">
              <div
                v-for="item in timeline"
                :key="`${item.timestamp}-${item.traceId ?? item.code}-${item.type}`"
                class="border border-gray-200 rounded-8px bg-gray-50 p-12px"
              >
                <div class="mb-8px flex flex-wrap items-center gap-8px">
                  <NTag type="info" size="small">{{ timelineLabelMap[item.code] ?? item.code }}</NTag>
                  <span class="text-12px text-gray-500 font-mono">{{ item.type }}</span>
                  <span v-if="item.sourceStep" class="text-12px text-gray-500">来源：{{ item.sourceStep }}</span>
                  <span v-if="item.traceId" class="text-12px text-gray-500">Trace：{{ item.traceId }}</span>
                  <span class="text-12px text-gray-500">{{ formatTime(item.timestamp) }}</span>
                </div>
                <pre class="m-0 overflow-auto rounded-6px bg-white p-12px text-12px text-gray-700 leading-18px">{{
                  formatObjectSummaryText(item.payload)
                }}</pre>
              </div>
            </div>
          </NCard>

          <!-- 异常列表区：展示后端归因的异常级别、代码和上下文。 -->
          <NCard title="异常列表" :bordered="false" size="small">
            <NEmpty v-if="abnormalities.length === 0" description="暂无异常" />
            <div v-else class="space-y-12px">
              <div
                v-for="abnormality in abnormalities"
                :key="`${abnormality.code}-${abnormality.traceId ?? abnormality.occurredAt ?? abnormality.message}`"
                class="border border-amber-200 rounded-8px bg-amber-50 p-12px"
              >
                <div class="mb-8px flex flex-wrap items-center gap-8px">
                  <NTag
                    :type="abnormality.level === 'CRITICAL' || abnormality.level === 'HIGH' ? 'error' : 'warning'"
                    size="small"
                  >
                    {{ abnormality.level }}
                  </NTag>
                  <span class="text-12px text-gray-500 font-mono">{{ abnormality.code }}</span>
                  <span v-if="abnormality.traceId" class="text-12px text-gray-500"
                    >Trace：{{ abnormality.traceId }}</span
                  >
                  <span v-if="abnormality.occurredAt" class="text-12px text-gray-500">
                    {{ formatTime(abnormality.occurredAt) }}
                  </span>
                </div>
                <div class="text-14px text-gray-800">{{ abnormality.message }}</div>
                <pre
                  v-if="abnormality.context && Object.keys(abnormality.context).length > 0"
                  class="m-0 mt-8px overflow-auto rounded-6px bg-white p-12px text-12px text-gray-700 leading-18px"
                  >{{ formatObjectSummaryText(abnormality.context) }}</pre
                >
              </div>
            </div>
          </NCard>
        </template>
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>
