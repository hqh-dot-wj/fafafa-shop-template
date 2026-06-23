<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NCard, NDataTable, NSpace } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import type { MarketingActivityItem } from '@/service/api/marketing';
import { $t } from '@/locales';

const props = defineProps<{
  items: MarketingActivityItem[];
  loading: boolean;
  columns: DataTableColumns<MarketingActivityItem>;
}>();

const emit = defineEmits<{
  create: [];
  refresh: [];
}>();

const rows = computed(() => props.items);
</script>

<template>
  <!-- 活动商品区：维护活动关联商品列表和新增/刷新入口。 -->
  <NCard title="活动商品" :bordered="false" size="small">
    <template #header-extra>
      <NSpace>
        <NButton type="primary" ghost @click="emit('create')">{{ $t('common.add') }}</NButton>
        <NButton @click="emit('refresh')">刷新</NButton>
      </NSpace>
    </template>
    <NDataTable :columns="columns" :data="rows" :loading="loading" :scroll-x="1000" />
  </NCard>
</template>
