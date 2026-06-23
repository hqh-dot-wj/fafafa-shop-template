<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  type DataTableColumns,
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  NTag,
  type SelectOption,
} from 'naive-ui';
import {
  type DistributionGrowth,
  type MarketingActivity,
  type MarketingActivityItem,
  fetchActivityDetail,
  fetchActivityItemList,
  fetchActivityList,
  fetchCreateActivityItem,
  fetchDeleteActivityItem,
  fetchPauseActivity,
  fetchPublishActivity,
  fetchUpdateActivity,
  fetchUpdateActivityItem,
} from '@/service/api/marketing';
import ActivityDetailHeader from '../modules/activity-detail-header.vue';
import ActivityBasicCard from '../modules/activity-basic-card.vue';
import ActivityItemCard from '../modules/activity-item-card.vue';
import ActivityPublishPanel from '../modules/activity-publish-panel.vue';
import ActivityItemDrawer from '../modules/activity-item-drawer.vue';
import ActivityDistributionGrowthPanel from '../modules/activity-distribution-growth-panel.vue';

defineOptions({ name: 'MarketingActivityDetailPage' });

// 活动详情页对应 ActivityController 的后台运行配置入口。
// 基础信息、玩法规则、商品项、触达和发布预检分区维护；订单、分佣、失败处理由后端服务执行。
interface ActivityBasicForm {
  name: string;
  type: string;
  description: string;
  startTime: string;
  endTime: string;
}

interface RuleFormModel {
  failurePolicy: string;
  commissionEnabled: boolean;
  commissionRate: number;
  leaderMode: string;
  allowQualifiedUserOpen: boolean;
  allowStaffProxyOpen: boolean;
  ownerUserId: string;
}

interface ItemFormModel {
  activityItemId?: string;
  itemType: string;
  productId: string;
  skuId: string;
  productName: string;
  skuName: string;
  originPrice: number;
  activityPrice: number;
  displayTag: string;
  sort: number;
  enabled: boolean;
}

type BooleanSelectValue = 'true' | 'false';
type ActivityTouchpointRow = MarketingActivity['touchpoints'][number];

const route = useRoute();

const activityId = ref((route.query.activityId as string) || '');
const loading = ref(false);
const saving = ref(false);
const activityPickerVisible = ref(false);
const activityPickerLoading = ref(false);
const activityPickerKeyword = ref('');
const activityPickerRows = ref<MarketingActivity[]>([]);
const selectedActivityId = ref('');
const activity = ref<MarketingActivity | null>(null);
const activityItems = ref<MarketingActivityItem[]>([]);
const precheckIssues = ref<string[]>([]);
const precheckCheckedAt = ref('');

const basicForm = reactive<ActivityBasicForm>({
  name: '',
  type: 'COURSE_GROUP',
  description: '',
  startTime: '',
  endTime: '',
});

const ruleForm = reactive<RuleFormModel>({
  failurePolicy: 'REFUND',
  commissionEnabled: false,
  commissionRate: 0,
  leaderMode: 'QUALIFIED_ONLY',
  allowQualifiedUserOpen: true,
  allowStaffProxyOpen: false,
  ownerUserId: '',
});

const enableOptions: SelectOption[] = [
  { label: '开启', value: 'true' },
  { label: '关闭', value: 'false' },
];

const yesNoOptions: SelectOption[] = [
  { label: '是', value: 'true' },
  { label: '否', value: 'false' },
];

const commissionEnabledValue = computed<BooleanSelectValue>({
  get: () => encodeBooleanSelect(ruleForm.commissionEnabled),
  set: (value) => {
    ruleForm.commissionEnabled = decodeBooleanSelect(value);
  },
});

const allowQualifiedUserOpenValue = computed<BooleanSelectValue>({
  get: () => encodeBooleanSelect(ruleForm.allowQualifiedUserOpen),
  set: (value) => {
    ruleForm.allowQualifiedUserOpen = decodeBooleanSelect(value);
  },
});

const allowStaffProxyOpenValue = computed<BooleanSelectValue>({
  get: () => encodeBooleanSelect(ruleForm.allowStaffProxyOpen),
  set: (value) => {
    ruleForm.allowStaffProxyOpen = decodeBooleanSelect(value);
  },
});

