<script setup lang="ts">
import { computed } from 'vue';
import type { SelectOption } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';

defineOptions({
  name: 'WorkerProfileSearch',
});

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const model = defineModel<Api.Store.WorkerProfileSearchParams>('model', { required: true });

const { formRef, validate, restoreValidation } = useNaiveForm();

const statusOptions: SelectOption[] = [
  { label: '接单中', value: 'WORKING' },
  { label: '休息中', value: 'RESTING' },
  { label: '已停用', value: 'DISABLED' },
];

const onlineOptions: SelectOption[] = [
  { label: '在线', value: 'true' },
  { label: '离线', value: 'false' },
];

const sourceOptions: SelectOption[] = [
  { label: '后台添加', value: 'BACKEND' },
  { label: '申请入驻', value: 'APPLICATION' },
];

const rules = computed(() => ({
  keyword: [],
  phone: [],
  status: [],
  isOnline: [],
  source: [],
}));

const onlineValue = computed<string | null>({
  get: () => {
    if (typeof model.value.isOnline !== 'boolean') return null;
    return model.value.isOnline ? 'true' : 'false';
  },
  set: (value) => {
    model.value.isOnline = value === null ? undefined : value === 'true';
  },
});

async function reset() {
  await restoreValidation();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['worker-profile-search']">
      <NCollapseItem title="搜索" name="worker-profile-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="80">
          <NGrid responsive="screen" item-responsive>
            <!-- 工作者资料只筛正式资料，不提供审核状态筛选。 -->
            <NFormItemGi span="24 s:12 m:6" label="关键词" path="keyword" class="pr-24px">
              <NInput
                v-model:value="model.keyword"
                clearable
                placeholder="姓名 / 昵称 / 手机号"
                @keyup.enter="search"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="手机号" path="phone" class="pr-24px">
              <NInput v-model:value="model.phone" clearable placeholder="请输入手机号" @keyup.enter="search" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="接单状态" path="status" class="pr-24px">
              <NSelect v-model:value="model.status" :options="statusOptions" clearable placeholder="全部" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="在线状态" path="isOnline" class="pr-24px">
              <NSelect v-model:value="onlineValue" :options="onlineOptions" clearable placeholder="全部" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="来源" path="source" class="pr-24px">
              <NSelect v-model:value="model.source" :options="sourceOptions" clearable placeholder="全部" />
            </NFormItemGi>
            <NGi span="24 s:24 m:6" offset="0 m:12" class="flex items-end justify-end pr-24px">
              <NSpace :wrap="false">
                <NButton @click="reset">
                  <template #icon>
                    <icon-ic-round-refresh class="text-icon" />
                  </template>
                  重置
                </NButton>
                <NButton type="primary" ghost @click="search">
                  <template #icon>
                    <icon-ic-round-search class="text-icon" />
                  </template>
                  搜索
                </NButton>
              </NSpace>
            </NGi>
          </NGrid>
        </NForm>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>
