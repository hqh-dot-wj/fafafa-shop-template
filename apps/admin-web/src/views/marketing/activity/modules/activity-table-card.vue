<script setup lang="ts">
import type { PaginationProps } from 'naive-ui';
import { NButton, NCard, NDataTable, NSpace } from 'naive-ui';
import { $t } from '@/locales';
import type { ActivityTableRow } from './activity-table-columns';

defineOptions({ name: 'ActivityTableCard' });

interface Props {
  columns: NaiveUI.TableColumn<ActivityTableRow>[];
  data: ActivityTableRow[];
  loading: boolean;
  pagination: PaginationProps;
  flexHeight: boolean;
  scrollX: number;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'create'): void;
  (e: 'refresh'): void;
}>();
</script>

<template>
  <!-- 活动列表区：展示活动中心分页数据，并提供创建和刷新入口。 -->
  <NCard title="活动列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
    <template #header-extra>
      <NSpace :size="8">
        <NButton type="primary" ghost size="small" @click="emit('create')">
          <template #icon>
            <icon-ic-round-plus class="text-icon" />
          </template>
          {{ $t('common.add') }}
        </NButton>
        <NButton size="small" @click="emit('refresh')">
          <template #icon>
            <icon-ic-round-refresh class="text-icon" />
          </template>
          {{ $t('common.refresh') }}
        </NButton>
      </NSpace>
    </template>
    <NDataTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :pagination="pagination"
      remote
      :row-key="(row: ActivityTableRow) => row.id"
      :flex-height="flexHeight"
      :scroll-x="scrollX"
      class="sm:h-full"
    >
      <template #empty>
        <div class="py-24px text-14px text-gray-500">{{ $t('datatable.empty') }}</div>
      </template>
    </NDataTable>
  </NCard>
</template>

<style scoped></style>
