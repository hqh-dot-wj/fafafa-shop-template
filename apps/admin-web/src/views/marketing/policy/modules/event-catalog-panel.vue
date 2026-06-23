<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import type { DataTableColumns, SelectOption } from 'naive-ui';
import { NButton, NTag } from 'naive-ui';
import {
  type MarketingEventCatalogItem,
  type MarketingEventCatalogQuery,
  type MarketingEventCatalogSummary,
  fetchMarketingEventCatalog,
  fetchMarketingEventCatalogSummary,
} from '@/service/api/marketing/event-catalog';
import ButtonIcon from '@/components/custom/button-icon.vue';

defineOptions({ name: 'MarketingEventCatalogPanel' });

type EventCategory = MarketingEventCatalogItem['category'];
type EventStatus = MarketingEventCatalogItem['status'];
type EventPrivacyLevel = MarketingEventCatalogItem['privacyLevel'];
type EventUsableScope = MarketingEventCatalogItem['usableScopes'][number];
type FilterBoolean = '' | 'true' | 'false';
type TagType = 'default' | 'info' | 'success' | 'warning' | 'error';

type LabelMeta = {
  label: string;
  type?: TagType;
};

type EventCatalogFilters = {
  category: '' | EventCategory;
  usableScope: '' | EventUsableScope;
  status: '' | EventStatus;
  privacyLevel: '' | EventPrivacyLevel;
  ruleTriggerable: FilterBoolean;
  keyword: string;
};

const categoryMeta: Record<EventCategory, LabelMeta> = {
  ORDER: { label: '订单', type: 'info' },
  COUPON: { label: '优惠券', type: 'success' },
  POINTS: { label: '积分', type: 'warning' },
  PLAY: { label: '玩法', type: 'error' },
  CONFIG: { label: '配置', type: 'default' },
};

const usableScopeMeta: Record<EventUsableScope, LabelMeta> = {
  POINTS: { label: '积分', type: 'warning' },
  COUPON: { label: '优惠券', type: 'success' },
  TASK: { label: '任务', type: 'info' },
  TOUCHPOINT: { label: '触点', type: 'info' },
  RISK: { label: '风控', type: 'error' },
  CACHE: { label: '缓存', type: 'default' },
  STAT: { label: '统计', type: 'default' },
  AUDIT: { label: '审计', type: 'default' },
};

const statusMeta: Record<EventStatus, LabelMeta> = {
  ACTIVE: { label: '启用', type: 'success' },
  DRAFT: { label: '草稿', type: 'warning' },
  DEPRECATED: { label: '废弃', type: 'default' },
};

const privacyMeta: Record<EventPrivacyLevel, LabelMeta> = {
  LOW: { label: '低', type: 'default' },
  MEMBER: { label: '会员', type: 'info' },
  ASSET: { label: '资产', type: 'warning' },
};

const booleanOptions: SelectOption[] = [
  { label: '全部', value: '' },
  { label: '是', value: 'true' },
  { label: '否', value: 'false' },
];

const loading = ref(false);
const summaryLoading = ref(false);
const rows = ref<MarketingEventCatalogItem[]>([]);
const summary = ref<MarketingEventCatalogSummary | null>(null);
const detailVisible = ref(false);
const detailRow = ref<MarketingEventCatalogItem | null>(null);

const filters = reactive<EventCatalogFilters>({
  category: '',
  usableScope: '',
  status: 'ACTIVE',
  privacyLevel: '',
  ruleTriggerable: '',
  keyword: '',
});

const categoryOptions = computed(() => buildBucketOptions(summary.value?.byCategory ?? [], categoryMeta));
const usableScopeOptions = computed(() => buildBucketOptions(summary.value?.byUsableScope ?? [], usableScopeMeta));
const statusOptions = computed(() => buildBucketOptions(summary.value?.byStatus ?? [], statusMeta));
const privacyOptions = computed(() => buildBucketOptions(summary.value?.byPrivacyLevel ?? [], privacyMeta));

const summaryItems = computed(() => [
  { label: '事件总数', value: summary.value?.total ?? 0 },
  { label: '启用事件', value: summary.value?.activeCount ?? 0 },
  { label: '规则可触发', value: summary.value?.ruleTriggerableCount ?? 0 },
  { label: '可重放', value: summary.value?.replayableCount ?? 0 },
  { label: '租户内事件', value: summary.value?.tenantScopedCount ?? 0 },
  { label: '最新 Schema', value: summary.value?.latestPayloadSchemaVersion ?? '-' },
]);