const itemDrawerVisible = ref(false);
const itemSubmitting = ref(false);
const editingItemId = ref<string | null>(null);
const itemForm = reactive<ItemFormModel>({
  itemType: 'PRODUCT',
  productId: '',
  skuId: '',
  productName: '',
  skuName: '',
  originPrice: 0,
  activityPrice: 0,
  displayTag: '',
  sort: 1,
  enabled: true,
});

const activityStatus = computed(() => {
  const current = activity.value;
  if (!current) return { label: '-', type: 'default' as const };
  const end = current.endTime ? new Date(current.endTime).getTime() : null;
  if (end && end <= Date.now()) return { label: '已归档', type: 'default' as const };
  if (current.isEnabled) return { label: '已发布', type: 'success' as const };
  return { label: '已暂停/草稿', type: 'warning' as const };
});

const sceneBindings = computed(() => {
  const rules = toRecord(activity.value?.rules);
  const list = rules.sceneBindings;
  return Array.isArray(list) ? list : [];
});

const touchpointRows = computed(() => activity.value?.touchpoints ?? []);

const distributionGrowth = computed<DistributionGrowth | null>(() => activity.value?.distributionGrowth ?? null);

const distributionReferralRule = computed<Record<string, unknown> | null>(() => {
  const triggerRule = toRecordOrNull(toRecord(activity.value?.triggerCondition).referralRule);
  if (triggerRule) return triggerRule;
  return toRecordOrNull(toRecord(activity.value?.rules).referralRule);
});

const distributionBudgetSnapshot = computed<Api.Store.CommissionBudgetSnapshot | null>(() => {
  const rewardsRecord = toRecord(activity.value?.rewards);
  const snapshotRecord = toRecordOrNull(rewardsRecord.commissionBudgetSnapshot ?? rewardsRecord.budgetSnapshot);
  if (!snapshotRecord) return null;

  return {
    budgetTotal: readNumeric(snapshotRecord.budgetTotal),
    budgetFrozen: readNumeric(snapshotRecord.budgetFrozen),
    budgetConsumed: readNumeric(snapshotRecord.budgetConsumed),
    budgetReleased: readNumeric(snapshotRecord.budgetReleased),
    budgetByLevel: toNumberRecord(snapshotRecord.budgetByLevel),
    budgetByChannel: toNumberRecord(snapshotRecord.budgetByChannel),
    budgetByActivityVersion: toNumberRecord(snapshotRecord.budgetByActivityVersion),
    budgetAlertThreshold: readNumeric(snapshotRecord.budgetAlertThreshold),
    budgetFuseThreshold: readNumeric(snapshotRecord.budgetFuseThreshold),
  };
});

const itemColumns: DataTableColumns<MarketingActivityItem> = [
  {
    key: 'itemName',
    title: '商品名称',
    minWidth: 150,
    render: (row) => readString(row, 'itemName') ?? readString(toRecord(row.config), 'productName') ?? '-',
  },
  {
    key: 'sku',
    title: '规格编号',
    minWidth: 130,
    render: (row) => readString(toRecord(row.config), 'skuId') ?? '-',
  },
  {
    key: 'originPrice',
    title: '原价',
    width: 120,
    render: (row) => Number(toRecord(row.config).originPrice ?? 0).toFixed(2),
  },
  {
    key: 'activityPrice',
    title: '活动价',
    width: 120,
    render: (row) => Number(toRecord(row.config).activityPrice ?? 0).toFixed(2),
  },
  {
    key: 'displayTag',
    title: '展示标签',
    minWidth: 120,
    render: (row) => readString(toRecord(row.config), 'displayTag') ?? '-',
  },
  {
    key: 'enabled',
    title: '状态',
    width: 100,
    render: (row) =>
      h(
        NTag,
        { type: row.enabled ? 'success' : 'default', size: 'small' },
        { default: () => (row.enabled ? '启用' : '停用') },
      ),
  },
  {
    key: 'sort',
    title: '排序',
    width: 80,
  },
  {
    key: 'operate',
    title: '操作',
    width: 180,
    render: (row) =>
      h(
        NSpace,
        { size: 8, justify: 'center' },
        {
          default: () => [
            h(
              NButton,
              { size: 'small', type: 'primary', ghost: true, onClick: () => openEditItem(row) },
              { default: () => '编辑' },
            ),
            h(
              NButton,
              { size: 'small', type: 'error', ghost: true, onClick: () => runAsyncTask(() => removeItem(row)) },
              { default: () => '删除' },
            ),
          ],
        },
      ),
  },
];

