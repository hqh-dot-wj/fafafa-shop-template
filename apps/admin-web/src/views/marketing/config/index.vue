<script setup lang="tsx">
import { computed, onMounted, reactive, ref } from 'vue';
import type { SelectOption } from 'naive-ui';
import { NButton, NSpace, NTag } from 'naive-ui';
import {
  fetchCreateStoreConfig,
  fetchDeleteStoreConfig,
  fetchGetStoreConfigList,
  fetchUpdateStoreConfig,
  fetchUpdateStoreConfigStatus,
} from '@/service/api/marketing/config';
import {
  type MarketingExecutablePlay,
  buildMarketingPlayTypeNameByCode,
  fetchMarketingExecutablePlayTypes,
} from '@/service/api/marketing/play';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import type { ProductPickerSelection } from '@/components/business/entity-picker.shared';
import ProductSelectModal from '@/components/business/product-select-modal.vue';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import { buildObjectFromEditableText, buildObjectSummary, formatObjectEditorText } from '../shared/object-summary';
import StoreConfigSearch from './modules/store-config-search.vue';

defineOptions({ name: 'MarketingConfig' });

// 营销动态配置页对应 StoreConfigController，绑定商品/服务与可执行玩法模板。
// 价格、库存策略、限购和上下架都会影响 C 端购买路径，前端只维护配置草稿和展示摘要。
const appStore = useAppStore();

/** 玩法模板 code -> 名称（列表展示用） */
const templateNameByCode = ref<Record<string, string>>({});
const templateRows = ref<MarketingExecutablePlay[]>([]);
const templateSelectOptions = computed<SelectOption[]>(() =>
  templateRows.value.map((template) => ({
    label: template.name,
    value: template.code,
  })),
);

function stockModeLabel(mode: Api.Marketing.StoreConfig['stockMode']): string {
  if (mode === 'STRONG_LOCK') return '强互斥锁定';
  if (mode === 'LAZY_CHECK') return '弱校验';
  return mode;
}

const ruleLabelMap: Record<string, string> = {
  activityName: '活动名称',
  name: '活动名称',
  tagLabel: '展示标签',
  displayTag: '展示标签',
  discountPrice: '活动价',
  flashPrice: '秒杀价',
  price: '价格',
  originalPrice: '原价',
  guidePrice: '指导价',
  marketPrice: '市场价',
  endTime: '截止时间',
  limitPerUser: '每人限购',
};

const modalVisible = ref(false);
const submitting = ref(false);
const editingId = ref<string | null>(null);
const servicePickerVisible = ref(false);
const serviceDisplayValue = ref('');
const detailVisible = ref(false);
const detailRow = ref<Api.Marketing.StoreConfig | null>(null);
const detailRuleSummary = computed(() => buildObjectSummary(detailRow.value?.rules ?? {}, { labelMap: ruleLabelMap }));
const detailUpdateTime = computed(() => (detailRow.value as { updateTime?: string } | null)?.updateTime ?? '-');
const advancedRulesMode = ref(false);
const originalRules = ref<Record<string, unknown>>({});
const ruleFields = reactive({
  activityName: '',
  tagLabel: '',
  discountPrice: '',
  originalPrice: '',
  endTime: '',
  limitPerUser: '',
});