const columns = computed<DataTableColumns<MarketingEventCatalogItem>>(() => [
  {
    key: 'eventType',
    title: '事件编码',
    minWidth: 210,
    ellipsis: { tooltip: true },
    render: (row) =>
      h(NTag, { type: 'info', size: 'small', bordered: false, class: 'font-mono' }, { default: () => row.eventType }),
  },
  { key: 'displayName', title: '事件名称', minWidth: 150, ellipsis: { tooltip: true } },
  {
    key: 'category',
    title: '分类',
    width: 100,
    render: (row) => renderMetaTag(row.category, categoryMeta),
  },
  {
    key: 'usableScopes',
    title: '可用范围',
    minWidth: 220,
    render: (row) => h('div', { class: 'flex flex-wrap justify-center gap-6px' }, row.usableScopes.map(renderScopeTag)),
  },
  { key: 'sourceModule', title: '来源模块', minWidth: 150, ellipsis: { tooltip: true } },
  {
    key: 'ruleTriggerable',
    title: '规则触发',
    width: 100,
    render: (row) => renderBooleanTag(row.ruleTriggerable),
  },
  {
    key: 'replayable',
    title: '可重放',
    width: 90,
    render: (row) => renderBooleanTag(row.replayable),
  },
  {
    key: 'privacyLevel',
    title: '隐私级别',
    width: 110,
    render: (row) => renderMetaTag(row.privacyLevel, privacyMeta),
  },
  {
    key: 'status',
    title: '状态',
    width: 90,
    render: (row) => renderMetaTag(row.status, statusMeta),
  },
  {
    key: 'operate',
    title: '操作',
    width: 90,
    render: (row) =>
      h(ButtonIcon, {
        type: 'default',
        class: 'text-primary',
        tooltipContent: '详情',
        icon: 'material-symbols:info-outline',
        onClick: () => openDetail(row),
      }),
  },
]);

function hasOwnKey<T extends string>(map: Record<T, LabelMeta>, value: string): value is T {
  return Object.hasOwn(map, value);
}

function buildBucketOptions<T extends string>(
  buckets: MarketingEventCatalogSummary['byCategory'],
  metaMap: Record<T, LabelMeta>,
): SelectOption[] {
  const seen = new Set<string>();
  const options: SelectOption[] = [{ label: '全部', value: '' }];

  for (const bucket of buckets) {
    if (hasOwnKey(metaMap, bucket.value)) {
      seen.add(bucket.value);
      options.push({ label: `${metaMap[bucket.value].label}（${bucket.count}）`, value: bucket.value });
    }
  }

  for (const key of Object.keys(metaMap) as T[]) {
    if (!seen.has(key)) {
      options.push({ label: metaMap[key].label, value: key });
    }
  }

  return options;
}

function renderMetaTag<T extends string>(value: T, metaMap: Record<T, LabelMeta>) {
  const meta = metaMap[value] ?? { label: value, type: 'default' as const };

  return h(NTag, { type: meta.type ?? 'default', size: 'small', bordered: false }, { default: () => meta.label });
}

function renderScopeTag(scope: EventUsableScope) {
  return renderMetaTag(scope, usableScopeMeta);
}

function renderBooleanTag(value: boolean) {
  return h(
    NTag,
    { type: value ? 'success' : 'default', size: 'small', bordered: false },
    { default: () => (value ? '是' : '否') },
  );
}

function buildQuery(): MarketingEventCatalogQuery {
  const query: MarketingEventCatalogQuery = {};

  if (filters.category) query.category = filters.category;
  if (filters.usableScope) query.usableScope = filters.usableScope;
  if (filters.status) query.status = filters.status;
  if (filters.privacyLevel) query.privacyLevel = filters.privacyLevel;
  if (filters.ruleTriggerable) query.ruleTriggerable = filters.ruleTriggerable === 'true';
  if (filters.keyword.trim()) query.keyword = filters.keyword.trim();

  return query;
}

async function loadSummary() {
  summaryLoading.value = true;
  try {
    summary.value = await fetchMarketingEventCatalogSummary();
  } finally {
    summaryLoading.value = false;
  }
}

async function loadCatalog() {
  loading.value = true;
  try {
    rows.value = await fetchMarketingEventCatalog(buildQuery());
  } finally {
    loading.value = false;
  }
}

async function refreshAll() {
  await Promise.all([loadSummary(), loadCatalog()]);
}

function resetFilters() {
  Object.assign(filters, {
    category: '',
    usableScope: '',
    status: 'ACTIVE',
    privacyLevel: '',
    ruleTriggerable: '',
    keyword: '',
  });
  loadCatalog();
}

function openDetail(row: MarketingEventCatalogItem) {
  detailRow.value = row;
  detailVisible.value = true;
}

onMounted(() => {
  refreshAll();
});
</script>

