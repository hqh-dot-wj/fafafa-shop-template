<script setup lang="ts">
import type { PaginationProps } from 'naive-ui';
import { NButton, NCard, NDataTable, NSpace } from 'naive-ui';
import type { ResolutionIncident } from '@/service/api/marketing/resolution';
import { $t } from '@/locales';

defineOptions({ name: 'ResolutionIncidentTableCard' });

interface Props {
  columns: NaiveUI.TableColumn<ResolutionIncident>[];
  data: ResolutionIncident[];
  loading: boolean;
  pagination: PaginationProps;
  flexHeight: boolean;
  scrollX: number;
}

defineProps<Props>();

const emit = defineEmits<{
  refresh: [];
}>();
</script>

<template>
  <!-- 排障工单表格区：展示工单列表并提供刷新入口。 -->
  <NCard title="排障工单" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
    <template #header-extra>
      <NSpace :size="8">
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
      :row-key="(row: ResolutionIncident) => row.id"
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
