<template>
  <view v-if="instance" class="course-widget">
    <view class="mb-3 flex items-center justify-between px-4 pt-4">
      <view class="text-sm text-gray-700 font-bold">
        {{ instance.role === 'LEADER' ? '我的拼课团' : '拼课进度' }}
      </view>
      <view :class="statusColor">
        {{ statusText }}
      </view>
    </view>

    <view class="mb-4 px-4">
      <view class="mb-1 flex justify-between text-xs text-gray-500">
        <text>已报名 {{ currentCount }} 人</text>
        <text>满 {{ minCount }} 人开班</text>
      </view>
      <view class="h-2 overflow-hidden rounded-full bg-gray-100">
        <view class="h-full bg-blue-500 transition-all duration-500" :style="{ width: `${progressPercent}%` }" />
      </view>
      <view v-if="currentCount < minCount" class="mt-1 text-xs text-orange-500"
        >还差 {{ minCount - currentCount }} 人开班</view
      >
      <view v-else class="mt-1 text-xs text-green-500"
        >已满足开班人数，剩余 {{ Math.max(0, maxCount - currentCount) }} 个名额</view
      >
    </view>

    <view class="mx-4 mb-4 rounded-lg bg-blue-50 p-3">
      <view class="mb-2 flex items-start">
        <text class="i-carbon-time mr-2 mt-0.5 text-sm text-blue-600" />
        <view class="text-xs text-blue-900">
          <view class="font-bold">上课时间</view>
          <view>{{ scheduleText }}</view>
        </view>
      </view>
      <view class="flex items-start">
        <text class="i-carbon-location mr-2 mt-0.5 text-sm text-blue-600" />
        <view class="text-xs text-blue-900">
          <view class="font-bold">上课地点</view>
          <view>{{ addressText }}</view>
        </view>
      </view>
    </view>

    <view v-if="timeLeft > 0" class="pb-4 text-center">
      <text class="text-xs text-gray-400">距离报名截止</text>
      <uni-countdown :show-day="true" :second="timeLeft" color="#3b82f6" background-color="#eff6ff" class="mt-1" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  instance: any;
}>();

// 拼课活动详情组件消费 ClientPlayInstanceController 返回的实例展示数据。
// role、人数、时间和地址优先展示后端 displayData/rules，不在组件内发起开团或支付。
function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function formatTimeRange(startValue: unknown, endValue: unknown): string {
  const start = new Date(String(startValue));
  const end = new Date(String(endValue));
  const startValid = !Number.isNaN(start.getTime());
  const endValid = !Number.isNaN(end.getTime());
  if (!startValid && !endValid) return '';
  const fmt = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(
      2,
      '0',
    )} ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  if (startValid && endValid) return `${fmt(start)} - ${fmt(end)}`;
  if (startValid) return fmt(start);
  return fmt(end);
}

const rules = computed(() => toRecord(props.instance?.config?.rules));
const displayData = computed(() => toRecord(props.instance?.displayData));
const instanceData = computed(() => toRecord(props.instance?.instanceData));

// currentCount 是玩法实例的展示进度，不等于真实支付人数；真实参团资格由拼课详情页 join-preview 校验。
const currentCount = computed(() => Math.max(0, readNumber(instanceData.value.currentCount, 0)));
const minCount = computed(() => Math.max(1, readNumber(rules.value.minCount, 1)));
const maxCount = computed(() => Math.max(minCount.value, readNumber(rules.value.maxCount, 100)));

const scheduleText = computed(() => {
  const fromDisplay = readText(displayData.value.scheduleText);
  if (fromDisplay) return fromDisplay;
  const fromRules = formatTimeRange(rules.value.classStartTime, rules.value.classEndTime);
  return fromRules || '待定';
});

const addressText = computed(() => {
  const fromDisplay = readText(displayData.value.addressText);
  if (fromDisplay) return fromDisplay;
  return readText(rules.value.classAddress) || '线上直播';
});

const progressPercent = computed(() => {
  const p = (currentCount.value / minCount.value) * 100;
  return Math.min(Math.max(p, 0), 100);
});

const statusText = computed(() => {
  const map: Record<string, string> = {
    PENDING_PAY: '待支付',
    PAID: '已支付',
    ACTIVE: '拼课中',
    SUCCESS: '开课成功',
    TIMEOUT: '拼课失败',
    REFUNDED: '已退款',
  };
  return map[props.instance?.status] || props.instance?.status;
});

const statusColor = computed(() => (props.instance?.status === 'SUCCESS' ? 'text-green-600' : 'text-orange-500'));

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    const parsedDate = Date.parse(text);
    if (!Number.isNaN(parsedDate)) {
      return parsedDate;
    }
    const parsedNumber = Number(text);
    if (Number.isFinite(parsedNumber)) {
      return parsedNumber > 1e12 ? parsedNumber : parsedNumber * 1000;
    }
  }
  return null;
}

const timeLeft = computed(() => {
  const end = parseTimestamp(rules.value.joinDeadline);
  if (end === null) return 0;
  const diff = (end - Date.now()) / 1000;
  return Math.max(Math.floor(diff), 0);
});
</script>
