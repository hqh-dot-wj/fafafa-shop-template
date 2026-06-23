<script setup lang="ts">
import type { PaginationProps } from 'naive-ui';
import { NButton, NCard, NDataTable, NSpace } from 'naive-ui';
import { $t } from '@/locales';
import type { EntitlementPoolRecord } from './entitlement-pool.types';

defineOptions({ name: 'EntitlementPoolTableCard' });

defineProps<{
  columns: NaiveUI.TableColumn<NaiveUI.TableDataWithIndex<EntitlementPoolRecord>>[];
  data: NaiveUI.TableDataWithIndex<EntitlementPoolRecord>[];
  loading: boolean;
  pagination: PaginationProps;
  flexHeight: boolean;
  scrollX: number;
}>();

const emit = defineEmits<{
  (e: 'create'): void;
  (e: 'refresh'): void;
}>();

function getRowKey(row: NaiveUI.TableDataWithIndex<EntitlementPoolRecord>) {
  return row.id;
}
</script>

<template>
  <!-- 权益池表格区：展示草稿和编译结果，并提供工作台级操作入口。 -->
  <NCard title="权益池工作台" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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
      :row-key="getRowKey"
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
