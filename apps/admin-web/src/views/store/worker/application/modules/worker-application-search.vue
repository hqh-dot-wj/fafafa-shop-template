<script setup lang="ts">
import { computed } from 'vue';
import type { SelectOption } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';

defineOptions({
  name: 'WorkerApplicationSearch',
});

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const model = defineModel<Api.Store.WorkerApplicationSearchParams>('model', { required: true });

const { formRef, validate, restoreValidation } = useNaiveForm();

const statusOptions: SelectOption[] = [
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已拒绝', value: 'REJECTED' },
];

const sourceOptions: SelectOption[] = [
  { label: '小程序申请', value: 'MINIAPP' },
  { label: '后台代提交', value: 'BACKEND' },
];

const rules = computed(() => ({
  keyword: [],
  phone: [],
  applicationStatus: [],
  applicationSource: [],
}));

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
    <NCollapse :default-expanded-names="['worker-application-search']">
      <NCollapseItem title="搜索" name="worker-application-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="80">
          <NGrid responsive="screen" item-responsive>
            <!-- 申请列表保留审核状态筛选，正式 worker 列表不使用该字段。 -->
            <NFormItemGi span="24 s:12 m:6" label="关键词" path="keyword" class="pr-24px">
              <NInput v-model:value="model.keyword" clearable placeholder="姓名 / 手机号" @keyup.enter="search" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="手机号" path="phone" class="pr-24px">
              <NInput v-model:value="model.phone" clearable placeholder="请输入手机号" @keyup.enter="search" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="申请状态" path="applicationStatus" class="pr-24px">
              <NSelect v-model:value="model.applicationStatus" :options="statusOptions" clearable placeholder="全部" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="申请来源" path="applicationSource" class="pr-24px">
              <NSelect v-model:value="model.applicationSource" :options="sourceOptions" clearable placeholder="全部" />
            </NFormItemGi>
            <NGi span="24 s:24 m:6" offset="0 m:18" class="flex items-end justify-end pr-24px">
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