const touchpointColumns: DataTableColumns<ActivityTouchpointRow> = [
  {
    key: 'name',
    title: '触达名称',
    minWidth: 160,
    render: (row) => row.name || row.code || '-',
  },
  {
    key: 'kind',
    title: '触达方式',
    width: 110,
    render: (row) =>
      h(
        NTag,
        { type: row.kind === 'SHARE' ? 'info' : 'success', size: 'small' },
        { default: () => (row.kind === 'SHARE' ? '分享入口' : '消息通知') },
      ),
  },
  {
    key: 'code',
    title: '触达编码',
    minWidth: 180,
    render: (row) => row.code || '-',
  },
  {
    key: 'config',
    title: '主要配置',
    minWidth: 220,
    render: (row) => formatTouchpointConfig(row),
  },
  {
    key: 'enabled',
    title: '状态',
    width: 90,
    render: (row) =>
      h(
        NTag,
        { type: row.isEnabled ? 'success' : 'default', size: 'small' },
        { default: () => (row.isEnabled ? '启用' : '停用') },
      ),
  },
];

const activityPickerColumns: DataTableColumns<MarketingActivity> = [
  {
    key: 'name',
    title: '活动名称',
    minWidth: 220,
    ellipsis: { tooltip: true },
    render: (row) =>
      h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium' }, row.name || '-'),
        h('span', { class: 'text-xs text-gray-500 font-mono' }, row.id),
      ]),
  },
  {
    key: 'type',
    title: '活动类型',
    width: 140,
    render: (row) => row.type || '-',
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (row) => row.status || '-',
  },
  {
    key: 'startTime',
    title: '开始时间',
    width: 170,
    render: (row) => formatDateTime(row.startTime),
  },
];

async function loadAll() {
  if (!activityId.value) return;
  loading.value = true;
  try {
    const [activityRes, itemsRes] = await Promise.all([
      fetchActivityDetail(activityId.value),
      fetchActivityItemList(activityId.value),
    ]);

    const currentActivity = activityRes.data;
    activity.value = currentActivity;
    activityItems.value = itemsRes.data || [];
    if (!currentActivity) {
      runPrecheck();
      return;
    }
    applyActivityToForm(currentActivity);
    runPrecheck();
  } finally {
    loading.value = false;
  }
}

async function loadActivityPickerRows() {
  activityPickerLoading.value = true;
  try {
    const { data } = await fetchActivityList({
      pageNum: 1,
      pageSize: 20,
      keyword: activityPickerKeyword.value.trim() || undefined,
    });
    activityPickerRows.value = data?.rows || [];
    if (activityId.value) {
      selectedActivityId.value = activityId.value;
    }
  } finally {
    activityPickerLoading.value = false;
  }
}

function openActivityPicker() {
  activityPickerVisible.value = true;
  loadActivityPickerRows();
}

function handleActivityRowClick(row: MarketingActivity) {
  selectedActivityId.value = row.id;
}

async function confirmActivitySelection() {
  if (!selectedActivityId.value) {
    window.$message?.warning('请先选择活动');
    return;
  }
  activityId.value = selectedActivityId.value;
  activityPickerVisible.value = false;
  await loadAll();
}

function applyActivityToForm(data: MarketingActivity) {
  Object.assign(basicForm, {
    name: data.name,
    type: data.type,
    description: data.description ?? '',
    startTime: toDatetimeLocal(data.startTime),
    endTime: toDatetimeLocal(data.endTime),
  });

  Object.assign(ruleForm, {
    failurePolicy: readString(data.rules, 'failurePolicy') ?? 'REFUND',
    commissionEnabled: readBoolean(data.rules, 'commissionEnabled'),
    commissionRate: Number(toRecord(data.rules).commissionRate ?? 0) || 0,
    leaderMode: readString(data.rules, 'leaderMode') ?? 'QUALIFIED_ONLY',
    allowQualifiedUserOpen: readBoolean(data.rules, 'allowQualifiedUserOpen'),
    allowStaffProxyOpen: readBoolean(data.rules, 'allowStaffProxyOpen'),
    ownerUserId: readString(data.triggerCondition, 'ownerUserId') ?? '',
  });
}

