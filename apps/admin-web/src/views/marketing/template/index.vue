<script setup lang="tsx">
import { NButton, NTag } from 'naive-ui';
import { fetchDeleteTemplate, fetchGetTemplateList } from '@/service/api/marketing/template';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableOperate } from '@/hooks/common/table';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import TemplateOperateDrawer from './modules/template-operate-drawer.vue';
import TemplateSearch from './modules/template-search.vue';

defineOptions({
  name: 'PlayTemplateList',
});

// 玩法模板页对应 TemplateController，定义“可执行玩法”的规则 schema 与详情组件标识。
// 模板本身不是活动配置，不能直接影响 C 端出数，只有被 StoreConfig/Campaign 引用后才进入运行链路。
function datePart(value: string | undefined): string {
  if (!value) return '';
  return value.replace('T', ' ').split(' ')[0] ?? value;
}

function ruleFieldCount(row: Api.Marketing.PlayTemplate): number {
  const fields = row.ruleSchema?.fields;
  return Array.isArray(fields) ? fields.length : 0;
}

const appStore = useAppStore();

const { data, loading, getData, getDataByPage, columns, searchParams, resetSearchParams, mobilePagination } = useTable({
  apiFn: fetchGetTemplateList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    code: null,
    name: null,
  },
  columns: () => [
    {
      key: 'code',
      title: '玩法编码',
      align: 'center',
      width: 180,
      ellipsis: { tooltip: true },
      render: (row) => (
        <NTag type="info" bordered={false} class="font-mono">
          {row.code}
        </NTag>
      ),
    },
    {
      key: 'name',
      title: '玩法名称',
      align: 'center',
      width: 180,
      ellipsis: { tooltip: true },
    },
    {
      key: 'unitName',
      title: '计量单位',
      align: 'center',
      width: 110,
      render: (row) => (
        <NTag type="success" size="small">
          {row.unitName}
        </NTag>
      ),
    },
    {
      key: 'ruleFields',
      title: '规则字段',
      align: 'center',
      width: 100,
      render: (row) => {
        const count = ruleFieldCount(row);
        return count > 0 ? `${count} 项` : '-';
      },
    },
    {
      key: 'uiComponentId',
      title: '详情交互模板',
      align: 'center',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: (row) => row.uiComponentId?.trim() || '未配置',
    },
    {
      key: 'createTime',
      title: '创建时间',
      align: 'center',
      width: 120,
      render: (row) => datePart(row.createTime) || '-',
    },
    {
      key: 'updateTime',
      title: '更新时间',
      align: 'center',
      width: 120,
      render: (row) => datePart(row.updateTime) || '-',
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 120,
      render: (row) => (
        <div class="flex-center gap-8px">
          <ButtonIcon
            type="primary"
            class="text-primary"
            tooltipContent={$t('common.edit')}
            icon="material-symbols:edit-square-outline"
            onClick={() => edit(row.id)}
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

const { handleAdd, handleEdit, drawerVisible, operateType, editingData, onDeleted } = useTableOperate(data, getData);

function edit(id: string) {
  handleEdit('id', id);
}

async function handleDelete(id: string) {
  // 删除模板会影响后续配置创建，已产生的活动实例仍以后端引用关系和删除策略为准。
  window.$dialog?.warning({
    title: $t('common.tip'),
    content: $t('common.confirmDelete'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      await fetchDeleteTemplate(id);
      await onDeleted();
    },
  });
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 搜索区：按玩法编码和名称筛选模板定义。 -->
    <TemplateSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <!-- 玩法模板表格区：维护规则 schema 和详情交互组件标识。 -->
    <NCard title="玩法模板列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NButton type="primary" ghost size="small" @click="handleAdd">
          <template #icon>
            <icon-ic-round-plus class="text-icon" />
          </template>
          新增模板
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
      />
      <TemplateOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getData"
      />
    </NCard>
  </div>
</template>

<style scoped></style>
