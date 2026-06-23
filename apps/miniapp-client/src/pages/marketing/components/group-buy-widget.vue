<template>
  <view v-if="instance" class="group-buy-widget">
    <!-- 1. 进度概览 -->
    <view class="mb-3 flex items-center justify-between">
      <view class="text-sm font-bold">
        {{ instance.role === 'LEADER' ? '我是团长' : '拼团成员' }}
      </view>
      <view class="text-xs text-gray-500">
        {{ statusText }}
      </view>
    </view>

    <!-- 2. 头像坑位区 -->
    <view class="my-4 flex justify-center gap-4">
      <view
        v-for="i in targetCount"
        :key="i"
        class="h-10 w-10 flex items-center justify-center border-2 rounded-full bg-gray-200"
        :class="i <= currentCount ? 'border-orange-500' : 'border-dashed border-gray-300'"
      >
        <text v-if="i <= currentCount" class="i-carbon-user text-orange-500" />
        <text v-else class="text-xs text-gray-300">?</text>
      </view>
    </view>

    <!-- 3. 倒计时/提示 -->
    <view class="mb-4 text-center text-sm text-gray-600">
      <text v-if="timeLeft > 0">
        仅剩
        <text class="text-red-500 font-bold">{{ remainCount }}</text>
        个名额， <uni-countdown :show-day="false" :second="timeLeft" color="#ef4444" background-color="#fff" /> 后结束
      </text>
      <text v-else>拼团已结束</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface GroupBuyDisplayData {
  countdownEndTime?: string | null;
}

interface GroupBuyInstance {
  status?: string;
  createTime?: string;
  config?: {
    rules?: Record<string, unknown>;
  };
  displayData?: GroupBuyDisplayData | null;
  instanceData?: Record<string, unknown>;
  role?: string;
}

const props = defineProps<{
  instance: GroupBuyInstance;
}>();

// 普通拼团组件只做实例数据展示，倒计时和人数来自 instanceData/displayData/config 的后端快照。
// 下单、库存和退款状态不在这里计算。
const statusText = computed(() => {
  const map: Record<string, string> = {
    PENDING_PAY: '待支付',
    PAID: '拼团中',
    ACTIVE: '待成团',
    SUCCESS: '拼团成功',
    TIMEOUT: '拼团失败',
    REFUNDED: '已退款',
  };
  const status = props.instance.status;
  if (!status) return '';
  return map[status] || status;
});

const instanceData = computed<Record<string, unknown>>(() => {
  const data = props.instance?.instanceData;
  return data && typeof data === 'object' ? data : {};
});

const targetCount = computed(() => normalizePositiveInt(instanceData.value.targetCount, 2));

const currentCount = computed(() => normalizePositiveInt(instanceData.value.currentCount, 0));

const remainCount = computed(() => Math.max(targetCount.value - currentCount.value, 0));

const countdownEndTime = computed(() => {
  // 倒计时字段兼容新旧来源，优先使用后端显式结束时间，最后才从创建时间 + 有效期推导展示值。
  const fromInstanceData = parseTimestamp(instanceData.value.countdownEndTime ?? instanceData.value.endAt);
  if (fromInstanceData !== null) {
    return fromInstanceData;
  }

  const fromDisplay = parseTimestamp(props.instance?.displayData?.countdownEndTime);
  if (fromDisplay !== null) {
    return fromDisplay;
  }

  const validDurationHours = normalizeFloat(props.instance?.config?.rules?.validDays);
  const createdAt = parseTimestamp(props.instance?.createTime);
  if (validDurationHours !== null && createdAt !== null) {
    return createdAt + validDurationHours * 60 * 60 * 1000;
  }

  return null;
});

const timeLeft = computed(() => {
  if (!countdownEndTime.value) {
    return 0;
  }
  return Math.max(Math.floor((countdownEndTime.value - Date.now()) / 1000), 0);
});

function normalizePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeFloat(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber > 1e12 ? asNumber : asNumber * 1000;
    }
  }
  return null;
}
</script>

<style scoped>
/* UnoCSS handles most styles */
</style>