function runPrecheck() {
  // 方法职责：发布前仅检查页面必填项和时间窗，资格、库存和权益规则以后端预检为准。
  const issues: string[] = [];
  if (!activity.value) {
    issues.push('活动未加载');
  }
  if (activityItems.value.length === 0) {
    issues.push('未配置活动商品');
  }
  if (!basicForm.startTime || !basicForm.endTime) {
    issues.push('活动时间范围不完整');
  }
  precheckIssues.value = issues;
  precheckCheckedAt.value = new Date().toISOString();
}

async function saveActivityBase() {
  if (!activityId.value || !activity.value) return;
  if (!basicForm.name.trim()) {
    window.$message?.warning('请填写活动名称');
    return;
  }
  saving.value = true;
  try {
    // 保存基础信息时保留 rules / triggerCondition / rewards 的未知字段，只覆盖当前表单负责的规则项。
    const rules = {
      ...toRecord(activity.value.rules),
      failurePolicy: ruleForm.failurePolicy,
      commissionEnabled: ruleForm.commissionEnabled,
      commissionRate: ruleForm.commissionRate,
      leaderMode: ruleForm.leaderMode,
      allowQualifiedUserOpen: ruleForm.allowQualifiedUserOpen,
      allowStaffProxyOpen: ruleForm.allowStaffProxyOpen,
    };
    const triggerCondition = {
      ...toRecord(activity.value.triggerCondition),
      ownerUserId: ruleForm.ownerUserId || undefined,
    };
    const rewards = {
      ...toRecord(activity.value.rewards),
      commissionEnabled: ruleForm.commissionEnabled,
      commissionRate: ruleForm.commissionRate,
    };

    await fetchUpdateActivity(activityId.value, {
      name: basicForm.name,
      description: basicForm.description || undefined,
      startTime: fromDatetimeLocal(basicForm.startTime),
      endTime: fromDatetimeLocal(basicForm.endTime),
      triggerCondition,
      rules,
      rewards,
      distributionGrowth: activity.value.distributionGrowth ?? undefined,
      isEnabled: activity.value.isEnabled ?? false,
      priority: activity.value.priority ?? 0,
    });
    window.$message?.success('活动基础信息已保存');
    await loadAll();
  } finally {
    saving.value = false;
  }
}

async function publishActivity() {
  if (!activityId.value) return;
  runPrecheck();
  if (precheckIssues.value.length > 0) {
    window.$message?.warning('发布预检未通过');
    return;
  }
  await fetchPublishActivity(activityId.value);
  window.$message?.success('活动已发布');
  await loadAll();
}

async function pauseActivity() {
  if (!activityId.value) return;
  await fetchPauseActivity(activityId.value);
  window.$message?.success('活动已暂停');
  await loadAll();
}

function openCreateItem() {
  editingItemId.value = null;
  Object.assign(itemForm, {
    activityItemId: undefined,
    itemType: 'PRODUCT',
    productId: '',
    skuId: '',
    productName: '',
    skuName: '',
    originPrice: 0,
    activityPrice: 0,
    displayTag: '',
    sort: activityItems.value.length + 1,
    enabled: true,
  });
  itemDrawerVisible.value = true;
}

function openEditItem(row: MarketingActivityItem) {
  editingItemId.value = row.id;
  const config = toRecord(row.config);
  Object.assign(itemForm, {
    activityItemId: row.id,
    itemType: row.itemType,
    productId: readString(config, 'productId') ?? '',
    skuId: readString(config, 'skuId') ?? '',
    productName: readString(config, 'productName') ?? row.itemName ?? '',
    skuName: readString(config, 'skuName') ?? '',
    originPrice: Number(config.originPrice ?? 0) || 0,
    activityPrice: Number(config.activityPrice ?? 0) || 0,
    displayTag: readString(config, 'displayTag') ?? '',
    sort: row.sort,
    enabled: row.enabled,
  });
  itemDrawerVisible.value = true;
}

