<script lang="ts" setup>
import type { OrderStatusEnum } from '@libs/common-types/enum';
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { getOrderList } from '@/api/order';
import { prepay } from '@/api/payment';
import PhoneBindTip from '@/components/phone-bind-tip/phone-bind-tip.vue';
import { usePhoneBindTip } from '@/composables/use-phone-bind';
import { useAuthStore } from '@/store/auth';
import { useTokenStore } from '@/store/token';
import { formatPrice } from '@/utils/money';

definePage({
  style: {
    navigationBarTitleText: '我的订单',
  },
});

const tokenStore = useTokenStore();
const authStore = useAuthStore();
const { showPhoneBindTip, handleBindPhone } = usePhoneBindTip();

// 订单状态（字段与 backend OrderListItemVo 对齐）
interface OrderItem {
  id: string;
  orderSn: string;
  status: string;
  payAmount: number;
  itemCount: number;
  coverImage: string;
  createTime: string;
}

// 状态tabs
const tabs = [
  { label: '全部', value: '' },
  { label: '待支付', value: 'PENDING_PAY' },
  { label: '已支付', value: 'PAID' },
  { label: '已完成', value: 'COMPLETED' },
];

const activeTab = ref(0);
const loading = ref(false);
const orders = ref<OrderItem[]>([]);
const pageNum = ref(1);
const pageSize = 10;
const hasMore = ref(true);

