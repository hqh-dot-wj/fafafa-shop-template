<script lang="ts" setup>
import type { AiContentRecord, AiGeneratedContent, AiPlatform } from '@/api/ai-content';
import { computed, onMounted, ref, watch } from 'vue';
import { generateAiContent, getAiPlatforms } from '@/api/ai-content';
import HistoryPopup from './components/history-popup.vue';
import ResultPopup from './components/result-popup.vue';

/** 接口失败或无数据时的兜底，与后端 seed 的 platformCode 一致 */
const FALLBACK_PLATFORMS: AiPlatform[] = [
  {
    platformCode: 'XIAOHONGSHU',
    platformName: '小红书',
    icon: null,
    maxLength: 1000,
    outputSchema: { title: 'string', body: 'string', tags: 'string[]' },
  },
  {
    platformCode: 'WECHAT_MP',
    platformName: '微信公众号',
    icon: null,
    maxLength: 2000,
    outputSchema: { title: 'string', summary: 'string', body: 'string' },
  },
  {
    platformCode: 'WECHAT_MOMENTS',
    platformName: '朋友圈',
    icon: null,
    maxLength: 200,
    outputSchema: { body: 'string', tags: 'string[]' },
  },
];

definePage({
  style: {
    navigationBarTitleText: 'AI 文案助手',
  },
});

const platforms = ref<AiPlatform[]>([]);
const selectedPlatformCode = ref('');
const userInput = ref('');
const generating = ref(false);

const resultVisible = ref(false);
const resultContent = ref<AiGeneratedContent | null>(null);
const resultLoading = ref(false);

const historyVisible = ref(false);

const selectedPlatform = computed(() => platforms.value.find((p) => p.platformCode === selectedPlatformCode.value));

const canGenerate = computed(
  () => selectedPlatformCode.value && userInput.value.trim().length > 0 && !generating.value,
);

/** 使用普通对象数组，避免响应式 Proxy 在部分机型上影响 picker 内部解析 */
const pickerColumns = ref<Array<{ value: string; label: string }>>([]);

function syncPickerColumns() {
  pickerColumns.value = platforms.value.map((p) => ({
    value: p.platformCode,
    label: p.platformName,
  }));
}

/** 微信小程序：columns 从空变为有数据时 picker-view 可能不刷新，用 key 强制重建 */
const platformPickerKey = computed(() => pickerColumns.value.map((c) => c.value).join('|') || 'empty');

watch(
  platforms,
  () => {
    syncPickerColumns();
  },
  { deep: true },
);

const placeholderMap: Record<string, string> = {
  XIAOHONGSHU: '输入你想种草的内容~',
  WECHAT_MP: '输入你想撰写的推文主题...',
  WECHAT_MOMENTS: '输入你想分享的内容...',
};

const inputPlaceholder = computed(() => placeholderMap[selectedPlatformCode.value] || '请输入你想生成的主题...');

onMounted(async () => {
  try {
    const list = await getAiPlatforms();
    platforms.value = Array.isArray(list) && list.length > 0 ? list : FALLBACK_PLATFORMS;
  } catch {
    platforms.value = FALLBACK_PLATFORMS;
  }
  syncPickerColumns();
});

async function handleGenerate() {
  if (!canGenerate.value) return;

  generating.value = true;
  resultContent.value = null;

  try {
    const record = await generateAiContent({
      platformCode: selectedPlatformCode.value,
      userInput: userInput.value.trim(),
    });
    resultContent.value = record.generatedContent;
    resultLoading.value = false;
    resultVisible.value = true;
  } catch {
    // 失败时 http 层已 toast（如「该平台暂不可用」），不要先开弹窗再关，避免闪一下
    resultVisible.value = false;
  } finally {
    generating.value = false;
  }
}

function handleRegenerate() {
  resultVisible.value = false;
  handleGenerate();
}

function handleHistorySelect(record: AiContentRecord) {
  historyVisible.value = false;
  selectedPlatformCode.value = record.platformCode;
  resultContent.value = record.generatedContent;
  resultVisible.value = true;
  resultLoading.value = false;
}
</script>

<template>
  <view class="generate-page">
    <view class="form-section">
      <view class="form-item">
        <text class="form-label">选择平台</text>
        <!-- 勿设 label-width=0 且保留 label：会导致标题区极窄、文字竖排 -->
        <wd-picker
          :key="platformPickerKey"
          v-model="selectedPlatformCode"
          :columns="pickerColumns"
          placeholder="请选择平台"
          title="选择平台"
          custom-class="platform-picker"
          :root-portal="true"
        />
      </view>

      <view class="form-item">
        <text class="form-label">输入主题</text>
        <wd-textarea
          v-model="userInput"
          :placeholder="inputPlaceholder"
          :maxlength="500"
          show-word-limit
          auto-height
          custom-style="min-height: 200rpx;"
        />
      </view>
    </view>

    <view class="action-bar">
      <wd-button plain custom-style="flex: 1; margin-right: 16rpx;" @click="historyVisible = true">
        我的历史
      </wd-button>
      <wd-button
        type="primary"
        :disabled="!canGenerate"
        :loading="generating"
        custom-style="flex: 2;"
        @click="handleGenerate"
      >
        ✨ 生成文案
      </wd-button>
    </view>

    <ResultPopup
      :visible="resultVisible"
      :platform-code="selectedPlatformCode"
      :platform-name="selectedPlatform?.platformName || ''"
      :content="resultContent"
      :loading="resultLoading"
      @update:visible="resultVisible = $event"
      @regenerate="handleRegenerate"
    />

    <HistoryPopup :visible="historyVisible" @update:visible="historyVisible = $event" @select="handleHistorySelect" />
  </view>
</template>

<style lang="scss" scoped>
.generate-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.form-section {
  flex: 1;
  padding: 24rpx;
}

.form-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;

  :deep(.platform-picker) {
    width: 100%;
  }

  :deep(.wd-picker__cell) {
    padding-left: 0;
    padding-right: 0;
  }

  .form-label {
    display: block;
    font-size: 28rpx;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 16rpx;
  }
}

.action-bar {
  display: flex;
  padding: 24rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1rpx solid #e2e8f0;
}
</style>
