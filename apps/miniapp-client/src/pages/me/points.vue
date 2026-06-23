<script lang="ts" setup>
import type { PointsBalance, PointsConsumeAllocation, PointsLot, PointsRefundAllocation } from '@/api/points';
import { onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { getPointsBalance, getPointsConsumeAllocations, getPointsLots, getPointsRefundAllocations } from '@/api/points';

definePage({
  style: {
    navigationBarTitleText: '积分明细',
    backgroundColor: '#f5f6fa',
  },
});

// C 端积分明细页对应 ClientPointsAccountController 的只读资产账接口。
// 页面并列展示余额、批次、消费分摊和退款回流，不能用某个 tab 的列表反推实时余额。
type PointsTab = 'lots' | 'consume' | 'refund';

const activeTab = ref<PointsTab>('lots');
const loading = ref(false);
const balance = ref<PointsBalance>({
  availablePoints: 0,
  frozenPoints: 0,
  expiringPoints: 0,
});
const lots = ref<PointsLot[]>([]);
const consumeAllocations = ref<PointsConsumeAllocation[]>([]);
const refundAllocations = ref<PointsRefundAllocation[]>([]);

const tabs: Array<{ key: PointsTab; label: string }> = [
  { key: 'lots', label: '积分批次' },
  { key: 'consume', label: '消费分摊' },
  { key: 'refund', label: '退款回流' },
];

const currentRows = computed(() => {
  if (activeTab.value === 'consume') return consumeAllocations.value;
  if (activeTab.value === 'refund') return refundAllocations.value;
  return lots.value;
});

onShow(() => {
  void loadPointsAssets();
});

async function loadPointsAssets() {
  loading.value = true;
  try {
    // 并行加载四类只读数据，任一失败统一提示，避免展示部分账务造成误读。
    const [nextBalance, lotPage, consumePage, refundPage] = await Promise.all([
      getPointsBalance({ hideErrorToast: true }),
      getPointsLots({ pageNum: 1, pageSize: 20 }, { hideErrorToast: true }),
      getPointsConsumeAllocations({ pageNum: 1, pageSize: 20 }, { hideErrorToast: true }),
      getPointsRefundAllocations({ pageNum: 1, pageSize: 20 }, { hideErrorToast: true }),
    ]);
    balance.value = nextBalance;
    lots.value = lotPage.rows ?? [];
    consumeAllocations.value = consumePage.rows ?? [];
    refundAllocations.value = refundPage.rows ?? [];
  } catch {
    uni.showToast({ title: '积分明细加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function setActiveTab(tab: PointsTab) {
  activeTab.value = tab;
}

function formatDate(value?: string | null) {
  if (!value) return '长期有效';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatStatus(value?: string | null) {
  const map: Record<string, string> = {
    ACTIVE: '可用',
    EXHAUSTED: '已用完',
    EXPIRED: '已过期',
    CANCELLED: '已取消',
    REFUNDED: '已退款',
    ORIGINAL_LOT_RESTORE: '原批次恢复',
    EXPIRED_LOT_COMPENSATION: '过期补偿',
    NEW_REFUND_TRANSACTION: '补偿入账',
    MANUAL_REVIEW: '人工复核',
  };
  return value ? (map[value] ?? value) : '-';
}

function getTransactionRemark(row: { sourceTransaction?: { remark?: string | null } | null }) {
  return row.sourceTransaction?.remark || '积分入账';
}

function getConsumeRemark(row: PointsConsumeAllocation) {
  return row.spendTransaction?.remark || row.relatedId || '积分消费';
}

function getRefundRemark(row: PointsRefundAllocation) {
  return row.refundTransaction?.remark || row.relatedId || '退款返还';
}
</script>

<template>
  <view class="points-page">
    <view class="points-summary">
      <view class="points-summary__main">
        <text class="points-summary__label">可用积分</text>
        <text class="points-summary__value">{{ balance.availablePoints }}</text>
      </view>
      <view class="points-summary__side">
        <view class="points-summary__side-item">
          <text class="points-summary__side-value">{{ balance.frozenPoints }}</text>
          <text class="points-summary__side-label">冻结中</text>
        </view>
        <view class="points-summary__side-item">
          <text class="points-summary__side-value">{{ balance.expiringPoints }}</text>
          <text class="points-summary__side-label">30天内过期</text>
        </view>
      </view>
    </view>

    <view class="points-tabs">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="points-tabs__item"
        :class="{ 'points-tabs__item--active': activeTab === tab.key }"
        hover-class="points-tabs__item--hover"
        @click="setActiveTab(tab.key)"
      >
        {{ tab.label }}
      </view>
    </view>

    <view class="points-list">
      <view v-if="loading" class="points-empty">加载中...</view>
      <view v-else-if="currentRows.length === 0" class="points-empty">暂无积分记录</view>

      <template v-else-if="activeTab === 'lots'">
        <view v-for="row in lots" :key="row.id" class="points-row">
          <view class="points-row__main">
            <text class="points-row__title">{{ getTransactionRemark(row) }}</text>
            <text class="points-row__meta">过期时间 {{ formatDate(row.expireTime) }}</text>
          </view>
          <view class="points-row__amount">
            <text class="points-row__amount-value">+{{ row.availableAmount }}</text>
            <text class="points-row__status">{{ formatStatus(row.status) }}</text>
          </view>
        </view>
      </template>

      <template v-else-if="activeTab === 'consume'">
        <view v-for="row in consumeAllocations" :key="row.id" class="points-row">
          <view class="points-row__main">
            <text class="points-row__title">{{ getConsumeRemark(row) }}</text>
            <text class="points-row__meta">可退 {{ row.refundableAmount }} · 批次 {{ row.lotId }}</text>
          </view>
          <view class="points-row__amount">
            <text class="points-row__amount-value points-row__amount-value--minus">-{{ row.amount }}</text>
            <text class="points-row__status">{{ formatStatus(row.status) }}</text>
          </view>
        </view>
      </template>

      <template v-else>
        <view v-for="row in refundAllocations" :key="row.id" class="points-row">
          <view class="points-row__main">
            <text class="points-row__title">{{ getRefundRemark(row) }}</text>
            <text class="points-row__meta">{{ formatStatus(row.strategy) }} · {{ formatDate(row.createTime) }}</text>
          </view>
          <view class="points-row__amount">
            <text class="points-row__amount-value">+{{ row.amount }}</text>
            <text class="points-row__status">已返还</text>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.points-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx;
  background: #f5f6fa;
}

.points-summary {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 20rpx;
  padding: 32rpx;
  color: #fff;
  background: linear-gradient(135deg, #1f2937 0%, #126c67 100%);
  border-radius: 16rpx;
}

.points-summary__main,
.points-summary__side {
  display: flex;
  flex-direction: column;
}

.points-summary__label,
.points-summary__side-label {
  font-size: 24rpx;
  color: rgb(255 255 255 / 76%);
}

.points-summary__value {
  margin-top: 10rpx;
  font-size: 64rpx;
  font-weight: 700;
  line-height: 1;
}

.points-summary__side {
  justify-content: space-between;
  min-width: 180rpx;
  text-align: right;
}

.points-summary__side-value {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
}

.points-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8rpx;
  margin-top: 24rpx;
  padding: 8rpx;
  background: #fff;
  border-radius: 12rpx;
}

.points-tabs__item {
  height: 64rpx;
  font-size: 26rpx;
  line-height: 64rpx;
  color: #5b6472;
  text-align: center;
  border-radius: 8rpx;
}

.points-tabs__item--active {
  color: #0f766e;
  background: #e8f5f3;
  font-weight: 600;
}

.points-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}

.points-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 12rpx;
}

.points-row__main {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}

.points-row__title,
.points-row__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.points-row__title {
  font-size: 28rpx;
  color: #111827;
}

.points-row__meta,
.points-row__status {
  font-size: 22rpx;
  color: #8a94a6;
}

.points-row__amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  min-width: 150rpx;
}

.points-row__amount-value {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f766e;
}

.points-row__amount-value--minus {
  color: #dc2626;
}

.points-empty {
  padding: 88rpx 0;
  font-size: 26rpx;
  color: #8a94a6;
  text-align: center;
  background: #fff;
  border-radius: 12rpx;
}
</style>