<template>
  <div class="min-h-0 flex flex-col gap-16px">
    <!-- 汇总指标区：只展示事件目录快照，不承担运营配置入口。 -->
    <div class="grid grid-cols-2 gap-12px md:grid-cols-3 xl:grid-cols-6">
      <div
        v-for="item in summaryItems"
        :key="item.label"
        class="border border-gray-200 rounded-6px bg-white px-12px py-10px"
      >
        <div class="text-12px text-gray-500">{{ item.label }}</div>
        <div class="mt-4px text-20px font-semibold">{{ item.value }}</div>
      </div>
    </div>

    <!-- 筛选区：空值在提交前转成 undefined，避免把 UI 的“全部”语义传给后端。 -->
    <NForm :model="filters" label-placement="left" :label-width="78">
      <NGrid responsive="screen" item-responsive :x-gap="12" :y-gap="8">
        <NFormItemGi span="24 s:12 m:6" label="分类">
          <NSelect v-model:value="filters.category" :options="categoryOptions" :loading="summaryLoading" />
        </NFormItemGi>
        <NFormItemGi span="24 s:12 m:6" label="可用范围">
          <NSelect v-model:value="filters.usableScope" :options="usableScopeOptions" :loading="summaryLoading" />
        </NFormItemGi>
        <NFormItemGi span="24 s:12 m:6" label="状态">
          <NSelect v-model:value="filters.status" :options="statusOptions" :loading="summaryLoading" />
        </NFormItemGi>
        <NFormItemGi span="24 s:12 m:6" label="隐私级别">
          <NSelect v-model:value="filters.privacyLevel" :options="privacyOptions" :loading="summaryLoading" />
        </NFormItemGi>
        <NFormItemGi span="24 s:12 m:6" label="规则触发">
          <NSelect v-model:value="filters.ruleTriggerable" :options="booleanOptions" />
        </NFormItemGi>
        <NFormItemGi span="24 s:12 m:10" label="关键词">
          <NInput v-model:value="filters.keyword" clearable placeholder="事件编码 / 名称 / 来源模块 / 消费者" />
        </NFormItemGi>
        <NFormItemGi span="24 s:24 m:8">
          <NSpace class="w-full" justify="end">
            <NButton type="primary" ghost :loading="loading" @click="loadCatalog">
              <template #icon>
                <icon-ic-round-search class="text-icon" />
              </template>
              查询
            </NButton>
            <NButton ghost :disabled="loading" @click="resetFilters">
              <template #icon>
                <icon-ic-round-refresh class="text-icon" />
              </template>
              重置
            </NButton>
            <NButton quaternary :loading="summaryLoading || loading" @click="refreshAll">
              <template #icon>
                <icon-material-symbols-sync-rounded class="text-icon" />
              </template>
              刷新
            </NButton>
          </NSpace>
        </NFormItemGi>
      </NGrid>
    </NForm>

    <!-- 列表区：事件编码仍展示原始 code，状态、分类、范围统一转换成运营可读中文。 -->
    <NDataTable
      :columns="columns"
      :data="rows"
      :loading="loading"
      :pagination="{ pageSize: 20, showSizePicker: true, pageSizes: [20, 50, 100] }"
      :row-key="(row) => row.eventType"
      :scroll-x="1320"
      remote
      size="small"
    >
      <template #empty>
        <div class="py-24px text-14px text-gray-500">暂无事件目录</div>
      </template>
    </NDataTable>

    <!-- 详情弹窗：只读展示事件边界，避免在目录视图里引入规则编辑职责。 -->
    <NModal v-model:show="detailVisible" preset="card" title="事件详情（只读）" class="w-760px">
      <NDescriptions v-if="detailRow" :column="2" bordered label-placement="left" size="small">
        <NDescriptionsItem label="事件编码">{{ detailRow.eventType }}</NDescriptionsItem>
        <NDescriptionsItem label="事件名称">{{ detailRow.displayName }}</NDescriptionsItem>
        <NDescriptionsItem label="分类">{{ categoryMeta[detailRow.category].label }}</NDescriptionsItem>
        <NDescriptionsItem label="来源模块">{{ detailRow.sourceModule }}</NDescriptionsItem>
        <NDescriptionsItem label="触发时机">{{ detailRow.triggerTiming }}</NDescriptionsItem>
        <NDescriptionsItem label="Schema 版本">{{ detailRow.payloadSchemaVersion }}</NDescriptionsItem>
        <NDescriptionsItem label="幂等键">{{ detailRow.idempotencyKey }}</NDescriptionsItem>
        <NDescriptionsItem label="顺序键">{{ detailRow.orderingKey }}</NDescriptionsItem>
        <NDescriptionsItem label="租户内事件">{{ detailRow.tenantScoped ? '是' : '否' }}</NDescriptionsItem>
        <NDescriptionsItem label="规则可触发">{{ detailRow.ruleTriggerable ? '是' : '否' }}</NDescriptionsItem>
        <NDescriptionsItem label="可重放">{{ detailRow.replayable ? '是' : '否' }}</NDescriptionsItem>
        <NDescriptionsItem label="隐私级别">{{ privacyMeta[detailRow.privacyLevel].label }}</NDescriptionsItem>
        <NDescriptionsItem label="可用范围" :span="2">
          <NSpace :size="6">
            <NTag
              v-for="scope in detailRow.usableScopes"
              :key="scope"
              :type="usableScopeMeta[scope].type"
              size="small"
              :bordered="false"
            >
              {{ usableScopeMeta[scope].label }}
            </NTag>
          </NSpace>
        </NDescriptionsItem>
        <NDescriptionsItem label="消费者" :span="2">
          <NSpace v-if="detailRow.consumers.length" :size="6">
            <NTag v-for="consumer in detailRow.consumers" :key="consumer" size="small" :bordered="false">
              {{ consumer }}
            </NTag>
          </NSpace>
          <span v-else>-</span>
        </NDescriptionsItem>
      </NDescriptions>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="detailVisible = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped></style>
