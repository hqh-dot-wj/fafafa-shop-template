<script lang="ts" setup>
import type { AddressVo } from '@/api/address';
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { deleteAddress, getAddressList, setDefaultAddress } from '@/api/address';

definePage({
  style: {
    navigationBarTitleText: '地址管理',
  },
});

const loading = ref(true);
const addressList = ref<AddressVo[]>([]);

// 页面显示时刷新数据
onShow(async () => {
  await loadAddressList();
});

// 加载地址列表
async function loadAddressList() {
  loading.value = true;
  try {
    const result = await getAddressList();
    if (result) {
      addressList.value = result.list || [];
    }
  } catch (err) {
    console.error('加载地址列表失败:', err);
  } finally {
    loading.value = false;
  }
}

// 新增地址
function goAddAddress() {
  uni.navigateTo({
    url: '/pages/address/edit',
  });
}

// 编辑地址
function goEditAddress(id: string) {
  uni.navigateTo({
    url: `/pages/address/edit?id=${id}`,
  });
}

// 设为默认
async function onSetDefault(addr: AddressVo) {
  if (addr.isDefault) return;

  try {
    await setDefaultAddress(addr.id);
    uni.showToast({ title: '设置成功', icon: 'success' });
    await loadAddressList();
  } catch (err) {
    console.error('设置默认地址失败:', err);
  }
}

// 删除地址
function onDelete(addr: AddressVo) {
  uni.showModal({
    title: '提示',
    content: '确定删除该地址吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteAddress(addr.id);
          uni.showToast({ title: '删除成功', icon: 'success' });
          await loadAddressList();
        } catch (err) {
          console.error('删除地址失败:', err);
        }
      }
    },
  });
}
</script>

<template>
  <view class="address-page">
    <!-- 加载中 -->
    <view v-if="loading" class="loading-state">
      <wd-loading />
    </view>

    <!-- 地址列表 -->
    <view v-else-if="addressList.length > 0" class="address-list">
      <view v-for="addr in addressList" :key="addr.id" class="address-item">
        <view class="addr-main" @click="goEditAddress(addr.id)">
          <view class="addr-header">
            <text class="name">{{ addr.name }}</text>
            <text class="phone">{{ addr.phone }}</text>
            <wd-tag v-if="addr.tag" custom-class="address-select-tag" type="primary">{{ addr.tag }}</wd-tag>
            <wd-tag v-if="addr.isDefault" type="danger" plain>默认</wd-tag>
          </view>
          <text class="addr-detail">{{ addr.fullAddress }}</text>
        </view>

        <view class="addr-actions">
          <view class="action-item" @click="onSetDefault(addr)">
            <view class="radio" :class="[{ active: addr.isDefault }]" />
            <text>默认地址</text>
          </view>
          <view class="action-item" @click="goEditAddress(addr.id)">
            <view class="i-carbon-edit text-28rpx" />
            <text>编辑</text>
          </view>
          <view class="action-item delete" @click="onDelete(addr)">
            <view class="i-carbon-trash-can text-28rpx" />
            <text>删除</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty-state">
      <view class="i-carbon-location text-80rpx text-gray-400" />
      <text class="empty-text">暂无收货地址</text>
    </view>

    <!-- 新增按钮 -->
    <view class="add-btn-wrap">
      <wd-button type="primary" block @click="goAddAddress">
        <view class="flex items-center justify-center gap-space-xs">
          <wd-icon name="add" size="28rpx" />
          <text class="text-body-lg">新增收货地址</text>
        </view>
      </wd-button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.address-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 140rpx;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60vh;
}

.address-list {
  padding: 20rpx;
}

.address-item {
  background-color: #fff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  overflow: hidden;

  .addr-main {
    padding: 30rpx;

    .addr-header {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16rpx;
      margin-bottom: 16rpx;

      .name {
        font-size: 32rpx;
        font-weight: 500;
        color: #333;
      }

      .phone {
        font-size: 28rpx;
        color: #666;
      }
    }

    .addr-detail {
      font-size: 26rpx;
      color: #666;
      line-height: 1.5;
    }
  }

  .addr-actions {
    display: flex;
    align-items: center;
    padding: 20rpx 30rpx;
    border-top: 1rpx solid #f0f0f0;

    .action-item {
      display: flex;
      align-items: center;
      gap: 8rpx;
      margin-right: 40rpx;
      font-size: 24rpx;
      color: #666;

      &.delete {
        margin-left: auto;
        margin-right: 0;
        color: #ff4d4f;
      }

      .radio {
        width: 32rpx;
        height: 32rpx;
        border: 2rpx solid #ddd;
        border-radius: 50%;

        &.active {
          border-color: var(--color-brand-primary);
          background-color: var(--color-brand-primary);
          position: relative;

          &::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 12rpx;
            height: 12rpx;
            background-color: var(--color-bg-surface);
            border-radius: 50%;
          }
        }
      }
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;

  .empty-text {
    margin-top: 20rpx;
    font-size: 28rpx;
    color: #999;
  }
}

.add-btn-wrap {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  box-sizing: border-box;
  padding: var(--space-md) var(--space-lg);
  padding-bottom: calc(var(--space-md) + env(safe-area-inset-bottom, 0px));
  background-color: var(--color-bg-surface);
  box-shadow: 0 -2rpx 20rpx rgba(0, 0, 0, 0.05);
}

/** 与选择地址页「我的地址」wd-tag 一致（家/公司等） */
:deep(.address-select-tag) {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}
</style>