async function saveItem() {
  if (!activityId.value) return;
  if (!itemForm.productName.trim()) {
    window.$message?.warning('请输入商品名称');
    return;
  }
  itemSubmitting.value = true;
  try {
    // 活动商品项只保存展示价和绑定信息，真实下单价格、库存和优惠叠加以后端订单链路为准。
    const payload = {
      activityItemId: itemForm.activityItemId,
      itemType: itemForm.itemType,
      itemCode: itemForm.productId || itemForm.activityItemId,
      itemName: itemForm.productName,
      enabled: itemForm.enabled,
      sort: itemForm.sort,
      config: {
        productId: itemForm.productId,
        skuId: itemForm.skuId,
        productName: itemForm.productName,
        skuName: itemForm.skuName,
        originPrice: itemForm.originPrice,
        activityPrice: itemForm.activityPrice,
        displayTag: itemForm.displayTag,
      },
    };
    if (editingItemId.value) {
      await fetchUpdateActivityItem(activityId.value, editingItemId.value, payload);
      window.$message?.success('活动商品已更新');
    } else {
      await fetchCreateActivityItem(activityId.value, payload);
      window.$message?.success('活动商品已新增');
    }
    itemDrawerVisible.value = false;
    await loadAll();
  } finally {
    itemSubmitting.value = false;
  }
}

