<route lang="json5">
{
  style: {
    navigationBarTitleText: '活动详情',
  },
}
</route>

<template>
  <view class="page-container min-h-screen bg-gray-50 pb-20">
    <view v-if="loadError" class="p-4 text-center text-sm text-red-500">
      {{ loadError }}
    </view>

    <view class="mb-4 bg-white p-4">
      <image v-if="productInfo.image" :src="productInfo.image" mode="aspectFill" class="mb-2 h-60 w-full rounded-lg" />
      <view
        v-else
        class="mb-2 h-60 w-full flex items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400"
      >
        暂无活动封面
      </view>
      <view class="text-lg font-bold">
        {{ productInfo.name }}
      </view>
      <view class="text-sm text-gray-500">
        {{ productInfo.desc }}
      </view>
      <view class="mt-2 text-xl text-red-500 font-bold">
        ¥ {{ instanceData ? instanceData.price : isLoading ? '...' : '--' }}
      </view>
    </view>

    <view v-if="instanceData" class="mx-4 mb-4 rounded-lg bg-white p-4 shadow-sm">
      <CourseWidget
        v-if="isCourseGroupTemplate(instanceData.templateCode) && hasCourseDisplayContext(instanceData)"
        :instance="instanceData"
      />

      <view v-if="instanceData.templateCode === 'SECKILL'" class="text-center text-orange-500">
        <template v-if="seckillTimeLeft > 0">
          距离活动结束
          <uni-countdown
            class="mt-2 inline-flex"
            :show-day="false"
            :second="seckillTimeLeft"
            color="#f97316"
            background-color="#fff7ed"
          />
        </template>
        <template v-else>当前秒杀活动已结束</template>
      </view>
    </view>

    <view class="fixed bottom-0 left-0 right-0 flex items-center justify-between border-t border-gray-100 bg-white p-4">
      <view class="flex flex-col">
        <text class="text-xs text-gray-500">实付金额</text>
        <text class="text-lg text-red-500 font-bold">¥ {{ instanceData ? instanceData.price : '0.00' }}</text>
      </view>
      <button
        class="rounded-full bg-blue-600 px-8 py-2 text-sm text-white font-bold"
        :disabled="isLoading"
        @click="handleMainAction"
      >
        {{ actionBtnText }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { MarketingPlayInstanceDetail } from '@/api/marketing';
import { onLoad } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { getMarketingPlayInstanceDetail } from '@/api/marketing';
import { COURSE_GROUP_ACTIVITY_TYPE, isCourseGroupActivityType } from '@/constants/course-group';
import { reportActionError, toUserErrorMessage } from '@/http/error-monitoring';
import CourseWidget from './components/course-widget.vue';

// 活动详情页读取 /client/marketing/instance/:id，只展示本人可见的玩法实例。
// 拼课模板额外挂载 CourseWidget，订单金额与可下单性仍在订单创建链路再次校验。
type CourseActionType = 'view-order' | 'ended' | 'invite' | 'waiting';

type MarketingPlayInstanceView = MarketingPlayInstanceDetail & {
  price: string;
  role: 'LEADER' | 'MEMBER';
  instanceData: Record<string, unknown>;
};

const productInfo = ref({
  name: '',
  desc: '',
  image: '',
});

const instanceData = ref<MarketingPlayInstanceView | null>(null);
const isLoading = ref(false);
const loadError = ref('');

onLoad((options) => {
  if (typeof options?.id === 'string' && options.id.length > 0) {
    void loadData(options.id);
    return;
  }
  loadError.value = '缺少活动实例参数';
});

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function pickFirstText(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === 'string' && value.trim()) {
    const dateTs = Date.parse(value);
    if (!Number.isNaN(dateTs)) return dateTs;
    const numTs = Number(value);
    if (Number.isFinite(numTs)) return numTs > 1e12 ? numTs : numTs * 1000;
  }
  return null;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true') return true;
    if (normalized === '0' || normalized === 'false') return false;
  }
  return undefined;
}

function isCourseGroupTemplate(templateCode: unknown): boolean {
  return isCourseGroupActivityType(templateCode);
}

