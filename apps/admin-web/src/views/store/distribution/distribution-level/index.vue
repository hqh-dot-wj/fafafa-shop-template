<script setup lang="tsx">
import { NDivider, NTag } from 'naive-ui';
import { fetchDeleteLevel, fetchGetLevelList } from '@/service/api/store/distribution';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableOperate, useTableProps } from '@/hooks/common/table';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import LevelOperateDrawer from './modules/level-operate-drawer.vue';
import LevelSearch from './modules/level-search.vue';

defineOptions({
  name: 'DistributionLevelList',
});

const appStore = useAppStore();
const tableProps = useTableProps();

const {
  columns,
  columnChecks,
  data,
  getData,
  getDataByPage,
  loading,
  mobilePagination,
  scrollX,
  searchParams,
  resetSearchParams,
} = useTable({
  apiFn: fetchGetLevelList,
  apiParams: {
    pageNum: 1,
    pageSize: 100,
    isActive: undefined,
  },
  columns: () => [
    {
      key: 'index',
      title: $t('common.index'),
      align: 'center',
      width: 64,
    },
    {
      key: 'levelId',
      title: '身份等级',
      align: 'center',
      minWidth: 80,
    },
    {
      key: 'levelName',
      title: '身份名称',
      align: 'center',
      minWidth: 120,
    },
    {
      key: 'level1Rate',
      title: '直推权益比例',
      align: 'center',
      minWidth: 120,
      render: (row) => `${row.level1Rate}%`,
    },
    {
      key: 'level2Rate',
      title: '团队权益比例',
      align: 'center',
      minWidth: 120,
      render: (row) => `${row.level2Rate}%`,
    },
    {
      key: 'sort',
      title: $t('common.sort'),
      align: 'center',
      minWidth: 80,
    },
    {
      key: 'isActive',
      title: '状态',
      align: 'center',
      minWidth: 100,
      render: (row) => <NTag type={row.isActive ? 'success' : 'default'}>{row.isActive ? '启用' : '停用'}</NTag>,
    },
    {
      key: 'createTime',
      title: '创建时间',
      align: 'center',
      minWidth: 160,
      render: (row) => row.createTime,
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 160,
      render: (row) => {
        const editBtn = () => (
          <ButtonIcon
            text
            type="primary"
            icon="material-symbols:drive-file-rename-outline-outline"
            tooltipContent={$t('common.edit')}
            onClick={() => edit(row.id)}
          />
        );

        const deleteBtn = () => (
          <ButtonIcon
            text
            type="error"
            icon="material-symbols:delete-outline"
            tooltipContent={$t('common.delete')}
            popconfirmContent={$t('common.confirmDelete')}
            onPositiveClick={() => handleDelete(row.id)}
          />
        );

        return (
          <div class="flex-center gap-8px">
            {editBtn()}
            <NDivider vertical />
            {deleteBtn()}
          </div>
        );
      },
    },
  ],
});

const { drawerVisible, operateType, editingData, handleAdd, handleEdit, onDeleted } = useTableOperate<Api.Store.Level>(
  data,
  getData,
);

async function handleDelete(id: number): Promise<void> {
  try {
    await fetchDeleteLevel(id);
    onDeleted();
  } catch {
    // 错误消息已在请求工具中显示
  }
}

function edit(id: number): void {
  handleEdit('id', id);
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <LevelSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <NCard title="分销身份权益" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading"
          show-add
          @add="handleAdd"
          @refresh="getData"
        />
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        v-bind="tableProps"
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        :loading="loading"
        remote
        :row-key="(row) => row.id"
        :pagination="mobilePagination"
        class="sm:h-full"
      />
      <LevelOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getData"
      />
    </NCard>
  </div>
</template>

<style scoped>
.card-wrapper {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
</style>
