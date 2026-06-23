<script setup lang="ts">
import type { PaginationProps } from 'naive-ui';
import { NButton, NCard, NDataTable, NSpace } from 'naive-ui';
import type { SceneDefinition } from '@/service/api/marketing';
import { $t } from '@/locales';

defineOptions({ name: 'SceneDefinitionTableCard' });

type SceneDefinitionRow = NaiveUI.TableDataWithIndex<SceneDefinition>;

interface Props {
  columns: NaiveUI.TableColumn<SceneDefinitionRow>[];
  data: SceneDefinitionRow[];
  loading: boolean;
  pagination: PaginationProps;
  flexHeight: boolean;
  scrollX: number;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'create'): void;
  (e: 'refresh'): void;
  (e: 'preview'): void;
}>();
</script>

<template>
  <!-- 场景定义表格区：展示旧投放定义并提供新增、刷新和预览入口。 -->
  <NCard title="场景投放定义列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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
        <NButton size="small" type="info" ghost @click="emit('preview')">
          {{ $t('route.marketing_scene-placement_preview') }}
        </NButton>
      </NSpace>
    </template>
    <NDataTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :pagination="pagination"
      remote
      :row-key="(row) => row.id"
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