function deriveCourseRole(instanceDataJson: Record<string, unknown>): 'LEADER' | 'MEMBER' {
  const parentId = pickFirstText([instanceDataJson.parentId]);
  const isLeader = readBoolean(instanceDataJson.isLeader) ?? parentId.length === 0;
  return isLeader ? 'LEADER' : 'MEMBER';
}

function normalizePlayInstance(raw: MarketingPlayInstanceDetail): MarketingPlayInstanceView {
  const rules = toRecord(raw.config?.rules);
  const displayData = toRecord(raw.displayData);
  // 价格展示兼容 displayData 与 rules 的历史字段；最终实付金额以创建订单时后端计算为准。
  const priceRaw =
    displayData.displayPrice ??
    displayData.price ??
    rules.discountPrice ??
    rules.salePrice ??
    rules.price ??
    rules.depositPrice ??
    rules.groupPrice;

  const instanceDataJson = toRecord(raw.instanceData);
  const price = priceRaw !== undefined && priceRaw !== null && String(priceRaw).length > 0 ? String(priceRaw) : '--';

  return {
    ...raw,
    price,
    role: deriveCourseRole(instanceDataJson),
    instanceData: instanceDataJson,
  };
}

async function loadData(id: string) {
  isLoading.value = true;
  loadError.value = '';
  try {
    const raw = await getMarketingPlayInstanceDetail(id, {
      hideErrorToast: true,
      timeout: 12_000,
      operationCode: 'marketing.detail',
      stepCode: 'marketing.detail.loadInstance',
      stepName: '加载活动详情',
      metadata: { module: 'marketing-detail', id },
    });
    instanceData.value = normalizePlayInstance(raw);
    const displayData = toRecord(raw.displayData);
    const rules = toRecord(raw.config?.rules);
    productInfo.value = {
      name: pickFirstText([
        displayData.activityName,
        displayData.productName,
        displayData.title,
        `营销活动（${raw.templateCode}）`,
      ]),
      desc: pickFirstText([
        displayData.lessonSummary,
        displayData.scheduleText,
        displayData.countText,
        `模板：${raw.templateCode}`,
      ]),
      image: pickFirstText([displayData.productImg, displayData.image, rules.productImg, rules.coverImage, '']),
    };
  } catch (error) {
    reportActionError(error, {
      module: 'marketing-detail',
      operationCode: 'marketing.detail',
      stepCode: 'marketing.detail.loadInstance',
      stepName: '加载活动详情',
      metadata: { id },
    });
    loadError.value = toUserErrorMessage(error, '活动信息加载失败，请稍后重试');
    instanceData.value = null;
  } finally {
    isLoading.value = false;
  }
}

function hasCourseDisplayContext(instance: MarketingPlayInstanceView): boolean {
  if (!isCourseGroupTemplate(instance.templateCode)) return false;
  const displayData = toRecord(instance.displayData);
  const rules = toRecord(instance.config?.rules);
  const hasDisplayText = [pickFirstText([displayData.scheduleText]), pickFirstText([displayData.addressText])].some(
    Boolean,
  );
  if (hasDisplayText) return true;
  return [rules.minCount, rules.maxCount, rules.classStartTime, rules.classEndTime, rules.classAddress].some(
    (value) => value !== undefined && value !== null,
  );
}

const courseActionTextMap: Record<CourseActionType, string> = {
  'view-order': '查看订单',
  ended: '活动结束',
  invite: '邀请拼课',
  waiting: '等待开班',
};

function getOrderId(instance: MarketingPlayInstanceView): string {
  return pickFirstText([toRecord(instance.instanceData).orderId, instance.orderSn]);
}

function isEndedStatus(status: MarketingPlayInstanceView['status']): boolean {
  return status === 'TIMEOUT' || status === 'FAILED' || status === 'REFUNDED';
}

