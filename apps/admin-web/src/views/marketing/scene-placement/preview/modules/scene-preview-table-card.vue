<script setup lang="ts">
import type { PaginationProps } from 'naive-ui';
import { NAlert, NCard, NDataTable } from 'naive-ui';
import type { ScenePreviewCard } from '@/service/api/marketing';
import { $t } from '@/locales';

defineOptions({ name: 'ScenePreviewTableCard' });

interface Props {
  columns: NaiveUI.TableColumn<ScenePreviewCard>[];
  data: ScenePreviewCard[];
  loading: boolean;
  pagination: PaginationProps;
  flexHeight: boolean;
  scrollX: number;
  total: number;
  previewError: string;
}

defineProps<Props>();

function rowKey(row: ScenePreviewCard) {
  return `${row.moduleCode}-${row.productId}-${row.activityContextKey ?? ''}`;
}
</script>

<template>
  <!-- 场景预览表格区：展示 preview-products 返回的卡片列表和错误提示。 -->
  <NCard title="场景投放预览" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
    <template #header-extra>
      <span class="text-12px text-gray-500">总计：{{ total }}</span>
    </template>
    <!-- 预览异常区：说明接口上下文缺失时的可排查方向。 -->
    <NAlert v-if="previewError" type="warning" :bordered="false" class="mb-12px" :title="previewError">
      预览接口可能缺少后台权限、租户上下文或已发布场景版本，场景信息和导航预览仍可查看。
    </NAlert>
    <!-- 预览数据区：展示模块、商品和活动上下文的预览结果。 -->
    <NDataTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :pagination="pagination"
      remote
      :row-key="rowKey"
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
