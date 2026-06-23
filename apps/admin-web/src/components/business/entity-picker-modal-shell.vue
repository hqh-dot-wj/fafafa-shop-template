<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NModal, NSpace } from 'naive-ui';

defineOptions({ name: 'EntityPickerModalShell' });

interface Props {
  visible: boolean;
  title: string;
  width?: number | string;
  selectedTitle?: string;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  width: 1080,
  selectedTitle: '当前已选',
  confirmText: '确认',
  cancelText: '取消',
  confirmDisabled: false,
  confirmLoading: false,
});

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm'): void;
}

const emit = defineEmits<Emits>();

const show = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
});

const modalStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
}));

function closeModal() {
  show.value = false;
}

function confirmSelection() {
  emit('confirm');
}
</script>

<template>
  <NModal v-model:show="show" preset="card" :title="title" :style="modalStyle">
    <div class="entity-picker-modal">
      <div class="entity-picker-modal__main">
        <div class="entity-picker-modal__search">
          <slot name="search" />
        </div>
        <div class="entity-picker-modal__table">
          <slot name="table" />
        </div>
      </div>

      <div class="entity-picker-modal__aside">
        <div class="entity-picker-modal__aside-title">{{ selectedTitle }}</div>
        <slot name="selected" />
      </div>
    </div>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="closeModal">{{ cancelText }}</NButton>
        <NButton type="primary" :disabled="confirmDisabled" :loading="confirmLoading" @click="confirmSelection">
          {{ confirmText }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.entity-picker-modal {
  display: grid;
  grid-template-columns: minmax(0, 2.2fr) 300px;
  gap: 16px;
  min-height: 520px;
}

.entity-picker-modal__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.entity-picker-modal__search {
  border-radius: 12px;
  background-color: rgb(248 250 252);
  padding: 12px;
}

.entity-picker-modal__table {
  min-height: 0;
  flex: 1;
}

.entity-picker-modal__aside {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-radius: 12px;
  background-color: rgb(248 250 252);
  padding: 12px;
}

.entity-picker-modal__aside-title {
  font-size: 14px;
  font-weight: 600;
  color: rgb(51 65 85);
}
</style>