function getCourseActionType(instance: MarketingPlayInstanceView): CourseActionType | null {
  if (!isCourseGroupTemplate(instance.templateCode)) return null;
  if (getOrderId(instance)) return 'view-order';
  if (isEndedStatus(instance.status)) return 'ended';
  if (instance.status === 'SUCCESS') return 'waiting';
  if (instance.status === 'PAID' || instance.status === 'ACTIVE') {
    return instance.role === 'LEADER' ? 'invite' : 'waiting';
  }
  return null;
}

const actionBtnText = computed(() => {
  const current = instanceData.value;
  if (!current) return '加载中...';
  const courseAction = getCourseActionType(current);
  if (courseAction) return courseActionTextMap[courseAction];
  if (current.status === 'SUCCESS') return '查看结果';
  if (isEndedStatus(current.status)) return '活动结束';
  const map: Record<string, string> = {
    [COURSE_GROUP_ACTIVITY_TYPE]: '参与拼课',
    SECKILL: '立即抢购',
    BARGAIN: '找人砍价',
  };
  return map[current.templateCode] || '立即参与';
});

const seckillTimeLeft = computed(() => {
  const current = instanceData.value;
  if (!current || current.templateCode !== 'SECKILL') return 0;
  const instanceJson = toRecord(current.instanceData);
  const displayData = toRecord(current.displayData);
  const timestamp = parseTimestamp(
    instanceJson.countdownEndTime ?? instanceJson.endAt ?? displayData.countdownEndTime ?? displayData.endAt,
  );
  if (timestamp === null) return 0;
  return Math.max(Math.floor((timestamp - Date.now()) / 1000), 0);
});

function toQueryString(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function buildCheckoutQuery(instance: MarketingPlayInstanceView): string | null {
  const instanceJson = toRecord(instance.instanceData);
  const rules = toRecord(instance.config?.rules);
  // 这里只组装订单页上下文，不能在活动详情页直接推导库存、名额或优惠后的真实应付金额。
  const skuId = pickFirstText([
    instanceJson.skuId,
    rules.skuId,
    toRecord(Array.isArray(rules.skus) ? rules.skus[0] : undefined).skuId,
  ]);
  if (!instance.tenantId || !skuId) return null;

  const params: Record<string, string | undefined> = {
    mode: 'course_group',
    tenantId: instance.tenantId,
    skuId,
    quantity: String(normalizePositiveInt(instanceJson.quantity, 1)),
    activityContextKey: instance.id,
    activityType: isCourseGroupTemplate(instance.templateCode) ? COURSE_GROUP_ACTIVITY_TYPE : instance.templateCode,
    activityConfigId: instance.configId,
  };

  if (isCourseGroupTemplate(instance.templateCode)) {
    const parentId = pickFirstText([instanceJson.parentId]);
    const isLeader = deriveCourseRole(instanceJson) === 'LEADER';
    params.isLeader = String(isLeader);
    if (!isLeader) {
      params.teamId = parentId || instance.id;
    }
  }

  return toQueryString(params);
}

function handleCourseAction(instance: MarketingPlayInstanceView, action: CourseActionType) {
  if (action === 'view-order') {
    uni.navigateTo({ url: `/pages/order/detail?id=${encodeURIComponent(getOrderId(instance))}` });
    return;
  }
  if (action === 'ended') {
    uni.showToast({ title: '活动已结束', icon: 'none' });
    return;
  }
  if (action === 'invite') {
    uni.showToast({ title: '请分享拼课链接邀请好友', icon: 'none' });
    return;
  }
  uni.showToast({ title: '已参团，等待开班', icon: 'none' });
}

function handleMainAction() {
  const current = instanceData.value;
  if (!current || isLoading.value) return;

  const courseAction = getCourseActionType(current);
  if (courseAction) {
    handleCourseAction(current, courseAction);
    return;
  }
  if (isEndedStatus(current.status)) {
    uni.showToast({ title: '活动已结束', icon: 'none' });
    return;
  }
  const checkoutQuery = buildCheckoutQuery(current);
  if (!checkoutQuery) {
    uni.showToast({ title: '活动信息不完整，暂不可下单', icon: 'none' });
    return;
  }
  uni.navigateTo({ url: `/pages/order/create?${checkoutQuery}` });
}
</script>

<style scoped>
/* UnoCSS recommended */
</style>
