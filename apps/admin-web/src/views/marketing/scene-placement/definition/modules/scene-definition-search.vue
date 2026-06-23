<script setup lang="ts">
import { computed } from 'vue';
import type { SelectOption } from 'naive-ui';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItemGi, NGrid, NInput, NSelect, NSpace } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({ name: 'SceneDefinitionSearch' });

interface SceneDefinitionSearchModel {
  sceneName: string;
  sceneCode: string;
  sceneType: string | null;
  status: string | null;
  activityType: string | null;
}

const props = defineProps<{
  model: SceneDefinitionSearchModel;
  sceneTypeOptions: SelectOption[];
  statusOptions: SelectOption[];
}>();

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = computed(() => props.model);

type RuleKey = keyof SceneDefinitionSearchModel;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  sceneName: [],
  sceneCode: [],
  sceneType: [],
  status: [],
  activityType: [],
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
  <!-- 场景定义搜索区：组合前端本地过滤和后端分页查询条件。 -->
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['scene-definition-search']">
      <NCollapseItem :title="$t('common.search')" name="scene-definition-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="112">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="场景名称" path="sceneName" class="min-w-0 pr-24px">
              <NInput v-model:value="model.sceneName" clearable class="max-w-full w-full" placeholder="场景名称" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="场景编码" path="sceneCode" class="min-w-0 pr-24px">
              <NInput v-model:value="model.sceneCode" clearable class="max-w-full w-full" placeholder="场景编码" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="场景类型" path="sceneType" class="min-w-0 pr-24px">
              <NSelect
                v-model:value="model.sceneType"
                clearable
                class="max-w-full w-full"
                :options="sceneTypeOptions"
                placeholder="请选择场景类型"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="活动类型" path="activityType" class="min-w-0 pr-24px">
              <NInput
                v-model:value="model.activityType"
                clearable
                class="max-w-full w-full"
                placeholder="如 COURSE_GROUP"
                @keyup.enter="search"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="状态" path="status" class="min-w-0 pr-24px">
              <NSelect
                v-model:value="model.status"
                clearable
                class="max-w-full w-full"
                :options="statusOptions"
                placeholder="请选择状态"
              />
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

<style scoped></style>
