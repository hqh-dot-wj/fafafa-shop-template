<script setup lang="tsx">
import { NSwitch, NTag } from 'naive-ui';
import {
  type AiPlatformPromptListParams,
  type AiPlatformPromptRow,
  fetchAiPromptDelete,
  fetchAiPromptList,
  fetchAiPromptUpdateStatus,
} from '@/service/api/marketing/ai-prompt';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableOperate } from '@/hooks/common/table';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import PlatformPromptSearch from './modules/platform-prompt-search.vue';
import PlatformPromptOperateDrawer from './modules/platform-prompt-operate-drawer.vue';

defineOptions({ name: 'MarketingAiPlatformPrompt' });

// AI 平台 Prompt 页对应 AiPlatformPromptController，维护各租户/平台的系统提示词和输出字段约束。
// 状态开关会影响小程序平台可用性，前端只切换启停，不拼接或执行 prompt。
function datePart(value: string | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return value.split(' ')[0] ?? value;
}

const appStore = useAppStore();
let openPromptEditor = (_id: string) => {};

const { data, loading, getData, getDataByPage, columns, searchParams, resetSearchParams, mobilePagination } = useTable({
  apiFn: fetchAiPromptList as unknown as NaiveUI.TableApiFn<AiPlatformPromptRow, AiPlatformPromptListParams>,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    platformCode: null,
    status: null,
  },
  columns: () => [
    {
      key: 'tenantName',
      title: '租户名称',
      align: 'center',
      minWidth: 140,
      ellipsis: { tooltip: true },
      render: (row: AiPlatformPromptRow) => row.tenantName || row.tenantId || '—',
    },
    {
      key: 'platformCode',
      title: '平台标识',
      align: 'center',
      width: 140,
      ellipsis: { tooltip: true },
      render: (row: AiPlatformPromptRow) => (
        <NTag type="info" bordered={false} class="font-mono">
          {row.platformCode}
        </NTag>
      ),
    },
    {
      key: 'platformName',
      title: '平台名称',
      align: 'center',
      width: 140,
      ellipsis: { tooltip: true },
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 100,
      render: (row: AiPlatformPromptRow) => (
        <NSwitch
          value={row.status === 1}
          onUpdateValue={async (v: boolean) => {
            await fetchAiPromptUpdateStatus(row.id, v ? 1 : 0);
            await getData();
          }}
        />
      ),
    },
    {
      key: 'sortOrder',
      title: '排序',
      align: 'center',
      width: 80,
    },
    {
      key: 'maxLength',
      title: '建议字数',
      align: 'center',
      width: 100,
      render: (row: AiPlatformPromptRow) =>
        row.maxLength !== null && row.maxLength !== undefined ? String(row.maxLength) : '—',
    },
    {
      key: 'createTime',
      title: '创建时间',
      align: 'center',
      width: 120,
      render: (row: AiPlatformPromptRow) => datePart(row.createTime) || '—',
    },
    {
      key: 'updateTime',
      title: '更新时间',
      align: 'center',
      width: 120,
      render: (row: AiPlatformPromptRow) => datePart(row.updateTime) || '—',
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 120,
      render: (row: AiPlatformPromptRow) => (
        <div class="flex-center gap-8px">
          <ButtonIcon
            type="primary"
            class="text-primary"
            tooltipContent={$t('common.edit')}
            icon="material-symbols:edit-square-outline"
            onClick={() => openPromptEditor(row.id)}
          />
          <ButtonIcon
            type="error"
            class="text-error"
            tooltipContent={$t('common.delete')}
            icon="material-symbols:delete-outline"
            onClick={() => handleDelete(row.id)}
          />
        </div>
      ),
    },
  ],
});

const { handleAdd, handleEdit, drawerVisible, operateType, editingData, onDeleted } =
  useTableOperate<AiPlatformPromptRow>(data, getData);

openPromptEditor = (id: string) => handleEdit('id', id);

async function handleDelete(id: string) {
  // 方法职责：删除前说明小程序平台影响，实际删除和租户隔离由后端接口执行。
  window.$dialog?.warning({
    title: $t('common.tip'),
    content: '确认删除该配置？删除后小程序对应平台将不可用。',
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      await fetchAiPromptDelete(id);
      await onDeleted();
    },
  });
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 检索区：按平台和状态筛选 Prompt 配置，不修改配置内容。 -->
    <PlatformPromptSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <!-- 配置表格区：展示 Prompt 状态并提供新增、编辑、删除入口。 -->
    <NCard title="AI 平台 Prompt" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NButton type="primary" ghost size="small" @click="handleAdd">
          <template #icon>
            <icon-ic-round-plus class="text-icon" />
          </template>
          新增
        </NButton>
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="mobilePagination"
        remote
        :flex-height="!appStore.isMobile"
        class="sm:h-full"
        :row-key="(row: AiPlatformPromptRow) => row.id"
      />
      <PlatformPromptOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getData"
      />
    </NCard>
  </div>
</template>

<style scoped></style>