async function removeItem(row: MarketingActivityItem) {
  if (!activityId.value) return;
  await fetchDeleteActivityItem(activityId.value, row.id);
  window.$message?.success('活动商品已删除');
  await loadAll();
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toRecordOrNull(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(source: unknown, key: string) {
  const value = toRecord(source)[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBoolean(source: unknown, key: string) {
  const value = toRecord(source)[key];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  if (typeof value === 'number') return value === 1;
  return false;
}

function readNumeric(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toNumberRecord(input: unknown): Record<string, number> {
  const record = toRecordOrNull(input);
  if (!record) return {};

  return Object.entries(record).reduce<Record<string, number>>((acc, [key, value]) => {
    const parsed = readNumeric(value);
    if (parsed > 0) {
      acc[key] = parsed;
    }
    return acc;
  }, {});
}

function readStringArray(source: unknown, key: string) {
  const value = toRecord(source)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function formatTouchpointConfig(row: ActivityTouchpointRow) {
  const config = toRecord(row.config);
  if (row.kind === 'SHARE') {
    const channels = readStringArray(config, 'shareChannels');
    const landingPage = readString(config, 'landingPagePath');
    return [channels.join(' / '), landingPage].filter(Boolean).join(' · ') || '-';
  }

  const channels = readStringArray(config, 'channels');
  const templateCode = readString(config, 'templateCode');
  return [channels.join(' / '), templateCode].filter(Boolean).join(' · ') || '-';
}

function encodeBooleanSelect(value: boolean): BooleanSelectValue {
  return value ? 'true' : 'false';
}

function decodeBooleanSelect(value: string | number | null | undefined): boolean {
  return value === 'true';
}

function toDatetimeLocal(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
}

watch(
  () => route.query.activityId,
  (value) => {
    activityId.value = (value as string) || '';
    if (activityId.value) {
      runAsyncTask(() => loadAll());
    }
  },
);

onMounted(() => {
  if (activityId.value) {
    runAsyncTask(() => loadAll());
  }
});

function runAsyncTask(task: () => Promise<unknown>) {
  task().catch(() => undefined);
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px">
    <!-- 文案锚点：请输入门店编号 -->
    <ActivityDetailHeader
      :activity-name="activity?.name || ''"
      :activity-status="activityStatus"
      :activity-id="activityId"
      :loading="loading"
      :saving="saving"
      @update:activity-id="activityId = $event"
      @pick="openActivityPicker"
      @load="loadAll"
      @save="saveActivityBase"
      @precheck="runPrecheck"
      @publish="publishActivity"
      @pause="pauseActivity"
    />

    <NGrid x-gap="16" y-gap="16" :cols="24">
      <NGridItem :span="16">
        <ActivityBasicCard :model="basicForm" />
      </NGridItem>
      <NGridItem :span="8">
        <ActivityPublishPanel
          :status-label="activityStatus.label"
          :scene-binding-count="sceneBindings.length"
          :publish-time="formatDateTime(activity?.updateTime)"
          :precheck-checked-at="formatDateTime(precheckCheckedAt)"
          :precheck-issues="precheckIssues"
        />
      </NGridItem>
    </NGrid>

    <NCard title="玩法规则" :bordered="false" size="small">
      <NForm :model="ruleForm" label-placement="left" :label-width="128">
        <NGrid :cols="4" :x-gap="12">
          <NFormItem label="失败策略">
            <NSelect
              v-model:value="ruleForm.failurePolicy"
              :options="[
                { label: '退款', value: 'REFUND' },
                { label: '转移', value: 'TRANSFER' },
                { label: '人工处理', value: 'MANUAL' },
              ]"
            />
          </NFormItem>
          <NFormItem label="分佣开关">
            <NSelect v-model:value="commissionEnabledValue" :options="enableOptions" />
          </NFormItem>
          <NFormItem label="分佣比例">
            <NInputNumber v-model:value="ruleForm.commissionRate" :min="0" :max="1" :step="0.01" class="w-full" />
          </NFormItem>
          <NFormItem label="团长模式">
            <NSelect
              v-model:value="ruleForm.leaderMode"
              :options="[
                { label: '仅达标团长', value: 'QUALIFIED_ONLY' },
                { label: '员工优先', value: 'STAFF_PRIORITY' },
              ]"
            />
          </NFormItem>
          <NFormItem label="允许用户开团">
            <NSelect v-model:value="allowQualifiedUserOpenValue" :options="yesNoOptions" />
          </NFormItem>
          <NFormItem label="允许员工代开">
            <NSelect v-model:value="allowStaffProxyOpenValue" :options="yesNoOptions" />
          </NFormItem>
          <NFormItem label="负责人账号">
            <NInput v-model:value="ruleForm.ownerUserId" placeholder="请输入负责人账号" />
          </NFormItem>
        </NGrid>
      </NForm>
    </NCard>

    <ActivityDistributionGrowthPanel
      :distribution-growth="distributionGrowth"
      :commission-budget-snapshot="distributionBudgetSnapshot"
      :referral-rule="distributionReferralRule"
    />

    <NCard title="触达配置" :bordered="false" size="small">
      <NDataTable
        v-if="touchpointRows.length"
        :columns="touchpointColumns"
        :data="touchpointRows"
        :pagination="false"
        :scroll-x="900"
        :row-key="(row) => row.id"
      />
      <NEmpty v-else description="当前活动未配置消息通知或分享入口" size="small" />
    </NCard>

    <ActivityItemCard
      :items="activityItems"
      :loading="loading"
      :columns="itemColumns"
      @create="openCreateItem"
      @refresh="loadAll"
    />
    <ActivityItemDrawer
      :show="itemDrawerVisible"
      :editing="Boolean(editingItemId)"
      :submitting="itemSubmitting"
      :model="itemForm"
      @update:show="itemDrawerVisible = $event"
      @save="saveItem"
    />

    <NModal v-model:show="activityPickerVisible" preset="card" title="选择活动" class="w-1100px">
      <div class="mb-12px flex items-center justify-between gap-12px">
        <NSpace>
          <NInput
            v-model:value="activityPickerKeyword"
            placeholder="按活动名称检索"
            clearable
            class="w-260px"
            @keyup.enter="loadActivityPickerRows"
          />
          <NButton type="primary" :loading="activityPickerLoading" @click="loadActivityPickerRows">查询</NButton>
        </NSpace>
        <div class="text-12px text-gray-500">请选择活动后自动加载详情。</div>
      </div>
      <NDataTable
        :loading="activityPickerLoading"
        :columns="activityPickerColumns"
        :data="activityPickerRows"
        :row-key="(row) => row.id"
        :row-props="
          (row) => ({
            onClick: () => handleActivityRowClick(row),
            style:
              row.id === selectedActivityId ? 'cursor:pointer;background:rgba(24,160,88,0.08);' : 'cursor:pointer;',
          })
        "
        :max-height="460"
        :scroll-x="900"
      />
      <template #footer>
        <div class="flex items-center justify-between">
          <div class="text-12px text-gray-500">
            已选活动：
            <span class="text-[#111827] font-medium">{{ selectedActivityId || '未选择' }}</span>
          </div>
          <NSpace>
            <NButton @click="activityPickerVisible = false">取消</NButton>
            <NButton type="primary" @click="confirmActivitySelection">确认选择</NButton>
          </NSpace>
        </div>
      </template>
    </NModal>
  </div>
</template>
