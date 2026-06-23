<script setup lang="tsx">
import { useRouter } from 'vue-router';
import { NAlert, NAvatar, NButton, NSwitch, NTag } from 'naive-ui';
import {
  fetchDeleteStoreConfig,
  fetchGetStoreConfigList,
  fetchUpdateStoreConfigStatus,
} from '@/service/api/marketing/config';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableOperate } from '@/hooks/common/table';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import ConfigSearch from './modules/config-search.vue';
import ConfigOperateDrawer from './modules/config-operate-drawer.vue';

defineOptions({
  name: 'StoreDistributionActivity',
});

const appStore = useAppStore();
const router = useRouter();

function goMarketingConfig() {
  router.push('/marketing/config');
}

function formatRulePrice(rules: Record<string, unknown>): string | null {
  const raw = rules.price;
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw));
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function ruleDatePart(rules: Record<string, unknown>, key: 'startTime' | 'endTime'): string {
  const v = rules[key];
  if (typeof v !== 'string' || v === '') return '';
  return v.split(' ')[0] ?? v;
}

const { data, loading, getData, getDataByPage, columns, searchParams, resetSearchParams, mobilePagination, scrollX } =
  useTable({
    apiFn: fetchGetStoreConfigList,
    apiParams: {
      pageNum: 1,
      pageSize: 10,
      storeId: null,
      templateCode: null,
      status: null,
    },
    columns: () => [
      {
        key: 'ruleName',
        title: $t('page.storeDistributionActivity.table.ruleName'),
        align: 'left',
        width: 180,
        render: (row: Api.Marketing.StoreConfig) => (
          <div class="flex-col">
            <span class="text-md font-bold">{row.ruleName}</span>
            <NTag type="info" bordered={false} size="small" class="mt-1 w-fit">
              {row.templateCode}
            </NTag>
          </div>
        ),
      },
      {
        key: 'productName',
        title: $t('page.storeDistributionActivity.table.relatedProduct'),
        align: 'left',
        minWidth: 200,
        render: (row: Api.Marketing.StoreConfig) => (
          <div class="flex items-center gap-2">
            <NAvatar
              src={row.productImage}
              fallback-src="https://via.placeholder.com/64"
              size={48}
              class="flex-shrink-0"
            />
            <div class="flex-col">
              <span class="font-bold">{row.productName}</span>
              <div class="mt-1 flex items-center gap-1">
                <span class="text-xs text-gray-400">ID: {row.serviceId}</span>
                {row.productStatus === 'ON_SHELF' ? (
                  <NTag type="success" size="small" class="origin-left scale-75">
                    {$t('page.storeDistributionActivity.table.onShelf')}
                  </NTag>
                ) : (
                  <NTag type="error" size="small" class="origin-left scale-75">
                    {$t('page.storeDistributionActivity.table.offShelf')}
                  </NTag>
                )}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'config',
        title: $t('page.storeDistributionActivity.table.activityConfig'),
        align: 'left',
        minWidth: 160,
        render: (row: Api.Marketing.StoreConfig) => {
          const rules = row.rules ?? {};
          const priceStr = formatRulePrice(rules);
          const start = ruleDatePart(rules, 'startTime');
          const end = ruleDatePart(rules, 'endTime');
          return (
            <div class="flex-col gap-1 text-xs">
              {priceStr !== null && (
                <div class="flex items-center">
                  <span class="mr-1 text-gray-500">{$t('page.storeDistributionActivity.table.price')}:</span>
                  <span class="text-sm text-error font-bold">¥{priceStr}</span>
                </div>
              )}
              {(start || end) && (
                <div class="mt-1 flex-col text-gray-500">
                  {start ? (
                    <div>
                      {$t('page.storeDistributionActivity.table.startShort')}: {start}
                    </div>
                  ) : null}
                  {end ? (
                    <div>
                      {$t('page.storeDistributionActivity.table.endShort')}: {end}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: 'status',
        title: $t('page.storeDistributionActivity.table.status'),
        align: 'center',
        render: (row: Api.Marketing.StoreConfig) => (
          <NTag type={row.status === 'ON_SHELF' ? 'success' : 'default'}>
            {row.status === 'ON_SHELF'
              ? $t('page.storeDistributionActivity.table.onShelf')
              : $t('page.storeDistributionActivity.table.offShelf')}
          </NTag>
        ),
      },
      {
        key: 'commissionMode',
        title: $t('page.storeDistributionActivity.table.commissionMode'),
        align: 'center',
        width: 100,
        render: (row: Api.Marketing.StoreConfig) =>
          row.commissionMode ? (
            <NTag type="info" size="small">
              {row.commissionMode}
            </NTag>
          ) : (
            <span class="text-gray-400">-</span>
          ),
      },
      {
        key: 'commissionRate',
        title: $t('page.storeDistributionActivity.table.commissionRate'),
        align: 'center',
        width: 90,
        render: (row: Api.Marketing.StoreConfig) =>
          row.commissionRate !== undefined && row.commissionRate !== null ? `${row.commissionRate}%` : '-',
      },
      {
        key: 'aggregateEnabled',
        title: $t('page.storeDistributionActivity.table.aggregateEnabled'),
        align: 'center',
        width: 90,
        render: (row: Api.Marketing.StoreConfig) => <NSwitch value={Boolean(row.aggregateEnabled)} disabled size="small" />,
      },
      {
        key: 'zoneEnabled',
        title: $t('page.storeDistributionActivity.table.zoneEnabled'),
        align: 'center',
        width: 90,
        render: (row: Api.Marketing.StoreConfig) => <NSwitch value={Boolean(row.zoneEnabled)} disabled size="small" />,
      },
      {
        key: 'displayPriority',
        title: $t('page.storeDistributionActivity.table.displayPriority'),
        align: 'center',
        width: 100,
        render: (row: Api.Marketing.StoreConfig) =>
          row.displayPriority !== undefined && row.displayPriority !== null ? row.displayPriority : '-',
      },
      {
        key: 'operate',
        title: $t('common.operate'),
        align: 'center',
        width: 200,
        render: (row: Api.Marketing.StoreConfig) => (
          <div class="flex-center flex-wrap gap-8px">
            {row.status === 'OFF_SHELF' ? (
              <NButton type="success" ghost size="small" onClick={() => handleStatus(row.id, 'ON_SHELF')}>
                {$t('page.storeDistributionActivity.table.shelve')}
              </NButton>
            ) : (
              <NButton type="warning" ghost size="small" onClick={() => handleStatus(row.id, 'OFF_SHELF')}>
                {$t('page.storeDistributionActivity.table.unshelve')}
              </NButton>
            )}
            <ButtonIcon
              type="primary"
              class="text-primary"
              tooltipContent={$t('page.storeDistributionActivity.table.configTooltip')}
              icon="material-symbols:settings-outline"
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

const { handleEdit, drawerVisible, operateType, editingData, onDeleted } = useTableOperate(data, getData);

async function edit(id: string) {
  handleEdit('id', id);
}

async function handleDelete(id: string) {
  window.$dialog?.warning({
    title: $t('common.tip'),
    content: $t('page.storeDistributionActivity.table.deleteConfirm'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      await fetchDeleteStoreConfig(id);
      await onDeleted();
    },
  });
}

async function handleStatus(id: string, status: string) {
  await fetchUpdateStoreConfigStatus(id, status);
  window.$message?.success(
    status === 'ON_SHELF'
      ? $t('page.storeDistributionActivity.table.shelfSuccess')
      : $t('page.storeDistributionActivity.table.unshelfSuccess'),
  );
  getData();
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NAlert type="warning" :bordered="false" :title="$t('page.storeDistributionActivity.migrateAlertTitle')">
      <div class="flex flex-col gap-12px sm:flex-row sm:items-center sm:justify-between">
        <span>{{ $t('page.storeDistributionActivity.migrateAlertDesc') }}</span>
        <NButton type="primary" size="small" class="flex-shrink-0" @click="goMarketingConfig">
          {{ $t('page.storeDistributionActivity.goMarketingConfig') }}
        </NButton>
      </div>
    </NAlert>
    <ConfigSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <NCard :title="$t('route.store_distribution_activity')" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NButton type="primary" ghost size="small" @click="goMarketingConfig">
          <template #icon>
            <icon-material-symbols:arrow-forward-rounded class="text-icon" />
          </template>
          {{ $t('page.storeDistributionActivity.unifyEntry') }}
        </NButton>
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="mobilePagination"
        remote
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        class="sm:h-full"
      />
      <ConfigOperateDrawer
        v-model:visible="drawerVisible"
        :operate-type="operateType"
        :row-data="editingData"
        @submitted="getData"
      />
    </NCard>
  </div>
</template>

<style scoped></style>