// 状态映射
const statusMap: Record<string, string> = {
  PENDING_PAY: '待支付',
  PAID: '已支付',
  SHIPPED: '已发货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

onLoad((options?: { tab?: string }) => {
  const raw = options?.tab;
  if (raw !== undefined && raw !== '') {
    const n = Number.parseInt(String(raw), 10);
    if (!Number.isNaN(n) && n >= 0 && n < tabs.length) {
      activeTab.value = n;
    }
  }
  if (!tokenStore.hasLogin) {
    authStore.openAuthModal(() => {
      loadOrders();
    });
  } else {
    loadOrders();
  }
});

// 加载订单列表
async function loadOrders(refresh = true) {
  if (loading.value) return;

  if (refresh) {
    pageNum.value = 1;
    hasMore.value = true;
  }

  if (!hasMore.value) return;

  loading.value = true;
  try {
    const status = tabs[activeTab.value]?.value ?? '';
    const result = await getOrderList({
      pageNum: pageNum.value,
      pageSize,
      ...(status ? { status: status as OrderStatusEnum } : {}),
    });
    if (result) {
      const rows = (result.rows || []) as OrderItem[];
      if (refresh) {
        orders.value = rows;
      } else {
        orders.value.push(...rows);
      }
      hasMore.value = orders.value.length < result.total;
      pageNum.value++;
    }
  } catch (err) {
    console.error('加载订单失败:', err);
  } finally {
    loading.value = false;
  }
}

// 切换tab
function onTabChange(index: number) {
  activeTab.value = index;
  loadOrders();
}

// 跳转订单详情
function goDetail(orderId: string) {
  uni.navigateTo({ url: `/pages/order/detail?id=${orderId}` });
}

// 格式化时间
function formatTime(timeStr: string): string {
  const date = new Date(timeStr);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function onPay(orderId: string) {
  try {
    uni.showLoading({ title: '发起支付...' });

    // 列表页支付入口必须走真实 prepay，不能在这里保留 mock-success 快捷路径。
    const params = await prepay(orderId);
    uni.requestPayment({
      provider: 'wxpay',
      ...params,
      success: () => {
        uni.hideLoading();
        uni.redirectTo({ url: `/pages/pay/result?orderId=${orderId}&status=success` });
      },
      fail: (err) => {
        uni.hideLoading();
        console.error('支付失败:', err);
        uni.showToast({ title: '支付失败', icon: 'none' });
      },
    });
  } catch (err: any) {
    uni.hideLoading();
    console.error('支付发起失败', err);
    uni.showToast({ title: '支付发起失败', icon: 'none' });
  }
}
</script>

<template>
  <view class="order-list-page">
    <phone-bind-tip v-if="showPhoneBindTip" @bind="handleBindPhone" />

    <!-- 状态tabs -->
    <view class="tabs-section">
      <view
        v-for="(tab, index) in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ active: activeTab === index }"
        @click="onTabChange(index)"
      >
        {{ tab.label }}
      </view>
    </view>

    <!-- 订单列表 -->
    <view class="order-list">
      <view v-if="loading && orders.length === 0" class="loading-state">
        <wd-loading />
      </view>

      <view v-else-if="orders.length === 0" class="empty-state">
        <wd-icon name="order" size="120rpx" color="#ccc" />
        <text>暂无订单</text>
      </view>

      <view v-else>
        <view v-for="order in orders" :key="order.id" class="order-card" @click="goDetail(order.id)">
          <view class="order-header">
            <text class="order-sn">订单号：{{ order.orderSn }}</text>
            <text class="order-status">{{ statusMap[order.status] || order.status }}</text>
          </view>
          <view class="order-body">
            <image class="product-img" :src="order.coverImage" mode="aspectFill" />
            <view class="order-info">
              <text class="item-count">共 {{ order.itemCount }} 件商品</text>
              <view class="order-footer">
                <text class="order-time">{{ formatTime(order.createTime) }}</text>
                <text class="order-amount">¥{{ formatPrice(order.payAmount) }}</text>
              </view>
            </view>
          </view>

          <!-- 底部按钮 -->
          <view class="order-actions" @click.stop>
            <wd-button v-if="order.status === 'PENDING_PAY'" size="small" type="primary" @click="onPay(order.id)">
              去支付
            </wd-button>
            <wd-button v-else size="small" plain @click="goDetail(order.id)"> 查看详情 </wd-button>
          </view>
        </view>

        <view v-if="loading" class="loading-more">
          <wd-loading size="24rpx" />
          <text>加载中...</text>
        </view>
        <view v-else-if="!hasMore" class="no-more"> 没有更多了 </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.order-list-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.tabs-section {
  display: flex;
  background: #fff;
  padding: 0 20rpx;
  border-bottom: 1rpx solid #f0f0f0;

  .tab-item {
    flex: 1;
    text-align: center;
    padding: 24rpx 0;
    font-size: 28rpx;
    color: #666;
    position: relative;

    &.active {
      color: #1890ff;
      font-weight: 500;

      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 48rpx;
        height: 4rpx;
        background: #1890ff;
        border-radius: 2rpx;
      }
    }
  }
}

.order-list {
  padding: 20rpx;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
  color: #999;

  text {
    margin-top: 16rpx;
    font-size: 28rpx;
  }
}

.order-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;

  .order-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20rpx;

    .order-sn {
      font-size: 24rpx;
      color: #999;
    }

    .order-status {
      font-size: 26rpx;
      color: #1890ff;
      font-weight: 500;
    }
  }

  .order-body {
    display: flex;

    .product-img {
      width: 140rpx;
      height: 140rpx;
      border-radius: 12rpx;
      flex-shrink: 0;
    }

    .order-info {
      flex: 1;
      margin-left: 20rpx;
      display: flex;
      flex-direction: column;

      .item-count {
        font-size: 28rpx;
        color: #333;
      }

      .order-footer {
        display: flex;
        justify-content: space-between;
        margin-top: auto;

        .order-time {
          font-size: 24rpx;
          color: #999;
        }

        .order-amount {
          font-size: 30rpx;
          font-weight: 600;
          color: #ff4d4f;
        }
      }
    }
  }

  .order-actions {
    display: flex;
    justify-content: flex-end;
    gap: 20rpx;
    padding-top: 20rpx;
    margin-top: 20rpx;
    border-top: 1rpx solid #f9f9f9;
  }
}

.loading-more,
.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx;
  color: #999;
  font-size: 24rpx;

  text {
    margin-left: 8rpx;
  }
}
</style>
