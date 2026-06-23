<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItemGi, NGrid, NInput, NSelect, NSpace } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({ name: 'CourseGroupFailureSearch' });

interface FailureSearchModel {
  teamId: string;
  productName: string;
  leaderName: string;
  status: string;
}

const props = defineProps<{
  model: FailureSearchModel;
  statusOptions: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = computed(() => props.model);

type RuleKey = keyof FailureSearchModel;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  teamId: [],
  productName: [],
  leaderName: [],
  status: [],
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
  <!-- 失败团搜索区：按团编号、商品、团长和状态筛选拼课失败记录。 -->
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['course-group-failure-search']">
      <NCollapseItem :title="$t('common.search')" name="course-group-failure-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="96">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="团编号" path="teamId" class="min-w-0 pr-24px">
              <NInput v-model:value="model.teamId" clearable class="max-w-full w-full" placeholder="团编号" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="商品名称" path="productName" class="min-w-0 pr-24px">
              <NInput v-model:value="model.productName" clearable class="max-w-full w-full" placeholder="商品名称" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="团长" path="leaderName" class="min-w-0 pr-24px">
              <NInput v-model:value="model.leaderName" clearable class="max-w-full w-full" placeholder="团长昵称" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="状态" path="status" class="min-w-0 pr-24px">
              <NSelect v-model:value="model.status" class="max-w-full w-full" :options="statusOptions" />
            </NFormItemGi>
            <NFormItemGi span="24">
              <NSpace class="w-full" justify="end">
                <NButton @click="reset">
                  <template #icon>
                    <icon-ic-round-refresh class="text-icon" />
                  </template>
                  {{ $t('common.reset') }}
                </NButton>
                <NButton type="primary" ghost @click="search">
                  <template #icon>
                    <icon-ic-round-search class="text-icon" />
                  </template>
                  {{ $t('common.search') }}
                </NButton>
              </NSpace>
            </NFormItemGi>
          </NGrid>
        </NForm>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>
