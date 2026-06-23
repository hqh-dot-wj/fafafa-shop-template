<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { DataTableColumns } from 'naive-ui';
import { NButton, NInputNumber, NSpace, NSwitch, NTag } from 'naive-ui';
import {
  fetchDeletePriorityRule,
  fetchInitDefaultPriorityRules,
  fetchPriorityRules,
  fetchUpsertPriorityRule,
} from '@/service/api/marketing/resolution';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';

defineOptions({ name: 'ResolutionPriority' });

const POLICY_ROUTE = 'marketing_policy';
const STANDALONE_ROUTE = 'marketing_resolution_priority';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const data = ref<Api.Marketing.PriorityRule[]>([]);
const modalVisible = ref(false);
const submitting = ref(false);
const form = reactive({
  id: '' as string | undefined,
  activityType: '',
  priority: 100,
  aggregateEnabled: true,
  zoneEnabled: false,
});

const columns: DataTableColumns<Api.Marketing.PriorityRule> = [
  {
    key: 'activityType',
    title: '活动类型',
    align: 'center',
    minWidth: 160,
    render: (row) =>
      h(NTag, { type: 'info', bordered: false, class: 'font-mono' }, { default: () => row.activityType }),
  },
  { key: 'priority', title: '优先级', align: 'center', width: 100 },
  {
    key: 'aggregateEnabled',
    title: '聚合裁决',
    align: 'center',
    width: 110,
    render: (row) => (row.aggregateEnabled ? '是' : '否'),
  },
  {
    key: 'zoneEnabled',
    title: '专区',
    align: 'center',
    width: 90,
    render: (row) => (row.zoneEnabled ? '是' : '否'),
  },
  {
    key: 'operate',
    title: $t('common.operate'),
    align: 'center',
    width: 140,
    render: (row) =>
      h(
        NSpace,
        { justify: 'center' },
        {
          default: () => [
            h(ButtonIcon, {
              type: 'primary',
              class: 'text-primary',
              tooltipContent: $t('common.edit'),
              icon: 'material-symbols:edit-square-outline',
              onClick: () => openEdit(row),
            }),
            h(ButtonIcon, {
              type: 'error',
              class: 'text-error',
              tooltipContent: $t('common.delete'),
              icon: 'material-symbols:delete-outline',
              onClick: () => handleDelete(row),
            }),
          ],
        },
      ),
  },
];

function resetForm() {
  form.id = undefined;
  form.activityType = '';
  form.priority = 100;
  form.aggregateEnabled = true;
  form.zoneEnabled = false;
}

function openCreate() {
  resetForm();
  modalVisible.value = true;
}

function openEdit(row: Api.Marketing.PriorityRule) {
  form.id = row.id;
  form.activityType = row.activityType;
  form.priority = row.priority;
  form.aggregateEnabled = row.aggregateEnabled;
  form.zoneEnabled = row.zoneEnabled;
  modalVisible.value = true;
}

async function loadList() {
  loading.value = true;
  try {
    const { data: list } = await fetchPriorityRules();
    data.value = Array.isArray(list) ? list : [];
  } finally {
    loading.value = false;
  }
}

function handleDelete(row: Api.Marketing.PriorityRule) {
  window.$dialog?.warning({
    title: $t('common.tip'),
    content: $t('common.confirmDelete'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      await fetchDeletePriorityRule(row.id);
      window.$message?.success($t('common.deleteSuccess'));
      await loadList();
    },
  });
}

async function handleInitDefaults() {
  window.$dialog?.warning({
    title: $t('common.tip'),
    content: '将初始化默认优先级规则，是否继续？',
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      await fetchInitDefaultPriorityRules();
      window.$message?.success('已初始化');
      await loadList();
    },
  });
}

async function handleSave() {
  if (!form.activityType.trim()) {
    window.$message?.warning('请填写活动类型');
    return;
  }
  submitting.value = true;
  try {
    await fetchUpsertPriorityRule({
      activityType: form.activityType.trim(),
      priority: form.priority,
      aggregateEnabled: form.aggregateEnabled,
      zoneEnabled: form.zoneEnabled,
    });
    window.$message?.success('已保存');
    modalVisible.value = false;
    await loadList();
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  if (route.name === STANDALONE_ROUTE) {
    router.replace({
      name: POLICY_ROUTE,
      query: { ...route.query, tab: 'priority' },
    });
    return;
  }
  loadList();
});
</script>

<template>
  <!-- 独立路由迁移区：旧入口自动跳转到策略中心 tab。 -->
  <div v-if="route.name === STANDALONE_ROUTE" class="p-16px text-center text-14px text-gray-500">
    正在跳转到策略中心...
  </div>
  <!-- 优先级规则区：维护活动类型的裁决优先级和聚合开关。 -->
  <div v-else class="flex-col-stretch gap-12px">
    <NSpace>
      <NButton type="primary" size="small" @click="openCreate">新增规则</NButton>
      <NButton size="small" @click="handleInitDefaults">初始化默认规则</NButton>
    </NSpace>
    <NDataTable :columns="columns" :data="data" :loading="loading" :scroll-x="720" />

    <!-- 优先级编辑弹窗：保存单个活动类型的裁决排序配置。 -->
    <NModal v-model:show="modalVisible" preset="card" title="优先级规则" class="w-520px">
      <NForm :model="form" label-placement="left" :label-width="120">
        <NFormItem label="活动类型">
          <NInput v-model:value="form.activityType" placeholder="如 FLASH_SALE" :disabled="Boolean(form.id)" />
        </NFormItem>
        <NFormItem label="优先级">
          <NInputNumber v-model:value="form.priority" :min="0" :max="999" class="w-full" />
        </NFormItem>
        <NFormItem label="参与聚合裁决">
          <NSwitch v-model:value="form.aggregateEnabled" />
        </NFormItem>
        <NFormItem label="启用专区">
          <NSwitch v-model:value="form.zoneEnabled" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSave">保存</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
