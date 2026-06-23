<script setup lang="ts">
import type { PaginationProps } from 'naive-ui';
import { NButton, NCard, NDataTable } from 'naive-ui';
import type { CourseGroupTeamSummary } from '@/service/api/marketing';
import { $t } from '@/locales';

defineOptions({ name: 'CourseGroupFailureTableCard' });

type CourseGroupFailureTableRow = NaiveUI.TableDataWithIndex<CourseGroupTeamSummary>;

interface Props {
  columns: NaiveUI.TableColumn<CourseGroupFailureTableRow>[];
  data: CourseGroupFailureTableRow[];
  loading: boolean;
  pagination: PaginationProps;
  flexHeight: boolean;
  scrollX: number;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();
</script>

<template>
  <!-- 失败团表格区：展示拼课失败团队并提供刷新入口。 -->
  <NCard title="失败团列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
    <template #header-extra>
      <NButton size="small" @click="emit('refresh')">
        <template #icon>
          <icon-ic-round-refresh class="text-icon" />
        </template>
        {{ $t('common.refresh') }}
      </NButton>
    </template>
    <NDataTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :pagination="pagination"
      remote
      :row-key="(row: CourseGroupFailureTableRow) => row.teamId"
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
