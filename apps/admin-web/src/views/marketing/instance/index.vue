<script setup lang="tsx">
import { computed, onMounted, ref } from 'vue';
import { NButton, NSpace, NTag } from 'naive-ui';
import { fetchInstanceDetail, fetchInstanceList, fetchUpdateInstanceStatus } from '@/service/api/marketing/instance';
import { buildMarketingPlayTypeNameByCode, fetchMarketingExecutablePlayTypes } from '@/service/api/marketing/play';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import { buildObjectSummary, parseObjectEditorText } from '../shared/object-summary';
import InstanceSearch from './modules/instance-search.vue';
import InstanceProbeDrawer from './modules/instance-probe-drawer.vue';
import { instanceStatusOptions } from './modules/instance-labels';

defineOptions({ name: 'MarketingInstance' });

// 活动实例页对应 PlayInstanceController，展示会员参与玩法后的运行记录。
// 状态流转属于高风险运营动作，前端只提交目标状态和可选附加参数，实例合法性由后端校验。
const appStore = useAppStore();

const detailVisible = ref(false);
const statusVisible = ref(false);
const detailRecord = ref<Api.Marketing.PlayInstance | null>(null);
const detailLoading = ref(false);
const statusUpdating = ref(false);
const detailId = ref('');
const nextStatus = ref('ACTIVE');
const extraDataText = ref('');
const advancedExtraMode = ref(false);
const probeVisible = ref(false);
const probeInstanceId = ref<string | null>(null);

const templateNameByCode = ref<Record<string, string>>({});
const instanceDataSummary = computed(() => buildObjectSummary(detailRecord.value?.instanceData ?? {}));

function statusTagType(status: string) {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED' || status === 'TIMEOUT') return 'error';
  if (status === 'REFUNDED') return 'default';
  return 'warning';
}

function formatDisplayWithId(displayName?: string | null, id?: string | null) {
  const normalizedName = displayName?.trim();
  const normalizedId = id?.trim();
  if (!normalizedName && !normalizedId) return '-';
  if (!normalizedName) return normalizedId || '-';
  if (!normalizedId || normalizedName === normalizedId) return normalizedName;
  return `${normalizedName} (${normalizedId})`;
}

const {
  data,
  loading,
  getData,
  getDataByPage,
  columns,
  searchParams,
  resetSearchParams,
  mobilePagination,
  scrollX,
  reloadColumns,
} = useTable({
  apiFn: fetchInstanceList,
  apiParams: { pageNum: 1, pageSize: 20, memberId: null, status: null },
  columns: () => [
    {
      key: 'id',
      title: '实例',
      align: 'left',
      minWidth: 200,
      render: (row: Api.Marketing.PlayInstance) => (
        <div class="flex-col gap-4px">
          <NTag type="info" bordered={false} class="w-fit text-12px font-mono">
            {row.id}
          </NTag>
          {row.instanceSummary ? (
            <span class="text-12px text-gray-500">{row.instanceSummary}</span>
          ) : (
            <span class="text-12px text-gray-400">活动参与记录的唯一标识</span>
          )}
        </div>
      ),
    },
    {
      key: 'memberId',
      title: '会员',
      align: 'left',
      minWidth: 160,
      render: (row: Api.Marketing.PlayInstance) => (
        <div class="flex-col gap-4px">
          <span class="font-medium">{row.memberDisplayName?.trim() || '—'}</span>
          <span class="text-12px text-gray-500 font-mono">ID: {row.memberId}</span>
        </div>
      ),
    },
    {
      key: 'configId',
      title: '营销配置',
      align: 'left',
      minWidth: 220,
      ellipsis: { tooltip: true },
      render: (row: Api.Marketing.PlayInstance) => (
        <div class="flex-col gap-4px">
          <span class="font-medium">{row.configDisplayName ?? '—'}</span>
          <span class="text-12px text-gray-500 font-mono">ID: {row.configId}</span>
        </div>
      ),
    },
    {
      key: 'templateCode',
      title: '玩法模板',
      align: 'left',
      minWidth: 140,
      render: (row: Api.Marketing.PlayInstance) => {
        const tplName = templateNameByCode.value[row.templateCode];
        return (
          <div class="flex-col gap-4px">
            <span class="font-medium">{tplName ?? '—'}</span>
            <NTag size="small" bordered={false} type="info" class="w-fit font-mono">
              {row.templateCode}
            </NTag>
          </div>
        );
      },
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 100,
      render: (row: Api.Marketing.PlayInstance) => (
        <NTag type={statusTagType(row.status)} size="small">
          {row.statusLabelZh ?? row.status}
        </NTag>
      ),
    },
    {
      key: 'createTime',
      title: '创建时间',
      align: 'center',
      minWidth: 170,
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 140,
      render: (row: Api.Marketing.PlayInstance) => (
        <div class="flex-center gap-8px">
          <ButtonIcon
            type="default"
            class="text-primary"
            tooltipContent="详情"
            icon="material-symbols:info-outline"
            onClick={() => openDetail(row.id)}
          />
          <ButtonIcon
            type="primary"
            class="text-primary"
            tooltipContent="改状态"
            icon="material-symbols:swap-horiz"
            onClick={() => openStatusModal(row.id, row.status)}
          />
          <ButtonIcon
            type="default"
            class="text-primary"
            tooltipContent="探针"
            icon="material-symbols:route"
            onClick={() => openProbeDrawer(row.id)}
          />
        </div>
      ),
    },
  ],
});

