<script setup lang="ts">
import type { PaginationProps } from 'naive-ui';
import { NButton, NCard, NDataTable } from 'naive-ui';
import { $t } from '@/locales';

defineOptions({ name: 'SceneTableCard' });

type SceneTableRow = NaiveUI.TableDataWithIndex<Api.Marketing.MarketingScene>;

interface Props {
  columns: NaiveUI.TableColumn<SceneTableRow>[];
  data: SceneTableRow[];
  loading: boolean;
  pagination: PaginationProps;
  flexHeight: boolean;
  scrollX: number;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'create'): void;
}>();
</script>

<template>
  <!-- 场景配置表格区：展示场景列表并提供新增入口。 -->
  <NCard
    title="场景配置"
    :bordered="false"
    size="small"
    class="min-h-0 card-wrapper sm:flex sm:flex-col sm:flex-1-hidden"
    content-class="flex min-h-0 flex-1 flex-col overflow-hidden"
  >
    <template #header-extra>
      <!-- 表格操作区：创建新的场景配置草稿。 -->
      <NButton type="primary" ghost size="small" @click="emit('create')">
        <template #icon>
          <icon-ic-round-plus class="text-icon" />
        </template>
        新增场景
      </NButton>
    </template>
    <!-- 数据列表区：承载分页、滚动宽度和空状态展示。 -->
    <div class="min-h-0 flex flex-col flex-1 sm:h-full">
      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="pagination"
        remote
        :row-key="(row) => row.id"
        :flex-height="flexHeight"
        :scroll-x="scrollX"
        class="min-h-0 flex-1 sm:h-full"
      >
        <template #empty>
          <div class="py-24px text-14px text-gray-500">{{ $t('datatable.empty') }}</div>
        </template>
      </NDataTable>
    </div>
  </NCard>
</template>

<style scoped></style>
