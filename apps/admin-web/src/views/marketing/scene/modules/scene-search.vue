<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItemGi, NGrid, NInput, NSelect, NSpace } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({ name: 'SceneSearch' });

interface Emits {
  (e: 'search'): void;
  (e: 'reset'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Marketing.SceneSearchParams>('model', { required: true });

type RuleKey = Extract<keyof Api.Marketing.SceneSearchParams, 'sceneCode' | 'status'>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  sceneCode: [],
  status: [],
}));

// quality-gate allow-semantic-options
const statusOptions = [
  { label: '启用', value: 'ACTIVE' },
  { label: '停用', value: 'INACTIVE' },
  { label: '草稿', value: 'DRAFT' },
];

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
  <!-- 场景搜索区：按场景编码和发布状态筛选场景配置。 -->
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['scene-search']">
      <NCollapseItem :title="$t('common.search')" name="scene-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="104">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="场景编码" path="sceneCode" class="pr-24px">
              <NInput v-model:value="model.sceneCode" clearable placeholder="场景编码" @keyup.enter="search" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="状态" path="status" class="pr-24px">
              <NSelect v-model:value="model.status" :options="statusOptions" clearable placeholder="请选择状态" />
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