async function loadTemplateNameMap() {
  try {
    const list = await fetchMarketingExecutablePlayTypes();
    templateNameByCode.value = buildMarketingPlayTypeNameByCode(list);
  } catch {
    // 方法职责：实例页只解释可执行玩法名称，接口失败时保留原始编码便于排查同步状态。
  } finally {
    reloadColumns();
  }
}

onMounted(() => {
  loadTemplateNameMap().catch(() => undefined);
});

function openStatusModal(id: string, currentStatus: string) {
  // 打开状态流转时默认带入当前状态，避免运营误点后直接提交空状态。
  detailId.value = id;
  nextStatus.value = currentStatus;
  advancedExtraMode.value = false;
  extraDataText.value = '';
  statusVisible.value = true;
}

function openProbeDrawer(id: string) {
  probeInstanceId.value = id;
  probeVisible.value = true;
}

async function openDetail(id: string) {
  detailLoading.value = true;
  try {
    const { data: detail } = await fetchInstanceDetail(id);
    detailRecord.value = detail ?? null;
    detailId.value = id;
    detailVisible.value = true;
  } finally {
    detailLoading.value = false;
  }
}

function parseExtraData(): Record<string, unknown> | undefined {
  const text = extraDataText.value.trim();
  if (!text) return undefined;
  // 高级附加参数只支持 object-summary 的简单键值语法，不在前端构造复杂状态机事件。
  const parsed = parseObjectEditorText(text);
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

async function handleUpdateStatus() {
  if (!detailId.value) return;
  statusUpdating.value = true;
  try {
    // 实例状态更新可能触发履约、退款或结果展示变化；前端不直接改实例业务数据。
    await fetchUpdateInstanceStatus(detailId.value, nextStatus.value, parseExtraData());
    window.$message?.success('实例状态已更新');
    statusVisible.value = false;
    getData();
  } finally {
    statusUpdating.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 搜索区：按会员和实例状态筛选活动参与记录。 -->
    <InstanceSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <!-- 实例表格区：展示实例、会员、配置和状态流转入口。 -->
    <NCard title="活动实例" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="mobilePagination"
        remote
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        class="sm:h-full"
      >
        <template #empty>
          <div class="py-24px text-14px text-gray-500">{{ $t('datatable.empty') }}</div>
        </template>
      </NDataTable>
    </NCard>

    <!-- 探针抽屉：按实例 ID 查看运行链路诊断信息。 -->
    <InstanceProbeDrawer v-model:show="probeVisible" :instance-id="probeInstanceId" />

    <!-- 实例详情弹窗：只读展示实例基础字段和业务数据摘要。 -->
    <NModal v-model:show="detailVisible" preset="card" title="实例详情（只读）" class="w-760px">
      <NSpin :show="detailLoading">
        <NDescriptions :column="2" bordered label-placement="left" size="small">
          <NDescriptionsItem label="实例ID">{{ detailRecord?.id || '-' }}</NDescriptionsItem>
          <NDescriptionsItem label="状态">{{
            detailRecord?.statusLabelZh || detailRecord?.status || '-'
          }}</NDescriptionsItem>
          <NDescriptionsItem label="会员">
            {{ formatDisplayWithId(detailRecord?.memberDisplayName, detailRecord?.memberId) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="营销配置">
            {{ formatDisplayWithId(detailRecord?.configDisplayName, detailRecord?.configId) }}
          </NDescriptionsItem>
          <NDescriptionsItem label="模板编码">{{ detailRecord?.templateCode || '-' }}</NDescriptionsItem>
          <NDescriptionsItem label="创建时间">{{ detailRecord?.createTime || '-' }}</NDescriptionsItem>
        </NDescriptions>
        <NCard title="实例业务数据" :bordered="false" size="small" class="mt-12px">
          <NDescriptions v-if="instanceDataSummary.length" :column="2" bordered label-placement="left" size="small">
            <NDescriptionsItem v-for="item in instanceDataSummary" :key="item.key" :label="item.label">
              {{ item.value }}
            </NDescriptionsItem>
          </NDescriptions>
          <NEmpty v-else description="暂无实例业务数据" />
        </NCard>
      </NSpin>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="detailVisible = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 状态流转弹窗：提交目标状态和可选附加参数，后端执行合法性校验。 -->
    <NModal v-model:show="statusVisible" preset="card" title="实例状态流转" class="w-720px">
      <NForm :model="{}" label-placement="left" :label-width="120">
        <NFormItem label="实例ID">
          <NInput :value="detailId" disabled />
        </NFormItem>
        <NFormItem label="目标状态">
          <NSelect v-model:value="nextStatus" :options="instanceStatusOptions" />
        </NFormItem>
        <NFormItem label="高级参数">
          <NButton quaternary @click="advancedExtraMode = !advancedExtraMode">
            {{ advancedExtraMode ? '收起附加参数' : '展开附加参数' }}
          </NButton>
        </NFormItem>
        <NFormItem v-if="advancedExtraMode" label="附加参数">
          <NInput
            v-model:value="extraDataText"
            type="textarea"
            placeholder="每行填写 字段 = 值"
            :autosize="{ minRows: 4, maxRows: 10 }"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="statusVisible = false">取消</NButton>
          <NButton type="primary" :loading="statusUpdating" @click="handleUpdateStatus">更新状态</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped></style>