const formModel = reactive<Api.Marketing.StoreConfigCreate & Api.Marketing.StoreConfigUpdate>({
  serviceId: '',
  serviceType: 'REAL',
  templateCode: '',
  rules: {},
  stockMode: 'STRONG_LOCK',
  status: 'OFF_SHELF',
});
const rulesText = ref('');

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
  apiFn: fetchGetStoreConfigList,
  apiParams: {
    pageNum: 1,
    pageSize: 20,
    templateCode: null,
    status: null,
  },
  columns: () => [
    {
      key: 'ruleName',
      title: '配置名称',
      align: 'left',
      minWidth: 160,
      ellipsis: { tooltip: true },
      render: (row: Api.Marketing.StoreConfig) => {
        const rules = row.rules as Record<string, unknown> | undefined;
        const fromRules = rules?.name;
        let explicit: string | null = null;

        if (typeof fromRules === 'string' && fromRules.trim()) {
          explicit = fromRules.trim();
        } else if (row.ruleName && row.ruleName !== row.templateCode) {
          explicit = String(row.ruleName).trim();
        }

        return <span class="font-medium">{explicit ?? '—'}</span>;
      },
    },
    {
      key: 'id',
      title: '配置ID',
      align: 'center',
      minWidth: 180,
      render: (row) => (
        <NTag type="info" bordered={false} class="font-mono">
          {row.id}
        </NTag>
      ),
    },
    {
      key: 'serviceId',
      title: '服务/商品',
      align: 'left',
      minWidth: 200,
      render: (row: Api.Marketing.StoreConfig) => (
        <div class="flex-col gap-4px">
          <span class="font-medium">{row.productName ?? '—'}</span>
          <span class="text-12px text-gray-500 font-mono">ID: {row.serviceId}</span>
        </div>
      ),
    },
    {
      key: 'templateCode',
      title: '玩法模板',
      align: 'left',
      minWidth: 160,
      render: (row: Api.Marketing.StoreConfig) => {
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
      key: 'stockMode',
      title: '库存策略',
      align: 'center',
      width: 120,
      render: (row: Api.Marketing.StoreConfig) => <span>{stockModeLabel(row.stockMode)}</span>,
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 100,
      render: (row) => (
        <NTag type={row.status === 'ON_SHELF' ? 'success' : 'default'} size="small">
          {row.status === 'ON_SHELF' ? '上架' : '下架'}
        </NTag>
      ),
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 260,
      render: (row) => (
        <div class="flex-center flex-wrap gap-8px">
          <ButtonIcon
            type="default"
            class="text-primary"
            tooltipContent="详情"
            icon="material-symbols:info-outline"
            onClick={() => openDetail(row)}
          />
          <ButtonIcon
            type="primary"
            class="text-primary"
            tooltipContent={$t('common.edit')}
            icon="material-symbols:edit-square-outline"
            onClick={() => openEdit(row)}
          />
          <NButton
            type="primary"
            ghost
            size="small"
            onClick={() => handleToggleStatus(row.id, row.status === 'ON_SHELF' ? 'OFF_SHELF' : 'ON_SHELF')}
          >
            {row.status === 'ON_SHELF' ? '下架' : '上架'}
          </NButton>
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

async function loadTemplateNameMap() {
  try {
    const list = await fetchMarketingExecutablePlayTypes();
    templateRows.value = list;
    templateNameByCode.value = buildMarketingPlayTypeNameByCode(list);
  } catch {
    // 可执行玩法接口失败时不回退到表单模板，避免把 PT_ 配置模板误作为可绑定玩法。
  } finally {
    reloadColumns();
  }
}

onMounted(() => {
  loadTemplateNameMap().catch(() => undefined);
});

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function readNumberText(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed) : '';
  }
  return '';
}

function applyRulesToFields(rules: Record<string, unknown>) {
  ruleFields.activityName = readString(rules.activityName || rules.name);
  ruleFields.tagLabel = readString(rules.tagLabel || rules.displayTag);
  ruleFields.discountPrice = readNumberText(rules.discountPrice || rules.flashPrice || rules.price);
  ruleFields.originalPrice = readNumberText(rules.originalPrice || rules.guidePrice || rules.marketPrice);
  ruleFields.endTime = readString(rules.endTime);
  ruleFields.limitPerUser = readNumberText(rules.limitPerUser);
}

function buildRulesFromFields(base: Record<string, unknown>) {
  // 表单字段只覆盖常用展示/规则项，未暴露的扩展规则通过 base 原样保留。
  const next = { ...base };
  const activityName = readString(ruleFields.activityName);
  if (activityName) {
    next.activityName = activityName;
    next.name = activityName;
  } else {
    delete next.activityName;
    delete next.name;
  }

  const tagLabel = readString(ruleFields.tagLabel);
  if (tagLabel) {
    next.tagLabel = tagLabel;
    next.displayTag = tagLabel;
  } else {
    delete next.tagLabel;
    delete next.displayTag;
  }

  const discountPrice = Number(ruleFields.discountPrice);
  if (Number.isFinite(discountPrice) && discountPrice > 0) {
    next.discountPrice = discountPrice;
  } else {
    delete next.discountPrice;
  }

  const originalPrice = Number(ruleFields.originalPrice);
  if (Number.isFinite(originalPrice) && originalPrice > 0) {
    next.originalPrice = originalPrice;
  } else {
    delete next.originalPrice;
  }

  const endTime = readString(ruleFields.endTime);
  if (endTime) {
    next.endTime = endTime;
  } else {
    delete next.endTime;
  }

  const limitPerUser = Number(ruleFields.limitPerUser);
  if (Number.isFinite(limitPerUser) && limitPerUser > 0) {
    next.limitPerUser = Math.trunc(limitPerUser);
  } else {
    delete next.limitPerUser;
  }

  return next;
}

function openCreate() {
  editingId.value = null;
  advancedRulesMode.value = false;
  originalRules.value = {};
  Object.assign(formModel, {
    serviceId: '',
    serviceType: 'REAL',
    templateCode: '',
    rules: {},
    stockMode: 'STRONG_LOCK',
    status: 'OFF_SHELF',
  });
  serviceDisplayValue.value = '';
  rulesText.value = '';
  applyRulesToFields({});
  modalVisible.value = true;
}

function openEdit(row: Api.Marketing.StoreConfig) {
  editingId.value = row.id;
  advancedRulesMode.value = false;
  originalRules.value = toRecord(row.rules);
  Object.assign(formModel, {
    serviceId: row.serviceId,
    serviceType: row.serviceType,
    templateCode: row.templateCode,
    rules: row.rules ?? {},
    stockMode: row.stockMode,
    status: row.status,
  });
  serviceDisplayValue.value = row.productName || row.serviceId;
  rulesText.value = formatObjectEditorText(row.rules ?? {}, { labelMap: ruleLabelMap });
  applyRulesToFields(originalRules.value);
  modalVisible.value = true;
}

function openDetail(row: Api.Marketing.StoreConfig) {
  detailRow.value = row;
  detailVisible.value = true;
}

function parseRulesObject(): Record<string, unknown> {
  return buildObjectFromEditableText(originalRules.value, rulesText.value);
}

async function handleSave() {
  if (!formModel.serviceId || !formModel.templateCode) {
    window.$message?.warning('请选择服务/商品和玩法模板');
    return;
  }
  const baseRules = advancedRulesMode.value ? parseRulesObject() : { ...originalRules.value };
  const nextRules = buildRulesFromFields(baseRules);

  // 保存时统一从规则字段重建 rules，避免普通模式下遗漏价格、限购等运营关键字段。
  const payload = {
    ...formModel,
    rules: nextRules,
  };
  submitting.value = true;
  try {
    if (editingId.value) {
      await fetchUpdateStoreConfig(editingId.value, payload);
      window.$message?.success('配置已更新');
    } else {
      await fetchCreateStoreConfig(payload);
      window.$message?.success('配置已创建');
    }
    modalVisible.value = false;
    getData();
  } finally {
    submitting.value = false;
  }
}

function openServicePicker() {
  servicePickerVisible.value = true;
}

function handleServiceSelect(selection: ProductPickerSelection) {
  formModel.serviceId = selection.productId;
  formModel.serviceType = selection.type === 'SERVICE' ? 'SERVICE' : 'REAL';
  serviceDisplayValue.value = selection.displayName || selection.productName || selection.name || selection.productId;
}

function clearServiceSelection() {
  formModel.serviceId = '';
  serviceDisplayValue.value = '';
}

async function handleToggleStatus(id: string, status: string) {
  // 上下架只提交状态，库存、订单占用和活动资格由后端状态机处理。
  await fetchUpdateStoreConfigStatus(id, status);
  window.$message?.success('状态已更新');
  getData();
}

async function handleDelete(id: string) {
  window.$dialog?.warning({
    title: $t('common.tip'),
    content: '确认删除该营销动态配置？',
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      await fetchDeleteStoreConfig(id);
      window.$message?.success($t('common.deleteSuccess'));
      getData();
    },
  });
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 搜索区：按玩法模板和状态筛选动态配置。 -->
    <StoreConfigSearch
      v-model:model="searchParams"
      :template-options="templateSelectOptions"
      @reset="resetSearchParams"
      @search="getDataByPage"
    />
    <!-- 配置表格区：展示商品/服务绑定的玩法模板和上下架入口。 -->
    <NCard title="营销动态配置" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NButton type="primary" ghost size="small" @click="openCreate">
          <template #icon>
            <icon-ic-round-plus class="text-icon" />
          </template>
          新增配置
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
      >
        <template #empty>
          <div class="py-24px text-14px text-gray-500">{{ $t('datatable.empty') }}</div>
        </template>
      </NDataTable>
    </NCard>

    <!-- 配置编辑弹窗：维护商品绑定、玩法模板、库存策略和常用规则字段。 -->
    <NModal
      v-model:show="modalVisible"
      preset="card"
      :title="editingId ? '编辑营销动态配置' : '新增营销动态配置'"
      class="w-720px"
    >
      <NForm :model="formModel" label-placement="left" :label-width="130">
        <!-- 绑定信息区：选择商品或服务，并确定可执行玩法模板。 -->
        <NFormItem label="服务/商品">
          <NSpace class="w-full" :wrap="false">
            <NInput
              v-model:value="serviceDisplayValue"
              placeholder="点击选择服务/商品"
              clearable
              readonly
              @click="openServicePicker"
              @clear="clearServiceSelection"
            />
            <NButton type="primary" ghost @click="openServicePicker">选择</NButton>
          </NSpace>
        </NFormItem>
        <NFormItem label="服务类型">
          <NSelect
            v-model:value="formModel.serviceType"
            :options="[
              { label: '实物', value: 'REAL' },
              { label: '服务', value: 'SERVICE' },
            ]"
          />
        </NFormItem>
        <NFormItem label="玩法模板">
          <NSelect
            v-model:value="formModel.templateCode"
            :options="templateSelectOptions"
            clearable
            placeholder="请选择玩法模板"
          />
        </NFormItem>
        <NFormItem label="库存策略">
          <NSelect
            v-model:value="formModel.stockMode"
            :options="[
              { label: '强互斥锁定', value: 'STRONG_LOCK' },
              { label: '弱校验', value: 'LAZY_CHECK' },
            ]"
          />
        </NFormItem>
        <NFormItem label="状态">
          <NSelect
            v-model:value="formModel.status"
            :options="[
              { label: '上架', value: 'ON_SHELF' },
              { label: '下架', value: 'OFF_SHELF' },
            ]"
          />
        </NFormItem>
        <!-- 常用规则区：编辑展示名、价格、截止时间和限购等运营字段。 -->
        <NFormItem label="规则要点">
          <NGrid :cols="2" :x-gap="12" :y-gap="8">
            <NFormItemGi label="活动名称" :span="1">
              <NInput v-model:value="ruleFields.activityName" placeholder="用于列表展示名称" />
            </NFormItemGi>
            <NFormItemGi label="展示标签" :span="1">
              <NInput v-model:value="ruleFields.tagLabel" placeholder="如：拼课价/秒杀价" />
            </NFormItemGi>
            <NFormItemGi label="活动价" :span="1">
              <NInput v-model:value="ruleFields.discountPrice" placeholder="数字，如 49.9" />
            </NFormItemGi>
            <NFormItemGi label="原价" :span="1">
              <NInput v-model:value="ruleFields.originalPrice" placeholder="数字，如 99" />
            </NFormItemGi>
            <NFormItemGi label="截止时间" :span="1">
              <NInput v-model:value="ruleFields.endTime" placeholder="ISO 时间或业务约定格式" />
            </NFormItemGi>
            <NFormItemGi label="每人限购" :span="1">
              <NInput v-model:value="ruleFields.limitPerUser" placeholder="整数，如 1" />
            </NFormItemGi>
          </NGrid>
        </NFormItem>
        <NFormItem label="高级模式">
          <NButton quaternary @click="advancedRulesMode = !advancedRulesMode">
            {{ advancedRulesMode ? '收起扩展规则' : '展开扩展规则' }}
          </NButton>
        </NFormItem>
        <!-- 扩展规则区：按 key=value 维护未显式建模的后端规则字段。 -->
        <NFormItem v-if="advancedRulesMode" label="扩展规则">
          <NInput
            v-model:value="rulesText"
            type="textarea"
            placeholder="每行填写 字段 = 值，仅覆盖简单字段"
            :autosize="{ minRows: 6, maxRows: 16 }"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSave">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 商品选择弹窗：返回商品或服务摘要给配置表单。 -->
    <ProductSelectModal
      v-model:visible="servicePickerVisible"
      :type="formModel.serviceType === 'SERVICE' ? 'SERVICE' : 'REAL'"
      :selected="
        formModel.serviceId
          ? {
              productId: formModel.serviceId,
              displayName: serviceDisplayValue || formModel.serviceId,
            }
          : null
      "
      @select="handleServiceSelect"
    />

    <!-- 详情弹窗：只读展示配置基础信息和规则摘要。 -->
    <NModal v-model:show="detailVisible" preset="card" title="营销动态配置详情" class="w-760px">
      <NDescriptions :column="2" bordered label-placement="left" size="small">
        <NDescriptionsItem label="配置ID">{{ detailRow?.id || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">{{ detailRow?.status || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="服务ID">{{ detailRow?.serviceId || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="服务名称">{{ detailRow?.productName || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="玩法模板">{{
          templateNameByCode[detailRow?.templateCode || ''] || '-'
        }}</NDescriptionsItem>
        <NDescriptionsItem label="模板编码">{{ detailRow?.templateCode || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="库存策略">{{
          detailRow ? stockModeLabel(detailRow.stockMode) : '-'
        }}</NDescriptionsItem>
        <NDescriptionsItem label="更新时间">{{ detailUpdateTime }}</NDescriptionsItem>
      </NDescriptions>
      <NCard title="规则详情" :bordered="false" size="small" class="mt-12px">
        <NDescriptions v-if="detailRuleSummary.length" :column="2" bordered label-placement="left" size="small">
          <NDescriptionsItem v-for="item in detailRuleSummary" :key="item.key" :label="item.label">
            {{ item.value }}
          </NDescriptionsItem>
        </NDescriptions>
        <NEmpty v-else description="暂无规则详情" />
      </NCard>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="detailVisible = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped></style>
