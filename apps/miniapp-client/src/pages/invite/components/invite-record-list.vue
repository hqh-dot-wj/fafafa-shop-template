<script lang="ts" setup>
import type { InviteRecord, InviteStats } from '@/api/invite';
import { ref, watch } from 'vue';
import { getInviteRecords, getInviteStats } from '@/api/invite';

defineOptions({ name: 'InviteRecordList' });

type FilterType = 'all' | 'ordered';

const stats = ref<InviteStats>({ totalInvited: 0, orderedCount: 0 });
const currentFilter = ref<FilterType>('all');
const paging = ref<any>(null);
const dataList = ref<InviteRecord[]>([]);

async function loadStats() {
  try {
    const res = await getInviteStats();
    if (res) stats.value = res;
  } catch {
    /* 静默失败，不影响列表展示 */
  }
}

function switchFilter(filter: FilterType) {
  if (currentFilter.value === filter) return;
  currentFilter.value = filter;
  paging.value?.reload();
}

async function queryList(pageNo: number, pageSize: number) {
  try {
    const res = await getInviteRecords({
      filter: currentFilter.value,
      pageNum: pageNo,
      pageSize,
    });
    paging.value?.complete(res?.rows ?? []);
  } catch {
    paging.value?.complete(false);
  }
}

loadStats();

defineExpose({
  refresh() {
    loadStats();
    paging.value?.reload();
  },
});
</script>

<template>
  <view class="invite-record">
    <!-- 子 tab 切换栏 -->
    <view class="invite-record__filter-bar">
      <view
        class="invite-record__filter-item"
        :class="{ 'invite-record__filter-item--active': currentFilter === 'all' }"
        hover-class="opacity-80"
        @click="switchFilter('all')"
      >
        <text class="invite-record__filter-text">全部邀请</text>
        <text class="invite-record__filter-count">{{ stats.totalInvited }}人</text>
      </view>
      <view class="invite-record__filter-divider" />
      <view
        class="invite-record__filter-item"
        :class="{ 'invite-record__filter-item--active': currentFilter === 'ordered' }"
        hover-class="opacity-80"
        @click="switchFilter('ordered')"
      >
        <text class="invite-record__filter-text">下单成功</text>
        <text class="invite-record__filter-count">{{ stats.orderedCount }}人</text>
      </view>
    </view>

    <!-- 列表 -->
    <view class="invite-record__list">
      <z-paging ref="paging" v-model="dataList" :fixed="false" @query="queryList">
        <view v-for="item in dataList" :key="item.id" class="invite-record__item">
          <image
            class="invite-record__avatar"
            :src="item.avatar || '/static/images/default-avatar.png'"
            mode="aspectFill"
          />
          <view class="invite-record__info">
            <text class="invite-record__name">{{ item.nickname || '匿名用户' }}</text>
            <text class="invite-record__time">邀请时间：{{ item.inviteTime || '-' }}</text>
          </view>
          <view class="invite-record__status">
            <text v-if="item.hasOrdered" class="invite-record__badge invite-record__badge--success"> 已下单 </text>
            <text v-else class="invite-record__badge invite-record__badge--pending">待下单</text>
          </view>
        </view>

        <template #empty>
          <view class="invite-record__empty">
            <wd-icon name="friends" size="100rpx" color="var(--color-border-default)" />
            <text class="invite-record__empty-text">暂无邀请记录</text>
            <text class="invite-record__empty-hint">快去邀请好友吧～</text>
          </view>
        </template>
      </z-paging>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.invite-record__filter-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-surface);
  border-radius: var(--radius-card);
  margin: 0 var(--space-lg) var(--space-sm);
}

.invite-record__filter-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.invite-record__filter-item--active {
  background: var(--color-brand-light);
}

.invite-record__filter-divider {
  width: 1rpx;
  height: 48rpx;
  background: var(--color-border-default);
  flex-shrink: 0;
}

.invite-record__filter-text {
  font-size: var(--font-body-medium);
  color: var(--color-text-secondary);
  line-height: var(--lh-normal);
}

.invite-record__filter-item--active .invite-record__filter-text {
  color: var(--color-brand-primary);
  font-weight: 600;
}

.invite-record__filter-count {
  font-size: var(--font-title-medium);
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: var(--lh-snug);
}

.invite-record__filter-item--active .invite-record__filter-count {
  color: var(--color-brand-primary);
}

.invite-record__list {
  min-height: 200rpx;
}

.invite-record__item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  margin: 0 var(--space-lg) var(--space-sm);
  background: var(--color-bg-surface);
  border-radius: var(--radius-card);
}

.invite-record__avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2rpx solid var(--color-border-default);
}

.invite-record__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.invite-record__name {
  font-size: var(--font-body-large);
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.invite-record__time {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

.invite-record__status {
  flex-shrink: 0;
}

.invite-record__badge {
  font-size: var(--font-caption);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-pill);
  line-height: 1;
}

.invite-record__badge--success {
  background: var(--color-brand-light);
  color: var(--color-brand-primary);
}

.invite-record__badge--pending {
  background: #fff7e6;
  color: var(--color-func-warning);
}

.invite-record__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl) 0;
  gap: var(--space-sm);
}

.invite-record__empty-text {
  font-size: var(--font-body-large);
  color: var(--color-text-secondary);
}

.invite-record__empty-hint {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}
</style>
