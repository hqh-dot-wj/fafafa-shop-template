<script lang="ts" setup>
import type { AiGeneratedContent } from '@/api/ai-content';
import { computed } from 'vue';
import { markdownToRichHtml } from '@/utils/markdown-to-rich-html';

const props = defineProps<{
  visible: boolean;
  platformCode: string;
  platformName: string;
  content: AiGeneratedContent | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'regenerate'): void;
}>();

const showTitle = computed(() => props.platformCode !== 'WECHAT_MOMENTS');
const showSummary = computed(() => props.platformCode === 'WECHAT_MP');
const showTags = computed(() => props.platformCode !== 'WECHAT_MP');

/** 正文：Markdown → HTML，供 rich-text 排版（标题/摘要仍用纯文本） */
const bodyHtml = computed(() => markdownToRichHtml(props.content?.body ?? ''));

function handleCopy() {
  if (!props.content) return;
  const parts: string[] = [];
  if (props.content.title) parts.push(props.content.title);
  if (props.content.summary) parts.push(props.content.summary);
  if (props.content.body) parts.push(props.content.body);
  if (props.content.tags?.length) parts.push(props.content.tags.map((t) => `#${t}`).join(' '));

  uni.setClipboardData({
    data: parts.join('\n\n'),
    success: () => uni.showToast({ title: '已复制到剪贴板', icon: 'success' }),
  });
}

function handleClose() {
  emit('update:visible', false);
}
</script>

<template>
  <wd-popup
    :model-value="props.visible"
    position="bottom"
    custom-style="height: 70%; border-radius: 24rpx 24rpx 0 0; overflow: hidden;"
    closable
    @close="handleClose"
  >
    <view class="result-popup">
      <view class="popup-header">
        <text class="popup-title">{{ platformName }} · 生成结果</text>
      </view>

      <view v-if="loading" class="loading-area">
        <wd-loading size="60rpx" />
        <text class="loading-text">AI 正在创作中...</text>
      </view>

      <scroll-view v-else-if="content" scroll-y class="content-area" :enable-flex="true">
        <view class="content-card">
          <view v-if="showTitle && content.title" class="content-title">
            {{ content.title }}
          </view>
          <view v-if="showSummary && content.summary" class="content-summary">
            {{ content.summary }}
          </view>
          <rich-text v-if="bodyHtml" class="content-body" :nodes="bodyHtml" />
          <view v-else class="content-body content-body--empty">
            <text class="content-body-placeholder">暂无正文</text>
          </view>
          <view v-if="showTags && content.tags?.length" class="content-tags">
            <text v-for="tag in content.tags" :key="tag" class="tag-item"> #{{ tag }} </text>
          </view>
        </view>
      </scroll-view>

      <view v-if="!loading && content" class="popup-actions">
        <view class="action-col">
          <wd-button type="primary" block @click="handleCopy">复制文案</wd-button>
        </view>
        <view class="action-col">
          <wd-button type="text" block @click="emit('regenerate')">重新生成</wd-button>
        </view>
      </view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
.result-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 32rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.popup-header {
  flex-shrink: 0;
  text-align: center;
  margin-bottom: 24rpx;

  .popup-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #1e293b;
  }
}

.loading-area {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  .loading-text {
    margin-top: 24rpx;
    font-size: 26rpx;
    color: #94a3b8;
  }
}

.content-area {
  flex: 1 1 0;
  min-height: 0;
  height: 0;
  width: 100%;
}

.content-card {
  background: #f8fafc;
  border-radius: 16rpx;
  padding: 32rpx;
}

.content-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 20rpx;
  line-height: 1.5;
}

.content-summary {
  font-size: 26rpx;
  color: #64748b;
  padding: 16rpx 20rpx;
  background: #f1f5f9;
  border-left: 6rpx solid #cbd5e1;
  border-radius: 8rpx;
  margin-bottom: 20rpx;
  line-height: 1.6;
}

.content-body {
  display: block;
  font-size: 28rpx;
  color: #334155;
  line-height: 1.8;
  overflow-wrap: break-word;
}

.content-body--empty {
  min-height: 80rpx;
}

.content-body-placeholder {
  font-size: 26rpx;
  color: #94a3b8;
}

.content-tags {
  margin-top: 24rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;

  .tag-item {
    font-size: 24rpx;
    color: #3b82f6;
    background: #eff6ff;
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
  }
}

.popup-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 16rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #e2e8f0;
}

.action-col {
  flex: 1;
  min-width: 0;
}
</style>
