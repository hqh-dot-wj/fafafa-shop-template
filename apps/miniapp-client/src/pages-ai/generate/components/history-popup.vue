<script lang="ts" setup>
import type { AiContentRecord } from '@/api/ai-content';
import { ref, watch } from 'vue';
import { getAiHistory } from '@/api/ai-content';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'select', record: AiContentRecord): void;
}>();

const list = ref<AiContentRecord[]>([]);
const loading = ref(false);
const finished = ref(false);
const page = ref(1);
const pageSize = 10;

watch(
  () => props.visible,
  (val) => {
    if (val) refresh();
  },
);

async function refresh() {
  page.value = 1;
  finished.value = false;
  list.value = [];
  await loadMore();
}

async function loadMore() {
  if (loading.value || finished.value) return;
  loading.value = true;
  try {
    const res = await getAiHistory(page.value, pageSize);
    const rows = res.rows || [];
    if (rows.length < pageSize) finished.value = true;
    list.value.push(...rows);
    page.value++;
  } catch {
    // http 层已 toast
  } finally {
    loading.value = false;
  }
}

function getPreview(record: AiContentRecord): string {
  const content = record.generatedContent;
  return content.title || content.body?.slice(0, 30) || '';
}

function getPlatformLabel(code: string): string {
  const map: Record<string, string> = {
    XIAOHONGSHU: '小红书',
    WECHAT_MP: '公众号',
    WECHAT_MOMENTS: '朋友圈',
  };
  return map[code] || code;
}

function handleClose() {
  emit('update:visible', false);
}
</script>

<template>
  <wd-popup
    :model-value="props.visible"
    position="bottom"
    custom-style="height: 70%; border-radius: 24rpx 24rpx 0 0;"
    closable
    @close="handleClose"
  >
    <view class="history-popup">
      <view class="popup-header">
        <text class="popup-title">我的历史</text>
      </view>

      <scroll-view scroll-y class="history-list" @scrolltolower="loadMore">
        <view v-if="list.length === 0 && !loading" class="empty-state">
          <text class="empty-text">暂无生成记录</text>
        </view>

        <view v-for="item in list" :key="item.id" class="history-item" @click="emit('select', item)">
          <view class="item-header">
            <text class="platform-tag">{{ getPlatformLabel(item.platformCode) }}</text>
            <text class="item-time">{{ item.createTime }}</text>
          </view>
          <text class="item-preview">{{ getPreview(item) }}</text>
        </view>

        <view v-if="loading" class="loading-more">
          <wd-loading size="40rpx" />
        </view>

        <view v-if="finished && list.length > 0" class="no-more">
          <text class="no-more-text">没有更多了</text>
        </view>
      </scroll-view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
.history-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 32rpx;
}

.popup-header {
  text-align: center;
  margin-bottom: 24rpx;

  .popup-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #1e293b;
  }
}

.history-list {
  flex: 1;
  min-height: 0;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300rpx;

  .empty-text {
    font-size: 28rpx;
    color: #94a3b8;
  }
}

.history-item {
  background: #f8fafc;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;

  .item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12rpx;
  }

  .platform-tag {
    font-size: 22rpx;
    color: #3b82f6;
    background: #eff6ff;
    padding: 4rpx 16rpx;
    border-radius: 16rpx;
  }

  .item-time {
    font-size: 22rpx;
    color: #94a3b8;
  }

  .item-preview {
    font-size: 26rpx;
    color: #334155;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.loading-more,
.no-more {
  display: flex;
  justify-content: center;
  padding: 24rpx;
}

.no-more-text {
  font-size: 24rpx;
  color: #94a3b8;
}
</style>
