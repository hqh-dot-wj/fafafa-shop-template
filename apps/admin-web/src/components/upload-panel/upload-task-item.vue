<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NEllipsis, NProgress, useThemeVars } from 'naive-ui';
import { UPLOAD_ITEM_HEIGHT, formatFileSize, getFileIcon } from '@/views/system/file-manager/constants';
import type { UploadTask } from './index.vue';

interface Props {
  task: UploadTask;
}

interface Emits {
  (e: 'pause'): void;
  (e: 'resume'): void;
  (e: 'cancel'): void;
  (e: 'retry'): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const themeVars = useThemeVars();

const fileIcon = computed(() => {
  const ext = props.task.fileName.split('.').pop();
  return getFileIcon(ext);
});

const progressStatus = computed(() => {
  switch (props.task.status) {
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
});

function formatSpeed(speed?: number): string {
  if (!speed) return '0 B/s';

  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let index = 0;
  let value = speed;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }

  return `${value.toFixed(2)} ${units[index]}`;
}

function formatSize(bytes?: number): string {
  return formatFileSize(bytes);
}
</script>

<template>
  <div class="upload-task-item" :style="{ height: `${UPLOAD_ITEM_HEIGHT}px` }">
    <div class="task-icon">
      <div :class="fileIcon" class="file-icon" />
    </div>

    <div class="task-content">
      <NEllipsis :line-clamp="1" class="file-name">
        {{ task.fileName }}
      </NEllipsis>

      <NProgress
        :percentage="task.progress"
        :height="3"
        :show-indicator="false"
        :status="progressStatus"
        :color="themeVars.primaryColor"
      />

      <div class="task-meta">
        <span v-if="task.status === 'uploading'" class="speed">
          {{ formatSpeed(task.speed) }}
        </span>
        <span v-if="task.status === 'success'" class="success-text">上传完成</span>
        <span v-if="task.status === 'error'" class="error-text">
          {{ task.error || '上传失败' }}
        </span>
        <span v-if="task.status === 'paused'" class="paused-text">已暂停</span>
        <span class="size-info">{{ formatSize(task.uploaded) }} / {{ formatSize(task.fileSize) }}</span>
      </div>
    </div>

    <div class="task-actions">
      <template v-if="task.status === 'uploading'">
        <NButton text @click="$emit('pause')">
          <template #icon>
            <div class="i-carbon-pause" />
          </template>
        </NButton>
        <NButton text @click="$emit('cancel')">
          <template #icon>
            <div class="i-carbon-close" />
          </template>
        </NButton>
      </template>

      <template v-if="task.status === 'paused'">
        <NButton text @click="$emit('resume')">
          <template #icon>
            <div class="i-carbon-play" />
          </template>
        </NButton>
        <NButton text @click="$emit('cancel')">
          <template #icon>
            <div class="i-carbon-close" />
          </template>
        </NButton>
      </template>

      <template v-if="task.status === 'success'">
        <NButton text @click="$emit('cancel')">
          <template #icon>
            <div class="i-carbon-checkmark success-icon" />
          </template>
        </NButton>
      </template>

      <template v-if="task.status === 'error'">
        <NButton text @click="$emit('retry')">
          <template #icon>
            <div class="i-carbon-renew" />
          </template>
        </NButton>
        <NButton text @click="$emit('cancel')">
          <template #icon>
            <div class="i-carbon-close" />
          </template>
        </NButton>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.upload-task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;

  .task-icon {
    flex-shrink: 0;

    .file-icon {
      font-size: 32px;
      color: v-bind('themeVars.textColor2');
    }
  }

  .task-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .file-name {
      font-size: 14px;
      color: v-bind('themeVars.textColor1');
    }

    .task-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;

      .speed {
        color: v-bind('themeVars.primaryColor');
      }

      .success-text {
        color: #67c23a;
      }

      .error-text {
        color: #f56c6c;
      }

      .paused-text {
        color: v-bind('themeVars.warningColor');
      }

      .size-info {
        color: v-bind('themeVars.textColor3');
      }
    }
  }

  .task-actions {
    flex-shrink: 0;
    display: flex;
    gap: 4px;

    .success-icon {
      color: #67c23a;
    }
  }
}
</style>
